/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Question {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
  };
  correctOption: 'A' | 'B';
  explanation: string;
  category: string; // 例如：課徵範圍、稅率、減免規定、申報實務
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  accuracy: number; // 百分比
  maxCombo: number;
  date: string;
}

export interface GameSettings {
  playerName: string;
  bgmVolume: number; // 0 - 100
  sfxVolume: number; // 0 - 100
  carColor: string; // hex code
  difficulty: 'easy' | 'normal' | 'hard';
}

export type GameView = 'menu' | 'playing' | 'gameover' | 'leaderboard' | 'settings' | 'intro';

export interface FinalRacerRanking {
  id: string;
  name: string;
  score: number;
  accuracy: number;
  isPlayer: boolean;
  color: string;
  dist: number;
}

