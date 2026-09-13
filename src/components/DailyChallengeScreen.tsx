import React, { useState, useEffect, useCallback, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  DailyChallengeUserState,
  DailyChallengeRecord,
  Question,
} from '../types';
import {
  loadDailyChallengeState,
  saveDailyChallengeState,
} from '../utils/dailyChallenge';
import {
  getWIBDateString,
  getWIBTimeUntilMidnight,
  generateDailyQuestions,
} from '../utils/dailyWib';
import { isDailyStreakEligible } from '../engine/competitive/modes/daily';
import { useCompetitiveSession } from '../hooks/useCompetitiveSession';
import { ValidationOutput } from '../engine/competitive/validator';
import { DailyHubView } from './daily/DailyHubView';
import { DailyHeader } from './daily/DailyHeader';
import { DailyResultView } from './daily/DailyResultView';
import { soundManager } from '../utils/sound';

export interface DailyChallengeScreenProps {
  onExit: () => void;
  onOpenStats: () => void;
}

const STAGE_TITLES = [
  'Refleks Puluhan',
  'Pengurangan Puluhan',
  'Perkalian Refleks',
  'Pembagian Cepat',
  'Rantai 3 Bilangan',
  'Pengurangan Majemuk',
  'Perkalian Puluhan Dekat',
  'Operasi BODMAS',
  'Aljabar Linear Cepat',
  'Grandmaster Mental Math',
];

const DAILY_SECRET = 'daily-challenge-v2-local-secret';

interface DailyPlayArenaProps {
  challengeId: string;
  dailyQuestions: Question[];
  isRanked: boolean;
  onFinish: (output: ValidationOutput) => void;
  onExit: () => void;
}

const DailyPlayArena: React.FC<DailyPlayArenaProps> = ({
  challengeId,
  dailyQuestions,
  isRanked,
  onFinish,
  onExit,
}) => {
  const [inputBuffer, setInputBuffer] = useState<string>('');

  const session = useCompetitiveSession({
    mode: 'daily',
    secret: DAILY_SECRET,
    challengeId,
    dailyQuestions,
    isRanked,
    onFinish,
  });

  const handleSubmitAnswer = useCallback(() => {
    if (!inputBuffer.trim()) return;
    const isCorrect = session.submitAnswer(inputBuffer.trim());
    if (isCorrect) {
      soundManager.playCorrect();
    } else {
      soundManager.playWrong();
    }
    setInputBuffer('');
  }, [inputBuffer, session]);

  // Keyboard navigation during play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        setInputBuffer((prev) => prev + e.key);
      } else if (e.key === '-') {
        setInputBuffer((prev) => (prev.startsWith('-') ? prev.slice(1) : '-' + prev));
      } else if (e.key === '/') {
        setInputBuffer((prev) => (prev.includes('/') ? prev : prev + '/'));
      } else if (e.key === 'Backspace') {
        setInputBuffer((prev) => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        handleSubmitAnswer();
      } else if (e.key === 'Escape') {
        session.abandonSession();
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmitAnswer, session, onExit]);

  const currentQIdx = Math.min(9, Math.max(0, (session.currentQuestion?.sequence ?? 1) - 1));
  const currentStageTitle = STAGE_TITLES[currentQIdx] || 'Tantangan Harian';

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-between min-h-[90vh] py-6 px-4">
      {/* HUD Header */}
      <DailyHeader
        timeRemainingMs={session.timeRemainingMs}
        currentQuestionIdx={currentQIdx}
        totalQuestions={10}
        comboStreak={session.comboStreak}
        stageTitle={currentStageTitle}
        onExit={() => {
          session.abandonSession();
          onExit();
        }}
      />

      {/* Central Math Prompt Card */}
      <div className="w-full my-auto flex flex-col items-center justify-center">
        <div
          role="region"
          aria-live="polite"
          className="w-full p-8 rounded-3xl bg-gradient-to-b from-indigo-950/90 to-indigo-900/90 border-2 border-indigo-700/80 shadow-2xl text-center"
        >
          <span className="text-3xl sm:text-5xl font-black font-mono tracking-wider text-white">
            {session.currentQuestion?.renderedPrompt || '...'}
          </span>
        </div>

        {/* Answer Display Field */}
        <div className="w-full mt-4">
          <input
            type="text"
            readOnly
            value={inputBuffer}
            placeholder="Ketik jawaban..."
            aria-label="Jawaban Anda"
            className="w-full min-h-[56px] text-center text-2xl font-mono font-black rounded-2xl bg-indigo-950 border-2 border-indigo-700 text-white placeholder-indigo-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>

      {/* Virtual Touch Keypad (>= 48px targets) */}
      <div className="w-full grid grid-cols-4 gap-2 sm:gap-2.5 mt-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => setInputBuffer((prev) => prev + String(digit))}
            aria-label={String(digit)}
            className="min-h-[52px] min-w-[48px] rounded-2xl bg-indigo-900/70 hover:bg-indigo-800 border border-indigo-700/60 text-white font-mono font-black text-xl flex items-center justify-center transition-all active:scale-95 shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {digit}
          </button>
        ))}

        {/* 0 and Utility Buttons */}
        <button
          type="button"
          onClick={() =>
            setInputBuffer((prev) => (prev.startsWith('-') ? prev.slice(1) : '-' + prev))
          }
          aria-label="Minus atau Negatif"
          className="min-h-[52px] min-w-[48px] rounded-2xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 font-mono font-black text-xl flex items-center justify-center transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          -
        </button>

        <button
          type="button"
          onClick={() => setInputBuffer((prev) => prev + '0')}
          aria-label="0"
          className="min-h-[52px] min-w-[48px] rounded-2xl bg-indigo-900/70 hover:bg-indigo-800 border border-indigo-700/60 text-white font-mono font-black text-xl flex items-center justify-center transition-all active:scale-95 shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          0
        </button>

        <button
          type="button"
          onClick={() => setInputBuffer((prev) => (prev.includes('/') ? prev : prev + '/'))}
          aria-label="Garis Miring atau Pecahan"
          className="min-h-[52px] min-w-[48px] rounded-2xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 font-mono font-black text-xl flex items-center justify-center transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          /
        </button>

        <button
          type="button"
          onClick={() => setInputBuffer((prev) => prev.slice(0, -1))}
          aria-label="Backspace"
          className="min-h-[52px] min-w-[48px] rounded-2xl bg-rose-950/70 hover:bg-rose-900 border border-rose-800 text-rose-300 font-mono font-black text-xl flex items-center justify-center transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-rose-400"
        >
          ⌫
        </button>

        <button
          type="button"
          onClick={handleSubmitAnswer}
          aria-label="Submit Jawaban"
          className="col-span-4 min-h-[52px] min-w-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center transition-all active:scale-98 shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          Jawab (↵)
        </button>
      </div>
    </div>
  );
};

export const DailyChallengeScreen: React.FC<DailyChallengeScreenProps> = ({
  onExit,
  onOpenStats,
}) => {
  const [screenState, setScreenState] = useState<'hub' | 'playing' | 'result'>('hub');
  const [sessionKey, setSessionKey] = useState<number>(0);
  const [userState, setUserState] = useState<DailyChallengeUserState>(() =>
    loadDailyChallengeState()
  );

  const todayStr = getWIBDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [countdown, setCountdown] = useState(() => getWIBTimeUntilMidnight());

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getWIBTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const challengeId = `${selectedDate}@Asia/Jakarta:2.0.0`;
  const dailyQuestions = useMemo(
    () => generateDailyQuestions(challengeId),
    [challengeId]
  );

  const isRanked = !userState.history[selectedDate] && selectedDate === todayStr;

  const [validationResult, setValidationResult] = useState<ValidationOutput | null>(null);
  const [isStreakIncremented, setIsStreakIncremented] = useState<boolean>(false);

  const handleFinish = useCallback(
    (output: ValidationOutput) => {
      setValidationResult(output);
      const isEligible = isDailyStreakEligible(output.result);

      if (output.status === 'VALIDATED' && isRanked) {
        setUserState((prev) => {
          const newStreak = isEligible ? prev.currentStreak + 1 : prev.currentStreak;
          const newBest = Math.max(newStreak, prev.bestStreak);
          const newRecord: DailyChallengeRecord = {
            date: selectedDate,
            completed: true,
            score: output.result.score,
            timeTakenSec: output.result.rankedActiveDurationMs / 1000,
            correctCount: output.result.correctCount,
            totalQuestions: 10,
            accuracy: output.result.accuracy,
            maxStreak: output.result.maxStreak,
            rank: 1,
            completedAt: new Date().toISOString(),
            answers: [],
          };
          const nextState: DailyChallengeUserState = {
            ...prev,
            currentStreak: newStreak,
            bestStreak: newBest,
            lastCompletedDate: selectedDate,
            history: {
              ...prev.history,
              [selectedDate]: newRecord,
            },
          };
          saveDailyChallengeState(nextState);
          return nextState;
        });
        setIsStreakIncremented(isEligible);
        try {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        } catch {
          // ignore if canvas is not available in environment
        }
      } else {
        setIsStreakIncremented(false);
      }

      setScreenState('result');
    },
    [isRanked, selectedDate]
  );

  if (screenState === 'hub') {
    return (
      <DailyHubView
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        todayDateStr={todayStr}
        countdown={countdown}
        userState={userState}
        todayRecord={userState.history[selectedDate]}
        onStartChallenge={() => {
          setSessionKey((prev) => prev + 1);
          setScreenState('playing');
        }}
        onExit={onExit}
        onOpenStats={onOpenStats}
      />
    );
  }

  if (screenState === 'result' && validationResult) {
    return (
      <DailyResultView
        output={validationResult}
        isRanked={isRanked}
        challengeId={challengeId}
        currentStreak={userState.currentStreak}
        isStreakIncremented={isStreakIncremented}
        onPlayAgain={() => {
          setSessionKey((prev) => prev + 1);
          setScreenState('playing');
        }}
        onExit={() => setScreenState('hub')}
      />
    );
  }

  return (
    <DailyPlayArena
      key={sessionKey}
      challengeId={challengeId}
      dailyQuestions={dailyQuestions}
      isRanked={isRanked}
      onFinish={handleFinish}
      onExit={() => setScreenState('hub')}
    />
  );
};
