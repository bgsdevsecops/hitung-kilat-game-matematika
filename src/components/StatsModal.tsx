import React, { useState } from 'react';
import { X, Trophy, Award, Flame, Target, Trash2 } from 'lucide-react';
import { UserStats } from '../types';
import { soundManager } from '../utils/sound';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: UserStats;
  totalStars: number;
  unlockedLevelsCount: number;
  onResetProgress: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  stats,
  totalStars,
  unlockedLevelsCount,
  onResetProgress,
}) => {
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  if (!isOpen) return null;

  const overallAccuracy =
    stats.totalSolved > 0 ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) : 0;
  const minutesPlayed = Math.round(stats.totalTimePlayedSec / 60);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-[2.5rem] border-4 border-indigo-800 bg-indigo-900 text-white p-6 sm:p-8 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-indigo-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 font-black border-b-2 border-amber-700 shadow-md">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-black text-xl text-white">Statistik Prestasi</h2>
              <p className="text-xs text-indigo-300">Rekapitulasi kecepatan & latihan Anda</p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-800 border border-indigo-700 text-indigo-200 hover:bg-indigo-700 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="my-6 grid grid-cols-2 gap-3">
          
          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="flex items-center justify-between text-yellow-400 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-200">Total Bintang</span>
              <span>⭐</span>
            </div>
            <div className="text-2xl font-black text-yellow-400 font-mono">
              {totalStars} <span className="text-xs font-normal text-indigo-300">/ 72</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="flex items-center justify-between text-pink-400 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-200">Level Terbuka</span>
              <Target className="h-4 w-4" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {unlockedLevelsCount} <span className="text-xs font-normal text-indigo-300">/ 24</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="flex items-center justify-between text-emerald-400 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-200">Akurasi Rata-rata</span>
              <Award className="h-4 w-4" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {overallAccuracy}%
            </div>
            <div className="text-[10px] text-indigo-300 mt-0.5 font-medium">
              {stats.totalCorrect} benar dari {stats.totalSolved} soal
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="flex items-center justify-between text-rose-400 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-200">Streak Terbaik</span>
              <Flame className="h-4 w-4 fill-rose-400 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-orange-400 font-mono">
              {stats.bestStreak}x
            </div>
            <div className="text-[10px] text-indigo-300 mt-0.5 font-medium">
              Kombo beruntun tanpa salah
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="text-[11px] font-black uppercase tracking-wider text-indigo-200 mb-1">
              Rekor Lari Kilat 60s
            </div>
            <div className="text-2xl font-black text-yellow-400 font-mono">
              {stats.highestTimeAttackScore} <span className="text-xs font-normal text-indigo-300">Poin</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5">
            <div className="text-[11px] font-black uppercase tracking-wider text-indigo-200 mb-1">
              Waktu Latihan
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {minutesPlayed} <span className="text-xs font-normal text-indigo-300">Menit</span>
            </div>
          </div>

        </div>

        {/* Reset Progress Section */}
        <div className="pt-4 border-t border-indigo-800/80">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Reset Seluruh Progres Permainan</span>
            </button>
          ) : (
            <div className="rounded-2xl bg-rose-950/80 border-2 border-rose-600/50 p-3.5 space-y-2.5 text-xs">
              <p className="font-bold text-rose-200">
                Yakin ingin mereset semua bintang dan pencapaian level? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onResetProgress();
                    setConfirmReset(false);
                  }}
                  className="rounded-xl bg-rose-600 px-3.5 py-2 font-black text-white shadow-md hover:bg-rose-500 border-b-2 border-rose-800 uppercase tracking-wider"
                >
                  Ya, Reset Sekarang
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="rounded-xl border border-indigo-700 bg-indigo-800 px-3.5 py-2 font-bold text-white hover:bg-indigo-700"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
