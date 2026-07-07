/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Award, Flame, Percent, RefreshCw, Home, ShieldAlert, CheckCircle2, ChevronRight, HelpCircle, ExternalLink } from 'lucide-react';
import { useAudio } from '../audio/useAudio';

export const GameOver: React.FC = () => {
  const { playClick, playMenuClose } = useAudio();
  const {
    score,
    maxCombo,
    correctAnswers,
    incorrectAnswers,
    totalAnswered,
    setView,
    initGame,
    settings,
    incorrectQuestionsList,
    answeredQuestionsList,
    finalRankings,
    realtimeRank,
    timeLeft
  } = useGameStore();

  const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;

  // Determine educational evaluation rank
  const getRankInfo = (score: number, accuracy: number) => {
    if (score >= 120 && accuracy >= 80) {
      return {
        title: "🏆 娛樂稅大師（兼任稽徵處長）",
        desc: "您對娛樂稅的課稅範疇、減免規定及申報日期完全瞭如指掌！一邊開賽車還能一邊當稅務大師，地方政府的建設經費有您把關真是萬無一失！",
        color: "from-amber-400 to-yellow-500 text-amber-300",
        bg: "bg-amber-950/20 border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.25)]"
      };
    } else if (score >= 80) {
      return {
        title: "🏎️ 稅法老司機（專業代徵代報人）",
        desc: "非常卓越的成績！您清楚知道 KTV 包廂、夾娃娃機及高爾夫競技皆應代徵娛樂稅。身為專業代徵人，您絕對能完美在次月10日前完成自動申報！",
        color: "from-indigo-400 to-cyan-500 text-cyan-300",
        bg: "bg-indigo-950/20 border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
      };
    } else if (score >= 40) {
      return {
        title: "🔰 稅法實習生（聰明娛樂消費者）",
        desc: "您已經具備娛樂稅的基本概念！了解看電影、打網咖需負擔娛樂稅。不過開賽車的速度太快了，下次過彎時記得要更早選定正確答案霓虹門喔！",
        color: "from-emerald-400 to-teal-500 text-emerald-300",
        bg: "bg-emerald-950/20 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
      };
    } else {
      return {
        title: "💥 駕照吊銷戶（誠實納稅義務人）",
        desc: "看來在高速行駛下答題對您是一項不小的考驗！別灰心，多看看路邊兩側亮綠色 LED 宣導看板上的娛樂稅知識，相信您很快能重回賽道飆出高分！",
        color: "from-red-400 to-rose-500 text-rose-300",
        bg: "bg-red-950/20 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
      };
    }
  };

  const rank = getRankInfo(score, accuracy);

  // Get comparison with computer players based on final standings from the game
  const getComputerPlayersRankings = () => {
    if (finalRankings && finalRankings.length > 0) {
      // Return mapped so it supports isAI / isPlayer properties
      return finalRankings.map(r => ({
        name: r.name,
        score: r.score,
        accuracy: r.accuracy,
        isAI: !r.isPlayer,
        color: r.color,
        dist: r.dist
      }));
    }

    // Fallback if finalRankings is empty
    const aiDrivers = [
      { name: "稅法老司機 🏎️", score: 85, accuracy: 90, isAI: true, color: "text-amber-400" },
      { name: "極速小稅官 ⚡", score: 65, accuracy: 75, isAI: true, color: "text-emerald-400" },
      { name: "新手菜鳥號 🔰", score: 40, accuracy: 60, isAI: true, color: "text-violet-400" },
    ];

    const playerDriver = {
      name: `${settings.playerName} (您)`,
      score: score,
      accuracy: accuracy,
      isAI: false,
      color: "text-yellow-400 font-extrabold"
    };

    return [...aiDrivers, playerDriver].sort((a, b) => b.score - a.score);
  };

  const rankings = getComputerPlayersRankings();
  const playerIndexInRankings = rankings.findIndex(r => !r.isAI);
  const playerRank = playerIndexInRankings !== -1 ? playerIndexInRankings + 1 : realtimeRank;

  const totalTimeSpent = Math.max(5, 180 - timeLeft);
  const avgSpeed = totalAnswered > 0 ? Math.round((totalTimeSpent / totalAnswered) * 10) / 10 : 0;

  // Determine achievement badge based on correct answers and speed
  const getBadgeInfo = (correct: number, speed: number) => {
    if (correct >= 9) {
      return {
        badgeLabel: "娛樂稅大師",
        subtitle: "✨ 智勇雙全的賽道傳奇 ✨",
        desc: `傲視群雄！您成功在時速 200+ 公里的急彎中精準命中正確答案，答對 ${correct} 題且平均答題僅花費 ${speed} 秒！您絕對具備「娛樂稅大師」的至高榮譽！`,
        color: "from-amber-400 via-yellow-300 to-amber-500",
        shadow: "shadow-[0_0_25px_rgba(245,158,11,0.35)]",
        border: "border-amber-400/40",
        textColor: "text-amber-300",
        bg: "bg-gradient-to-br from-amber-500/10 via-yellow-600/5 to-transparent",
        emblem: "🥇"
      };
    } else if (correct >= 6) {
      return {
        badgeLabel: "娛樂稅高手",
        subtitle: "🏎️ 稅法觀念卓越的老司機 🏎️",
        desc: `非常傑出！您對娛樂稅代徵義務（例如 KTV、打網咖及高爾夫等代徵項目）瞭如指掌。平均答題花費 ${speed} 秒，榮獲「娛樂稅高手」稱號！`,
        color: "from-cyan-400 via-blue-400 to-indigo-500",
        shadow: "shadow-[0_0_25px_rgba(6,182,212,0.3)]",
        border: "border-cyan-400/35",
        textColor: "text-cyan-300",
        bg: "bg-gradient-to-br from-cyan-500/10 via-blue-600/5 to-transparent",
        emblem: "🥈"
      };
    } else {
      return {
        badgeLabel: "娛樂稅專員",
        subtitle: "🔰 穩健起步的稅法代言人 🔰",
        desc: `實力派！您頂住賽車高壓完成所有答題，獲得了基本娛樂稅常識，平均答題時間為 ${speed} 秒。獲得「娛樂稅專員」徽章，實至名歸！`,
        color: "from-emerald-400 via-teal-400 to-emerald-600",
        shadow: "shadow-[0_0_25px_rgba(16,185,129,0.25)]",
        border: "border-emerald-400/30",
        textColor: "text-emerald-300",
        bg: "bg-gradient-to-br from-emerald-500/10 via-teal-600/5 to-transparent",
        emblem: "🥉"
      };
    }
  };

  const badge = getBadgeInfo(correctAnswers, avgSpeed);

  const handleRestart = () => {
    playClick();
    initGame();
    setView('playing');
  };

  return (
    <div className="h-screen w-full bg-[#050505] text-white flex flex-col items-center justify-start py-8 md:py-12 px-4 relative overflow-y-auto">
      
      {/* Dynamic Backglow */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] bg-[#00FF88]/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Panel Card */}
      <div className="w-full max-w-2xl bg-black/60 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl z-10 flex flex-col space-y-6 mb-12">
        
        {/* Flag badge */}
        <div className="mx-auto bg-gradient-to-r from-[#FFCC00] via-[#00FF88] to-[#FF3366] p-[1.5px] rounded-full">
          <div className="bg-[#050505] px-4 py-1.5 rounded-full flex items-center space-x-1.5 text-xs font-black tracking-widest text-[#FFCC00]">
            <span>🏁 RACE COMPLETED 🏁</span>
          </div>
        </div>

        {/* Header Results */}
        <div className="text-center space-y-2">
          <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">
            Racer {settings.playerName} // 競速挑戰結算
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            競速成果發表
          </h2>
        </div>

        {/* Rank / Evaluation display */}
        <div className={`p-5 rounded-2xl border ${rank.bg} flex flex-col space-y-3`}>
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🎖️</span>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                稅務宣導段位評級
              </span>
              <h3 className={`text-xl font-black bg-gradient-to-r ${rank.color} bg-clip-text text-transparent`}>
                {rank.title}
              </h3>
            </div>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed font-medium">
            {rank.desc}
          </p>
        </div>

        {/* 🏆 娛樂稅達人成就徽章 */}
        <div className={`p-6 rounded-2xl border ${badge.border} ${badge.shadow} ${badge.bg} flex flex-col md:flex-row items-center gap-6 transition-all relative overflow-hidden`}>
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
          
          {/* Glowing Emblem Visualizer */}
          <div className="relative shrink-0 w-24 h-24 rounded-full bg-black/60 border border-white/10 flex items-center justify-center shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]">
            <div className={`absolute inset-0 rounded-full bg-gradient-to-tr ${badge.color} opacity-25 blur-lg`} />
            <div className="absolute inset-1.5 rounded-full border border-dashed border-white/20 animate-[spin_30s_linear_infinite]" />
            <span className="relative text-5xl select-none filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">{badge.emblem}</span>
          </div>

          <div className="flex-1 space-y-2 text-center md:text-left z-10">
            <span className="text-[10px] text-amber-400 font-extrabold tracking-widest uppercase">
              🏆 榮獲「娛樂稅達人」成就勳章
            </span>
            <h3 className={`text-2xl font-black tracking-tight bg-gradient-to-r ${badge.color} bg-clip-text text-transparent`}>
              {badge.badgeLabel}
            </h3>
            <span className="text-xs font-bold text-gray-400 block">{badge.subtitle}</span>
            <p className="text-gray-300 text-xs leading-relaxed">
              {badge.desc}
            </p>
          </div>
        </div>



        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* STAT 1: Score */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] text-[#00FF88] font-bold uppercase tracking-widest mb-1">
              總得分
            </span>
            <span className="text-2xl md:text-3xl font-black font-mono text-[#00FF88] leading-none">
              {score}
            </span>
          </div>

          {/* STAT 2: Accuracy */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] text-[#FFCC00] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
              <Percent className="w-3 h-3 text-[#FFCC00]" />
              正確率
            </span>
            <span className="text-2xl md:text-3xl font-black font-mono text-[#FFCC00] leading-none">
              {accuracy}%
            </span>
            <span className="text-[9px] text-gray-500 font-bold mt-1 font-mono">
              ({correctAnswers}/{totalAnswered} 題)
            </span>
          </div>

          {/* STAT 3: Max Combo */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] text-[#FF3366] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
              <Flame className="w-3 h-3 fill-[#FF3366] text-[#FF3366]" />
              最高連擊
            </span>
            <span className="text-2xl md:text-3xl font-black font-mono text-[#FF3366] leading-none">
              {maxCombo}
            </span>
          </div>

          {/* STAT 4: Ending Rank */}
          <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/20 rounded-2xl p-4 flex flex-col justify-center items-center text-center shadow-[inset_0_0_12px_rgba(245,158,11,0.05)]">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              終點排名
            </span>
            <span className="text-2xl md:text-3xl font-black font-mono text-amber-300 leading-none">
              第 {playerRank} 名
            </span>
            <span className="text-[9px] text-amber-500/70 font-bold mt-1">
              共 {rankings.length} 位車手
            </span>
          </div>

        </div>

        {/* Competitor Standings Leaderboard */}
        <div className="bg-black/40 border border-white/5 rounded-2xl p-4.5 flex flex-col space-y-3">
          <h4 className="text-[#00FF88] text-xs font-black tracking-wider uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
            <Award className="w-4 h-4 text-[#00FF88]" />
            <span>競速終點排位榜（與電腦玩家競爭排行）</span>
          </h4>
          <div className="space-y-1.5">
            {rankings.map((racer, idx) => {
              const isPlayer = !racer.isAI;
              return (
                <div 
                  key={idx} 
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all ${
                    isPlayer 
                      ? 'bg-[#00FF88]/10 border-[#00FF88]/30 shadow-[0_0_15px_rgba(0,255,136,0.1)]' 
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={`font-mono font-black text-sm w-5 ${
                      idx === 0 
                        ? 'text-amber-400' 
                        : idx === 1 
                        ? 'text-slate-300' 
                        : idx === 2 
                        ? 'text-amber-600' 
                        : 'text-gray-500'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className={`text-xs ${racer.color}`}>
                      {racer.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-5 text-xs font-mono">
                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 block leading-none mb-0.5">SCORE</span>
                      <span className={`font-black ${isPlayer ? 'text-[#00FF88]' : 'text-gray-300'}`}>{racer.score}分</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 block leading-none mb-0.5">ACCURACY</span>
                      <span className="font-bold text-gray-400">{racer.accuracy}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* All Answered Questions Review Panel (各題對錯、答案、解說一併顯示) */}
        {answeredQuestionsList && answeredQuestionsList.length > 0 && (
          <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-4.5 flex flex-col space-y-3.5">
            <h4 className="text-[#00FF88] text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#00FF88]" />
              <span>挑戰答題詳情與解析 ({answeredQuestionsList.length} 題)</span>
            </h4>
            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 select-text scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {answeredQuestionsList.map((item, idx) => {
                const isCorrect = item.isCorrect;
                return (
                  <div 
                    key={idx} 
                    className={`border rounded-xl p-3.5 text-left text-xs space-y-2.5 transition-all ${
                      isCorrect 
                        ? 'border-[#00FF88]/20 bg-[#00FF88]/[0.02]' 
                        : 'border-[#FF3366]/20 bg-[#FF3366]/[0.02]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5">
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] shrink-0 ${
                          isCorrect
                            ? 'bg-[#00FF88]/20 border border-[#00FF88]/30 text-[#00FF88]'
                            : 'bg-[#FF3366]/20 border border-[#FF3366]/30 text-[#FF3366]'
                        }`}>
                          Q{idx + 1}
                        </span>
                        <p className="font-extrabold text-white flex-1 leading-snug">
                          {item.question.question}
                        </p>
                      </div>
                      <span className={`font-black shrink-0 text-xs px-2 py-0.5 rounded-full ${
                        isCorrect ? 'text-[#00FF88] bg-[#00FF88]/10' : 'text-[#FF3366] bg-[#FF3366]/10'
                      }`}>
                        {isCorrect ? '✓ 答對' : '✗ 答錯'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-2 border-t border-white/5 text-gray-400">
                      <div>
                        您的選擇：
                        <span className={`font-bold ml-1 ${isCorrect ? 'text-[#00FF88]' : 'text-red-400'}`}>
                          【{item.chosenOption}】 {item.question.options[item.chosenOption]}
                        </span>
                      </div>
                      <div>
                        正確答案：
                        <span className="text-[#00FF88] font-bold ml-1">
                          【{item.question.correctOption}】 {item.question.options[item.question.correctOption]}
                        </span>
                      </div>
                    </div>

                    <div className="bg-amber-500/10 border-l-2 border-amber-500 px-3 py-2 rounded-r text-gray-200 leading-relaxed text-[11px]">
                      <span className="font-bold text-amber-400 block mb-0.5">💡 稅務解析：</span>
                      {item.question.explanation}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detailed Education Summary List (Quick recap of what they learned) */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-400 space-y-2">
          <span className="font-extrabold text-gray-300 block mb-1">💡 娛樂稅宣導重點回顧：</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] leading-relaxed">
            <div className="flex items-start space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF88] shrink-0 mt-0.5" />
              <span>KTV唱歌、打網咖上網玩遊戲皆包含娛樂稅。</span>
            </div>
            <div className="flex items-start space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF88] shrink-0 mt-0.5" />
              <span>娛樂稅是「地方稅」，由縣市稅捐稽徵處管轄。</span>
            </div>
            <div className="flex items-start space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF88] shrink-0 mt-0.5" />
              <span>業者為代徵人，應於「次月10日前」完成申報繳納。</span>
            </div>
            <div className="flex items-start space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF88] shrink-0 mt-0.5" />
              <span>辦理符合規定之慈善義演，可享有全額免稅優待。</span>
            </div>
          </div>
        </div>

        {/* Action button row */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {/* PLAY AGAIN */}
          <button
            onClick={handleRestart}
            id="restart-game-btn"
            className="flex-1 py-4.5 px-6 rounded-2xl font-black text-black bg-[#00FF88] hover:bg-[#00e67a] shadow-[0_0_20px_rgba(0,255,136,0.25)] hover:shadow-[0_0_30px_rgba(0,255,136,0.45)] transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center space-x-2.5 cursor-pointer group"
          >
            <RefreshCw className="w-5 h-5 text-black group-hover:rotate-180 transition-transform duration-500" />
            <span className="font-extrabold">重新挑戰一局</span>
          </button>

          {/* BACK TO MENU */}
          <button
            onClick={() => {
              playMenuClose();
              setView('menu');
            }}
            id="home-menu-btn"
            className="py-4.5 px-6 rounded-2xl font-bold bg-black/40 border border-white/10 hover:bg-[#1a1a1a] hover:border-white/20 text-gray-300 hover:text-white transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Home className="w-5 h-5" />
            <span>返回主選單</span>
          </button>
        </div>

      </div>

    </div>
  );
};
