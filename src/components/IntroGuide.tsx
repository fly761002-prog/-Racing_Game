/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { ChevronLeft, Info, HelpCircle, ArrowRight, Play, BookOpen, ShieldCheck, Car } from 'lucide-react';
import { useAudio } from '../audio/useAudio';

export const IntroGuide: React.FC = () => {
  const { setView } = useGameStore();
  const { playClick, playMenuClose, initAudioContext } = useAudio();

  return (
    <div className="min-h-screen w-full bg-[#050505] text-white flex flex-col items-center p-4 md:p-8 relative overflow-hidden">
      
      {/* Glow */}
      <div className="absolute top-[-20%] left-[20%] w-[50%] h-[50%] bg-[#00FF88]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-3xl bg-black/60 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl z-10 flex flex-col space-y-6 my-auto">
        
        {/* Navigation header */}
        <div className="flex justify-between items-center pb-4 border-b border-white/10">
          <button
            onClick={() => {
              playMenuClose();
              setView('menu');
            }}
            id="back-to-menu-from-intro-btn"
            className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white font-bold transition-colors cursor-pointer group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回選單</span>
          </button>
          
          <div className="flex items-center space-x-2 bg-[#FFCC00]/10 text-[#FFCC00] px-3 py-1 rounded-full text-xs font-bold border border-[#FFCC00]/20">
            <BookOpen className="w-3.5 h-3.5" />
            <span>租稅教育手冊</span>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-amber-200 to-[#00FF88] bg-clip-text text-transparent">
            新手上路：娛樂稅宣導與操作說明
          </h2>
          <p className="text-gray-400 text-xs font-medium">
            了解什麼是「娛樂稅」，並學習如何在高速賽道中獲得最高分數！
          </p>
        </div>

        {/* Info Grid Split: Left = Education, Right = Gameplay */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          
          {/* COLUMN 1: Tax Education Info */}
          <div className="space-y-4 p-5 rounded-2xl bg-black/40 border border-white/5">
            <h3 className="text-sm font-black text-[#FFCC00] flex items-center gap-1.5 uppercase tracking-wider pb-2 border-b border-white/5">
              <ShieldCheck className="w-4.5 h-4.5 text-[#FFCC00]" />
              什麼是「娛樂稅」？
            </h3>
            
            <div className="space-y-3.5 text-xs text-gray-300 leading-relaxed">
              <div>
                <span className="font-extrabold text-[#00FF88] block mb-0.5">1. 課徵範圍</span>
                <p>
                  凡是電影、戲劇、音樂演奏、競技比賽（包括電競售票）、舞廳舞場、夜總會、KTV、網咖、高爾夫球場，以及各種提供娛樂設施（如夾娃娃機、電子遊戲機）等，依法皆屬於娛樂稅的課徵項目！
                </p>
              </div>

              <div>
                <span className="font-extrabold text-[#00FF88] block mb-0.5">2. 誰來負擔？誰來繳納？</span>
                <p>
                  娛樂稅是由「去消費娛樂的顧客（消費者）」來實際負擔。而娛樂場所「業者（代徵人）」則負責在收費時一併代為收取，並在<b>次月10日前</b>申報自動報繳填寫稅單向地方國庫繳納。
                </p>
              </div>

              <div>
                <span className="font-extrabold text-[#00FF88] block mb-0.5">3. 慈善免稅與優待</span>
                <p>
                  機關團體若舉辦符合社會福利、慈善救災、救濟為目的之義演，若符合「全部收入扣除不超過 30% 費用後，餘額皆做慈善之用」之規定，可向稅局申請全額免徵娛樂稅。
                </p>
              </div>
            </div>
          </div>

          {/* COLUMN 2: Gameplay Mechanics */}
          <div className="space-y-4 p-5 rounded-2xl bg-black/40 border border-white/5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-sm font-black text-[#00FF88] flex items-center gap-1.5 uppercase tracking-wider pb-2 border-b border-white/5">
                <Car className="w-4.5 h-4.5 text-[#00FF88]" />
                如何進行遊戲與操作？
              </h3>
              
              <div className="space-y-3 text-xs text-gray-300">
                <div className="flex items-center space-x-3 bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="bg-[#111111] text-[#00FF88] border border-white/10 font-mono font-bold px-2 py-0.5 rounded shadow">W</span>
                  <span>踩深油門、加速前進</span>
                </div>
                
                <div className="flex items-center space-x-3 bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="bg-[#111111] text-[#00FF88] border border-white/10 font-mono font-bold px-2 py-0.5 rounded shadow">S</span>
                  <span>煞車減速（撞擊障礙物會劇烈減速）</span>
                </div>

                <div className="flex items-center space-x-3 bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <span className="bg-[#111111] text-[#00FF88] border border-white/10 font-mono font-bold px-2 py-0.5 rounded shadow">A / D</span>
                  <span>控制方向盤、左右移動避開路障</span>
                </div>

                <div className="pt-2 border-t border-white/5 text-gray-400 space-y-1.5 leading-snug">
                  <p><span className="text-[#00FF88] font-bold">🟢 答題霓虹大門</span>：前方會高高懸掛題目。左門代表 A，右門代表 B。驅車穿過對應的一側即可回答問題！</p>
                  <p><span className="text-[#FFCC00] font-bold">🔥 答對</span> 獲得 <b className="text-[#00FF88] font-mono">+10 分</b> ；每達成 <b className="text-[#FFCC00]">5 連擊 (Combo)</b>，獲得額外 <b className="text-[#FFCC00] font-mono">+15 分加成</b>！</p>
                  <p><span className="text-[#FF3366] font-bold">🔴 答錯</span> 扣 5 分，<span className="text-[#FF3366] font-bold">撞擊路障</span> 扣 10 分並重置連擊數。</p>
                </div>
              </div>
            </div>

            {/* QUICK LAUNCH PLAY */}
            <button
              onClick={() => {
                initAudioContext();
                playClick();
                setView('playing');
              }}
              id="guide-quick-play-btn"
              className="w-full mt-4 py-3 px-4 rounded-xl font-black text-black bg-[#00FF88] hover:bg-[#00e67a] shadow-[0_0_20px_rgba(0,255,136,0.25)] hover:shadow-[0_0_30px_rgba(0,255,136,0.45)] transform hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer text-xs uppercase tracking-wider font-extrabold"
            >
              <span>了解！帶我進入賽車賽道</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Footer info slogan */}
        <p className="text-[10px] text-gray-500 text-center font-medium">
          誠實申報娛樂稅，地方建設最完備。地方政府將本項稅課全額用於地方社會建設，共創健康和諧的生活環境。
        </p>

      </div>

    </div>
  );
};
