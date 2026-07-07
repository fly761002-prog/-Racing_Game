/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { AudioManager } from './AudioManager';
import { SoundName } from './soundAssets';

export function useAudio() {
  const audioManager = AudioManager.getInstance();

  const playSound = useCallback((soundName: SoundName, options?: { volume?: number; pitch?: number }) => {
    audioManager.play(soundName, options);
  }, [audioManager]);

  const stopSound = useCallback((soundName: SoundName) => {
    audioManager.stop(soundName);
  }, [audioManager]);

  const playCorrect = useCallback(() => {
    playSound('correct');
  }, [playSound]);

  const playWrong = useCallback(() => {
    playSound('wrong');
  }, [playSound]);

  const playCrash = useCallback((speedRatio = 0.5) => {
    // 傳入 speedRatio 作為 pitch，在 AudioManager 中這會放大 Crash 的音量與低音
    playSound('crash', { pitch: speedRatio });
  }, [playSound]);

  const playBGM = useCallback((bgmName: SoundName) => {
    audioManager.playBGM(bgmName);
  }, [audioManager]);

  const stopBGM = useCallback(() => {
    audioManager.stopBGM();
  }, [audioManager]);

  const playClick = useCallback(() => {
    playSound('click');
  }, [playSound]);

  const playMenuOpen = useCallback(() => {
    playSound('menu_open');
  }, [playSound]);

  const playMenuClose = useCallback(() => {
    playSound('menu_close');
  }, [playSound]);

  const playLevelUp = useCallback(() => {
    playSound('level_up');
  }, [playSound]);

  const playComboUp = useCallback(() => {
    playSound('combo_up');
  }, [playSound]);

  const playCountdownTick = useCallback((isUrgent = false) => {
    playSound('countdown_tick', { pitch: isUrgent ? 1.5 : 1.0 });
  }, [playSound]);

  const playGameOverSound = useCallback(() => {
    playSound('game_over_sound');
  }, [playSound]);

  // 引擎聲控制
  const startEngine = useCallback(() => {
    audioManager.startEngine();
  }, [audioManager]);

  const updateEngine = useCallback((speedRatio: number) => {
    audioManager.updateEngine(speedRatio);
  }, [audioManager]);

  const stopEngine = useCallback(() => {
    audioManager.stopEngine();
  }, [audioManager]);

  const stopAll = useCallback(() => {
    audioManager.stopAll();
  }, [audioManager]);

  // 設定與靜音
  const setBGMVolume = useCallback((vol: number) => {
    audioManager.setBGM(vol);
  }, [audioManager]);

  const setSFXVolume = useCallback((vol: number) => {
    audioManager.setSFX(vol);
  }, [audioManager]);

  const setCustomBGMFile = useCallback(async (file: File) => {
    return await audioManager.setCustomBGMFile(file);
  }, [audioManager]);

  const clearCustomBGM = useCallback(() => {
    audioManager.clearCustomBGM();
  }, [audioManager]);

  const muteAll = useCallback((toggle: boolean) => {
    audioManager.muteAll(toggle);
  }, [audioManager]);

  // 初始化 Audio Context (可由按鈕點擊觸發)
  const initAudioContext = useCallback(() => {
    audioManager.initContext();
  }, [audioManager]);

  return {
    playCorrect,
    playWrong,
    playCrash,
    playBGM,
    stopBGM,
    playClick,
    playMenuOpen,
    playMenuClose,
    playLevelUp,
    playComboUp,
    playCountdownTick,
    playGameOverSound,
    startEngine,
    updateEngine,
    stopEngine,
    stopAll,
    setBGMVolume,
    setSFXVolume,
    setCustomBGMFile,
    clearCustomBGM,
    muteAll,
    initAudioContext,
    bgmVolume: audioManager.getBGMVolume(),
    sfxVolume: audioManager.getSFXVolume()
  };
}
export type UseAudioReturn = ReturnType<typeof useAudio>;
