import React, { useState } from 'react';
import { Flame, Zap, Sparkles, Share2, Check, RotateCcw, Home } from 'lucide-react';
import { ValidationOutput } from '../../engine/competitive/validator';
import { calculateDailyScore } from '../../engine/competitive/scoring';

export interface DailyResultViewProps {
  output: ValidationOutput;
  isRanked: boolean;
  challengeId?: string;
  currentStreak: number;
  isStreakIncremented: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
}

export const DailyResultView: React.FC<DailyResultViewProps> = ({
  output,
  isRanked,
  challengeId,
  currentStreak,
  isStreakIncremented,
  onPlayAgain,
  onExit,
}) => {
  const [copied, setCopied] = useState(false);
  const { result } = output;

  const scoreDetails = calculateDailyScore(
    result.correctCount,
    result.maxStreak,
    result.rankedActiveDurationMs
  );

  const durationSec = (result.rankedActiveDurationMs / 1000).toFixed(1);

  const handleShare = () => {
    const datePart = challengeId ? challengeId.split('@')[0] : 'Hari Ini';
    const text =
      `⚡ Hitung Kilat - Tantangan Harian (${datePart})\n` +
      `🏆 Skor: ${result.score} Poin\n` +
      `⏱️ Waktu: ${durationSec}s | Akurasi: ${result.accuracy.toFixed(0)}%\n` +
      `🎯 Benar: ${result.correctCount}/10 (Max Kombo: ${result.maxStreak}x)\n` +
      `🔥 Streak: ${currentStreak} Hari\n\n` +
      `Uji kecepatan kalkulasi mentalmu di Hitung Kilat!`;

    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6 py-6 px-4">
      {/* Top Banner & Status Badge */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-indigo-700/70 bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-950 p-6 text-center text-white shadow-2xl">
        <div className="flex justify-center mb-3">
          {isRanked ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1 text-xs font-black text-emerald-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Skor Resmi Tercatat
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 px-3.5 py-1 text-xs font-black text-amber-300 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              Mode Latihan (Tidak Mengubah Rekor Resmi)
            </span>
          )}
        </div>

        <h2 className="text-2xl sm:text-3xl font-black italic text-white tracking-tight">
          Tantangan Harian Selesai!
        </h2>
        <div className="my-4">
          <div className="text-5xl sm:text-6xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400">
            {result.score}
          </div>
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
            Total Poin Diperoleh
          </span>
        </div>

        {/* Streak Flame Tracker */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-white/10 border border-white/15 text-sm font-black text-amber-300">
          <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span>Streak: {currentStreak} Hari</span>
          {isStreakIncremented && (
            <span className="text-xs text-emerald-400 font-bold">(+1 Hari Ini!)</span>
          )}
        </div>
      </div>

      {/* 4-Tier Score Breakdown Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Tier 1: Base */}
        <div className="p-3.5 rounded-2xl bg-indigo-900/50 border border-indigo-700/50">
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Skor Dasar</div>
          <div className="text-xl font-mono font-black text-white mt-1">+{scoreDetails.base}</div>
          <div className="text-[10px] text-indigo-400">{result.correctCount} benar × 120</div>
        </div>

        {/* Tier 2: Streak */}
        <div className="p-3.5 rounded-2xl bg-indigo-900/50 border border-indigo-700/50">
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Bonus Kombo</div>
          <div className="text-xl font-mono font-black text-white mt-1">+{scoreDetails.streakBonus}</div>
          <div className="text-[10px] text-indigo-400">Max kombo {result.maxStreak}x</div>
        </div>

        {/* Tier 3: Speed */}
        <div className="p-3.5 rounded-2xl bg-indigo-900/50 border border-indigo-700/50">
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Bonus Kecepatan</div>
          <div className="text-xl font-mono font-black text-white mt-1">+{scoreDetails.speedBonus}</div>
          <div className="text-[10px] text-indigo-400">Waktu aktif {durationSec}s</div>
        </div>

        {/* Tier 4: Perfect */}
        <div className="p-3.5 rounded-2xl bg-indigo-900/50 border border-indigo-700/50">
          <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Bonus Sempurna</div>
          <div className="text-xl font-mono font-black text-white mt-1">+{scoreDetails.perfectBonus}</div>
          <div className="text-[10px] text-indigo-400">
            {result.correctCount === 10 ? '10/10 Sempurna!' : '0 (Perlu 10/10)'}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={handleShare}
          aria-label="Bagikan Hasil"
          className="w-full sm:flex-1 min-h-[48px] min-w-[48px] flex items-center justify-center gap-2 rounded-2xl bg-indigo-800 hover:bg-indigo-700 border border-indigo-600 text-white font-black text-sm transition-all shadow-md active:scale-98"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          <span>{copied ? 'Tersalin ke Clipboard!' : 'Bagikan'}</span>
        </button>

        <button
          type="button"
          onClick={onPlayAgain}
          aria-label="Main Ulang Mode Latihan"
          className="w-full sm:flex-1 min-h-[48px] min-w-[48px] flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-sm transition-all shadow-md active:scale-98"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Main Ulang (Latihan)</span>
        </button>

        <button
          type="button"
          onClick={onExit}
          aria-label="Kembali ke Beranda"
          className="w-full sm:w-auto min-h-[48px] min-w-[48px] px-5 flex items-center justify-center gap-2 rounded-2xl bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/60 text-indigo-300 hover:text-white font-bold text-sm transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </div>
    </div>
  );
};
