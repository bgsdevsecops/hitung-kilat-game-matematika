import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CompetitiveMode, CompetitiveQuestionView } from '../../engine/competitive/types';
import { useCompetitiveSession } from '../../hooks/useCompetitiveSession';
import { SprintHeader } from './SprintHeader';
import { SurvivalHeader } from './SurvivalHeader';
import { CompetitiveResultView } from './CompetitiveResultView';
import { soundManager } from '../../utils/sound';
import { evaluateCompetitiveEligibility } from '../../lib/competitiveEligibility';
import { createCompetitiveApiClient, CompetitiveApiClient } from '../../lib/competitiveApi';
import { isCompetitiveRankedEnabled } from '../../lib/featureFlags';
import { loadPrivacyState } from '../../utils/privacy/privacyState';
import { auth } from '../../lib/firebase';
import { PrivacyState } from '../../types';

export interface CompetitivePlayScreenProps {
  mode: CompetitiveMode;
  secret: string;
  userId?: string;
  isRanked?: boolean;
  onExit: () => void;
  onPlayAgain?: () => void;
  apiClient?: CompetitiveApiClient;
  privacyState?: PrivacyState;
}

interface CompetitivePlayScreenInnerProps extends CompetitivePlayScreenProps {
  resolvedExecutionMode: 'ranked' | 'practice';
  serverSessionId?: string;
  initialServerQuestions?: CompetitiveQuestionView[];
  client: CompetitiveApiClient;
}

const CompetitivePlayScreenInner: React.FC<CompetitivePlayScreenInnerProps> = ({
  mode,
  secret,
  userId,
  isRanked,
  onExit,
  onPlayAgain,
  resolvedExecutionMode,
  serverSessionId,
  initialServerQuestions,
  client,
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
    isRankedSession,
  } = useCompetitiveSession({
    mode,
    secret,
    userId,
    isRanked,
    executionMode: resolvedExecutionMode,
    serverSessionId,
    initialServerQuestions,
    apiClient: client,
  });

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
    if (isCorrect) {
      soundManager.playCorrect(comboStreak);
    } else {
      soundManager.playWrong();
    }

    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedback(isCorrect ? 'correct' : 'wrong');
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback('none');
    }, 600);

    setUserInput('');
  }, [userInput, isGameOver, submitAnswer, comboStreak]);

  const handleNumberClick = useCallback(
    (num: string) => {
      if (isGameOver) return;
      soundManager.playClick();
      setUserInput((prev) => {
        if (prev.length >= 10) return prev;
        if (prev === '0') return num;
        if (prev === '-0') return '-' + num;
        if (prev.endsWith('/0')) return prev.slice(0, -1) + num;
        return prev + num;
      });
    },
    [isGameOver]
  );

  const handleSymbolClick = useCallback(
    (sym: '-' | '/') => {
      if (isGameOver) return;
      soundManager.playClick();
      setUserInput((prev) => {
        if (prev.length >= 10) return prev;
        if (sym === '-') {
          return prev.startsWith('-') ? prev.slice(1) : '-' + prev;
        }
        if (sym === '/') {
          if (prev === '' || prev === '-' || prev.includes('/')) return prev;
          return prev + '/';
        }
        return prev;
      });
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
        handleNumberClick(e.key);
      } else if (e.key === '-' || e.key === '/') {
        e.preventDefault();
        handleSymbolClick(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
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
  }, [isGameOver, handleNumberClick, handleSymbolClick, handleBackspace, handleInputSubmit, abandonSession, onExit]);

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
      {/* Mode Indicator Badge */}
      <div className="flex items-center justify-between px-1">
        {isRankedSession ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Ranked · Server Validated
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Mode Lokal Aman · Tidak Berperingkat
          </span>
        )}
      </div>

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

      {/* Touch-Friendly Numeric Keypad */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-sm mx-auto">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleNumberClick(digit)}
            className="min-h-[48px] min-w-[48px] h-13 sm:h-14 rounded-2xl bg-indigo-900/70 hover:bg-indigo-800/80 active:scale-95 border border-indigo-700/60 text-white font-mono font-black text-2xl flex items-center justify-center transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {digit}
          </button>
        ))}

        {/* Negative Sign Button */}
        <button
          type="button"
          onClick={() => handleSymbolClick('-')}
          aria-label="Tanda Minus"
          className="min-h-[48px] min-w-[48px] h-13 sm:h-14 rounded-2xl bg-indigo-900/70 hover:bg-indigo-800/80 active:scale-95 border border-indigo-700/60 text-white font-mono font-black text-2xl flex items-center justify-center transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          ±
        </button>

        {/* Zero Digit */}
        <button
          type="button"
          onClick={() => handleNumberClick('0')}
          className="min-h-[48px] min-w-[48px] h-13 sm:h-14 rounded-2xl bg-indigo-900/70 hover:bg-indigo-800/80 active:scale-95 border border-indigo-700/60 text-white font-mono font-black text-2xl flex items-center justify-center transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          0
        </button>

        {/* Slash / Fraction Button */}
        <button
          type="button"
          onClick={() => handleSymbolClick('/')}
          aria-label="Garis Miring atau Pecahan"
          className="min-h-[48px] min-w-[48px] h-13 sm:h-14 rounded-2xl bg-indigo-900/70 hover:bg-indigo-800/80 active:scale-95 border border-indigo-700/60 text-white font-mono font-black text-2xl flex items-center justify-center transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          /
        </button>

        {/* Backspace Button */}
        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Backspace"
          className="min-h-[48px] min-w-[48px] h-13 sm:h-14 rounded-2xl bg-rose-900/40 hover:bg-rose-900/60 active:scale-95 border border-rose-700/50 text-rose-300 font-mono font-black text-2xl flex items-center justify-center transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-rose-400"
        >
          ⌫
        </button>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleInputSubmit}
          aria-label="Submit"
          className="col-span-2 min-h-[48px] min-w-[48px] h-13 sm:h-14 rounded-2xl bg-emerald-600/70 hover:bg-emerald-500/80 active:scale-95 border border-emerald-400/60 text-white font-mono font-black text-2xl flex items-center justify-center transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          ↵
        </button>
      </div>
    </div>
  );
};

export const CompetitivePlayScreen: React.FC<CompetitivePlayScreenProps> = (props) => {
  const { mode, apiClient, privacyState, onPlayAgain } = props;
  const [sessionKey, setSessionKey] = useState(0);

  const clientRef = useRef<CompetitiveApiClient | null>(null);
  if (!clientRef.current || apiClient) {
    clientRef.current = apiClient || createCompetitiveApiClient();
  }
  const client = clientRef.current;

  const currentPrivacy = privacyState || loadPrivacyState();
  const currentUser = auth.currentUser;
  const isGuest = currentUser ? currentUser.isAnonymous : true;
  const isAuthenticated = Boolean(currentUser && !currentUser.isAnonymous);
  const featureFlagEnabled = isCompetitiveRankedEnabled();

  const eligibility = evaluateCompetitiveEligibility({
    ageEligibility: currentPrivacy.ageEligibility,
    isGuest,
    isAuthenticated,
    leaderboardOptOut: Boolean(currentPrivacy.leaderboardOptOut),
    featureFlagEnabled,
  });

  const [initStatus, setInitStatus] = useState<'initializing' | 'ready'>(() => {
    return eligibility.executionMode === 'practice' ? 'ready' : 'initializing';
  });
  const [resolvedExecutionMode, setResolvedExecutionMode] = useState<'ranked' | 'practice'>(
    eligibility.executionMode
  );
  const [serverSessionId, setServerSessionId] = useState<string | undefined>(undefined);
  const [initialServerQuestions, setInitialServerQuestions] = useState<CompetitiveQuestionView[] | undefined>(
    undefined
  );

  useEffect(() => {
    let cancelled = false;

    if (eligibility.executionMode === 'practice') {
      setResolvedExecutionMode('practice');
      setInitStatus('ready');
      return;
    }

    setInitStatus('initializing');

    client
      .createSession({
        mode,
        idempotencyKey: `init_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      })
      .then((res) => {
        if (!cancelled) {
          setServerSessionId(res.session.sessionId);
          setInitialServerQuestions(res.questions);
          setResolvedExecutionMode('ranked');
          setInitStatus('ready');
        }
      })
      .catch(() => {
        // Fallback to local practice on API/network error
        if (!cancelled) {
          setResolvedExecutionMode('practice');
          setInitStatus('ready');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionKey, mode, client, eligibility.executionMode]);

  const handlePlayAgain = () => {
    setSessionKey((prev) => prev + 1);
    onPlayAgain?.();
  };

  if (initStatus === 'initializing') {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center py-24 text-center gap-4">
        <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-indigo-200 font-medium tracking-wide">Mempersiapkan arena kompetitif...</p>
      </div>
    );
  }

  return (
    <CompetitivePlayScreenInner
      key={sessionKey}
      {...props}
      resolvedExecutionMode={resolvedExecutionMode}
      serverSessionId={serverSessionId}
      initialServerQuestions={initialServerQuestions}
      client={client}
      onPlayAgain={handlePlayAgain}
    />
  );
};

export default CompetitivePlayScreen;
