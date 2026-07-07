/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 宣告音效與背景音樂的實體檔案路徑
// 在不具備實體 mp3 的環境下，我們的 AudioManager 將提供高品質的 Web Audio API 模擬合成音效，確保 100% 可播放與絕佳效能
export const sounds = {
  // BGM
  bgm_menu: "/sounds/bgm_menu.mp3",
  bgm_playing: "/sounds/bgm_playing.mp3",
  bgm_gameover: "/sounds/bgm_gameover.mp3",

  // Core SFX
  correct: "/sounds/correct.mp3",
  wrong: "/sounds/wrong.mp3",
  crash: "/sounds/crash.mp3",

  // UI & Feedback SFX
  click: "/sounds/click.mp3",
  menu_open: "/sounds/menu_open.mp3",
  menu_close: "/sounds/menu_close.mp3",
  level_up: "/sounds/level_up.mp3",
  combo_up: "/sounds/combo_up.mp3",
  countdown_tick: "/sounds/countdown_tick.mp3",
  game_over_sound: "/sounds/game_over.mp3"
};

export type SoundName = keyof typeof sounds;
