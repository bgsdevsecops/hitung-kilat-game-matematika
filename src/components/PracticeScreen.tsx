import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Target, Play, RotateCcw, Check, Delete, RefreshCw } from 'lucide-react';
import { Question } from '../types';
import { randomInt } from '../utils/mathGenerator';
import { soundManager } from '../utils/sound';

interface PracticeScreenProps {
  onExit: () => void;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({ onExit }) => {
  // Practice configuration state
  const [isConfiguring, setIsConfiguring] = useState<boolean>(true);
  const [selectedOp, setSelectedOp] = useState<'+' | '-' | '*' | '/' | 'mix'>('+');
  const [numberRange, setNumberRange] = useState<number>(20);
  const [questionCountTarget, setQuestionCountTarget] = useState<number>(10);

  // Active game state
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [userInput, setUserInput] = useState<string>('');
  const [answeredCount, setAnsweredCount] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const startTimeRef = useRef<number>(Date.now());
  const historyRef = useRef<Question[]>([]);

  // Generate next practice question
  const spawnQuestion = useCallback(() => {
    let op = selectedOp;
    if (op === 'mix') {
      const ops: ('+' | '-' | '*' | '/')[] = ['+', '-', '*', '/'];
      op = ops[Math.floor(Math.random() * ops.length)];
    }

    const id = `practice_${Date.now()}_${Math.random()}`;

    if (op === '+') {
      const a = randomInt(2, numberRange);
      const b = randomInt(2, numberRange);
      return { id, prompt: `${a} + ${b}`, num1: a, num2: b, operation: '+', correctAnswer: a + b, explanation: `${a} + ${b} = ${a + b}` };
    }
    if (op === '-') {
      const b = randomInt(2, numberRange);
      const a = b + randomInt(1, numberRange);
      return { id, prompt: `${a} - ${b}`, num1: a, num2: b, operation: '-', correctAnswer: a - b, explanation: `${a} - ${b} = ${a - b}` };
    }
    if (op === '*') {
      const a = randomInt(2, Math.min(numberRange, 12));
      const b = randomInt(2, Math.min(numberRange, 12));
      return { id, prompt: `${a} × ${b}`, num1: a, num2: b, operation: '×', correctAnswer: a * b, explanation: `${a} × ${b} = ${a * b}` };
    }
    // op === '/'
    const divisor = randomInt(2, Math.min(numberRange, 12));
    const quotient = randomInt(2, Math.min(numberRange, 12));
    const dividend = divisor * quotient;
    return { id, prompt: `${dividend} ÷ ${divisor}`, num1: dividend, num2: divisor, operation: '÷', correctAnswer: quotient, explanation: `${dividend} ÷ ${divisor} = ${quotient}` };
  }, [selectedOp, numberRange]);

  // Start Session
  const handleStartPractice = () => {
    setIsConfiguring(false);
    setIsFinished(false);
    setAnsweredCount(0);
    setCorrectCount(0);
    setUserInput('');
    historyRef.current = [];
    startTimeRef.current = Date.now();
    setCurrentQuestion(spawnQuestion());
  };

  // Submit Answer
  const handleSubmit = useCallback(() => {
    if (!currentQuestion || isFinished || userInput.trim() === '' || userInput === '-') return;

    const parsed = parseInt(userInput, 10);
    if (isNaN(parsed)) return;

    const isCorrect = parsed === currentQuestion.correctAnswer;
    historyRef.current.push({
      ...currentQuestion,
      userAnswer: parsed,
      isCorrect,
    });

    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      soundManager.playCorrect(0);
      setFeedback('correct');
    } else {
      soundManager.playWrong();
      setFeedback('wrong');
    }

    const nextAnswered = answeredCount + 1;
    setAnsweredCount(nextAnswered);

    setTimeout(() => {
      setFeedback('none');
      if (nextAnswered >= questionCountTarget) {
        setIsFinished(true);
        soundManager.playFanfare();
      } else {
        setCurrentQuestion(spawnQuestion());
        setUserInput('');
      }
    }, 350);
  }, [currentQuestion, isFinished, userInput, answeredCount, questionCountTarget, spawnQuestion]);

  // Keypad Click Helper
  const handleKeypadPress = (val: string) => {
    if (isFinished) return;
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
      handleSubmit();
      return;
    }

    if (userInput.length < 5) {
      setUserInput((prev) => prev + val);
    }
  };

  // Physical Keyboard Listener
  useEffect(() => {
    if (isConfiguring) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;

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
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConfiguring, isFinished, handleSubmit]);

  // VIEW 1: Configuration Screen
  if (isConfiguring) {
    return (
      <div className="mx-auto w-full max-w-lg pb-12">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => {
              soundManager.playClick();
              onExit();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-indigo-950 bg-indigo-800 text-white shadow-lg transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2"
            title="Kembali"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 font-black text-xl text-white">
            <Target className="h-6 w-6 text-pink-400" />
            <span>Mode Latihan Bebas</span>
          </div>
          <div className="w-11" />
        </div>

        <div className="rounded-[2.5rem] border-4 border-indigo-800/80 bg-indigo-900 p-6 sm:p-8 shadow-2xl space-y-6 text-white">
          {/* Operation Selector */}
          <div>
            <label className="block text-xs font-black text-indigo-300 uppercase tracking-wider mb-2.5">
              1. Pilih Operasi Matematika
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { id: '+', label: '+' },
                { id: '-', label: '−' },
                { id: '*', label: '×' },
                { id: '/', label: '÷' },
                { id: 'mix', label: 'Campur' },
              ].map((op) => (
                <button
                  key={op.id}
                  onClick={() => {
                    soundManager.playClick();
                    setSelectedOp(op.id as '+' | '-' | '*' | '/' | 'mix');
                  }}
                  className={`flex h-13 items-center justify-center rounded-2xl font-black text-lg transition active:translate-y-0.5 ${
                    selectedOp === op.id
                      ? 'bg-pink-500 text-white border-b-4 border-pink-700 shadow-lg shadow-pink-500/25'
                      : 'bg-indigo-800/80 border-2 border-indigo-700 text-indigo-200 hover:bg-indigo-700'
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* Number Range Selector */}
          <div>
            <label className="block text-xs font-black text-indigo-300 uppercase tracking-wider mb-2.5">
              2. Batas Rentang Angka
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: 10, label: '1 - 10' },
                { val: 20, label: '1 - 20' },
                { val: 50, label: '1 - 50' },
                { val: 100, label: '1 - 100' },
              ].map((range) => (
                <button
                  key={range.val}
                  onClick={() => {
                    soundManager.playClick();
                    setNumberRange(range.val);
                  }}
                  className={`flex h-12 items-center justify-center rounded-2xl font-black text-xs sm:text-sm transition active:translate-y-0.5 ${
                    numberRange === range.val
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 border-b-4 border-amber-700 shadow-md'
                      : 'bg-indigo-800/80 border-2 border-indigo-700 text-indigo-200 hover:bg-indigo-700'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Questions Count Target */}
          <div>
            <label className="block text-xs font-black text-indigo-300 uppercase tracking-wider mb-2.5">
              3. Jumlah Soal Latihan
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[10, 20, 30].map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => {
                    soundManager.playClick();
                    setQuestionCountTarget(cnt);
                  }}
                  className={`flex h-12 items-center justify-center rounded-2xl font-black text-xs sm:text-sm transition active:translate-y-0.5 ${
                    questionCountTarget === cnt
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 border-b-4 border-amber-700 shadow-md'
                      : 'bg-indigo-800/80 border-2 border-indigo-700 text-indigo-200 hover:bg-indigo-700'
                  }`}
                >
                  {cnt} Soal
                </button>
              ))}
            </div>
          </div>

          {/* Start Action */}
          <button
            onClick={() => {
              soundManager.playClick();
              handleStartPractice();
            }}
            className="w-full flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-base font-black text-white border-b-4 border-pink-800 shadow-xl shadow-pink-500/25 transition active:translate-y-0.5 active:border-b-2 uppercase tracking-wider"
          >
            <Play className="h-5 w-5 fill-white" />
            Mulai Latihan Bebas
          </button>
        </div>
      </div>
    );
  }

  // VIEW 2: Finished Practice Summary
  if (isFinished) {
    const totalTimeSpent = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    const accuracy = Math.round((correctCount / questionCountTarget) * 100);

    return (
      <div className="mx-auto w-full max-w-md pb-12">
        <div className="rounded-[2.5rem] border-4 border-indigo-800/80 bg-indigo-900 p-6 sm:p-8 text-center shadow-2xl text-white space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-pink-500 text-white font-black text-3xl shadow-xl border-b-4 border-pink-700">
            🎯
          </div>
          <div>
            <h2 className="text-2xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400">
              Sesi Latihan Selesai!
            </h2>
            <p className="mt-1 text-xs text-indigo-200">Kerja bagus, latihan rutin mempertajam kecepatan kalkulasi mental.</p>
          </div>

          <div className="my-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 border border-white/15 p-4">
              <div className="text-2xl font-black font-mono text-yellow-400">{correctCount} / {questionCountTarget}</div>
              <div className="text-xs font-bold text-indigo-200 mt-1">Benar ({accuracy}%)</div>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/15 p-4">
              <div className="text-2xl font-black font-mono text-green-400">{totalTimeSpent}s</div>
              <div className="text-xs font-bold text-indigo-200 mt-1">Total Waktu</div>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={() => {
                soundManager.playClick();
                handleStartPractice();
              }}
              className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-sm font-black text-amber-950 border-b-4 border-amber-700 shadow-md active:translate-y-0.5 uppercase tracking-wider"
            >
              <RotateCcw className="h-4 w-4 stroke-[3]" />
              Latihan Lagi
            </button>
            <button
              onClick={() => {
                soundManager.playClick();
                setIsConfiguring(true);
              }}
              className="flex h-13 items-center justify-center rounded-2xl border-2 border-indigo-700 border-b-4 border-indigo-950 bg-indigo-800 text-sm font-black text-white hover:bg-indigo-700 active:translate-y-0.5 uppercase tracking-wider"
            >
              Ubah Pengaturan Latihan
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 3: Active Practice Gameplay
  if (!currentQuestion) return null;

  const promptParts = currentQuestion.prompt.split(/([+\-×÷=?()])/g);

  return (
    <div className="mx-auto w-full max-w-xl pb-12">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          onClick={() => {
            soundManager.playClick();
            setIsConfiguring(true);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-b-4 border-indigo-950 bg-indigo-800 text-white shadow-lg transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2"
          title="Kembali ke Opsi"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <span className="rounded-2xl bg-pink-500 border-b-2 border-pink-700 px-4 py-1.5 text-xs font-black text-white shadow-md uppercase tracking-wider">
          Soal {answeredCount + 1} / {questionCountTarget}
        </span>

        <span className="text-xs font-black bg-white/10 px-3 py-1.5 rounded-2xl border border-white/15 text-green-400 font-mono">
          Benar: {correctCount}
        </span>
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
        <span className="bg-indigo-600 text-white px-5 py-1 rounded-full text-xs sm:text-sm font-black shadow-md uppercase tracking-wider mb-4 inline-block">
          Latihan Bebas
        </span>

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

        <div className="mt-5 w-full max-w-sm bg-white border-4 border-indigo-200 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl flex items-center justify-between">
          <div className={`text-2xl sm:text-3xl font-mono font-black ${userInput === '' ? 'text-indigo-900/30 italic' : 'text-indigo-950'}`}>
            {userInput === '' ? '???' : userInput}
          </div>
          <button
            onClick={handleSubmit}
            disabled={userInput === '' || userInput === '-'}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs sm:text-sm font-black px-5 py-2.5 rounded-xl sm:rounded-2xl border-b-4 border-indigo-900 shadow-md active:translate-y-0.5 active:border-b-2 uppercase tracking-wider"
          >
            ENTER
          </button>
        </div>
      </div>

      {/* Tactile Keypad */}
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
          onClick={handleSubmit}
          disabled={userInput === '' || userInput === '-'}
          className="col-span-2 flex h-13 items-center justify-center rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-sm sm:text-base font-black text-white border-b-4 border-pink-800 shadow-xl shadow-pink-500/25 transition active:translate-y-0.5 active:border-b-2 disabled:opacity-40 uppercase tracking-wider"
        >
          <Check className="h-5 w-5 mr-1.5 stroke-[3]" />
          JAWAB (ENTER)
        </button>
      </div>
    </div>
  );
};
