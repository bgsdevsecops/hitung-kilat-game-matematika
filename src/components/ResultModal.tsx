import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, ArrowRight, Home, ChevronDown, ChevronUp, Award, Flame, CheckCircle, XCircle } from 'lucide-react';
import { GameSummary } from '../types';
import { soundManager } from '../utils/sound';

interface ResultModalProps {
  summary: GameSummary;
  onRetry: () => void;
  onNextLevel?: () => void;
  onHome: () => void;
  hasNextLevel?: boolean;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  summary,
  onRetry,
  onNextLevel,
  onHome,
  hasNextLevel = false,
}) => {
  const [showReview, setShowReview] = useState<boolean>(false);

  useEffect(() => {
    if (summary.starsEarned >= 2 || summary.isNewRecord) {
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#f59e0b', '#10b981', '#ec4899'],
        });
      } catch {
        // Fallback if canvas is unavailable
      }
    }
  }, [summary]);

  const isLevelSuccess = summary.starsEarned > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md rounded-[2.5rem] border-4 border-indigo-800 bg-indigo-900 text-white p-6 sm:p-8 shadow-2xl transition-all my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Ribbon / Stars */}
        <div className="text-center">
          {summary.mode === 'campaign' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-4xl sm:text-5xl">
                {[1, 2, 3].map((starIdx) => (
                  <span
                    key={starIdx}
                    className={`transition-all duration-300 ${
                      starIdx <= summary.starsEarned
                        ? 'text-yellow-400 scale-110 drop-shadow-[0_4px_10px_rgba(250,204,21,0.5)]'
                        : 'text-indigo-800'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400">
                {summary.starsEarned === 3
                  ? 'Sempurna & Sangat Kilat! 🏆'
                  : summary.starsEarned === 2
                  ? 'Hebat & Akurat! ⭐'
                  : summary.starsEarned === 1
                  ? 'Level Selesai! 👍'
                  : 'Waktu Habis / Coba Lagi! 💪'}
              </h2>

              <p className="text-xs sm:text-sm text-indigo-200 font-medium">
                {isLevelSuccess
                  ? 'Tingkat kecepatan berhitung Anda luar biasa.'
                  : 'Latih fokus dan coba lagi untuk membuka bintang!'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-400 text-amber-950 font-black text-3xl mb-1 shadow-lg border-b-4 border-amber-600">
                ⚡
              </div>
              <h2 className="text-2xl sm:text-3xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400">
                Sesi Lari Kilat Selesai!
              </h2>
              {summary.isNewRecord && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 border-b-2 border-amber-600 px-4 py-1 text-xs font-black text-amber-950 shadow-md uppercase tracking-wider animate-pulse">
                  <Award className="h-4 w-4" />
                  Rekor Skor Baru Tercapai!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Score & Metrics Grid */}
        <div className="my-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5 text-center">
            <div className="text-2xl font-black text-yellow-400 font-mono">
              {summary.score}
            </div>
            <div className="text-[10px] font-black text-indigo-300 uppercase tracking-wider mt-0.5">
              Total Skor
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5 text-center">
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {summary.accuracy}%
            </div>
            <div className="text-[10px] font-black text-indigo-300 uppercase tracking-wider mt-0.5">
              Akurasi ({summary.correctCount}/{summary.questionsTotal})
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5 text-center">
            <div className="text-xl font-black text-pink-400 font-mono">
              {summary.questionsPerMinute} <span className="text-xs font-medium text-indigo-300">SPM</span>
            </div>
            <div className="text-[10px] font-black text-indigo-300 uppercase tracking-wider mt-0.5">
              Soal / Menit
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5 text-center">
            <div className="flex items-center justify-center gap-1 text-xl font-black text-amber-400 font-mono">
              <Flame className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span>{summary.maxStreak}x</span>
            </div>
            <div className="text-[10px] font-black text-indigo-300 uppercase tracking-wider mt-0.5">
              Streak Tertinggi
            </div>
          </div>
        </div>

        {/* Review Answers Collapsible */}
        {summary.history.length > 0 && (
          <div className="mb-6 rounded-2xl border-2 border-indigo-800 bg-indigo-950/60 overflow-hidden">
            <button
              onClick={() => setShowReview((prev) => !prev)}
              className="w-full flex items-center justify-between bg-indigo-800/80 px-4 py-2.5 text-xs font-black text-indigo-200 hover:bg-indigo-800 transition"
            >
              <span>Tinjau Jawaban Soal ({summary.history.length} Soal)</span>
              {showReview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showReview && (
              <div className="max-h-48 overflow-y-auto p-3 space-y-2 text-xs divide-y divide-indigo-800/80">
                {summary.history.map((q, idx) => (
                  <div key={q.id || idx} className="pt-2 first:pt-0 flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-mono font-bold text-white">
                        {q.prompt} = <span className="text-yellow-400 font-black">{q.correctAnswer}</span>
                      </div>
                      <div className="text-[11px] text-indigo-300">
                        {q.explanation}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 font-mono">
                      <span className={q.isCorrect ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold line-through'}>
                        {q.userAnswer}
                      </span>
                      {q.isCorrect ? (
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {summary.mode === 'campaign' && isLevelSuccess && hasNextLevel && onNextLevel && (
            <button
              id="result-next-level-button"
              onClick={() => {
                soundManager.playClick();
                onNextLevel();
              }}
              className="w-full flex h-13 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-sm font-black text-amber-950 border-b-4 border-amber-700 shadow-xl transition active:translate-y-0.5 uppercase tracking-wider"
            >
              <span>Level Selanjutnya</span>
              <ArrowRight className="h-4 w-4 stroke-[3]" />
            </button>
          )}

          <button
            id="result-retry-button"
            onClick={() => {
              soundManager.playClick();
              onRetry();
            }}
            className={`w-full flex h-13 items-center justify-center gap-2 rounded-2xl font-black text-sm transition active:translate-y-0.5 uppercase tracking-wider ${
              isLevelSuccess
                ? 'bg-pink-500 hover:bg-pink-600 text-white border-b-4 border-pink-700 shadow-lg'
                : 'bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-amber-950 border-b-4 border-amber-700 shadow-xl'
            }`}
          >
            <RotateCcw className="h-4 w-4 stroke-[3]" />
            <span>Main Lagi</span>
          </button>

          <button
            id="result-home-button"
            onClick={() => {
              soundManager.playClick();
              onHome();
            }}
            className="w-full flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-indigo-700 border-b-4 border-indigo-950 bg-indigo-800 text-xs font-black text-white hover:bg-indigo-700 transition active:translate-y-0.5 uppercase tracking-wider"
          >
            <Home className="h-4 w-4" />
            <span>Menu Peta Level</span>
          </button>
        </div>

      </div>
    </div>
  );
};
