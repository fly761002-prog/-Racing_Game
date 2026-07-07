/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Play, Trophy, Settings, HelpCircle, ShieldCheck, Flame, Car, ChevronRight } from 'lucide-react';
import { useAudio } from '../audio/useAudio';

export const Dashboard: React.FC = () => {
  const { setView, settings, loadLeaderboard } = useGameStore();
  const { playClick, playMenuOpen, initAudioContext } = useAudio();

  useEffect(() => {
    loadLeaderboard(); // preload local storage ranking records
  }, [loadLeaderboard]);

  return (
    <div className="min-h-screen w-full bg-[#050505] text-white flex flex-col items-center justify-between p-4 md:p-8 relative overflow-hidden">
      
      {/* Decorative Cyberpunk Background Glowing Grids */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-[#FFCC00]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-[#00FF88]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* TOP: Welcome & Profile banner */}
      <div className="w-full max-w-5xl flex justify-between items-center z-10">
        <div className="flex items-center space-x-3 bg-black/60 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-950" style={{ backgroundColor: settings.carColor }}>
            🏎️
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">車手身份</span>
            <span className="text-sm font-black text-white">{settings.playerName}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="hidden md:inline-flex bg-[#00FF88]/10 border border-[#00FF88]/20 text-[#00FF88] px-3 py-2 rounded-full items-center gap-1.5 font-bold text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse" />
            娛樂稅推廣教育專版
          </span>
          
          {/* Tax Office Marketing Logo */}
          <div className="flex items-center space-x-2 bg-black/60 border border-[#00FF88]/30 px-4 py-2 rounded-2xl backdrop-blur-md select-none">
            <div className="flex flex-col text-left leading-none">
              <span className="text-[8px] text-[#00FF88] font-bold tracking-wider uppercase">指導單位</span>
              <span className="text-xs font-black text-white mt-0.5">稅捐稽徵處</span>
            </div>
          </div>
        </div>
      </div>

      {/* CENTER: Title Logo & Main Actions */}
      <div className="w-full max-w-xl text-center my-auto flex flex-col items-center justify-center space-y-8 z-10">
        
        {/* Title Group */}
        <div className="space-y-4">
          <div className="inline-flex items-center space-x-2 bg-[#FFCC00]/10 border border-[#FFCC00]/30 px-4 py-1.5 rounded-full text-xs font-bold text-[#FFCC00]">
            <Car className="w-4.5 h-4.5 animate-pulse text-[#FFCC00]" />
            <span>第一人稱賽車 3D Web 體驗</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none bg-gradient-to-r from-white via-amber-200 to-[#00FF88] bg-clip-text text-transparent">
            娛樂稅極速挑戰
          </h1>
          
          <p className="text-gray-400 text-sm md:text-base font-medium max-w-md mx-auto">
            手握方向盤，踩深油門！在高速賽道上躲避路障，衝撞正確答案大門，用熱血與智慧稱霸娛樂稅神話！
          </p>

          {/* 遊戲說明面板 / Game Instructions Panel */}
          <div className="w-full max-w-md bg-black/60 border border-white/10 rounded-2xl p-4 text-left space-y-3.5 backdrop-blur-md shadow-xl">
            <div className="flex items-center space-x-2 border-b border-white/10 pb-2">
              <HelpCircle className="w-4 h-4 text-[#FFCC00]" />
              <h2 className="text-sm font-extrabold text-[#FFCC00] tracking-wider">🎮 賽道操作與答題指南</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-2.5 text-xs text-gray-300">
              <div className="flex items-start space-x-2.5">
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-400/20 px-2 py-0.5 rounded font-black uppercase text-[10px] shrink-0">電腦</span>
                <p className="leading-relaxed">
                  按 <kbd className="bg-white/10 px-1 py-0.5 rounded text-white font-mono font-bold">A</kbd> 或 <kbd className="bg-white/10 px-1 py-0.5 rounded text-white font-mono font-bold">←</kbd> 向左行駛，並回答 <span className="text-[#00FF88] font-bold">A 選項</span><br />
                  按 <kbd className="bg-white/10 px-1 py-0.5 rounded text-white font-mono font-bold">D</kbd> 或 <kbd className="bg-white/10 px-1 py-0.5 rounded text-white font-mono font-bold">→</kbd> 向右行駛，並回答 <span className="text-[#00FF88] font-bold">B 選項</span>
                </p>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 px-2 py-0.5 rounded font-black uppercase text-[10px] shrink-0">手機</span>
                <p className="leading-relaxed">
                  點擊畫面下方的 <span className="text-[#00FF88] font-bold">左 A</span> 與 <span className="text-[#00FF88] font-bold">右 B</span> 按鈕來控制方向與答題。
                </p>
              </div>

              <div className="flex items-start space-x-2.5 border-t border-white/5 pt-2">
                <span className="bg-amber-500/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded font-black uppercase text-[10px] shrink-0">規則</span>
                <p className="leading-relaxed">
                  看清題目後，<span className="text-white font-bold">行駛穿過對應選項的霓虹拱門</span>：左邊為 A，右邊為 B。答對將獲得「超能加速」與連擊加分；答錯則會「強制減速」喔！
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Actions Button Stack */}
        <div className="w-full space-y-3.5 px-4">
          
          {/* PLAY BUTTON */}
          <button
            onClick={() => {
              initAudioContext();
              playClick();
              setView('playing');
            }}
            id="start-playing-btn"
            className="w-full py-4.5 px-6 rounded-2xl font-black text-black bg-[#00FF88] hover:bg-[#00e67a] shadow-[0_0_25px_rgba(0,255,136,0.35)] hover:shadow-[0_0_35px_rgba(0,255,136,0.55)] transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-3 cursor-pointer group"
          >
            <Play className="w-5.5 h-5.5 fill-black text-black" />
            <span className="text-lg uppercase tracking-wider font-extrabold">進入賽道・立刻開飆</span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* SECONDARY ROW */}
          <div className="grid grid-cols-2 gap-3 w-full">
            
            {/* LEADERBOARD */}
            <button
              onClick={() => {
                initAudioContext();
                playMenuOpen();
                setView('leaderboard');
              }}
              id="view-leaderboard-btn"
              className="py-3 px-5 rounded-xl font-bold bg-black/60 border border-white/10 hover:border-white/20 hover:bg-black/80 transition-all flex items-center justify-center space-x-2 cursor-pointer text-gray-200"
            >
              <Trophy className="w-4.5 h-4.5 text-[#FFCC00]" />
              <span>排行榜</span>
            </button>

            {/* SETTINGS */}
            <button
              onClick={() => {
                initAudioContext();
                playMenuOpen();
                setView('settings');
              }}
              id="view-settings-btn"
              className="py-3 px-5 rounded-xl font-bold bg-black/60 border border-white/10 hover:border-white/20 hover:bg-black/80 transition-all flex items-center justify-center space-x-2 cursor-pointer text-gray-200"
            >
              <Settings className="w-4.5 h-4.5 text-[#FF3366]" />
              <span>賽車設定</span>
            </button>

          </div>

          {/* INTRO GAME GUIDE */}
          <button
            onClick={() => {
              initAudioContext();
              playMenuOpen();
              setView('intro');
            }}
            id="view-intro-btn"
            className="w-full py-3 px-5 rounded-xl font-bold bg-black/40 border border-white/10 text-gray-400 hover:text-white hover:border-white/25 transition-all flex items-center justify-center space-x-2 cursor-pointer text-xs"
          >
            <HelpCircle className="w-4 h-4" />
            <span>新手上路：如何進行遊戲與娛樂稅宣導說明</span>
          </button>

        </div>

      </div>

      {/* BOTTOM: Educational Footer slogans */}
      <div className="w-full max-w-5xl text-center border-t border-white/10 pt-6 mt-12 text-[11px] md:text-xs text-gray-500 z-10 flex flex-col md:flex-row md:justify-between items-center gap-4">
        <div className="flex items-center space-x-2 justify-center">
          <ShieldCheck className="w-4 h-4 text-[#00FF88]" />
          <span>依財政部娛樂稅法第2條：娛樂稅之代徵人，應於收費時，代徵娛樂稅。</span>
        </div>
        <p className="font-mono text-[10px]">VER. 1.1.0 // MADE FOR TAX EDUCATION</p>
      </div>

    </div>
  );
};
