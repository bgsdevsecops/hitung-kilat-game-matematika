import React from 'react';
import { Clock, ShieldCheck } from 'lucide-react';

export interface SurvivalHeaderProps {
  timeRemainingMs: number;
  totalElapsedMs: number;
  difficultyTier: number;
  feedback?: 'none' | 'correct' | 'wrong';
}

export const SurvivalHeader: React.FC<SurvivalHeaderProps> = ({
  timeRemainingMs,
  totalElapsedMs,
  difficultyTier,
  feedback = 'none',
}) => {
  const secondsLeft = Math.max(0, (timeRemainingMs / 1000)).toFixed(1);
  const percent = Math.min(100, Math.max(0, (timeRemainingMs / 60000) * 100));

  const totalSec = Math.floor(totalElapsedMs / 1000);
  const minutes = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const seconds = (totalSec % 60).toString().padStart(2, '0');

  return (
    <header className="w-full flex flex-col gap-2 p-3 bg-slate-900/80 rounded-2xl border border-slate-700/60 backdrop-blur-md">
      <div className="flex items-center justify-between text-xs">
        {/* Tier & Mode */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-md font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Tier {difficultyTier}
          </span>
          <div className="flex items-center gap-1 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono font-bold text-sm text-slate-100">{minutes}:{seconds}</span>
          </div>
        </div>

        {/* Pulse & Time Left */}
        <div className="flex items-center gap-2">
          {feedback === 'correct' && (
            <span className="font-bold text-xs text-emerald-400 animate-bounce">+2s</span>
          )}
          {feedback === 'wrong' && (
            <span className="font-bold text-xs text-rose-400 animate-bounce">-4s</span>
          )}
          <span className="font-mono font-bold text-sm text-amber-300">{secondsLeft}s</span>
          <div className="flex items-center gap-1 text-slate-400" title="Anti-Cheat Aktif">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Energy Gauge Bar */}
      <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Energy remaining"
          style={{ width: `${percent}%` }}
          className={`h-full transition-all duration-200 rounded-full ${
            percent > 40
              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
              : percent > 15
              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
              : 'bg-gradient-to-r from-rose-600 to-red-500 animate-pulse'
          }`}
        />
      </div>
    </header>
  );
};
