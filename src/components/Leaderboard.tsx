/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Trophy, ChevronLeft, Calendar, Flame, Percent, RefreshCw, Trash2 } from 'lucide-react';
import { useAudio } from '../audio/useAudio';

export const Leaderboard: React.FC = () => {
  const { leaderboard, loadLeaderboard, setView } = useGameStore();
  const { playClick, playMenuClose } = useAudio();

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const handleClear = () => {
    if (window.confirm("確定要重設排行榜記錄嗎？這將會清除所有本地數據。")) {
      playClick();
      localStorage.removeItem('tax_racer_leaderboard');
      loadLeaderboard();
    }
  };

  // Pre-seed mock data if leaderboard is completely empty, to give a beautiful display
  const displayList = leaderboard.length > 0 ? leaderboard : [
    { id: 'mock1', name: '稅法老司機', score: 150, accuracy: 100, maxCombo: 12, date: '2026/06/28' },
    { id: 'mock2', name: '極速小稅官', score: 110, accuracy: 80, maxCombo: 8, date: '2026/06/28' },
    { id: 'mock3', name: '地方稽徵局長', score: 95, accuracy: 93, maxCombo: 5, date: '2026/06/29' },
    { id: 'mock4', name: '新手菜鳥號', score: 55, accuracy: 60, maxCombo: 3, date: '2026/06/29' }
  ];

  return (
    <div className="min-h-screen w-full bg-[#050505] text-white flex flex-col items-center p-4 md:p-8 relative overflow-hidden">
      
      {/* Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#00FF88]/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-2xl bg-black/60 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl z-10 flex flex-col space-y-6 my-auto">
        
        {/* Header navigation */}
        <div className="flex justify-between items-center pb-4 border-b border-white/10">
          <button
            onClick={() => {
              playMenuClose();
              setView('menu');
            }}
            id="back-to-menu-from-leaderboard-btn"
            className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white font-bold transition-colors cursor-pointer group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>返回選單</span>
          </button>
          
          <div className="flex items-center space-x-2 bg-[#FFCC00]/10 text-[#FFCC00] px-3 py-1 rounded-full text-xs font-bold border border-[#FFCC00]/20">
            <Trophy className="w-3.5 h-3.5 fill-[#FFCC00] text-[#FFCC00]" />
            <span>全服英雄榜</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-amber-200 to-[#FFCC00] bg-clip-text text-transparent">
            車手榮譽排行榜
          </h2>
          <p className="text-gray-400 text-xs font-medium">
            名次由高分到低分排列，快來挑戰「娛樂稅老司機」的位置！
          </p>
        </div>

        {/* Ranking List Table */}
        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
          {displayList.map((entry, index) => {
            const isTop3 = index < 3;
            const rankColors = [
              'bg-[#FFCC00] text-black font-black shadow-[0_0_15px_rgba(255,204,0,0.4)]', // Gold
              'bg-white text-black font-black shadow-[0_0_15px_rgba(255,255,255,0.4)]', // Silver
              'bg-[#FF3366] text-white font-black shadow-[0_0_15px_rgba(255,51,102,0.4)]' // Bronze
            ];

            return (
              <div
                key={entry.id}
                className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                  isTop3 
                    ? 'bg-black/85 border-white/10' 
                    : 'bg-black/40 border-white/5 hover:border-white/15'
                }`}
              >
                {/* Name & Rank info */}
                <div className="flex items-center space-x-3.5">
                  {/* Rank circle badge */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                    isTop3 ? rankColors[index] : 'bg-[#1a1a1a] text-gray-400 font-bold'
                  }`}>
                    {index + 1}
                  </div>

                  <div className="flex flex-col">
                    <span className="font-extrabold text-white text-sm md:text-base">{entry.name}</span>
                    
                    {/* Sub statistics inline */}
                    <div className="flex items-center space-x-3 text-[10px] text-gray-400 font-bold mt-0.5">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3 text-[#00FF88]" />
                        正確率 {entry.accuracy}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3 text-[#FFCC00]" />
                        連擊 {entry.maxCombo}
                      </span>
                      <span className="flex items-center gap-1 font-normal font-mono">
                        <Calendar className="w-3 h-3 text-gray-600" />
                        {entry.date}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score value */}
                <div className="text-right">
                  <span className="text-xl md:text-2xl font-black font-mono text-[#00FF88] shadow-sm leading-none block">
                    {entry.score}
                  </span>
                  <span className="text-[9px] text-gray-500 font-bold tracking-widest block mt-0.5">PTS</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer actions: Clear leaderboard */}
        <div className="flex justify-between items-center pt-4 border-t border-white/10">
          <p className="text-[10px] text-gray-500 font-medium font-mono uppercase">
            Data locally stored in browser localstorage
          </p>

          {leaderboard.length > 0 && (
            <button
              onClick={handleClear}
              id="clear-leaderboard-btn"
              className="flex items-center space-x-1.5 text-xs text-[#FF3366]/80 hover:text-[#FF3366] font-bold transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-[#FF3366]/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>清空資料</span>
            </button>
          )}
        </div>

      </div>

    </div>
  );
};
