import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft, Pause, Play, Flame, Clock, Crown, Target } from 'lucide-react';
import { LevelConfig, Question, GameSummary } from '../types';
import { LevelConfigV2 } from '../engine/types/level';
import { createDefaultGeneratorRegistry } from '../engine/registry';
import { adaptV1LevelToV2 } from '../engine/adapter/v1Adapter';
import { DynamicKeypad, sanitizeKeypadInput } from './game/DynamicKeypad';
import { evaluateAnswer } from '../engine/evaluator/answerEvaluator';
import { calculateLevelStars } from '../utils/starRating';
import { ingestGameAnswers } from '../utils/masteryBridge';
import { soundManager } from '../utils/sound';

export interface PlayScreenProps {
  level: LevelConfigV2 | LevelConfig;
  currentStars?: number;
  onFinishLevel: (summary: GameSummary) => void;
  onExit: () => void;
  userId?: string;
}

export const PlayScreen: React.FC<PlayScreenProps> = ({
  level,
  currentStars = 0,
  onFinishLevel,
  onExit,
  userId = 'guest_user',
}) => {
  // Adapt legacy LevelConfig if needed
  const v2Level: LevelConfigV2 = useMemo(() => {
    if (typeof level.id === 'string' && 'generatorKey' in level) {
      const v2 = level as LevelConfigV2;
      return {
        ...v2,
        passingAccuracy: v2.passingAccuracy > 1 ? v2.passingAccuracy / 100 : v2.passingAccuracy,
      };
    }
    const adapted = adaptV1LevelToV2(level as LevelConfig);
    return {
      ...adapted,
      passingAccuracy: adapted.passingAccuracy > 1 ? adapted.passingAccuracy / 100 : adapted.passingAccuracy,
    };
  }, [level]);

  // Generator registry instance
  const registry = useMemo(() => createDefaultGeneratorRegistry(), []);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userInput, setUserInput] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);

  // Monotonic timer states
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // Visual feedback states
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [lastFeedbackDetail, setLastFeedbackDetail] = useState<{ isCorrect: boolean; explanation: string } | null>(null);
  const [floatingBonus, setFloatingBonus] = useState<string | null>(null);

  // Time and session tracking refs
  const levelStartTimeRef = useRef<number>(Date.now());
  const pausedDurationRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());
  const historyRef = useRef<Question[]>([]);
  const sessionIdRef = useRef<string>(`campaign_${v2Level.id}_${Date.now()}`);

  // Adaptive keypad flags
  const showNegative = Boolean(
    (v2Level.rules as any)?.allowNegative ||
    (v2Level.answerKind as string) === 'signed' ||
    (v2Level.rules as any)?.kind === 'signed'
  );
  const showSlash = v2Level.answerKind === 'rational';
  const showDecimal = v2Level.answerKind === 'decimal';

  // Initialize session questions using generator registry
  useEffect(() => {
    const seed = `campaign_${v2Level.id}_${Date.now()}`;
    const generated = registry.generateSessionQuestions(v2Level, seed);

    const adaptedQuestions: Question[] = generated.map((q, idx) => ({
      id: q.questionInstanceId || `${v2Level.id}_${idx + 1}`,
      prompt: q.displayPrompt.includes('?') ? q.displayPrompt : `${q.displayPrompt} = ?`,
      displayPrompt: q.displayPrompt,
      text: q.displayPrompt,
      correctAnswer: q.answerSpec.kind === 'integer' ? q.answerSpec.value : 0,
      options: [],
      explanation: q.explanation || `Jawaban: ${q.answerSpec.kind === 'integer' ? q.answerSpec.value : ''}`,
      answerSpec: q.answerSpec,
      primarySkillId: q.primarySkillId,
      subSkillId: q.subSkillId,
      skillTags: q.skillTags,
      difficulty: q.difficulty,
      templateFamily: q.templateFamily,
    }));

    setQuestions(adaptedQuestions);
    setCurrentIndex(0);
    setUserInput('');
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setWrongCount(0);
    setElapsedSec(0);
    setIsPaused(false);
    setIsGameOver(false);
    setFeedback('none');
    setLastFeedbackDetail(null);
    setFloatingBonus(null);

    historyRef.current = [];
    levelStartTimeRef.current = Date.now();
    pausedDurationRef.current = 0;
    pauseStartTimeRef.current = null;
    questionStartTimeRef.current = Date.now();
    sessionIdRef.current = `campaign_${v2Level.id}_${Date.now()}`;
  }, [v2Level, registry]);

  // Handle Pause Duration Tracking
  const togglePause = useCallback(() => {
    soundManager.playClick();
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        pauseStartTimeRef.current = Date.now();
      } else if (pauseStartTimeRef.current !== null) {
        pausedDurationRef.current += Date.now() - pauseStartTimeRef.current;
        pauseStartTimeRef.current = null;
      }
      return next;
    });
  }, []);

  // Handle Level End
  const handleComplete = useCallback((
    timeout: boolean = false,
    finalCorrect?: number,
    finalWrong?: number,
    finalScore?: number,
    finalMaxStreak?: number
  ) => {
    if (isGameOver) return;
    setIsGameOver(true);

    const now = Date.now();
    let currentPausedDuration = pausedDurationRef.current;
    if (pauseStartTimeRef.current !== null) {
      currentPausedDuration += now - pauseStartTimeRef.current;
    }
    const totalDurationMs = Math.max(1000, now - levelStartTimeRef.current - currentPausedDuration);
    const timeSpent = Math.max(1, Math.round(totalDurationMs / 1000));

    const actualCorrect = finalCorrect !== undefined ? finalCorrect : correctCount;
    const actualWrong = finalWrong !== undefined ? finalWrong : wrongCount;
    const actualScore = finalScore !== undefined ? finalScore : score;
    const actualMaxStreak = finalMaxStreak !== undefined ? finalMaxStreak : maxStreak;

    const totalAnswered = actualCorrect + actualWrong;
    const accuracy = totalAnswered > 0 ? Math.round((actualCorrect / totalAnswered) * 100) : 0;
    const questionsPerMin = Math.round((actualCorrect / (timeSpent / 60)));

    // Calculate stars using canonical V2 calculator
    const starResult = calculateLevelStars(
      v2Level,
      actualCorrect,
      v2Level.questionCount,
      timeSpent,
      timeout
    );
    const stars = starResult.stars;

    if (stars > 0) {
      soundManager.playFanfare();
    } else {
      soundManager.playWrong();
    }

    const isNewStarRecord = stars > currentStars;

    // Live Learning Ingestion into MasteryStore
    try {
      ingestGameAnswers(sessionIdRef.current, userId, historyRef.current);
    } catch {
      // Ingestion fallback
    }

    const summary: GameSummary = {
      mode: 'campaign',
      levelId: v2Level.id,
      score: actualScore,
      questionsTotal: v2Level.questionCount,
      correctCount: actualCorrect,
      wrongCount: actualWrong,
      accuracy,
      timeSpentSec: timeSpent,
      avgTimePerQuestionSec: Number((timeSpent / Math.max(1, totalAnswered)).toFixed(1)),
      questionsPerMinute: questionsPerMin,
      maxStreak: actualMaxStreak,
      starsEarned: stars,
      history: historyRef.current,
      isNewRecord: isNewStarRecord,
      isNewStarRecord,
      previousStars: currentStars,
      sessionId: sessionIdRef.current,
    };

    onFinishLevel(summary);
  }, [isGameOver, correctCount, wrongCount, v2Level, currentStars, userId, score, maxStreak, onFinishLevel]);

  // Main game timer countdown (monotonic)
  useEffect(() => {
    if (isPaused || isGameOver || questions.length === 0) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const effectiveElapsedMs = now - levelStartTimeRef.current - pausedDurationRef.current;
      const currentElapsedSec = Math.floor(effectiveElapsedMs / 1000);
      setElapsedSec(currentElapsedSec);

      const remainingSec = Math.max(0, v2Level.timeLimitSec - currentElapsedSec);
      if (remainingSec <= 5 && remainingSec > 0) {
        soundManager.playTick();
      }
      if (remainingSec <= 0) {
        clearInterval(timer);
        handleComplete(true);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [isPaused, isGameOver, questions.length, v2Level.timeLimitSec, handleComplete]);

  // Current active question
  const currentQ = questions[currentIndex];

  // Submit Answer Logic
  const handleSubmitAnswer = useCallback(() => {
    if (!currentQ || isPaused || isGameOver || userInput.trim() === '' || userInput === '-') return;

    const timeSpentOnThisQuestion = Date.now() - questionStartTimeRef.current;

    // Evaluate answer with answerSpec or legacy fallback
    let isCorrect = false;
    let expectedDisplay = '';
    if (currentQ.answerSpec) {
      const evalRes = evaluateAnswer(currentQ.answerSpec, userInput);
      isCorrect = evalRes.isCorrect;
      expectedDisplay = evalRes.expectedDisplay;
    } else {
      const parsedUserAnswer = parseInt(userInput, 10);
      isCorrect = !isNaN(parsedUserAnswer) && parsedUserAnswer === currentQ.correctAnswer;
      expectedDisplay = String(currentQ.correctAnswer ?? '');
    }

    // Record question into history
    const recordedQuestion: Question = {
      ...currentQ,
      userAnswer: /^-?\d+$/.test(userInput) ? parseInt(userInput, 10) : undefined,
      isCorrect,
      timeSpentMs: timeSpentOnThisQuestion,
    };
    historyRef.current.push(recordedQuestion);

    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
      setCorrectCount((prev) => prev + 1);

      // Score calculation: Base 100 pts + streak bonus + speed bonus
      const speedBonus = Math.max(10, Math.round((5000 - timeSpentOnThisQuestion) / 80));
      const streakBonus = Math.min(200, (newStreak - 1) * 25);
      const pointsEarned = 100 + Math.max(0, speedBonus) + streakBonus;

      setScore((prev) => prev + pointsEarned);
      setFloatingBonus(`+${pointsEarned}`);
      soundManager.playCorrect(newStreak);
      setFeedback('correct');

      setTimeout(() => {
        setFloatingBonus(null);
        setFeedback('none');
      }, 350);

      // Advance question or complete level
      if (currentIndex + 1 >= questions.length) {
        handleComplete(false, correctCount + 1, wrongCount, score + pointsEarned, Math.max(maxStreak, newStreak));
      } else {
        setCurrentIndex((prev) => prev + 1);
        setUserInput('');
        questionStartTimeRef.current = Date.now();
      }
    } else {
      // Wrong Answer: Boss rage or standard error shake
      setStreak(0);
      setWrongCount((prev) => prev + 1);
      soundManager.playWrong();
      setFeedback('wrong');
      setLastFeedbackDetail({
        isCorrect: false,
        explanation: `${currentQ.explanation || `Jawaban yang benar: ${expectedDisplay}`} (Jawabanmu: ${userInput})`,
      });

      setTimeout(() => {
        setFeedback('none');
        setLastFeedbackDetail(null);
        if (currentIndex + 1 >= questions.length) {
          handleComplete(false, correctCount, wrongCount + 1, score, maxStreak);
        } else {
          setCurrentIndex((prev) => prev + 1);
          setUserInput('');
          questionStartTimeRef.current = Date.now();
        }
      }, 700);
    }
  }, [currentQ, isPaused, isGameOver, userInput, streak, maxStreak, currentIndex, questions.length, handleComplete]);

  // Physical Keyboard Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPaused || isGameOver) return;
      // Skip system chords (ctrl, meta, alt)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        soundManager.playClick();
        setUserInput((prev) => sanitizeKeypadInput(prev, e.key, 12));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        soundManager.playClick();
        setUserInput((prev) => sanitizeKeypadInput(prev, 'backspace', 12));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        soundManager.playClick();
        setUserInput('');
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        if (showNegative) {
          soundManager.playClick();
          setUserInput((prev) => sanitizeKeypadInput(prev, '-', 12));
        }
      } else if (e.key === '/') {
        e.preventDefault();
        if (showSlash) {
          soundManager.playClick();
          setUserInput((prev) => sanitizeKeypadInput(prev, '/', 12));
        }
      } else if (e.key === '.') {
        e.preventDefault();
        if (showDecimal) {
          soundManager.playClick();
          setUserInput((prev) => sanitizeKeypadInput(prev, '.', 12));
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmitAnswer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, isGameOver, showNegative, showSlash, showDecimal, handleSubmitAnswer]);

  if (!currentQ) return null;

  // Remaining time and percent calculation
  const remainingSec = Math.max(0, v2Level.timeLimitSec - elapsedSec);
  const timePercent = Math.max(0, Math.min(100, (remainingSec / v2Level.timeLimitSec) * 100));
  const targetPercent = Math.max(0, Math.min(100, (v2Level.targetTimeSec / v2Level.timeLimitSec) * 100));

  // Boss HP calculations
  const isBoss = v2Level.boss;
  const bossMaxHp = v2Level.questionCount;
  const bossHp = Math.max(0, bossMaxHp - correctCount);
  const bossHpPercent = Math.round((bossHp / Math.max(1, bossMaxHp)) * 100);

  // Split prompt string to highlight operator in vibrant pink
  const promptParts = (currentQ.displayPrompt || currentQ.prompt).split(/([+\-×÷=?()])/g);

  return (
    <div className="mx-auto w-full max-w-xl pb-12">

      {/* Top Navigation & Level Status Bar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-indigo-950 bg-indigo-800 text-white shadow-lg transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2"
          title="Keluar ke Menu Level"
          aria-label="Kembali ke menu"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          {isBoss ? (
            <span className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 border-b-2 border-red-800 px-4 py-1.5 text-xs font-black text-white shadow-lg uppercase tracking-wider">
              <Crown className="h-4 w-4 text-amber-300 animate-pulse" />
              PERTARUNGAN BOSS: {v2Level.title.toUpperCase()}
            </span>
          ) : (
            <span className="rounded-2xl bg-pink-500 border-b-2 border-pink-700 px-4 py-1.5 text-xs font-black text-white shadow-md uppercase tracking-wider">
              Level {v2Level.id}: {v2Level.title}
            </span>
          )}
        </div>

        <button
          onClick={togglePause}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-indigo-950 bg-indigo-800 text-white shadow-lg transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2"
          title={isPaused ? 'Lanjutkan' : 'Jeda'}
          aria-label={isPaused ? 'Lanjutkan permainan' : 'Jeda permainan'}
        >
          {isPaused ? <Play className="h-5 w-5 fill-white" /> : <Pause className="h-5 w-5" />}
        </button>
      </div>

      {/* Boss Health Bar (When Boss Level) */}
      {isBoss && (
        <div className="mb-4 rounded-3xl border-4 border-rose-800/80 bg-gradient-to-r from-rose-950/90 via-red-950/90 to-amber-950/90 p-4 shadow-2xl">
          <div className="flex items-center justify-between text-xs font-bold text-rose-200 mb-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400 animate-pulse" />
              <span className="font-black text-amber-300 uppercase tracking-wider">
                HP BOSS: {bossHp} / {bossMaxHp}
              </span>
            </div>
            <span className="font-mono text-xs text-rose-300 font-bold">
              {bossHpPercent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Boss HP"
            aria-valuemin={0}
            aria-valuemax={bossMaxHp}
            aria-valuenow={bossHp}
            aria-live="polite"
            className="h-4 w-full overflow-hidden rounded-full bg-rose-950 border border-rose-700/60 p-0.5"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-amber-400 transition-all duration-300 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
              style={{ width: `${bossHpPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Progress & Live Stats Banner */}
      <div className={`mb-4 rounded-3xl border-4 p-4 shadow-xl ${
        isBoss
          ? 'border-red-900/80 bg-red-950/90'
          : 'border-indigo-800/80 bg-indigo-900/90'
      }`}>
        <div className="flex items-center justify-between text-xs font-bold text-indigo-200 mb-2">
          <div className="flex items-center gap-2.5">
            <span className="bg-white/10 px-2.5 py-1 rounded-xl text-white font-mono">
              Soal {currentIndex + 1} dari {questions.length}
            </span>
            {streak >= 2 && (
              <span className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-xs font-black text-amber-950 shadow-md border-b-2 border-amber-600 animate-pulse">
                <Flame className="h-3.5 w-3.5 fill-amber-950 text-amber-950" />
                {streak}x COMBO
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-indigo-300 block leading-tight">Skor</span>
              <span className="text-yellow-400 font-black font-mono text-lg leading-tight">{score}</span>
            </div>

            <div className={`flex items-center gap-1 font-mono font-black text-sm px-3 py-1.5 rounded-xl border ${
              remainingSec <= 5
                ? 'bg-rose-500/30 text-rose-300 border-rose-500/50 animate-pulse'
                : 'bg-white/10 text-white border-white/15'
            }`}>
              <Clock className="h-3.5 w-3.5" />
              <span>{remainingSec}s</span>
            </div>
          </div>
        </div>

        {/* Animated Timer Progress Bar with Target Time Marker */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-indigo-950/80">
          <div
            className="h-full bg-gradient-to-r from-red-500 via-orange-400 to-green-500 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(239,68,68,0.5)]"
            style={{ width: `${timePercent}%` }}
          />
          {/* Target Speed Threshold Indicator */}
          {targetPercent > 0 && targetPercent < 100 && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.8)] z-10"
              style={{ left: `${targetPercent}%` }}
              title={`Target Waktu: ${v2Level.targetTimeSec}s`}
            />
          )}
        </div>
      </div>

      {/* Main Flashcard Display Card (Arena Card) */}
      <div
        data-testid="arena-card"
        className={`relative mb-4 flex flex-col items-center justify-center rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border-4 sm:border-8 transition-all duration-200 overflow-hidden ${
          isBoss
            ? 'border-amber-500/80 bg-gradient-to-b from-indigo-950 via-rose-950 to-indigo-950 text-white p-6 sm:p-8 pt-8 sm:pt-10'
            : 'border-white bg-indigo-50 text-indigo-950 p-6 sm:p-8 pt-8 sm:pt-10'
        } ${
          feedback === 'correct'
            ? 'ring-8 ring-green-500/40 bg-emerald-50'
            : feedback === 'wrong'
            ? isBoss
              ? 'ring-8 ring-rose-600 border-rose-600 bg-rose-950/80 animate-shake'
              : 'ring-8 ring-rose-500/40 bg-rose-50 animate-shake'
            : ''
        }`}
        style={{ minHeight: '220px' }}
      >
        {/* Top Rainbow Progress Bar inside card */}
        <div className="absolute top-0 left-0 w-full h-3.5 bg-indigo-200 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-500 via-orange-400 to-green-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all duration-300"
            style={{ width: `${timePercent}%` }}
          />
        </div>

        {/* Floating bonus notification */}
        {floatingBonus && (
          <div className="absolute top-5 right-6 text-sm font-black text-emerald-600 bg-emerald-100 px-3 py-1 rounded-xl shadow-md animate-bounce border border-emerald-300">
            {floatingBonus}
          </div>
        )}

        {/* Paused Overlay */}
        {isPaused ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <span className={`text-xl font-black ${isBoss ? 'text-white' : 'text-indigo-950'}`}>
              Permainan Dijeda
            </span>
            <button
              onClick={togglePause}
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-base font-black text-white shadow-lg shadow-indigo-600/30 border-b-4 border-indigo-900 transition hover:bg-indigo-700 active:translate-y-0.5"
            >
              <Play className="h-5 w-5 fill-white" />
              Lanjutkan
            </button>
          </div>
        ) : (
          <>
            {/* Challenge Mode Badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`px-5 py-1 rounded-full text-xs sm:text-sm font-black shadow-md uppercase tracking-wider inline-block ${
                isBoss
                  ? 'bg-rose-600 text-white border border-rose-400'
                  : 'bg-indigo-600 text-white'
              }`}>
                {isBoss ? 'Duel Boss' : 'Tantangan Kilat!'}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                <Target className="h-3 w-3" />
                Target: {v2Level.targetTimeSec}s
              </span>
            </div>

            {/* Central Question Prompt Container */}
            <div
              data-testid="question-prompt"
              className={`flex items-center justify-center flex-wrap gap-x-3 gap-y-1 text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter font-mono select-none text-center ${
                isBoss ? 'text-white' : 'text-indigo-950'
              }`}
            >
              {promptParts.map((part, i) => {
                if (['+', '-', '×', '÷', '=', '?', '(', ')'].includes(part)) {
                  return (
                    <span key={i} className="text-pink-500 font-black">
                      {part}
                    </span>
                  );
                }
                return <span key={i}>{part}</span>;
              })}
            </div>

            {/* Answer Display Box */}
            <div className="mt-5 w-full max-w-sm bg-white border-4 border-indigo-200 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl flex items-center justify-between">
              <div className={`text-2xl sm:text-3xl font-mono font-black ${userInput === '' ? 'text-indigo-900/30 italic' : 'text-indigo-950'}`}>
                {userInput === '' ? '???' : userInput}
              </div>
              <button
                onClick={handleSubmitAnswer}
                disabled={isPaused || userInput === '' || userInput === '-'}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs sm:text-sm font-black px-5 py-2.5 rounded-xl sm:rounded-2xl border-b-4 border-indigo-900 shadow-md active:translate-y-0.5 active:border-b-2 uppercase tracking-wider"
              >
                ENTER
              </button>
            </div>

            {/* Error correction toast if answered wrong */}
            {lastFeedbackDetail && (
              <div className="mt-3 rounded-xl bg-rose-100 px-3 py-1.5 text-center text-xs font-bold text-rose-800 border border-rose-300 animate-fadeIn">
                {lastFeedbackDetail.explanation}
              </div>
            )}

            {/* Question Progress Dots */}
            <div className="mt-6 flex items-center justify-center gap-2">
              {questions.map((_, dotIdx) => (
                <div
                  key={dotIdx}
                  className={`h-2.5 w-2.5 rounded-full transition-all ${
                    dotIdx < currentIndex
                      ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] scale-110'
                      : dotIdx === currentIndex
                      ? 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.8)] scale-125 animate-pulse'
                      : 'bg-indigo-200'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Adaptive Virtual Keypad */}
      <DynamicKeypad
        onKeyPress={(key) => {
          if (isPaused || isGameOver) return;
          soundManager.playClick();
          if (key === 'clear') {
            setUserInput('');
          } else {
            setUserInput((prev) => sanitizeKeypadInput(prev, key, 12));
          }
        }}
        onBackspace={() => {
          if (isPaused || isGameOver) return;
          soundManager.playClick();
          setUserInput((prev) => sanitizeKeypadInput(prev, 'backspace', 12));
        }}
        onClear={() => {
          if (isPaused || isGameOver) return;
          soundManager.playClick();
          setUserInput('');
        }}
        onSubmit={handleSubmitAnswer}
        showNegative={showNegative}
        showSlash={showSlash}
        showDecimal={showDecimal}
        answerKind={v2Level.answerKind}
        ruleKind={(v2Level.rules as any)?.kind}
        disabled={isPaused || isGameOver}
        submitDisabled={isPaused || isGameOver || userInput.trim() === '' || userInput === '-'}
        submitLabel="JAWAB (ENTER)"
      />

      {/* Keyboard Helper hint for desktop */}
      <div className="mt-4 text-center text-xs text-indigo-300/80 font-medium select-none">
        Tips: Gunakan tombol angka keyboard dan tekan <kbd className="rounded-lg bg-white/10 px-2 py-0.5 font-mono text-[11px] font-bold text-white border border-white/20">Enter</kbd> untuk berhitung kilat!
      </div>

    </div>
  );
};
