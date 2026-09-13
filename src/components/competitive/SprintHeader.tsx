import React from 'react';
import { Flame, Zap } from 'lucide-react';

export interface SprintHeaderProps {
  timeRemainingMs: number;
  comboStreak: number;
  difficultyTier: number;
}

export const SprintHeader: React.FC<SprintHeaderProps> = ({
  timeRemainingMs,
  comboStreak,
  difficultyTier,
}) => {
  const secondsLeft = Math.max(0, Math.ceil(timeRemainingMs / 1000));
  const isCritical = secondsLeft <= 10;
  const multiplier = Math.min(3.0, 1.0 + Math.floor(comboStreak) * 0.1).toFixed(1);

  return (
    <header className="w-full flex items-center justify-between px-4 py-3 bg-indigo-900/60 rounded-2xl border border-indigo-700/50 backdrop-blur-md">
      {/* Tier Badge */}
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30">
          Tier {difficultyTier}
        </span>
        <div className="flex items-center gap-1 text-xs text-indigo-300">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Sprint 60s</span>
        </div>
      </div>

      {/* Center Countdown Badge */}
      <div
        role={isCritical ? 'status' : undefined}
        aria-live={isCritical ? 'assertive' : 'off'}
        className={`flex items-center justify-center font-mono font-black text-2xl px-5 py-1.5 rounded-xl border transition-all ${
          isCritical
            ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse motion-reduce:animate-none scale-105'
            : 'bg-indigo-950/80 border-indigo-500/40 text-amber-300'
        }`}
      >
        {secondsLeft}s
      </div>

      {/* Multiplier / Combo Flame */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-sm">
          <Flame className={`w-4 h-4 ${comboStreak > 3 ? 'text-orange-400 animate-bounce motion-reduce:animate-none' : 'text-amber-400'}`} />
          <span>{multiplier}x</span>
        </div>
      </div>
    </header>
  );
};
