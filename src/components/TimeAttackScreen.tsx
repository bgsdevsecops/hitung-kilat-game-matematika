import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Flame, Zap, Clock, Delete, RefreshCw, Check } from 'lucide-react';
import { Question, GameSummary } from '../types';
import { generateTimeAttackQuestion } from '../utils/mathGenerator';
import { soundManager } from '../utils/sound';

interface TimeAttackScreenProps {
  onFinish: (summary: GameSummary) => void;
  onExit: () => void;
  highScore: number;
}

export const TimeAttackScreen: React.FC<TimeAttackScreenProps> = ({
  onFinish,
  onExit,
  highScore,
}) => {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [userInput, setUserInput] = useState<string>('');
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [wrongCount, setWrongCount] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // Visual feedback
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [floatingBonus, setFloatingBonus] = useState<string | null>(null);
  const [timeBonusText, setTimeBonusText] = useState<string | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const questionStartRef = useRef<number>(Date.now());
  const historyRef = useRef<Question[]>([]);

  // Spawn initial question
  useEffect(() => {
    const q = generateTimeAttackQuestion(0, 0);
    setCurrentQuestion(q);
    startTimeRef.current = Date.now();
    questionStartRef.current = Date.now();
  }, []);

  // Finish game handler
  const handleGameOver = useCallback(() => {
    if (isGameOver) return;
    setIsGameOver(true);

    const totalSecondsSpent = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    const totalAnswered = correctCount + wrongCount;
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const questionsPerMin = Math.round((correctCount / (totalSecondsSpent / 60)));

    if (score > highScore) {
      soundManager.playFanfare();
    } else {
      soundManager.playFanfare();
    }

    const summary: GameSummary = {
      mode: 'time_attack',
      score,
      questionsTotal: totalAnswered,
      correctCount,
      wrongCount,
      accuracy,
      timeSpentSec: totalSecondsSpent,
      avgTimePerQuestionSec: Number((totalSecondsSpent / Math.max(1, totalAnswered)).toFixed(1)),
      questionsPerMinute: questionsPerMin,
      maxStreak,
      starsEarned: score >= 2000 ? 3 : score >= 1000 ? 2 : 1,
      history: historyRef.current,
      isNewRecord: score > highScore,
    };

    onFinish(summary);
  }, [isGameOver, correctCount, wrongCount, score, highScore, maxStreak, onFinish]);

  // Game timer
  useEffect(() => {
    if (isGameOver) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleGameOver();
          return 0;
        }
        if (prev <= 5) {
          soundManager.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isGameOver, handleGameOver]);

  // Submit Answer
  const handleSubmitAnswer = useCallback(() => {
    if (!currentQuestion || isGameOver || userInput.trim() === '' || userInput === '-') return;

    const parsed = parseInt(userInput, 10);
    if (isNaN(parsed)) return;

    const timeSpentOnThis = Date.now() - questionStartRef.current;
    const isCorrect = parsed === currentQuestion.correctAnswer;

    historyRef.current.push({
      ...currentQuestion,
      userAnswer: parsed,
      isCorrect,
      timeSpentMs: timeSpentOnThis,
    });

    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
      setCorrectCount((prev) => prev + 1);

      // Score: Base 100 + streak multiplier + fast solve bonus
      const speedBonus = Math.max(0, Math.round((4000 - timeSpentOnThis) / 50));
      const comboMult = 1 + (newStreak - 1) * 0.2;
      const pts = Math.round((100 + speedBonus) * comboMult);

      setScore((prev) => prev + pts);
      setFloatingBonus(`+${pts}`);

      // Time reward: +2.5 seconds (max 60)
      setTimeLeft((prev) => Math.min(60, prev + 2));
      setTimeBonusText('+2s');

      soundManager.playCorrect(newStreak);
      setFeedback('correct');

      setTimeout(() => {
        setFloatingBonus(null);
        setTimeBonusText(null);
        setFeedback('none');
      }, 350);

      // Next dynamic question
      setCurrentQuestion(generateTimeAttackQuestion(newStreak, score + pts));
      setUserInput('');
      questionStartRef.current = Date.now();
    } else {
      // Wrong Answer: Time penalty -4 seconds
      setStreak(0);
      setWrongCount((prev) => prev + 1);
      setTimeLeft((prev) => Math.max(0, prev - 4));
      setTimeBonusText('-4s');
      soundManager.playWrong();
      setFeedback('wrong');

      setTimeout(() => {
        setTimeBonusText(null);
        setFeedback('none');
        setCurrentQuestion(generateTimeAttackQuestion(0, score));
        setUserInput('');
        questionStartRef.current = Date.now();
      }, 400);
    }
  }, [currentQuestion, isGameOver, userInput, streak, maxStreak, score]);

  // Keypad Click Helper
  const handleKeypadPress = (val: string) => {
    if (isGameOver) return;
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

    if (userInput.length < 5) {
      setUserInput((prev) => prev + val);
    }
  };

  // Keyboard Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isGameOver) return;

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
  }, [isGameOver, handleSubmitAnswer]);

  if (!currentQuestion) return null;

  // Split prompt string to highlight operator in pink
  const promptParts = currentQuestion.prompt.split(/([+\-×÷=?()])/g);

  return (
    <div className="mx-auto w-full max-w-xl pb-12">
      
      {/* Header Bar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-indigo-950 bg-indigo-800 text-white shadow-lg transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2"
          title="Keluar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 border-b-2 border-amber-600 px-4 py-1.5 text-xs font-black text-amber-950 shadow-md uppercase tracking-wider">
            <Zap className="h-4 w-4 fill-amber-950 text-amber-950" />
            Lari Kilat (Sprint 60s)
          </span>
        </div>

        <div className="text-xs font-bold bg-white/10 px-3 py-1.5 rounded-2xl border border-white/15 text-indigo-200">
          Rekor: <span className="text-yellow-400 font-mono font-black text-sm ml-1">{highScore}</span>
        </div>
      </div>

      {/* Live Dashboard Card */}
      <div className="mb-4 rounded-3xl border-4 border-indigo-800/80 bg-indigo-900/90 p-4 shadow-xl text-white">
        <div className="flex items-center justify-between text-xs font-bold text-indigo-200 mb-2">
          <div className="flex items-center gap-2">
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-indigo-300 block leading-tight">Skor Lari</span>
              <span className="text-2xl font-black text-yellow-400 font-mono leading-tight">{score}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {streak >= 2 && (
              <span className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-xs font-black text-amber-950 shadow-md border-b-2 border-amber-600 animate-pulse">
                <Flame className="h-3.5 w-3.5 fill-amber-950 text-amber-950" />
                {streak}x COMBO
              </span>
            )}

            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono font-black text-base ${
                timeLeft <= 10 
                  ? 'bg-rose-500/30 text-rose-300 border-rose-500/50 animate-pulse' 
                  : 'bg-white/10 text-white border-white/15'
              }`}>
                <Clock className="h-4 w-4" />
                <span>{timeLeft}s</span>
              </div>
              {timeBonusText && (
                <span className={`text-xs font-black animate-bounce px-2 py-0.5 rounded-lg ${
                  timeBonusText.startsWith('+') 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {timeBonusText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Timer Bar */}
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-indigo-950/80">
          <div
            className={`h-full transition-all duration-300 ease-out shadow-sm ${
              timeLeft > 25
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : timeLeft > 10
                ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                : 'bg-rose-500 animate-pulse'
            }`}
            style={{ width: `${Math.min(100, (timeLeft / 60) * 100)}%` }}
          />
        </div>
      </div>

      {/* Main Expression Box */}
      <div
        className={`relative mb-4 flex flex-col items-center justify-center rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border-4 sm:border-8 border-white bg-indigo-50 p-6 sm:p-8 pt-8 sm:pt-10 transition-all duration-200 overflow-hidden ${
          feedback === 'correct'
            ? 'ring-8 ring-green-500/40 bg-emerald-50'
            : feedback === 'wrong'
            ? 'ring-8 ring-rose-500/40 bg-rose-50'
            : ''
        }`}
        style={{ minHeight: '220px' }}
      >
        {/* Top Progress bar inside card */}
        <div className="absolute top-0 left-0 w-full h-3.5 bg-indigo-200 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
            style={{ width: `${Math.min(100, (timeLeft / 60) * 100)}%` }}
          />
        </div>

        {floatingBonus && (
          <div className="absolute top-5 right-6 text-sm font-black text-emerald-600 bg-emerald-100 px-3 py-1 rounded-xl shadow-md animate-bounce border border-emerald-300">
            {floatingBonus}
          </div>
        )}

        {/* Challenge pill */}
        <span className="bg-amber-500 text-amber-950 px-5 py-1 rounded-full text-xs sm:text-sm font-black shadow-md uppercase tracking-wider mb-4 inline-block">
          Sprint Berkecepatan Tinggi!
        </span>

        {/* Prompt with vibrant operator styling */}
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

        {/* Answer Box */}
        <div className="mt-5 w-full max-w-sm bg-white border-4 border-indigo-200 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl flex items-center justify-between">
          <div className={`text-2xl sm:text-3xl font-mono font-black ${userInput === '' ? 'text-indigo-900/30 italic' : 'text-indigo-950'}`}>
            {userInput === '' ? '???' : userInput}
          </div>
          <button
            onClick={handleSubmitAnswer}
            disabled={userInput === '' || userInput === '-'}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-amber-950 text-xs sm:text-sm font-black px-5 py-2.5 rounded-xl sm:rounded-2xl border-b-4 border-amber-700 shadow-md active:translate-y-0.5 active:border-b-2 uppercase tracking-wider"
          >
            ENTER
          </button>
        </div>
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
              onClick={() => handleKeypadPress(keyVal)}
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

      {/* Action Row */}
      <div className="mt-3 grid grid-cols-3 gap-2.5 sm:gap-3 max-w-sm mx-auto">
        <button
          onClick={() => handleKeypadPress('clear')}
          disabled={userInput === ''}
          className="flex h-13 items-center justify-center rounded-2xl border-b-4 border-indigo-950 bg-indigo-700/80 text-xs sm:text-sm font-black text-indigo-100 transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2 disabled:opacity-40"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          HAPUS
        </button>

        <button
          onClick={handleSubmitAnswer}
          disabled={userInput === '' || userInput === '-'}
          className="col-span-2 flex h-13 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-sm sm:text-base font-black text-amber-950 border-b-4 border-amber-700 shadow-xl shadow-amber-500/25 transition active:translate-y-0.5 active:border-b-2 disabled:opacity-40 uppercase tracking-wider"
        >
          <Check className="h-5 w-5 mr-1.5 stroke-[3]" />
          JAWAB (ENTER)
        </button>
      </div>

      <div className="mt-4 text-center text-xs text-indigo-300 font-medium">
        ⚡ Benar <span className="font-bold text-emerald-400">+2 detik</span> &bull; Salah <span className="font-bold text-rose-400">-4 detik</span>!
      </div>

    </div>
  );
};
