/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SoundName } from './soundAssets';

export class AudioManager {
  private static instance: AudioManager | null = null;

  // Web Audio Context & Nodes
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  // Volumes (0 - 100)
  private bgmVolume = 80;
  private sfxVolume = 80;
  private isMuted = false;

  // Buffer Cache for fetched MP3s
  private buffers: Map<string, AudioBuffer> = new Map();
  private activeSources: Map<string, AudioBufferSourceNode[]> = new Map();

  // Active loop generators & active synths
  private currentBgmName: SoundName | null = null;
  private currentBgmSource: AudioBufferSourceNode | null = null;
  private currentBgmGain: GainNode | null = null;
  private bgmSequenceInterval: number | null = null; // for synthesized BGM fallback

  // Engine sound synthesis nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private isEngineRunning = false;

  // Sound play limiters to prevent overlapping noise
  private lastPlayTimes: Map<string, number> = new Map();
  private static COOLDOWN_MS = 100;
  private activeCrashCount = 0;

  private constructor() {
    // 延遲初始化，等使用者第一次點擊時啟動 AudioContext
    this.loadSettings();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * 初始化 AudioContext（瀏覽器安全限制下必須由使用者操作觸發）
   */
  public initContext(): void {
    if (this.ctx) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('Web Audio API is not supported in this browser.');
        return;
      }

      this.ctx = new AudioCtxClass();
      
      // 建立主要音量控制鏈
      this.masterGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      // 連接關係: Source -> BGM/SFX Gain -> Master Gain -> Destination
      this.bgmGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // 設定初始音量
      this.applyVolumes();
      
      // 預載實體音效（可選），就算失敗也會在播放時使用合成器
      this.preloadAssets();
    } catch (e) {
      console.error('Failed to initialize AudioContext', e);
    }
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem('tax_racer_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed.bgmVolume === 'number') this.bgmVolume = parsed.bgmVolume;
        if (typeof parsed.sfxVolume === 'number') this.sfxVolume = parsed.sfxVolume;
      }
    } catch (e) {
      console.warn('Failed to load audio settings', e);
    }
  }

  private saveSettings(): void {
    try {
      const stored = localStorage.getItem('tax_racer_settings');
      const settings = stored ? JSON.parse(stored) : {};
      settings.bgmVolume = this.bgmVolume;
      settings.sfxVolume = this.sfxVolume;
      localStorage.setItem('tax_racer_settings', JSON.stringify(settings));
    } catch (e) {}
  }

  private applyVolumes(): void {
    if (!this.masterGain || !this.bgmGain || !this.sfxGain) return;

    const masterTarget = this.isMuted ? 0 : 1;
    const bgmTarget = this.bgmVolume / 100;
    const sfxTarget = this.sfxVolume / 100;

    // 平滑調整音量避免爆音
    const now = this.ctx?.currentTime || 0;
    this.masterGain.gain.setValueAtTime(masterTarget, now);
    this.bgmGain.gain.linearRampToValueAtTime(bgmTarget, now + 0.1);
    this.sfxGain.gain.linearRampToValueAtTime(sfxTarget, now + 0.1);
  }

  /**
   * 預先非同步加載 MP3 音效，快取到 buffers 中。
   */
  private async preloadAssets(): Promise<void> {
    // 預先載入預設的賽道背景音樂（由使用者上傳的 背景音樂.mp3）
    try {
      if (this.ctx && !this.buffers.has('bgm_playing')) {
        const response = await fetch('/sounds/背景音樂.mp3');
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
          this.buffers.set('bgm_playing', audioBuffer);
          console.log('Successfully preloaded custom background music: /sounds/背景音樂.mp3');
        }
      }
    } catch (e) {
      console.warn('Failed to pre-load background music, will fallback to synthesized BGM:', e);
    }
  }

  /**
   * 主要播放方法：如果有 buffer 快取就播，否則使用 Web Audio 合成器。
   */
  public play(soundName: SoundName, options?: { volume?: number; pitch?: number }): void {
    this.initContext();
    if (!this.ctx) return;

    // 恢復受瀏覽器政策自動暫停的 AudioContext
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = Date.now();
    const lastPlay = this.lastPlayTimes.get(soundName) || 0;
    if (now - lastPlay < AudioManager.COOLDOWN_MS) {
      return; // 防止疊音
    }
    this.lastPlayTimes.set(soundName, now);

    // 處理特定的 Collision 限制
    if (soundName === 'crash') {
      if (this.activeCrashCount >= 3) return; // 限制最多3個同時播放
      this.activeCrashCount++;
      setTimeout(() => {
        this.activeCrashCount = Math.max(0, this.activeCrashCount - 1);
      }, 500);
    }

    const buffer = this.buffers.get(soundName);
    if (buffer) {
      // 1. 播放 AudioBuffer
      this.playBuffer(soundName, buffer, options);
    } else {
      // 2. 完美 Fallback：使用高品質 Web Audio 合成器產生動態 SFX
      this.playSynthSFX(soundName, options);
    }
  }

  private playBuffer(soundName: string, buffer: AudioBuffer, options?: { volume?: number; pitch?: number }): void {
    if (!this.ctx || !this.sfxGain) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.ctx.createGain();
    const customVol = options?.volume !== undefined ? options.volume : 1;
    gainNode.gain.setValueAtTime(customVol, this.ctx.currentTime);

    const pitch = options?.pitch !== undefined ? options.pitch : 1;
    source.playbackRate.setValueAtTime(pitch, this.ctx.currentTime);

    // 連接 nodes
    source.connect(gainNode);
    gainNode.connect(this.sfxGain);

    source.start(0);

    // 加入 activeSources 管理，以便隨時停止
    if (!this.activeSources.has(soundName)) {
      this.activeSources.set(soundName, []);
    }
    this.activeSources.get(soundName)!.push(source);

    source.onended = () => {
      gainNode.disconnect();
      source.disconnect();
      const list = this.activeSources.get(soundName);
      if (list) {
        this.activeSources.set(soundName, list.filter(s => s !== source));
      }
    };
  }

  /**
   * 停止播放指定音效
   */
  public stop(soundName: string): void {
    const list = this.activeSources.get(soundName);
    if (list) {
      list.forEach(src => {
        try {
          src.stop();
        } catch (_) {}
        src.disconnect();
      });
      this.activeSources.set(soundName, []);
    }

    if (soundName === 'engine') {
      this.stopEngine();
    }
  }

  /**
   * 停止所有音效和背景音樂
   */
  public stopAll(): void {
    this.activeSources.forEach((list, key) => {
      this.stop(key);
    });
    this.stopBGM();
    this.stopEngine();
  }

  /**
   * 設定主音量（Mute 開關）
   */
  public muteAll(toggle: boolean): void {
    this.isMuted = toggle;
    this.applyVolumes();
  }

  /**
   * 設定背景音樂音量 (0 - 100)
   */
  public setBGM(volume: number): void {
    this.bgmVolume = Math.max(0, Math.min(100, volume));
    this.applyVolumes();
    this.saveSettings();
  }

  /**
   * 設定特效音量 (0 - 100)
   */
  public setSFX(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(100, volume));
    this.applyVolumes();
    this.saveSettings();
  }

  public getBGMVolume(): number {
    return this.bgmVolume;
  }

  public getSFXVolume(): number {
    return this.sfxVolume;
  }

  /**
   * 設定自訂的賽道背景音樂檔案
   */
  public async setCustomBGMFile(file: File): Promise<string> {
    this.initContext();
    if (!this.ctx) {
      throw new Error('AudioContext 尚未初始化或不支援');
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      this.buffers.set('bgm_playing', audioBuffer);
      return file.name;
    } catch (e) {
      console.error('Failed to decode custom BGM file:', e);
      throw e;
    }
  }

  /**
   * 清除自訂賽道音樂，還原為預設背景音樂
   */
  public clearCustomBGM(): void {
    this.buffers.delete('bgm_playing');
    this.preloadAssets();
  }

  /**
   * 漸入（Fade In）
   */
  public fadeIn(gainNode: GainNode, duration = 1.5, targetVolume = 1): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(targetVolume, now + duration);
  }

  /**
   * 漸出（Fade Out）
   */
  public fadeOut(gainNode: GainNode, duration = 1.5, onComplete?: () => void): void {
    if (!this.ctx) {
      if (onComplete) onComplete();
      return;
    }
    const now = this.ctx.currentTime;
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);
    if (onComplete) {
      setTimeout(onComplete, duration * 1000);
    }
  }

  /**
   * 背景音樂管理：切換 BGM，並做平滑的 Fade In / Out 切換
   */
  public playBGM(bgmName: SoundName): void {
    this.initContext();
    if (!this.ctx || !this.bgmGain) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.currentBgmName === bgmName) {
      return; // 已經在播放了
    }

    // 1. 如果已有其他 BGM 在播放，先淡出並停止
    if (this.currentBgmGain) {
      const prevGain = this.currentBgmGain;
      const prevSource = this.currentBgmSource;
      const prevInterval = this.bgmSequenceInterval;

      this.fadeOut(prevGain, 1.0, () => {
        try {
          if (prevSource) prevSource.stop();
        } catch (_) {}
        if (prevSource) prevSource.disconnect();
        prevGain.disconnect();
        if (prevInterval) clearInterval(prevInterval);
      });
    }

    this.currentBgmName = bgmName;

    // 2. 建立新的 BGM 播放鏈
    const newGainNode = this.ctx.createGain();
    newGainNode.connect(this.bgmGain);
    this.currentBgmGain = newGainNode;

    const buffer = this.buffers.get(bgmName);
    if (buffer) {
      // 播放實體 MP3 循環軌
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(newGainNode);
      source.start(0);
      this.currentBgmSource = source;
      this.fadeIn(newGainNode, 1.2, 1.0);
    } else {
      // 完美合成：高水準的 8-bit 科幻音樂循環合成器！
      this.fadeIn(newGainNode, 1.2, 1.0);
      this.startSynthesizedBGM(bgmName, newGainNode);
    }
  }

  public stopBGM(): void {
    if (this.bgmSequenceInterval) {
      clearInterval(this.bgmSequenceInterval);
      this.bgmSequenceInterval = null;
    }

    if (this.currentBgmGain) {
      const prevGain = this.currentBgmGain;
      const prevSource = this.currentBgmSource;

      this.fadeOut(prevGain, 0.8, () => {
        try {
          if (prevSource) prevSource.stop();
        } catch (_) {}
        if (prevSource) prevSource.disconnect();
        prevGain.disconnect();
      });

      this.currentBgmName = null;
      this.currentBgmSource = null;
      this.currentBgmGain = null;
    }
  }

  /**
   * ==========================================
   * 引擎音效 (Engine Sound Synth)
   * 採用 Web Audio API 實例，具有物理真實感的引擎鋸齒波合成
   * ==========================================
   */
  public startEngine(): void {
    this.initContext();
    if (!this.ctx || !this.sfxGain || this.isEngineRunning) return;

    try {
      this.isEngineRunning = true;

      // 建立兩個低頻調變振盪器（Oscillators）
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc2 = this.ctx.createOscillator();
      
      // 使用 sawtooth 和 triangle 波形混音，模仿真實引擎排氣閥的頻率
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc2.type = 'triangle';

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(250, this.ctx.currentTime); // 低通濾除尖銳高音

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.05, this.ctx.currentTime); // 初始低速微弱聲

      // 連接關係: Oscs -> Filter -> Gain -> sfxGain
      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      // 設定微小頻率偏移 (Detune)，製造更深沉有彈性的引擎抖動感
      this.engineOsc1.frequency.setValueAtTime(45, this.ctx.currentTime);
      this.engineOsc2.frequency.setValueAtTime(45.5, this.ctx.currentTime);

      this.engineOsc1.start(0);
      this.engineOsc2.start(0);
    } catch (e) {
      console.warn('Failed to start engine audio synthesis', e);
    }
  }

  /**
   * 根據車速比例（0.0 到 1.0）動態調整引擎音高 (pitch) 與音量 (volume)
   */
  public updateEngine(speedRatio: number): void {
    if (!this.ctx || !this.isEngineRunning || !this.engineOsc1 || !this.engineOsc2 || !this.engineGain || !this.engineFilter) {
      if (!this.isEngineRunning && speedRatio > 0.05) {
        this.startEngine();
      }
      return;
    }

    const now = this.ctx.currentTime;
    
    // 引擎最低頻率 40Hz，高速極限 180Hz (完美模擬低速抖動到高速嘶吼)
    const baseFreq = 40 + (speedRatio * 140);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.01 + 0.5, now, 0.1);

    // 車速高時，引擎音量稍微變大，但整體控制在悅耳範疇（0.05 - 0.22）
    const targetVolume = 0.04 + (speedRatio * 0.14);
    this.engineGain.gain.setTargetAtTime(targetVolume, now, 0.15);

    // 車速高時，濾波器截止頻率也升高，使音色變得明亮
    const filterFreq = 180 + (speedRatio * 600);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.15);
  }

  public stopEngine(): void {
    this.isEngineRunning = false;
    
    if (this.engineOsc1 && this.engineOsc2) {
      try {
        this.engineOsc1.stop();
        this.engineOsc2.stop();
      } catch (_) {}
      this.engineOsc1.disconnect();
      this.engineOsc2.disconnect();
    }

    if (this.engineFilter) this.engineFilter.disconnect();
    if (this.engineGain) this.engineGain.disconnect();

    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
  }


  /**
   * ==========================================
   * 高品質 Web Audio 動態合成音效庫 (Retro 8-bit / Sci-Fi Synth SFX)
   * 即使完全沒有 mp3，依舊給予玩家極致的遊戲聽覺盛宴！
   * ==========================================
   */
  private playSynthSFX(soundName: SoundName, options?: { volume?: number; pitch?: number }): void {
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const baseVolume = options?.volume !== undefined ? options.volume : 1.0;
    const speedPitch = options?.pitch !== undefined ? options.pitch : 1.0;

    switch (soundName) {
      case 'click': {
        // UI click: 乾淨極速的 short pitch drop
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 * speedPitch, now);
        osc.frequency.exponentialRampToValueAtTime(120 * speedPitch, now + 0.08);

        gain.gain.setValueAtTime(0.12 * baseVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }

      case 'menu_open': {
        // Menu slide/open: 上升滑音
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260 * speedPitch, now);
        osc.frequency.exponentialRampToValueAtTime(520 * speedPitch, now + 0.15);

        gain.gain.setValueAtTime(0.15 * baseVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }

      case 'menu_close': {
        // Menu close: 下降滑音
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440 * speedPitch, now);
        osc.frequency.exponentialRampToValueAtTime(180 * speedPitch, now + 0.15);

        gain.gain.setValueAtTime(0.15 * baseVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }

      case 'correct': {
        // 答對！璀璨奪目的 8-bit 大三和弦快速琶音 (Arpeggio) (C5 -> E5 -> G5 -> C6)
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, index) => {
          if (!this.ctx || !this.sfxGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq * speedPitch, now + index * 0.06);

          gain.gain.setValueAtTime(0.0, now + index * 0.06);
          gain.gain.linearRampToValueAtTime(0.12 * baseVolume, now + index * 0.06 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.06 + 0.25);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now + index * 0.06);
          osc.stop(now + index * 0.06 + 0.25);
        });
        break;
      }

      case 'wrong': {
        // 答錯！低沉失落的雙振盪器滑音 (F#2 -> C2)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);

        // 稍微 detune
        osc1.frequency.setValueAtTime(146.83 * speedPitch, now); // D3
        osc1.frequency.linearRampToValueAtTime(73.42 * speedPitch, now + 0.35); // D2

        osc2.frequency.setValueAtTime(148.0 * speedPitch, now);
        osc2.frequency.linearRampToValueAtTime(74.0 * speedPitch, now + 0.35);

        gain.gain.setValueAtTime(0.25 * baseVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.4);
        osc2.stop(now + 0.4);
        break;
      }

      case 'level_up': {
        // Level up: 高昂的雙滑音加長琶音
        const startFreqs = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        startFreqs.forEach((freq, idx) => {
          if (!this.ctx || !this.sfxGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * speedPitch, now + idx * 0.08);
          osc.frequency.linearRampToValueAtTime(freq * 2 * speedPitch, now + idx * 0.08 + 0.2);

          gain.gain.setValueAtTime(0.12 * baseVolume, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.4);
        });
        break;
      }

      case 'combo_up': {
        // Combo UP: 超亮麗的高音 8-bit 叮一聲 (Coin sound effect)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(987.77 * speedPitch, now); // B5
        osc.frequency.setValueAtTime(1318.51 * speedPitch, now + 0.08); // E6

        gain.gain.setValueAtTime(0.12 * baseVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.28);
        break;
      }

      case 'countdown_tick': {
        // Tick: 乾淨高頻、極短促的木魚敲擊聲
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        // 若為緊急狀態（最後3秒），音高與亮度加倍
        const isUrgent = speedPitch > 1.2;
        osc.frequency.setValueAtTime(isUrgent ? 1800 : 1000, now);

        gain.gain.setValueAtTime(isUrgent ? 0.2 * baseVolume : 0.08 * baseVolume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.03);
        break;
      }

      case 'crash': {
        // 碰撞爆炸音：白噪音合成 (White Noise Synth with decaying bandpass envelope)
        const bufferSize = this.ctx.sampleRate * 0.4; // 0.4秒長的白噪音
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1; // 隨機震幅
        }

        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        // 高車速碰撞帶來更大範圍、更響亮的重低音，低車速則很微弱
        const initialFilterFreq = 200 + (speedPitch * 600);
        filter.frequency.setValueAtTime(initialFilterFreq, now);
        filter.frequency.exponentialRampToValueAtTime(50, now + 0.35);

        const gainNode = this.ctx.createGain();
        // 碰撞音量由 speedPitch (車速比例) 主導
        const crashAmp = (0.1 + (speedPitch * 0.45)) * baseVolume;
        gainNode.gain.setValueAtTime(crashAmp, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        noiseNode.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.sfxGain);

        noiseNode.start(now);
        noiseNode.stop(now + 0.4);
        break;
      }

      case 'game_over_sound': {
        // Game Over Jingle: 8-bit 下降哀愁和弦
        const noteSequence = [392.00, 349.23, 311.13, 246.94]; // G4, F4, Eb4, B3
        noteSequence.forEach((freq, idx) => {
          if (!this.ctx || !this.sfxGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq * speedPitch, now + idx * 0.12);

          gain.gain.setValueAtTime(0.12 * baseVolume, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.35);
        });
        break;
      }

      default:
        break;
    }
  }

  /**
   * ==========================================
   * 超炫 8-bit Retro 科技旋律合成器 (Real-time Sequence Loop Generator)
   * 當本機無 bgm.mp3 時，直接在背景不占效能地用 2 軌 Oscillator 演奏極速電子音樂！
   * ==========================================
   */
  private startSynthesizedBGM(bgmName: SoundName, targetGain: GainNode): void {
    if (!this.ctx) return;

    if (this.bgmSequenceInterval) {
      clearInterval(this.bgmSequenceInterval);
    }

    let step = 0;
    let tempo = 120; // BPM
    let notes: number[] = [];
    let bassline: number[] = [];

    if (bgmName === 'bgm_menu') {
      tempo = 120; // 舒適中速
      // 16-step Am7 - G6 - Fmaj7 - E7 科幻 Synthwave 旋律
      notes = [
        659.25, 783.99, 880.00, 987.77,   // Am: E5, G5, A5, B5
        587.33, 783.99, 987.77, 1174.66,  // G:  D5, G5, B5, D6
        523.25, 698.46, 880.00, 1046.50,  // F:  C5, F5, A5, C6
        493.88, 659.25, 830.61, 987.77    // E7: B4, E5, G#5, B5
      ];
      bassline = [
        110.00, 110.00, 110.00, 110.00,   // A2
        98.00,  98.00,  98.00,  98.00,    // G2
        87.31,  87.31,  87.31,  87.31,    // F2
        82.41,  82.41,  82.41,  82.41     // E2
      ];
    } else if (bgmName === 'bgm_playing') {
      tempo = 148; // 高速狂飆
      // 16-step Dm - F - C - Gm 速度感霓虹極速電子樂
      notes = [
        880.00, 1174.66, 1396.91, 1174.66, // Dm: A5, D6, F6, D6
        1046.50, 1396.91, 1760.00, 1396.91, // F:  C6, F6, A6, F6
        783.99, 1046.50, 1318.51, 1046.50, // C:  G5, C6, E6, C6
        932.33, 1174.66, 1567.98, 1396.91  // Gm: Bb5, D6, G6, F6
      ];
      bassline = [
        73.42, 73.42, 73.42, 73.42,       // D2
        87.31, 87.31, 87.31, 87.31,       // F2
        65.41, 65.41, 65.41, 65.41,       // C2
        98.00, 98.00, 98.00, 98.00        // G2
      ];
    } else if (bgmName === 'bgm_gameover') {
      tempo = 95; // 抒情凱旋 finish
      // 16-step C - G - Am - F 凱旋溫暖史詩終章
      notes = [
        523.25, 659.25, 783.99, 1046.50,  // C:  C5, E5, G5, C6
        783.99, 987.77, 1174.66, 1567.98,  // G:  G5, B5, D6, G6
        880.00, 1046.50, 1318.51, 1760.00, // Am: A5, C6, E6, A6
        698.46, 880.00, 1046.50, 1396.91   // F:  F5, A5, C6, F6
      ];
      bassline = [
        65.41,  65.41,  65.41,  65.41,     // C2
        98.00,  98.00,  98.00,  98.00,     // G2
        110.00, 110.00, 110.00, 110.00,    // A2
        87.31,  87.31,  87.31,  87.31      // F2
      ];
    }

    const stepDuration = 60 / tempo / 2; // 八分音符間隔

    const runSequenceStep = () => {
      if (!this.ctx) return;
      if (!this.isEngineRunning && bgmName === 'bgm_playing' && Math.random() < 0.1) {
        // 如果 context 不存在，則跳出
      }
      
      const now = this.ctx.currentTime;
      const stepIdx = step % notes.length;

      // --- 1. Bass Track (貝斯根音，沉穩厚實的 Triangle 波形) ---
      const bassFreq = bassline[stepIdx];
      if (bassFreq > 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassGain.gain.setValueAtTime(0.18, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 0.9);

        bassOsc.connect(bassGain);
        bassGain.connect(targetGain);
        
        bassOsc.start(now);
        bassOsc.stop(now + stepDuration * 0.9);
      }

      // --- 2. Melody Lead Track (旋律主音，清脆乾淨的 Sine/Triangle 波形) ---
      // 隨機跳過部分步進，讓旋律不單調
      const shouldPlayMelody = bgmName === 'bgm_playing' 
        ? (stepIdx % 2 === 0 || Math.random() < 0.3) 
        : (stepIdx % 4 !== 3);

      const melodyFreq = notes[stepIdx];
      if (melodyFreq > 0 && shouldPlayMelody) {
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        
        // 使用 low-pass 稍微濾波的 Sawtooth 波形增加點 80年代 Synthwave 復古鋸齒感，或是單純的 Triangle / Sine
        leadOsc.type = bgmName === 'bgm_playing' ? 'sawtooth' : 'sine';
        leadOsc.frequency.setValueAtTime(melodyFreq, now);

        let finalConnectionNode: AudioNode = leadGain;

        if (bgmName === 'bgm_playing') {
          // 加入 Lowpass Filter，讓鋸齒波聽起來像溫暖的類比合成器，不會刺耳
          const lowpass = this.ctx.createBiquadFilter();
          lowpass.type = 'lowpass';
          lowpass.frequency.setValueAtTime(2000, now);
          lowpass.frequency.exponentialRampToValueAtTime(800, now + stepDuration * 0.8);
          
          leadOsc.connect(lowpass);
          lowpass.connect(leadGain);
          
          // 如果是飆車模式，加入顫音 (Vibrato) 讓科幻感暴增
          const vibrato = this.ctx.createOscillator();
          const vibratoGain = this.ctx.createGain();
          vibrato.frequency.value = 8; // 8Hz LFO
          vibratoGain.gain.value = 12; // detune by 12 cents
          vibrato.connect(vibratoGain);
          vibratoGain.connect(leadOsc.frequency);
          vibrato.start(now);
          vibrato.stop(now + stepDuration);
        } else {
          leadOsc.connect(leadGain);
        }

        leadGain.gain.setValueAtTime(bgmName === 'bgm_playing' ? 0.03 : 0.05, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 0.85);

        leadGain.connect(targetGain);

        leadOsc.start(now);
        leadOsc.stop(now + stepDuration * 0.85);
      }

      step++;
    };

    // 啟動步進器循環
    this.bgmSequenceInterval = setInterval(runSequenceStep, stepDuration * 1000) as any;
  }
}
