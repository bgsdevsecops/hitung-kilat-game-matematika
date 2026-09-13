import React from 'react';
import {
  Trophy,
  CheckCircle,
  Flame,
  Clock,
  RotateCcw,
  Home,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { ValidationOutput } from '../../engine/competitive/validator';

export interface CompetitiveResultViewProps {
  output: ValidationOutput;
  onPlayAgain: () => void;
  onExit: () => void;
}

export const CompetitiveResultView: React.FC<CompetitiveResultViewProps> = ({
  output,
  onPlayAgain,
  onExit,
}) => {
  const { canonicalMetrics, status, leaderboardEligible, rejectionReasons } = output;
  const durationSec = Math.round(canonicalMetrics.rankedActiveDurationMs / 1000);
  const isValidated = leaderboardEligible && status === 'VALIDATED';

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-6 p-6 bg-indigo-950/90 rounded-3xl border border-indigo-700/60 shadow-2xl backdrop-blur-xl animate-fade-in motion-reduce:animate-none">
      {/* Title & Status */}
      <div className="flex flex-col items-center text-center gap-1">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-1">
          <Trophy className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-wide">Hasil Pertandingan</h2>
        {isValidated ? (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" /> Peringkat Sah
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3.5 h-3.5" /> Latihan Tidak Berperingkat
          </span>
        )}
        {!isValidated && rejectionReasons && rejectionReasons.length > 0 && (
          <span className="text-[11px] text-amber-400/80 mt-0.5">
            Alasan: {rejectionReasons.join(', ')}
          </span>
        )}
      </div>

      {/* Main Canonical Score Card */}
      <div className="w-full flex flex-col items-center py-4 px-6 rounded-2xl bg-gradient-to-b from-indigo-900/60 to-indigo-950/80 border border-indigo-600/30">
        <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">Skor Akhir</span>
        <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">
          {canonicalMetrics.score}
        </span>
      </div>

      {/* Grid of Canonical Metrics */}
      <div className="w-full grid grid-cols-2 gap-3">
        <div className="flex flex-col p-3 rounded-xl bg-indigo-900/40 border border-indigo-800/40">
          <div className="flex items-center gap-1 text-xs text-indigo-300 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Akurasi</span>
          </div>
          <span className="font-bold text-lg text-white">{canonicalMetrics.accuracy}%</span>
          <span className="text-[11px] text-indigo-400">
            {canonicalMetrics.correctCount} / {canonicalMetrics.questionsAnswered}
          </span>
        </div>

        <div className="flex flex-col p-3 rounded-xl bg-indigo-900/40 border border-indigo-800/40">
          <div className="flex items-center gap-1 text-xs text-indigo-300 mb-1">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Max Combo</span>
          </div>
          <span className="font-bold text-lg text-white">{canonicalMetrics.maxStreak}</span>
          <span className="text-[11px] text-indigo-400">Streak berturut-turut</span>
        </div>

        <div className="flex flex-col p-3 rounded-xl bg-indigo-900/40 border border-indigo-800/40">
          <div className="flex items-center gap-1 text-xs text-indigo-300 mb-1">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>Durasi Aktif</span>
          </div>
          <span className="font-bold text-lg text-white">{durationSec}s</span>
          <span className="text-[11px] text-indigo-400">Waktu respon efektif</span>
        </div>

        <div className="flex flex-col p-3 rounded-xl bg-indigo-900/40 border border-indigo-800/40">
          <div className="flex items-center gap-1 text-xs text-indigo-300 mb-1">
            <Trophy className="w-3.5 h-3.5 text-yellow-400" />
            <span>Tier Tertinggi</span>
          </div>
          <span className="font-bold text-lg text-white">Tier {canonicalMetrics.difficultyReached}</span>
          <span className="text-[11px] text-indigo-400">Tingkat kesulitan</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onPlayAgain}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
        >
          <RotateCcw className="w-4 h-4" /> Main Lagi
        </button>
        <button
          type="button"
          onClick={onExit}
          className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-indigo-900/80 hover:bg-indigo-800/80 border border-indigo-700/50 text-indigo-200 active:scale-95 transition-all"
        >
          <Home className="w-4 h-4" /> Kembali ke Menu
        </button>
      </div>
    </div>
  );
};
