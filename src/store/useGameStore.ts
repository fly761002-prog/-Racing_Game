/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { GameView, GameSettings, LeaderboardEntry, Question, FinalRacerRanking } from '../types/game';
import { taxQuestions, getShuffledQuestions } from '../data/questions';
import { AudioManager } from '../audio/AudioManager';

interface GameStore {
  // Navigation & Settings
  currentView: GameView;
  settings: GameSettings;
  leaderboard: LeaderboardEntry[];
  
  // Game session states
  score: number;
  combo: number;
  maxCombo: number;
  correctAnswers: number;
  incorrectAnswers: number;
  totalAnswered: number;
  timeLeft: number; // in seconds, default 180
  incorrectQuestionsList: { question: Question; chosenOption: 'A' | 'B' }[];
  answeredQuestionsList: { question: Question; chosenOption: 'A' | 'B'; isCorrect: boolean }[];
  realtimeRank: number;
  selectedAnswer: 'A' | 'B' | null;
  currentSpeed: number;
  finalRankings: FinalRacerRanking[];
  isCompleting: boolean;
  crossedFinishLine: boolean;
  
  // Question states
  currentQuestionList: Question[];
  currentQuestionIndex: number;
  currentQuestion: Question | null;
  
  // UI states for feedbacks
  feedbackType: 'correct' | 'incorrect' | 'obstacle' | null;
  feedbackText: string;
  feedbackExplanation: string | null;
  showFeedbackModal: boolean;
  
  // Actions
  setView: (view: GameView) => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  loadLeaderboard: () => void;
  addLeaderboardEntry: (name: string, score: number, accuracy: number, maxCombo: number) => void;
  
  // Game control Actions
  initGame: () => void;
  decrementTime: () => void;
  answerQuestion: (option: 'A' | 'B') => { isCorrect: boolean; explanation: string };
  selectAnswer: (option: 'A' | 'B') => void;
  clearSelectedAnswer: () => void;
  addBonusPoints: (points: number) => void;
  triggerObstacleHit: () => void;
  clearFeedback: () => void;
  endGame: () => void;
  setRealtimeRank: (rank: number) => void;
  setCurrentSpeed: (speed: number) => void;
  setFinalRankings: (rankings: FinalRacerRanking[]) => void;
  setCrossedFinishLine: (crossed: boolean) => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  playerName: '極速稅務官',
  bgmVolume: 80,
  sfxVolume: 80,
  carColor: '#ef4444', // Red-500
  difficulty: 'normal'
};

export const useGameStore = create<GameStore>((set, get) => ({
  // Navigation & Settings
  currentView: 'menu',
  settings: { ...DEFAULT_SETTINGS },
  leaderboard: [],
  
  // Game session states
  score: 0,
  combo: 0,
  maxCombo: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  totalAnswered: 0,
  timeLeft: 180,
  incorrectQuestionsList: [],
  answeredQuestionsList: [],
  realtimeRank: 4,
  selectedAnswer: null,
  currentSpeed: 0,
  finalRankings: [],
  isCompleting: false,
  crossedFinishLine: false,
  
  // Question states
  currentQuestionList: [],
  currentQuestionIndex: 0,
  currentQuestion: null,
  
  // Feedbacks
  feedbackType: null,
  feedbackText: '',
  feedbackExplanation: null,
  showFeedbackModal: false,

  setView: (view) => {
    set({ currentView: view });
    
    // 依據不同的 View 動態切換 BGM
    const am = AudioManager.getInstance();
    if (view === 'menu') {
      am.stopEngine();
      am.playBGM('bgm_menu');
    } else if (view === 'playing') {
      am.playBGM('bgm_playing');
      get().initGame();
    } else if (view === 'gameover') {
      am.stopEngine();
      am.playBGM('bgm_gameover');
    }
  },

  updateSettings: (newSettings) => {
    set((state) => {
      const updated = { ...state.settings, ...newSettings };
      localStorage.setItem('tax_racer_settings', JSON.stringify(updated));
      
      // 動態將音量變更同步到 AudioManager
      const am = AudioManager.getInstance();
      if (updated.bgmVolume !== undefined) {
        am.setBGM(updated.bgmVolume);
      }
      if (updated.sfxVolume !== undefined) {
        am.setSFX(updated.sfxVolume);
      }
      
      return { settings: updated };
    });
  },

  loadLeaderboard: () => {
    try {
      const stored = localStorage.getItem('tax_racer_leaderboard');
      const loaded = stored ? JSON.parse(stored) : [];
      set({ leaderboard: loaded });
    } catch (e) {
      console.error('Failed to load leaderboard', e);
    }
  },

  addLeaderboardEntry: (name, score, accuracy, maxCombo) => {
    const entry: LeaderboardEntry = {
      id: Math.random().toString(36).substr(2, 9),
      name: name || '無名車手',
      score,
      accuracy,
      maxCombo,
      date: new Date().toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    set((state) => {
      const newLeaderboard = [...state.leaderboard, entry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Keep top 10
      localStorage.setItem('tax_racer_leaderboard', JSON.stringify(newLeaderboard));
      return { leaderboard: newLeaderboard };
    });
  },

  initGame: () => {
    // Load local settings if exists
    try {
      const storedSettings = localStorage.getItem('tax_racer_settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        set({ settings: parsed });
        
        // 載入遊戲時同步音量
        const am = AudioManager.getInstance();
        if (parsed.bgmVolume !== undefined) am.setBGM(parsed.bgmVolume);
        if (parsed.sfxVolume !== undefined) am.setSFX(parsed.sfxVolume);
      }
    } catch (_) {}

    const shuffled = getShuffledQuestions();
    set({
      score: 0,
      combo: 0,
      maxCombo: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      totalAnswered: 0,
      timeLeft: 180,
      incorrectQuestionsList: [],
      answeredQuestionsList: [],
      realtimeRank: 4,
      selectedAnswer: null,
      isCompleting: false,
      crossedFinishLine: false,
      currentQuestionList: shuffled,
      currentQuestionIndex: 0,
      currentQuestion: shuffled[0] || null,
      feedbackType: null,
      feedbackText: '',
      feedbackExplanation: null,
      showFeedbackModal: false,
      finalRankings: []
    });

    // 啟動引擎音效
    AudioManager.getInstance().startEngine();
  },

  decrementTime: () => {
    // No-op as requested (取消遊戲倒數)
  },

  answerQuestion: (option) => {
    const { currentQuestion, currentQuestionList, currentQuestionIndex, combo, maxCombo, score, correctAnswers, incorrectAnswers, totalAnswered } = get();
    
    if (!currentQuestion) {
      return { isCorrect: false, explanation: '' };
    }

    const isCorrect = currentQuestion.correctOption === option;
    const nextCombo = isCorrect ? combo + 1 : 0;
    const nextMaxCombo = Math.max(maxCombo, nextCombo);
    
    // Calculate score
    // Correct: +10, Combo every 5: extra +15
    // Incorrect: -5
    let scoreChange = isCorrect ? 10 : -5;
    const isComboMilestone = isCorrect && nextCombo > 0 && nextCombo % 5 === 0;
    if (isComboMilestone) {
      scoreChange += 15; // Combo bonus!
    }
    const nextScore = Math.max(0, score + scoreChange);
    
    const nextIndex = (currentQuestionIndex + 1) % currentQuestionList.length;
    const nextQuestion = currentQuestionList[nextIndex] || null;

    // 播放答題音效
    const am = AudioManager.getInstance();
    if (isCorrect) {
      if (isComboMilestone) {
        am.play('combo_up');
      } else {
        am.play('correct');
      }
    } else {
      am.play('wrong');
    }

    const updatedIncorrectList = !isCorrect
      ? [...get().incorrectQuestionsList, { question: currentQuestion, chosenOption: option }]
      : get().incorrectQuestionsList;

    const updatedAnsweredList = [
      ...get().answeredQuestionsList,
      { question: currentQuestion, chosenOption: option, isCorrect }
    ];

    const nextTotalAnswered = totalAnswered + 1;

    set({
      score: nextScore,
      combo: nextCombo,
      maxCombo: nextMaxCombo,
      correctAnswers: isCorrect ? correctAnswers + 1 : correctAnswers,
      incorrectAnswers: !isCorrect ? incorrectAnswers + 1 : incorrectAnswers,
      totalAnswered: nextTotalAnswered,
      currentQuestionIndex: nextIndex,
      currentQuestion: nextQuestion,
      incorrectQuestionsList: updatedIncorrectList,
      answeredQuestionsList: updatedAnsweredList,
      selectedAnswer: null, // Clear selection for the next question
      feedbackType: isCorrect ? 'correct' : 'incorrect',
      feedbackText: isCorrect 
        ? `答對了！ ${nextCombo > 0 && nextCombo % 5 === 0 ? '🔥 達成 5 連擊，額外加 15 分！' : '+10 分'}` 
        : `答錯了！ 正確答案是【${currentQuestion.correctOption}】`,
      feedbackExplanation: currentQuestion.explanation,
      showFeedbackModal: false // 答錯解說於遊戲結束後一併顯示，遊玩中不再彈出視窗打斷
    });

    // Auto clear feedback after 2 seconds
    setTimeout(() => {
      const state = get();
      if (state.feedbackType === 'correct' || state.feedbackType === 'incorrect') {
        set({ feedbackType: null, feedbackText: '', feedbackExplanation: null });
      }
    }, 2000);

    if (nextTotalAnswered >= 10) {
      set({ isCompleting: true });
      
      // Play extra celebratory/achievement sounds via AudioManager
      setTimeout(() => {
        const am = AudioManager.getInstance();
        am.play('combo_up', { pitch: 0.85 });
      }, 300);
      setTimeout(() => {
        const am = AudioManager.getInstance();
        am.play('correct', { pitch: 1.2 });
      }, 900);

      setTimeout(() => {
        get().endGame();
        set({ isCompleting: false });
      }, 8500); // 8500ms total: 4.5s slow-motion rank adjust + 1.5s finish line rush + 2.5s post-race celebration
    }

    return { isCorrect, explanation: currentQuestion.explanation };
  },

  triggerObstacleHit: () => {
    // 播放碰撞音效（預設中等車速）
    AudioManager.getInstance().play('crash', { pitch: 0.65 });

    set((state) => {
      const nextScore = Math.max(0, state.score - 10);
      return {
        score: nextScore,
        combo: 0, // Reset combo
        feedbackType: 'obstacle',
        feedbackText: '💥 撞擊障礙物！ 減速並扣 10 分',
        feedbackExplanation: null,
        showFeedbackModal: false // HUD flash only, don't interrupt racing with popup
      };
    });

    // Auto clear feedback after 2 seconds
    setTimeout(() => {
      const state = get();
      if (state.feedbackType === 'obstacle') {
        set({ feedbackType: null, feedbackText: '', feedbackExplanation: null });
      }
    }, 2000);
  },

  clearFeedback: () => {
    set({
      feedbackType: null,
      feedbackText: '',
      feedbackExplanation: null,
      showFeedbackModal: false
    });
  },

  endGame: () => {
    const { score, correctAnswers, totalAnswered, maxCombo, settings, addLeaderboardEntry } = get();
    const accuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;
    
    // Auto add to leaderboard
    get().loadLeaderboard();
    addLeaderboardEntry(settings.playerName, score, accuracy, maxCombo);
    
    // 停止引擎聲並播放 Game Over 樂音
    const am = AudioManager.getInstance();
    am.stopEngine();
    am.play('game_over_sound');

    set({ currentView: 'gameover' });
    am.playBGM('bgm_gameover');
  },

  setRealtimeRank: (rank) => {
    set({ realtimeRank: rank });
  },

  setFinalRankings: (rankings) => {
    set({ finalRankings: rankings });
  },

  setCurrentSpeed: (speed) => {
    set({ currentSpeed: speed });
  },

  setCrossedFinishLine: (crossed) => {
    set({ crossedFinishLine: crossed });
  },

  selectAnswer: (option) => {
    set({ selectedAnswer: option });
  },

  clearSelectedAnswer: () => {
    set({ selectedAnswer: null });
  },

  addBonusPoints: (points) => {
    const { score } = get();
    set({
      score: score + points,
      feedbackType: 'correct',
      feedbackText: `✨ 獲得加分禮物！+${points} 分！`
    });
    // Auto clear feedback after 1.5 seconds
    setTimeout(() => {
      const state = get();
      if (state.feedbackText.includes('獲得加分禮物')) {
        set({ feedbackType: null, feedbackText: '' });
      }
    }, 1500);
  }
}));
