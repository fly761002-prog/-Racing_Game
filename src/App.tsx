/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { useGameStore } from './store/useGameStore';
import { Dashboard } from './components/Dashboard';
import { GameCanvas } from './game/GameCanvas';
import { GameOver } from './components/GameOver';
import { Leaderboard } from './components/Leaderboard';
import { Settings } from './components/Settings';
import { IntroGuide } from './components/IntroGuide';
import { AudioManager } from './audio/AudioManager';

export default function App() {
  const currentView = useGameStore((state) => state.currentView);

  useEffect(() => {
    const am = AudioManager.getInstance();
    
    // 初始嘗試播放背景音樂
    am.playBGM('bgm_menu');

    // 瀏覽器 Autoplay 解鎖監聽：當使用者在頁面上進行任何點擊或按鍵，解鎖 AudioContext
    const unlockAudio = () => {
      am.initContext();
      // 如果當前是在選單頁面，就播放選單背景音樂
      const current = useGameStore.getState().currentView;
      if (current === 'menu') {
        am.playBGM('bgm_menu');
      } else if (current === 'playing') {
        am.playBGM('bgm_playing');
      } else if (current === 'gameover') {
        am.playBGM('bgm_gameover');
      }
      
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      am.stopAll();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  return (
    <div className="w-full h-screen overflow-hidden bg-slate-950 font-sans select-none text-white antialiased">
      {currentView === 'menu' && <Dashboard />}
      {currentView === 'playing' && <GameCanvas />}
      {currentView === 'gameover' && <GameOver />}
      {currentView === 'leaderboard' && <Leaderboard />}
      {currentView === 'settings' && <Settings />}
      {currentView === 'intro' && <IntroGuide />}
    </div>
  );
}

