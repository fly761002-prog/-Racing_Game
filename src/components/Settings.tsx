/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { ChevronLeft, Save, Sparkles, Volume2, Shield, User, Music, Trash2, Upload } from 'lucide-react';
import { useAudio } from '../audio/useAudio';

export const Settings: React.FC = () => {
  const { settings, updateSettings, setView } = useGameStore();
  const { 
    playClick, 
    playMenuClose, 
    setBGMVolume, 
    setSFXVolume,
    setCustomBGMFile,
    clearCustomBGM
  } = useAudio();

  const [name, setName] = useState(settings.playerName);
  const [selectedColor, setSelectedColor] = useState(settings.carColor);
  const [difficulty, setDifficulty] = useState(settings.difficulty);
  const [bgmVol, setBgmVol] = useState(settings.bgmVolume);
  const [sfxVol, setSfxVol] = useState(settings.sfxVolume);

  const [customBgmName, setCustomBgmName] = useState<string | null>(
    localStorage.getItem('tax_racer_custom_bgm_name')
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isSaved, setIsSaved] = useState(false);

  const carColors = [
    { name: '極光紅', value: '#ef4444' },
    { name: '螢光綠', value: '#10b981' },
    { name: '星際藍', value: '#06b6d4' },
    { name: '迷幻粉', value: '#ec4899' },
    { name: '活力橘', value: '#f59e0b' }
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    playClick(); // 播放儲存點擊音效
    
    updateSettings({
      playerName: name.trim() || '極速稅務官',
      carColor: selectedColor,
      difficulty: difficulty,
      bgmVolume: bgmVol,
      sfxVolume: sfxVol
    });
    
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setView('menu'); // Auto return to menu
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full bg-[#050505] text-white flex flex-col items-center p-4 md:p-8 relative overflow-hidden">
      
      {/* Decorative Glow */}
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#00FF88]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Settings Form Card */}
      <div className="w-full max-w-xl bg-black/60 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl z-10 flex flex-col space-y-6 my-auto">
        
        {/* Navigation */}
        <div className="flex justify-between items-center pb-4 border-b border-white/10">
          <button
            onClick={() => {
              playMenuClose();
              setView('menu');
            }}
            id="back-to-menu-from-settings-btn"
            className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white font-bold transition-colors cursor-pointer group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回選單</span>
          </button>
          
          <span className="text-xs font-bold text-[#FFCC00] uppercase tracking-widest">
            Racer Profile Setup
          </span>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-amber-200 to-[#00FF88] bg-clip-text text-transparent">
            車手與賽車設定
          </h2>
          <p className="text-gray-400 text-xs font-medium">
            個性化您的賽車與名稱，設定會自動保存至本機。
          </p>
        </div>

        {/* Settings Fields Form */}
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* FIELD 1: Player Name */}
          <div className="space-y-2">
            <label className="text-xs md:text-sm font-extrabold text-gray-300 flex items-center gap-2">
              <User className="w-4 h-4 text-[#00FF88]" />
              <span>車手姓名（將顯示於排行榜）</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 12))}
              placeholder="請輸入您的姓名（限12字）"
              className="w-full bg-black/60 border border-white/10 focus:border-[#00FF88] focus:ring-1 focus:ring-[#00FF88]/30 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-gray-600 transition-all outline-none"
              id="settings-player-name"
              required
            />
          </div>

          {/* FIELD 2: Car Neon Paint */}
          <div className="space-y-2">
            <label className="text-xs md:text-sm font-extrabold text-gray-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF3366]" />
              <span>賽車烤漆與方向盤霓虹配色</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {carColors.map((color) => {
                const isSelected = selectedColor === color.value;
                return (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => {
                      setSelectedColor(color.value);
                      playClick();
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-[#00FF88] bg-[#00FF88]/10 shadow-[0_0_15px_rgba(0,255,136,0.15)] scale-[1.05]' 
                        : 'border-white/10 hover:border-white/20 bg-black/40'
                    }`}
                  >
                    {/* Circle of color */}
                    <span 
                      className="w-5 h-5 rounded-full border border-black/30" 
                      style={{ backgroundColor: color.value }}
                    />
                    <span className="text-[10px] font-bold text-gray-400">
                      {color.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* FIELD 3: Difficulty */}
          <div className="space-y-2">
            <label className="text-xs md:text-sm font-extrabold text-gray-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#00FF88]" />
              <span>賽事困難度</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['easy', 'normal', 'hard'] as const).map((diff) => {
                const label = diff === 'easy' ? '簡單 (少障礙)' : diff === 'normal' ? '標準賽道' : '極限狂飆';
                const isSelected = difficulty === diff;
                return (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => {
                      setDifficulty(diff);
                      playClick();
                    }}
                    className={`py-2.5 px-3 rounded-xl border font-bold text-xs cursor-pointer transition-all capitalize ${
                      isSelected 
                        ? 'bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88] shadow-[0_0_15px_rgba(0,255,136,0.15)]' 
                        : 'border-white/10 bg-black/40 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* FIELD 4: Volumes (UI simulation) */}
          <div className="space-y-4 p-4 rounded-xl bg-black/40 border border-white/10">
            <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
              <Volume2 className="w-4.5 h-4.5 text-[#FFCC00]" />
              <span>音效與背景音量（即時套用與保存）</span>
            </h4>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-semibold">背景音樂 BGM</span>
                <span className="text-[#00FF88] font-mono font-bold">{bgmVol}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={bgmVol}
                onChange={(e) => {
                  const vol = Number(e.target.value);
                  setBgmVol(vol);
                  setBGMVolume(vol); // 即時設定背景音樂
                }}
                className="w-full accent-[#00FF88] cursor-pointer bg-neutral-800 rounded-lg h-1"
              />

              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-gray-400 font-semibold">遊戲音效 SFX</span>
                <span className="text-[#00FF88] font-mono font-bold">{sfxVol}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sfxVol}
                onChange={(e) => {
                  const vol = Number(e.target.value);
                  setSfxVol(vol);
                  setSFXVolume(vol); // 即時設定遊戲音效
                  playClick(); // 給出聲音大小的回饋
                }}
                className="w-full accent-[#00FF88] cursor-pointer bg-neutral-800 rounded-lg h-1"
              />
            </div>
          </div>

          {/* FIELD 5: Custom BGM Upload */}
          <div className="space-y-4 p-4 rounded-xl bg-black/40 border border-white/10">
            <h4 className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
              <Music className="w-4.5 h-4.5 text-[#00FF88]" />
              <span>自訂賽道背景音樂（不須混音，直接取代）</span>
            </h4>
            
            <div className="space-y-3">
              {customBgmName ? (
                <div className="flex items-center justify-between bg-black/40 border border-[#00FF88]/30 px-3 py-2.5 rounded-xl text-xs">
                  <div className="flex items-center space-x-2 text-gray-300 font-semibold truncate max-w-[70%]">
                    <Music className="w-4 h-4 text-[#00FF88] shrink-0 animate-pulse" />
                    <span className="truncate">{customBgmName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      playClick();
                      clearCustomBGM();
                      localStorage.removeItem('tax_racer_custom_bgm_name');
                      setCustomBgmName(null);
                    }}
                    className="flex items-center space-x-1 text-xs text-[#FF3366] hover:text-[#ff1a53] font-bold cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>清除</span>
                  </button>
                </div>
              ) : (
                <div className="relative group">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadError(null);
                      try {
                        playClick();
                        const name = await setCustomBGMFile(file);
                        localStorage.setItem('tax_racer_custom_bgm_name', name);
                        setCustomBgmName(name);
                      } catch (err: any) {
                        setUploadError('音樂解碼失敗，請嘗試其他音訊格式 (如 MP3/WAV)');
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border border-dashed border-white/10 group-hover:border-[#00FF88]/40 px-4 py-4 rounded-xl text-center transition-all flex flex-col items-center justify-center space-y-1.5 bg-black/20">
                    <Upload className="w-5.5 h-5.5 text-gray-500 group-hover:text-[#00FF88] transition-colors" />
                    <p className="text-xs text-gray-400 font-semibold group-hover:text-gray-300 transition-colors">
                      點擊上傳您的音訊檔案 (.mp3, .wav)
                    </p>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      上傳後將直接取代原本的賽道飆車音樂，不須混音。若重新整理頁面需再次上傳。
                    </p>
                  </div>
                </div>
              )}
              {uploadError && (
                <p className="text-[10px] text-[#FF3366] font-bold">{uploadError}</p>
              )}
            </div>
          </div>

          {/* Submit Save Button */}
          <button
            type="submit"
            id="save-settings-btn"
            className="w-full py-4 rounded-xl font-black text-black bg-[#00FF88] hover:bg-[#00e67a] shadow-lg transform hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer font-extrabold"
          >
            {isSaved ? (
              <span className="text-black font-extrabold animate-pulse">✓ 設定已成功儲存！</span>
            ) : (
              <>
                <Save className="w-4.5 h-4.5 fill-black text-black" />
                <span>儲存設定・重返榮耀</span>
              </>
            )}
          </button>

        </form>

      </div>

    </div>
  );
};
