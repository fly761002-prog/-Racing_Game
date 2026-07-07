/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Pseudo3DRacer } from './Pseudo3DRacer';
import { GameHUD } from '../components/GameHUD';
import { Play, Pause, RotateCcw, Home } from 'lucide-react';

export const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const racerRef = useRef<Pseudo3DRacer | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    settings,
    currentQuestion,
    answerQuestion,
    triggerObstacleHit,
    decrementTime,
    timeLeft,
    setView,
    feedbackType,
    feedbackText,
    showFeedbackModal,
    clearFeedback,
    score
  } = useGameStore();

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Pseudo 3D Engine
    const racer = new Pseudo3DRacer(
      canvasRef.current,
      settings.carColor,
      (option) => {
        // Trigger answer callback in store
        return answerQuestion(option);
      },
      () => {
        // Trigger obstacle hit callback in store
        triggerObstacleHit();
      },
      () => {
        // Supply current question or fallback
        return useGameStore.getState().currentQuestion;
      }
    );

    racerRef.current = racer;
    racer.start();

    // Resize handler
    const handleResize = () => {
      racer.resize();
    };
    window.addEventListener('resize', handleResize);

    // Gameplay Timer countdown (1 tick per second)
    timerRef.current = setInterval(() => {
      if (!useGameStore.getState().showFeedbackModal) {
        decrementTime();
      }
    }, 1000);

    return () => {
      // Clean up on unmount
      racer.stop();
      window.removeEventListener('resize', handleResize);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [answerQuestion, triggerObstacleHit, decrementTime]);

  // Update car colors live if changed in settings
  useEffect(() => {
    if (racerRef.current) {
      racerRef.current.updateCarColor(settings.carColor);
    }
  }, [settings.carColor]);

  // Handle ESC or Pause keys to return menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setView('menu');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setView]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 flex flex-col items-center justify-center">
      
      {/* 3D Render Canvas */}
      <div className="relative w-full h-full flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="w-full h-full block focus:outline-none"
          tabIndex={0}
          id="game-canvas"
        />
      </div>

      {/* Embedded HUD & Overlays */}
      <GameHUD />

      {/* Answer Explanation Modal (Only triggers on wrong answers to explain tax concept) */}
      {showFeedbackModal && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 transition-all duration-300">
          <div className="bg-slate-900 border border-red-500/50 rounded-2xl p-6 md:p-8 max-w-lg w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-in zoom-in duration-200">
            
            {/* Header */}
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-500/20 text-red-400 p-2.5 rounded-full border border-red-500/30">
                <span className="text-xl font-bold">💡</span>
              </div>
              <h3 className="text-xl font-bold text-red-400 tracking-tight">回答說明與娛樂稅知識</h3>
            </div>

            {/* Error prompt */}
            <p className="text-red-200 font-medium mb-4 pb-3 border-b border-slate-800">
              {feedbackText}
            </p>

            {/* Educational explanation content */}
            <div className="space-y-4 mb-6">
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <span className="text-xs text-indigo-400 font-semibold uppercase tracking-wider block mb-1">
                  娛樂稅小百科
                </span>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {useGameStore.getState().feedbackExplanation}
                </p>
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={clearFeedback}
              id="close-feedback-btn"
              className="w-full py-3.5 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 transition-all shadow-[0_4px_20px_rgba(239,68,68,0.3)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              了解！踩油門繼續競速 🏎️
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
