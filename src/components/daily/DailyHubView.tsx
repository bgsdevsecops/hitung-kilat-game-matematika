import React from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  Trophy,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import {
  DailyChallengeRecord,
  DailyChallengeUserState,
  LeaderboardEntry,
} from '../../types';
import { formatIndonesianDate, getLeaderboardForDate } from '../../utils/dailyChallenge';

export interface DailyHubViewProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  todayDateStr: string;
  countdown: { hours: number; minutes: number; seconds: number; ms: number };
  userState: DailyChallengeUserState;
  todayRecord?: DailyChallengeRecord;
  onStartChallenge: () => void;
  onExit: () => void;
  onOpenStats: () => void;
}

const STAGE_PREVIEWS = [
  { num: 1, title: 'Refleks Puluhan', icon: '⚡', diff: 'Mudah' },
  { num: 2, title: 'Pengurangan Cepat', icon: '➖', diff: 'Mudah' },
  { num: 3, title: 'Tabel Perkalian', icon: '✖️', diff: 'Sedang' },
  { num: 4, title: 'Pembagian Refleks', icon: '➗', diff: 'Sedang' },
  { num: 5, title: 'Rantai 3 Bilangan', icon: '⛓️', diff: 'Menantang' },
  { num: 6, title: 'Pengurangan Majemuk', icon: '🎯', diff: 'Menantang' },
  { num: 7, title: 'Perkalian 2-Digit', icon: '🔢', diff: 'Tinggi' },
  { num: 8, title: 'BODMAS Prioritas', icon: '📐', diff: 'Tinggi' },
  { num: 9, title: 'Aljabar Linear Kilat', icon: '🧩', diff: 'Master' },
  { num: 10, title: 'Grandmaster Math', icon: '👑', diff: 'Grandmaster' },
];

export const DailyHubView: React.FC<DailyHubViewProps> = ({
  selectedDate,
  onSelectDate,
  todayDateStr,
  countdown,
  userState,
  todayRecord,
  onStartChallenge,
  onExit,
  onOpenStats,
}) => {
  const isToday = selectedDate === todayDateStr;
  const leaderboard: LeaderboardEntry[] = getLeaderboardForDate(selectedDate);

  const formattedCountdown = `${String(countdown.hours).padStart(2, '0')}:${String(
    countdown.minutes
  ).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`;

  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    onSelectDate(prev.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    if (selectedDate >= todayDateStr) return;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    onSelectDate(next.toISOString().split('T')[0]);
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 py-6 px-4">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Kembali ke Beranda"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/50 text-indigo-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-black italic tracking-tight text-white">
            Tantangan Harian
          </h1>
          <span className="text-xs text-indigo-300 font-medium">
            Waktu Indonesia Barat (WIB)
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenStats}
          aria-label="Buka Statistik & Rekor"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-indigo-900/60 hover:bg-indigo-800/80 border border-indigo-700/50 text-amber-400 hover:text-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <Trophy className="w-5 h-5" />
        </button>
      </header>

      {/* Date Navigator & Midnight WIB Countdown */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-indigo-950/70 border border-indigo-800/60 shadow-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevDay}
            aria-label="Hari Sebelumnya"
            className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl bg-indigo-900/70 hover:bg-indigo-800 text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center px-2">
            <div className="text-sm font-black text-white">
              {formatIndonesianDate(selectedDate)}
            </div>
            {isToday && (
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Hari Ini
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            disabled={selectedDate >= todayDateStr}
            aria-label="Hari Berikutnya"
            className={`min-h-[48px] min-w-[48px] flex items-center justify-center rounded-2xl transition-colors ${
              selectedDate >= todayDateStr
                ? 'opacity-40 cursor-not-allowed bg-indigo-950 text-indigo-600'
                : 'bg-indigo-900/70 hover:bg-indigo-800 text-white'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* WIB Midnight Countdown & Streak Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs">
            <Flame className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>Streak: {userState.currentStreak} Hari</span>
          </div>

          {isToday && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-indigo-900/60 border border-indigo-700/40 text-indigo-300 font-mono text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>Reset dlm: {formattedCountdown}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hero Action Card */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-indigo-700/80 bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-950 p-6 shadow-2xl text-center">
        {todayRecord ? (
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-xs font-black text-emerald-300 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              Rekor Resmi Hari Ini Tercatat
            </div>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-black font-mono text-amber-300">
                {todayRecord.score} Poin
              </span>
              <span className="text-xs text-indigo-300 mt-1">
                Akurasi: {todayRecord.accuracy}% | Benar: {todayRecord.correctCount}/10
              </span>
            </div>

            <button
              type="button"
              onClick={onStartChallenge}
              aria-label="Main Ulang Tantangan (Mode Latihan)"
              className="w-full sm:w-auto min-h-[48px] min-w-[48px] px-8 py-3 flex items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-sm shadow-xl active:scale-98 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Main Ulang (Mode Latihan)</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-yellow-400/20 border border-yellow-400/40 text-xs font-black text-yellow-300 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              1x Kesempatan Resmi per Hari
            </div>
            <p className="text-sm text-indigo-200 max-w-md">
              Selesaikan 10 soal deterministik dalam 90 detik. Sesi ini menentukan perolehan
              peringkat resmi dan streak harianmu!
            </p>

            <button
              type="button"
              onClick={onStartChallenge}
              aria-label="Mulai Tantangan Harian"
              className="w-full sm:w-auto min-h-[48px] min-w-[48px] px-10 py-3.5 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-amber-950 font-black text-base shadow-2xl active:scale-98 transition-all"
            >
              <Play className="w-5 h-5 fill-amber-950" />
              <span>Mulai Tantangan (10 Soal)</span>
            </button>
          </div>
        )}
      </div>

      {/* 10-Stage Preview */}
      <section aria-labelledby="stage-preview-heading" className="flex flex-col gap-3">
        <h2 id="stage-preview-heading" className="text-sm font-black text-indigo-300 uppercase tracking-wider">
          Rincian 10 Tahap Soal Curated
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {STAGE_PREVIEWS.map((st) => (
            <div
              key={st.num}
              className="flex flex-col items-center text-center p-2.5 rounded-2xl bg-indigo-950/60 border border-indigo-800/40"
            >
              <span className="text-lg">{st.icon}</span>
              <span className="text-[11px] font-black text-white mt-1 truncate w-full">
                {st.title}
              </span>
              <span className="text-[10px] text-indigo-400 font-medium">{st.diff}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard Benchmark Table */}
      <section aria-labelledby="leaderboard-heading" className="flex flex-col gap-3">
        <h2 id="leaderboard-heading" className="text-sm font-black text-indigo-300 uppercase tracking-wider">
          Peringkat Global ({formatIndonesianDate(selectedDate)})
        </h2>
        <div className="overflow-hidden rounded-2xl border border-indigo-800/50 bg-indigo-950/60">
          <table className="w-full text-left text-xs">
            <thead className="bg-indigo-900/50 text-indigo-300 font-bold uppercase tracking-wider border-b border-indigo-800/50">
              <tr>
                <th className="py-2.5 px-3 text-center w-12">#</th>
                <th className="py-2.5 px-3">Pemain</th>
                <th className="py-2.5 px-3 text-right">Waktu</th>
                <th className="py-2.5 px-3 text-right">Skor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-900/40 text-white font-medium">
              {leaderboard.slice(0, 5).map((entry, idx) => (
                <tr key={entry.id || idx} className="hover:bg-indigo-900/30 transition-colors">
                  <td className="py-2 px-3 text-center font-bold text-amber-400">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </td>
                  <td className="py-2 px-3">
                    <span className="mr-1.5">{entry.flag}</span>
                    <span className="font-bold">{entry.playerName || (entry as any).name}</span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-indigo-300">
                    {entry.timeTakenSec.toFixed(1)}s
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-black text-amber-300">
                    {entry.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
