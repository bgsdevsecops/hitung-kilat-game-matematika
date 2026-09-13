import React from 'react';
import { ArrowLeft, Clock, Flame, Zap } from 'lucide-react';

export interface DailyHeaderProps {
  timeRemainingMs: number;
  currentQuestionIdx: number;
  totalQuestions?: number;
  comboStreak: number;
  stageTitle: string;
  onExit: () => void;
}

export const DailyHeader: React.FC<DailyHeaderProps> = ({
  timeRemainingMs,
  currentQuestionIdx,
  totalQuestions = 10,
  comboStreak,
  stageTitle,
  onExit,
}) => {
  const totalSeconds = Math.max(0, Math.ceil(timeRemainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Speed target is 75s (remaining time >= 15s out of 90s)
  const isWithinTarget = timeRemainingMs >= 15000;

  return (
    <header className="w-full flex flex-col gap-2.5" role="banner">
      {/* Top Action & Status Row */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Kembali ke Beranda"
          title="Keluar (Escape)"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/50 text-indigo-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Center: Stage Title and Question Indicator */}
        <div className="flex-1 flex flex-col items-center text-center truncate">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="truncate">{stageTitle}</span>
          </div>
          <span className="text-sm font-black text-white font-mono">
            Soal {Math.min(totalQuestions, currentQuestionIdx + 1)} dari {totalQuestions}
          </span>
        </div>

        {/* Right: Monotonic Countdown Timer */}
        <div
          className={`flex flex-col items-end px-3 py-1.5 rounded-2xl border transition-colors ${
            isWithinTarget
              ? 'bg-indigo-950/80 border-emerald-500/50 text-emerald-400'
              : 'bg-indigo-950/80 border-amber-500/60 text-amber-400'
          }`}
        >
          <div className="flex items-center gap-1.5 font-mono font-black text-lg">
            <Clock className="w-4 h-4" />
            <span>{formattedTime}</span>
          </div>
          <span className="text-[10px] font-bold text-indigo-300">Target: 75s</span>
        </div>
      </div>

      {/* Segmented 10-Question Progress Bar */}
      <div
        role="progressbar"
        aria-label="Progres Soal Tantangan Harian"
        aria-valuenow={currentQuestionIdx + 1}
        aria-valuemin={1}
        aria-valuemax={totalQuestions}
        className="flex gap-1.5 w-full"
      >
        {Array.from({ length: totalQuestions }).map((_, idx) => {
          const isPassed = idx < currentQuestionIdx;
          const isCurrent = idx === currentQuestionIdx;
          return (
            <div
              key={idx}
              className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                isPassed
                  ? 'bg-emerald-400'
                  : isCurrent
                  ? 'bg-amber-400 animate-pulse motion-reduce:animate-none'
                  : 'bg-indigo-950 border border-indigo-800/60'
              }`}
            />
          );
        })}
      </div>

      {/* Combo Streak Indicator */}
      {comboStreak > 1 && (
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-amber-950 font-black text-xs shadow-md border border-amber-300 animate-bounce motion-reduce:animate-none">
            <Flame className="w-3.5 h-3.5 fill-amber-950" />
            <span>{comboStreak}x Kombo Beruntun! (+{comboStreak * 30} Poin)</span>
          </div>
        </div>
      )}
    </header>
  );
};
