import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Clock, Delete, CornerDownLeft } from 'lucide-react';
import { Question } from '../../engine/types/question';
import { evaluateAnswer } from '../../engine/evaluator/answerEvaluator';
import { soundManager } from '../../utils/sound';

export interface AdaptivePlayArenaProps {
  questions: Question[];
  onFinish: (answers: Question[], durationMs: number) => void;
  onExit: () => void;
}

export const AdaptivePlayArena: React.FC<AdaptivePlayArenaProps> = ({
  questions,
  onFinish,
  onExit,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [inputVal, setInputVal] = useState<string>('');
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const startTimeRef = useRef<number>(Date.now());
  const questionStartTimeRef = useRef<number>(Date.now());
  const historyRef = useRef<Question[]>([]);

  // Untimed elapsed stopwatch
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentQ = questions && questions.length > 0 ? (questions[currentIndex] || questions[0]) : null;

  const formatStopwatch = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleKeyPress = useCallback((char: string) => {
    soundManager.playClick();
    setInputVal((prev) => {
      if (prev.length >= 12) return prev;
      if (char === '-' && prev.length === 0) return '-';
      if (char === '/' && !prev.includes('/') && prev.length > 0 && prev !== '-') return prev + '/';
      if (/^[0-9]$/.test(char)) return prev + char;
      return prev;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    soundManager.playClick();
    setInputVal((prev) => prev.slice(0, -1));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!currentQ || !inputVal.trim() || inputVal === '-') return;

    const now = Date.now();
    const responseTimeMs = now - questionStartTimeRef.current;

    // Check correctness
    let isCorrect = false;
    const spec = currentQ?.answerSpec;
    if (spec) {
      if (spec.kind === 'fraction') {
        const parts = inputVal.split('/');
        if (parts.length === 2) {
          const num = parseInt(parts[0], 10);
          const den = parseInt(parts[1], 10);
          const targetNum = (spec as any).numerator ?? (spec as any).value;
          const targetDen = (spec as any).denominator ?? 1;
          isCorrect = num === targetNum && den === targetDen;
        }
      } else if (spec.kind === 'rational' || spec.kind === 'integer' || spec.kind === 'decimal' || spec.kind === 'choice') {
        isCorrect = evaluateAnswer(spec, inputVal).isCorrect;
      } else {
        isCorrect = inputVal.trim() === String((spec as any).value ?? '');
      }
    } else {
      isCorrect = inputVal.trim() === String((currentQ as any)?.correctAnswer ?? '');
    }

    if (isCorrect) {
      soundManager.playCorrect(0);
    } else {
      soundManager.playWrong();
    }

    const recordedQ: Question = {
      ...currentQ,
      isCorrect,
      timeSpentMs: responseTimeMs,
    };
    historyRef.current.push(recordedQ);

    setInputVal('');
    const nextIdx = currentIndex + 1;
    if (nextIdx < questions.length) {
      setCurrentIndex(nextIdx);
      questionStartTimeRef.current = Date.now();
    } else {
      const totalDurationMs = Date.now() - startTimeRef.current;
      onFinish(historyRef.current, totalDurationMs);
    }
  }, [inputVal, currentQ, currentIndex, questions.length, onFinish]);

  // Physical keyboard support with e.preventDefault()
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === '-' || e.key === '/') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress, handleBackspace, handleSubmit]);

  if (!questions || questions.length === 0 || !currentQ) {
    return null;
  }

  return (
    <div className="max-w-md mx-auto py-4 px-3 sm:px-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            soundManager.playClick();
            onExit();
          }}
          aria-label="Kembali"
          className="min-h-[48px] px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white flex items-center gap-1.5 text-xs font-bold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Keluar</span>
        </button>

        <div className="flex items-center gap-1.5 bg-indigo-900/60 px-3.5 py-2 rounded-2xl border border-indigo-800 text-xs font-mono font-bold text-amber-300">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>{formatStopwatch(elapsedSec)}</span>
        </div>

        <div className="text-xs font-bold text-indigo-200 bg-white/10 px-3 py-2 rounded-2xl">
          Soal {currentIndex + 1} dari {questions.length}
        </div>
      </div>

      {/* Central Math Prompt Card */}
      <div
        aria-live="polite"
        className="rounded-3xl border-2 border-indigo-700 bg-gradient-to-b from-indigo-900/90 to-indigo-950 p-6 sm:p-8 text-center shadow-2xl relative"
      >
        <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-300 block mb-2">
          {currentQ.primarySkillId || 'Latihan'}
        </span>
        <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-wider mb-6">
          {currentQ.displayPrompt || currentQ.prompt}
        </div>

        {/* User Input Display */}
        <div
          data-testid="user-input-display"
          className="h-14 w-full rounded-2xl border-2 border-amber-400/60 bg-indigo-950/80 flex items-center justify-center text-3xl font-mono font-bold text-amber-300 shadow-inner"
        >
          {inputVal || <span className="text-indigo-400/40 text-lg">Ketik jawaban...</span>}
        </div>
      </div>

      {/* Responsive Virtual Keypad */}
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '0', '/'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKeyPress(key)}
            aria-label={key}
            className="min-h-[48px] h-12 sm:h-14 rounded-2xl border-2 border-indigo-700/80 border-b-4 border-b-indigo-950 bg-indigo-800/90 hover:bg-indigo-700 text-xl font-bold font-mono text-white active:translate-y-0.5 shadow-md transition"
          >
            {key}
          </button>
        ))}

        <button
          type="button"
          onClick={handleBackspace}
          aria-label="Hapus"
          className="min-h-[48px] h-12 sm:h-14 rounded-2xl border-2 border-rose-700/80 border-b-4 border-b-rose-950 bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 flex items-center justify-center active:translate-y-0.5 shadow-md transition"
        >
          <Delete className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          aria-label="Kirim Jawaban"
          disabled={!inputVal.trim() || inputVal === '-'}
          className={`col-span-2 min-h-[48px] h-12 sm:h-14 rounded-2xl border-2 font-black text-sm flex items-center justify-center gap-2 shadow-xl transition uppercase tracking-wider ${
            !inputVal.trim() || inputVal === '-'
              ? 'border-indigo-900 border-b-4 border-b-indigo-950 bg-indigo-900/40 text-indigo-400/40 cursor-not-allowed'
              : 'border-amber-500 border-b-4 border-b-amber-700 bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 active:translate-y-0.5 text-amber-950'
          }`}
        >
          <span>Kirim</span>
          <CornerDownLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
