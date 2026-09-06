import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Pause, Play, RefreshCw, Flame, Check, Delete, Clock } from 'lucide-react';
import { LevelConfig, Question, GameSummary } from '../types';
import { generateLevelQuestions } from '../utils/mathGenerator';
import { soundManager } from '../utils/sound';

interface PlayScreenProps {
  level: LevelConfig;
  onFinishLevel: (summary: GameSummary) => void;
  onExit: () => void;
}

export const PlayScreen: React.FC<PlayScreenProps> = ({
  level,
  onFinishLevel,
  onExit,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userInput, setUserInput] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState<number>(level.timeLimitSec);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // Visual feedback states
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [lastFeedbackDetail, setLastFeedbackDetail] = useState<{ isCorrect: boolean; explanation: string } | null>(null);
  const [floatingBonus, setFloatingBonus] = useState<string | null>(null);

  // Time tracking
  const questionStartTimeRef = useRef<number>(Date.now());
  const historyRef = useRef<Question[]>([]);

  // Initialize level questions
  useEffect(() => {
    const qList = generateLevelQuestions(level);
    setQuestions(qList);
    setCurrentIndex(0);
    setUserInput('');
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setWrongCount(0);
    setTimeLeft(level.timeLimitSec);
    setIsPaused(false);
    setIsGameOver(false);
    historyRef.current = [];
    questionStartTimeRef.current = Date.now();
  }, [level]);

  // Handle Level End
  const handleComplete = useCallback((timeout: boolean = false) => {
    if (isGameOver) return;
    setIsGameOver(true);

    const timeSpent = Math.max(1, level.timeLimitSec - (timeout ? 0 : timeLeft));
    const totalAnswered = correctCount + wrongCount;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const questionsPerMin = Math.round((correctCount / (timeSpent / 60)));

    // Determine stars
    let stars = 0;
    if (correctCount >= Math.ceil(level.questionsCount * 0.95) && timeSpent <= level.timeLimitSec * 0.75) {
      stars = 3; // Super fast & almost perfect
    } else if (correctCount >= Math.ceil(level.questionsCount * 0.8)) {
      stars = 2; // High accuracy
    } else if (correctCount >= Math.ceil(level.questionsCount * 0.6)) {
      stars = 1; // Passed minimum threshold
    }

    if (stars > 0) {
      soundManager.playFanfare();
    } else {
      soundManager.playWrong();
    }

    const summary: GameSummary = {
      mode: 'campaign',
      levelId: level.id,
      score,
      questionsTotal: level.questionsCount,
      correctCount,
      wrongCount,
      accuracy,
      timeSpentSec: timeSpent,
      avgTimePerQuestionSec: Number((timeSpent / Math.max(1, totalAnswered)).toFixed(1)),
      questionsPerMinute: questionsPerMin,
      maxStreak,
      starsEarned: stars,
      history: historyRef.current,
      isNewRecord: false,
    };

    onFinishLevel(summary);
  }, [isGameOver, level, timeLeft, correctCount, wrongCount, score, maxStreak, onFinishLevel]);

  // Main game timer countdown
  useEffect(() => {
    if (isPaused || isGameOver || questions.length === 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleComplete(true);
          return 0;
        }
        if (prev <= 5) {
          soundManager.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, isGameOver, questions, handleComplete]);

  // Current question
  const currentQ = questions[currentIndex];

  // Submit Answer Logic
  const handleSubmitAnswer = useCallback(() => {
    if (!currentQ || isPaused || isGameOver || userInput.trim() === '' || userInput === '-') return;

    const parsedUserAnswer = parseInt(userInput, 10);
    if (isNaN(parsedUserAnswer)) return;

    const timeSpentOnThisQuestion = Date.now() - questionStartTimeRef.current;
    const isCorrect = parsedUserAnswer === currentQ.correctAnswer;

    // Record question in history
    const recordedQuestion: Question = {
      ...currentQ,
      userAnswer: parsedUserAnswer,
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

      // Move to next question or complete
      if (currentIndex + 1 >= questions.length) {
        handleComplete(false);
      } else {
        setCurrentIndex((prev) => prev + 1);
        setUserInput('');
        questionStartTimeRef.current = Date.now();
      }
    } else {
      // Wrong Answer
      setStreak(0);
      setWrongCount((prev) => prev + 1);
      soundManager.playWrong();
      setFeedback('wrong');
      setLastFeedbackDetail({
        isCorrect: false,
        explanation: `${currentQ.explanation} (Jawabanmu: ${parsedUserAnswer})`,
      });

      // Brief delay to allow player to see error, then proceed
      setTimeout(() => {
        setFeedback('none');
        setLastFeedbackDetail(null);
        if (currentIndex + 1 >= questions.length) {
          handleComplete(false);
        } else {
          setCurrentIndex((prev) => prev + 1);
          setUserInput('');
          questionStartTimeRef.current = Date.now();
        }
      }, 700);
    }
  }, [currentQ, isPaused, isGameOver, userInput, streak, maxStreak, currentIndex, questions.length, handleComplete]);

  // Keypad Click Helper
  const handleKeypadPress = (val: string) => {
    if (isPaused || isGameOver) return;
    soundManager.playClick();

    if (val === 'backspace') {
      setUserInput((prev) => prev.slice(0, -1));
      return;
    }

    if (val === 'clear') {
      setUserInput('');
      return;
    }

    if (val === '-') {
      if (userInput === '') {
        setUserInput('-');
      } else if (userInput.startsWith('-')) {
        setUserInput(userInput.substring(1));
      } else {
        setUserInput('-' + userInput);
      }
      return;
    }

    if (val === 'enter') {
      handleSubmitAnswer();
      return;
    }

    // Append digit (max 5 digits)
    if (userInput.length < 5) {
      const nextInput = userInput + val;
      setUserInput(nextInput);
    }
  };

  // Keyboard Event Listener (for physical keyboard & numpad)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPaused || isGameOver) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadPress('backspace');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleKeypadPress('clear');
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleKeypadPress('-');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmitAnswer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, isGameOver, handleSubmitAnswer]);

  // Timer color & width calculation
  const timePercent = Math.max(0, Math.min(100, (timeLeft / level.timeLimitSec) * 100));
  const timerColor =
    timePercent > 40
      ? 'bg-emerald-500'
      : timePercent > 20
      ? 'bg-amber-500'
      : 'bg-rose-500 animate-pulse';

  if (!currentQ) return null;

  // Split prompt string to highlight operator in pink
  const promptParts = currentQ.prompt.split(/([+\-×÷=?()])/g);

  return (
    <div className="mx-auto w-full max-w-xl pb-12">
      
      {/* Top Navigation & Status Bar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-indigo-950 bg-indigo-800 text-white shadow-lg transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2"
          title="Keluar ke Menu Level"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="rounded-2xl bg-pink-500 border-b-2 border-pink-700 px-4 py-1.5 text-xs font-black text-white shadow-md uppercase tracking-wider">
            Level {level.id}: {level.title}
          </span>
        </div>

        <button
          onClick={() => {
            soundManager.playClick();
            setIsPaused((prev) => !prev);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-indigo-950 bg-indigo-800 text-white shadow-lg transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2"
          title={isPaused ? 'Lanjutkan' : 'Jeda'}
        >
          {isPaused ? <Play className="h-5 w-5 fill-white" /> : <Pause className="h-5 w-5" />}
        </button>
      </div>

      {/* Progress & Live Stats Banner */}
      <div className="mb-4 rounded-3xl border-4 border-indigo-800/80 bg-indigo-900/90 p-4 shadow-xl">
        <div className="flex items-center justify-between text-xs font-bold text-indigo-200 mb-2">
          <div className="flex items-center gap-2.5">
            <span className="bg-white/10 px-2.5 py-1 rounded-xl text-white font-mono">
              Soal {currentIndex + 1} / {questions.length}
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
              timeLeft <= 5 
                ? 'bg-rose-500/30 text-rose-300 border-rose-500/50 animate-pulse' 
                : 'bg-white/10 text-white border-white/15'
            }`}>
              <Clock className="h-3.5 w-3.5" />
              <span>{timeLeft}s</span>
            </div>
          </div>
        </div>

        {/* Animated Timer Progress Bar */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-indigo-950/80">
          <div
            className="h-full bg-gradient-to-r from-red-500 via-orange-400 to-green-500 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(239,68,68,0.5)]"
            style={{ width: `${timePercent}%` }}
          />
        </div>
      </div>

      {/* Main Flashcard Display Card (Vibrant Signature Style) */}
      <div
        className={`relative mb-4 flex flex-col items-center justify-center rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border-4 sm:border-8 border-white bg-indigo-50 p-6 sm:p-8 pt-8 sm:pt-10 transition-all duration-200 overflow-hidden ${
          feedback === 'correct'
            ? 'ring-8 ring-green-500/40 bg-emerald-50'
            : feedback === 'wrong'
            ? 'ring-8 ring-rose-500/40 bg-rose-50 animate-shake'
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
            <span className="text-xl font-black text-indigo-950">Permainan Dijeda</span>
            <button
              onClick={() => setIsPaused(false)}
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-base font-black text-white shadow-lg shadow-indigo-600/30 border-b-4 border-indigo-900 transition hover:bg-indigo-700 active:translate-y-0.5"
            >
              <Play className="h-5 w-5 fill-white" />
              Lanjutkan
            </button>
          </div>
        ) : (
          <>
            {/* Quick Challenge Badge */}
            <span className="bg-indigo-600 text-white px-5 py-1 rounded-full text-xs sm:text-sm font-black shadow-md uppercase tracking-wider mb-4 inline-block">
              Tantangan Kilat!
            </span>

            {/* The Math Expression with Vibrant Operator Styling */}
            <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 text-4xl sm:text-6xl md:text-7xl font-black tracking-tighter text-indigo-950 font-mono select-none text-center">
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
              <div className="mt-3 rounded-xl bg-rose-100 px-3 py-1.5 text-center text-xs font-bold text-rose-800 border border-rose-300">
                {lastFeedbackDetail.explanation}
              </div>
            )}

            {/* Question Progress Dots along bottom of card */}
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

      {/* Tactile Virtual Keypad */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 max-w-sm mx-auto">
        {[
          '1', '2', '3',
          '4', '5', '6',
          '7', '8', '9',
          '-', '0', 'backspace',
        ].map((keyVal) => {
          const isMinus = keyVal === '-';
          const isBack = keyVal === 'backspace';

          return (
            <button
              key={keyVal}
              id={`keypad-${keyVal}`}
              onClick={() => handleKeypadPress(keyVal)}
              disabled={isPaused}
              className={`flex h-14 sm:h-15 items-center justify-center rounded-2xl font-black text-xl sm:text-2xl shadow-lg border-b-4 transition active:translate-y-0.5 active:border-b-2 select-none ${
                isBack
                  ? 'bg-rose-600 border-rose-900 text-white hover:bg-rose-500'
                  : isMinus
                  ? 'bg-indigo-700 border-indigo-950 text-indigo-100 hover:bg-indigo-600'
                  : 'bg-indigo-800 border-indigo-950 text-white hover:bg-indigo-700'
              }`}
            >
              {isBack ? <Delete className="h-6 w-6" /> : isMinus ? '±' : keyVal}
            </button>
          );
        })}
      </div>

      {/* Action Row (Hapus & Jawab/Enter) */}
      <div className="mt-3 grid grid-cols-3 gap-2.5 sm:gap-3 max-w-sm mx-auto">
        <button
          id="keypad-clear"
          onClick={() => handleKeypadPress('clear')}
          disabled={isPaused || userInput === ''}
          className="flex h-13 items-center justify-center rounded-2xl border-b-4 border-indigo-950 bg-indigo-700/80 text-xs sm:text-sm font-black text-indigo-100 transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2 disabled:opacity-40"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          HAPUS
        </button>

        <button
          id="keypad-enter"
          onClick={handleSubmitAnswer}
          disabled={isPaused || userInput === '' || userInput === '-'}
          className="col-span-2 flex h-13 items-center justify-center rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-sm sm:text-base font-black text-white border-b-4 border-pink-800 shadow-xl shadow-pink-500/25 transition active:translate-y-0.5 active:border-b-2 disabled:opacity-40 uppercase tracking-wider"
        >
          <Check className="h-5 w-5 mr-1.5 stroke-[3]" />
          JAWAB (ENTER)
        </button>
      </div>

      {/* Keyboard Helper hint for desktop */}
      <div className="mt-4 text-center text-xs text-indigo-300/80 font-medium select-none">
        💡 Tips: Gunakan tombol angka keyboard dan tekan <kbd className="rounded-lg bg-white/10 px-2 py-0.5 font-mono text-[11px] font-bold text-white border border-white/20">Enter</kbd> untuk berhitung kilat!
      </div>

    </div>
  );
};
