import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CompetitiveMode } from '../../engine/competitive/types';
import { useCompetitiveSession } from '../../hooks/useCompetitiveSession';
import { SprintHeader } from './SprintHeader';
import { SurvivalHeader } from './SurvivalHeader';
import { CompetitiveResultView } from './CompetitiveResultView';
import { soundManager } from '../../utils/sound';

export interface CompetitivePlayScreenProps {
  mode: CompetitiveMode;
  secret: string;
  userId?: string;
  isRanked?: boolean;
  onExit: () => void;
  onPlayAgain?: () => void;
}

const CompetitivePlayScreenInner: React.FC<CompetitivePlayScreenProps> = ({
  mode,
  secret,
  userId,
  isRanked,
  onExit,
  onPlayAgain,
}) => {
  const [userInput, setUserInput] = useState<string>('');
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    currentQuestion,
    comboStreak,
    difficultyReached,
    timeRemainingMs,
    totalElapsedMs,
    isGameOver,
    submitAnswer,
    abandonSession,
    resultOutput,
  } = useCompetitiveSession({ mode, secret, userId, isRanked });

  // Focus input automatically
  useEffect(() => {
    inputRef.current?.focus();
  }, [currentQuestion]);

  // Clean up feedback timer
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const handleInputSubmit = useCallback(() => {
    if (!userInput.trim() || isGameOver) return;
    const inputVal = userInput.trim();
    const isCorrect = submitAnswer(inputVal);
    soundManager.playCorrect();

    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedback(isCorrect ? 'correct' : 'wrong');
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback('none');
    }, 600);

    setUserInput('');
  }, [userInput, isGameOver, submitAnswer]);

  const handleNumberClick = useCallback(
    (num: string) => {
      if (isGameOver) return;
      soundManager.playClick();
      setUserInput((prev) => (prev.length < 10 ? prev + num : prev));
    },
    [isGameOver]
  );

  const handleBackspace = useCallback(() => {
    if (isGameOver) return;
    soundManager.playClick();
    setUserInput((prev) => prev.slice(0, -1));
  }, [isGameOver]);

  // Physical keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onExit();
        }
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        soundManager.playClick();
        setUserInput((prev) => (prev.length < 10 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        soundManager.playClick();
        setUserInput((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleInputSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        abandonSession();
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGameOver, handleInputSubmit, abandonSession, onExit]);

  // Result screen when game is over
  if (isGameOver && resultOutput) {
    return (
      <div className="w-full max-w-xl mx-auto py-6">
        <CompetitiveResultView
          output={resultOutput}
          onPlayAgain={onPlayAgain || (() => {})}
          onExit={onExit}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-5 py-4 pb-12">
      {/* Top Header Row with Back Button and Mode HUD */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            abandonSession();
            onExit();
          }}
          aria-label="Kembali"
          title="Keluar (Escape)"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/50 text-indigo-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1">
          {mode === 'sprint' ? (
            <SprintHeader
              timeRemainingMs={timeRemainingMs}
              comboStreak={comboStreak}
              difficultyTier={difficultyReached}
            />
          ) : (
            <SurvivalHeader
              timeRemainingMs={timeRemainingMs}
              totalElapsedMs={totalElapsedMs}
              difficultyTier={difficultyReached}
              feedback={feedback}
            />
          )}
        </div>
      </div>

      {/* Central Question Prompt Card */}
      <div
        className={`w-full p-8 rounded-3xl bg-indigo-950/80 backdrop-blur-md text-center transition-all duration-300 border-2 shadow-xl ${
          feedback === 'correct'
            ? 'border-emerald-500 shadow-emerald-500/20'
            : feedback === 'wrong'
            ? 'border-rose-500 shadow-rose-500/20'
            : 'border-indigo-700/60'
        }`}
      >
        <div
          aria-live="polite"
          className="text-4xl sm:text-5xl font-mono font-black tracking-tight text-white select-none"
        >
          {currentQuestion?.renderedPrompt ?? '...'}
        </div>
      </div>

      {/* Answer Input Display */}
      <div className="w-full">
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={userInput}
          placeholder="Ketik jawaban..."
          aria-label="Jawaban"
          className="w-full text-center text-3xl font-mono font-black tracking-widest bg-indigo-900/40 text-white placeholder-indigo-400/50 border-2 border-indigo-700/60 rounded-2xl py-3.5 px-4 focus:outline-none focus:border-amber-400 transition-colors shadow-inner"
        />
      </div>

      {/* Touch-Friendly 3-Column Numeric Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleNumberClick(digit)}
            className="min-h-[48px] min-w-[48px] h-14 rounded-2xl bg-indigo-900/70 hover:bg-indigo-800/80 active:scale-95 border border-indigo-700/60 text-white font-mono font-black text-2xl flex items-center justify-center transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {digit}
          </button>
        ))}

        {/* Backspace Button */}
        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Backspace"
          className="min-h-[48px] min-w-[48px] h-14 rounded-2xl bg-rose-900/40 hover:bg-rose-900/60 active:scale-95 border border-rose-700/50 text-rose-300 font-mono font-black text-2xl flex items-center justify-center transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-rose-400"
        >
          ⌫
        </button>

        {/* Zero Button */}
        <button
          type="button"
          onClick={() => handleNumberClick('0')}
          className="min-h-[48px] min-w-[48px] h-14 rounded-2xl bg-indigo-900/70 hover:bg-indigo-800/80 active:scale-95 border border-indigo-700/60 text-white font-mono font-black text-2xl flex items-center justify-center transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          0
        </button>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleInputSubmit}
          aria-label="Submit"
          className="min-h-[48px] min-w-[48px] h-14 rounded-2xl bg-emerald-600/70 hover:bg-emerald-500/80 active:scale-95 border border-emerald-400/60 text-white font-mono font-black text-2xl flex items-center justify-center transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          ↵
        </button>
      </div>
    </div>
  );
};

export const CompetitivePlayScreen: React.FC<CompetitivePlayScreenProps> = (props) => {
  const [sessionKey, setSessionKey] = useState(0);

  const handlePlayAgain = () => {
    setSessionKey((prev) => prev + 1);
    props.onPlayAgain?.();
  };

  return (
    <CompetitivePlayScreenInner
      key={sessionKey}
      {...props}
      onPlayAgain={handlePlayAgain}
    />
  );
};
