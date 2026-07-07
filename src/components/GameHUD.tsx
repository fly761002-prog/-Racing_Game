/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { Award, Clock, Flame, ShieldAlert, Navigation, ArrowLeftRight, HelpCircle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { useAudio } from '../audio/useAudio';

export const GameHUD: React.FC = () => {
  const {
    score,
    combo,
    timeLeft,
    currentQuestion,
    feedbackType,
    feedbackText,
    setView,
    totalAnswered,
    realtimeRank,
    selectedAnswer,
    selectAnswer,
    currentSpeed,
    isCompleting,
    crossedFinishLine
  } = useGameStore();

  const { playClick } = useAudio();
  const [showQuitConfirm, setShowQuitConfirm] = React.useState(false);

  // Helper simulated keystroke dispatch
  const handleControlStart = (key: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
  };

  const handleControlEnd = (key: string) => {
    window.dispatchEvent(new KeyboardEvent('keyup', { key }));
  };

  // Convert seconds to mm:ss format
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeLeft <= 15;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 z-30 font-sans">
      
      {/* 🏁 FINISH / GOAL CELEBRATION OVERLAY */}
      {crossedFinishLine && (
        <div className="absolute inset-0 bg-black/10 backdrop-blur-[0.5px] flex flex-col items-center justify-center z-50 pointer-events-none animate-in fade-in duration-300">
          <div className="text-center space-y-2 max-w-xl px-4">
            <h1 className="text-5xl md:text-7xl font-black italic tracking-wider text-yellow-400 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] font-mono">
              FINISH 🏁
            </h1>
            <p className="text-sm md:text-base font-bold text-[#00FF88] tracking-widest uppercase">
              衝線成功！
            </p>
          </div>
        </div>
      )}


      
      {/* TOP HEADER COMPARTMENT: Statistics, Question & Exit Control */}
      <div className="w-full flex flex-col items-center pointer-events-none gap-2">
        
        {/* TOPMOST ROW: Sleek combined Horizontal Stats & Controls Bar (Saves maximum vertical space) */}
        <div className="w-full flex justify-between items-center bg-black/85 border border-white/10 px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl backdrop-blur-md pointer-events-auto shadow-lg">
          {/* Left: Stats row */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Score Pill */}
            <div className="flex items-center space-x-1 bg-black/40 border border-white/10 px-2 py-0.5 md:py-1 rounded-lg">
              <Award className="w-3.5 h-3.5 text-[#00FF88]" />
              <div className="flex items-baseline space-x-0.5 md:space-x-1">
                <span className="hidden xs:inline text-[7px] text-gray-400 font-bold tracking-wider uppercase">SCORE</span>
                <span className="text-xs md:text-sm font-black text-[#00FF88] font-mono leading-none">{score}</span>
              </div>
            </div>

            {/* Ranking Pill */}
            <div className="flex items-center space-x-1 bg-black/40 border border-white/10 px-2 py-0.5 md:py-1 rounded-lg">
              <Navigation className="w-3.5 h-3.5 text-[#FFCC00] rotate-45 fill-[#FFCC00]/20" />
              <div className="flex items-baseline space-x-0.5 md:space-x-1">
                <span className="hidden xs:inline text-[7px] text-gray-400 font-bold tracking-wider uppercase">RANK</span>
                <span className="text-xs md:text-sm font-black text-[#FFCC00] font-mono leading-none">第 {realtimeRank} 名</span>
              </div>
            </div>

            {/* Combo Pill */}
            {combo > 0 && (
              <div className="flex items-center space-x-1 bg-[#FFCC00]/10 border border-[#FFCC00]/30 px-1.5 py-0.5 rounded-lg text-[#FFCC00] font-bold animate-pulse">
                <Flame className="w-3 h-3 fill-[#FFCC00] text-[#FFCC00]" />
                <span className="text-[9px] font-black tracking-wider font-mono">
                  {combo}🔥
                </span>
              </div>
            )}
          </div>

          {/* Right: Exit / Menu */}
          <div className="flex items-center space-x-2">
            {/* Mini helper controls display (hidden on small screens, ultra-sleek on desktop) */}
            <div className="hidden sm:flex items-center space-x-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-gray-400 text-[8px] uppercase font-bold tracking-wider leading-none">
              <span className="bg-white/10 px-1 rounded text-white font-mono">A/D</span>
              <span>左右換道</span>
              <span className="text-gray-600">|</span>
              <span className="text-[#00FF88] font-extrabold">自動行駛中 ✨</span>
            </div>

            <button
              onClick={() => {
                playClick();
                setShowQuitConfirm(true);
              }}
              id="quit-game-btn"
              className="flex items-center space-x-1 bg-red-950/20 border border-red-500/20 hover:border-red-500/50 hover:bg-red-900/30 text-red-300 px-2.5 py-1 rounded-lg text-[9px] md:text-[10px] font-bold transition-all shadow-md cursor-pointer"
            >
              <span>返回選單</span>
            </button>
          </div>
        </div>

        {/* SLEEK COMPACT TAX QUESTION BANNER: Positioned beautifully at the top center, smaller scale */}
        {!isCompleting && currentQuestion && (
          <div className="w-full max-w-[480px] px-2 pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-300 z-10">
            <div className="w-full bg-black/95 backdrop-blur-md border border-[#00FF88]/40 py-2 px-3 sm:px-4 rounded-xl flex flex-col items-center shadow-[0_4px_24px_rgba(0,0,0,0.85)] text-center border-t-2 border-t-[#00FF88]">
              {/* Top tiny hint */}
              <div className="text-[#FFCC00] text-[9px] md:text-[10px] font-black tracking-wider uppercase mb-1 flex items-center justify-center gap-1">
                <HelpCircle className="w-3 h-3 text-[#FFCC00]" />
                <span>娛樂稅作答 • 左右方向鍵或點擊換道</span>
              </div>
              <h2 className="text-white text-[12px] sm:text-[13px] md:text-[14px] font-black tracking-tight leading-normal select-none mb-1.5 whitespace-normal drop-shadow-md">
                Q{totalAnswered + 1}: {currentQuestion.question}
              </h2>
              
              {/* Split directions guide as interactive selection buttons (Sleek compact design) */}
              <div className="w-full flex flex-row gap-2 pt-1.5 border-t border-white/15">
                <button
                  onClick={() => selectAnswer('A')}
                  className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all text-left cursor-pointer pointer-events-auto select-none ${
                    selectedAnswer === 'A'
                      ? 'bg-[#00FF88]/15 border-[#00FF88] shadow-[0_0_10px_rgba(0,255,136,0.25)] text-white scale-[1.01]'
                      : 'bg-black/60 border-white/5 text-gray-300 hover:bg-black/80 hover:border-[#00FF88]/30'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className={`w-4 h-4 rounded flex items-center justify-center font-mono font-black text-[10px] shrink-0 ${
                      selectedAnswer === 'A' ? 'bg-[#00FF88] text-black' : 'bg-white/10 text-white'
                    }`}>
                      A
                    </span>
                    <span className="text-[10px] sm:text-[11px] md:text-[12px] font-bold leading-tight whitespace-normal break-words">{currentQuestion.options.A}</span>
                  </div>
                  <Navigation className={`w-3.5 h-3.5 shrink-0 rotate-[-90deg] transition-all ml-1 ${
                    selectedAnswer === 'A' ? 'text-[#00FF88] animate-pulse' : 'text-gray-500'
                  }`} />
                </button>

                <button
                  onClick={() => selectAnswer('B')}
                  className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-all text-left cursor-pointer pointer-events-auto select-none ${
                    selectedAnswer === 'B'
                      ? 'bg-[#FF3366]/15 border-[#FF3366] shadow-[0_0_10px_rgba(255,51,102,0.25)] text-white scale-[1.01]'
                      : 'bg-black/60 border-white/5 text-gray-300 hover:bg-black/80 hover:border-[#FF3366]/30'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className={`w-4 h-4 rounded flex items-center justify-center font-mono font-black text-[10px] shrink-0 ${
                      selectedAnswer === 'B' ? 'bg-[#FF3366] text-white' : 'bg-white/10 text-white'
                    }`}>
                      B
                    </span>
                    <span className="text-[10px] sm:text-[11px] md:text-[12px] font-bold leading-tight whitespace-normal break-words">{currentQuestion.options.B}</span>
                  </div>
                  <Navigation className={`w-3.5 h-3.5 shrink-0 rotate-[90deg] transition-all ml-1 ${
                    selectedAnswer === 'B' ? 'text-[#FF3366] animate-pulse' : 'text-gray-500'
                  }`} />
                </button>
              </div>

              {/* Selection Notification Banner */}
              {selectedAnswer && (
                <div className={`mt-1.5 px-2 py-0.5 rounded-full text-[8px] md:text-[9px] font-black tracking-wider uppercase flex items-center gap-1 ${
                  selectedAnswer === 'A' 
                    ? 'bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/15' 
                    : 'bg-[#FF3366]/10 text-[#FF3366] border border-[#FF3366]/15'
                }`}>
                  <span className="inline-block w-1 h-1 rounded-full bg-current animate-ping" />
                  <span>已選擇【{selectedAnswer}】：自動行駛目標車道中</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM FOOTER: Mobile touch controllers */}
      <div className="flex flex-col items-center w-full pb-2 space-y-3">

        {/* HUD Overlay Alert Flasher (Positioned perfectly above touch controls / dashboard) */}
        {feedbackType && (
          <div className={`px-4 py-2.5 rounded-xl border text-center font-bold shadow-2xl backdrop-blur-md max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto mb-1 ${
            feedbackType === 'correct'
              ? 'bg-black/95 border-l-4 border-l-[#00FF88] border-white/10 text-[#00FF88] shadow-[0_0_20px_rgba(0,255,136,0.2)]'
              : feedbackType === 'incorrect'
              ? 'bg-black/95 border-l-4 border-l-[#FF3366] border-white/10 text-[#FF3366] shadow-[0_0_20px_rgba(255,51,102,0.2)]'
              : 'bg-black/95 border-l-4 border-l-[#FFCC00] border-white/10 text-[#FFCC00] shadow-[0_0_20px_rgba(255,204,0,0.2)]'
          }`}>
            <div className="flex items-center justify-center space-x-1.5 text-xs md:text-sm">
              {feedbackType === 'correct' && <span>✅</span>}
              {feedbackType === 'incorrect' && <ShieldAlert className="w-4 h-4 text-[#FF3366] shrink-0" />}
              {feedbackType === 'obstacle' && <ShieldAlert className="w-4 h-4 text-[#FFCC00] shrink-0" />}
              <p className="leading-tight font-extrabold">{feedbackText}</p>
            </div>
          </div>
        )}
        
        {/* MOBILE / TOUCH DEVICE CONTROLS */}
        <div className="flex justify-between items-center w-full px-4 md:hidden pointer-events-none select-none">
          {/* Left steering button */}
          <button
            onTouchStart={(e) => { e.preventDefault(); handleControlStart('a'); }}
            onTouchEnd={(e) => { e.preventDefault(); handleControlEnd('a'); }}
            onMouseDown={(e) => { e.preventDefault(); handleControlStart('a'); }}
            onMouseUp={(e) => { e.preventDefault(); handleControlEnd('a'); }}
            onMouseLeave={(e) => { e.preventDefault(); handleControlEnd('a'); }}
            className="w-20 h-20 rounded-2xl bg-black/85 border-2 border-[#00FF88] active:bg-[#00FF88]/30 flex flex-col items-center justify-center text-white active:scale-95 transition-all cursor-pointer shadow-[0_0_20px_rgba(0,255,136,0.3)] pointer-events-auto"
          >
            <ChevronLeft className="w-10 h-10 text-[#00FF88]" />
            <span className="text-[10px] text-[#00FF88] font-black uppercase tracking-wider">左 A</span>
          </button>

          {/* Right steering button */}
          <button
            onTouchStart={(e) => { e.preventDefault(); handleControlStart('d'); }}
            onTouchEnd={(e) => { e.preventDefault(); handleControlEnd('d'); }}
            onMouseDown={(e) => { e.preventDefault(); handleControlStart('d'); }}
            onMouseUp={(e) => { e.preventDefault(); handleControlEnd('d'); }}
            onMouseLeave={(e) => { e.preventDefault(); handleControlEnd('d'); }}
            className="w-20 h-20 rounded-2xl bg-black/85 border-2 border-[#00FF88] active:bg-[#00FF88]/30 flex flex-col items-center justify-center text-white active:scale-95 transition-all cursor-pointer shadow-[0_0_20px_rgba(0,255,136,0.3)] pointer-events-auto"
          >
            <ChevronRight className="w-10 h-10 text-[#00FF88]" />
            <span className="text-[10px] text-[#00FF88] font-black uppercase tracking-wider">右 B</span>
          </button>
        </div>
      </div>

      {/* 退出確認彈窗 */}
      {showQuitConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 pointer-events-auto">
          <div className="bg-[#111115] border-2 border-[#FF3366] p-6 rounded-2xl max-w-sm w-full text-center shadow-[0_0_50px_rgba(255,51,102,0.3)] animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-[#FF3366]/10 border border-[#FF3366]/30 text-[#FF3366] flex items-center justify-center rounded-full mx-auto mb-4 animate-bounce">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-white text-lg font-bold mb-2">確定要放棄遊戲嗎？</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-6">
              現在返回主選單將不會儲存您在本局遊戲中的任何積分與連擊記錄。
            </p>
            <div className="flex space-x-3.5 justify-center">
              <button
                onClick={() => {
                  playClick();
                  setShowQuitConfirm(false);
                }}
                className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 text-white py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                繼續挑戰
              </button>
              <button
                onClick={() => {
                  playClick();
                  setShowQuitConfirm(false);
                  setView('menu');
                }}
                className="flex-1 bg-[#FF3366] hover:bg-[#ff1a53] text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(255,51,102,0.3)] active:scale-95 cursor-pointer"
              >
                確定放棄
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
