import React, { useState, useEffect, useRef } from 'react';
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
  PrivacyState,
} from '../../types';
import {
  formatIndonesianDate,
  getEffectiveDailyStreak,
} from '../../utils/dailyChallenge';
import { getWIBDateString } from '../../utils/dailyWib';
import { evaluateCompetitiveEligibility } from '../../lib/competitiveEligibility';
import {
  createCompetitiveApiClient,
  CompetitiveApiClient,
  CompetitiveLeaderboardEntry,
} from '../../lib/competitiveApi';
import { isCompetitiveRankedEnabled } from '../../lib/featureFlags';
import { loadPrivacyState } from '../../utils/privacy/privacyState';
import { auth } from '../../lib/firebase';

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
  apiClient?: CompetitiveApiClient;
  privacyState?: PrivacyState;
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
  apiClient,
  privacyState,
}) => {
  const isToday = selectedDate === todayDateStr;
  const effectiveStreak = getEffectiveDailyStreak(userState);

  const clientRef = useRef<CompetitiveApiClient | null>(null);
  if (!clientRef.current || apiClient) {
    clientRef.current = apiClient || createCompetitiveApiClient();
  }
  const client = clientRef.current;

  const currentPrivacy = privacyState || loadPrivacyState();
  const currentUser = auth.currentUser;
  const isGuest = currentUser ? currentUser.isAnonymous : true;
  const isAuthenticated = Boolean(currentUser && !currentUser.isAnonymous);
  const featureFlagEnabled = isCompetitiveRankedEnabled();

  const eligibility = evaluateCompetitiveEligibility({
    ageEligibility: currentPrivacy.ageEligibility,
    isGuest,
    isAuthenticated,
    leaderboardOptOut: Boolean(currentPrivacy.leaderboardOptOut),
    featureFlagEnabled,
  });

  const [serverLeaderboard, setServerLeaderboard] = useState<CompetitiveLeaderboardEntry[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);
  const [leaderboardError, setLeaderboardError] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    if (eligibility.executionMode !== 'ranked') {
      setServerLeaderboard([]);
      setIsLoadingLeaderboard(false);
      setLeaderboardError(false);
      return;
    }

    setIsLoadingLeaderboard(true);
    setLeaderboardError(false);

    client
      .getLeaderboard(selectedDate, 'daily')
      .then((res) => {
        if (!cancelled) {
          setServerLeaderboard(res.entries || []);
          setIsLoadingLeaderboard(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServerLeaderboard([]);
          setIsLoadingLeaderboard(false);
          setLeaderboardError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, client, eligibility.executionMode]);

  const formattedCountdown = `${String(countdown.hours).padStart(2, '0')}:${String(
    countdown.minutes
  ).padStart(2, '0')}:${String(countdown.seconds).padStart(2, '0')}`;

  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
    onSelectDate(getWIBDateString(prev));
  };

  const handleNextDay = () => {
    if (selectedDate >= todayDateStr) return;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
    onSelectDate(getWIBDateString(next));
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
            {isToday ? (
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Hari Ini
              </span>
            ) : (
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                Arsip Lampau
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
            <span>Streak: {effectiveStreak} Hari</span>
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
            <div
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${
                todayRecord.completed
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {todayRecord.completed
                ? isToday
                  ? 'Rekor Resmi Hari Ini Tercatat'
                  : 'Rekor Tersimpan'
                : 'Kesempatan Resmi Telah Digunakan'}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-black font-mono text-amber-300">
                {todayRecord.score} Poin
              </span>
              <span className="text-xs text-indigo-300 mt-1">
                {todayRecord.completed
                  ? `Akurasi: ${todayRecord.accuracy}% | Benar: ${todayRecord.correctCount}/10`
                  : 'Sesi sebelumnya dihentikan sebelum selesai (0 Poin)'}
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
        ) : isToday ? (
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
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-xs font-black text-indigo-300 uppercase tracking-wider">
              <RotateCcw className="w-4 h-4" />
              Mode Latihan Arsip
            </div>
            <p className="text-sm text-indigo-200 max-w-md">
              Teka-teki arsip lampau dapat dimainkan untuk latihan tanpa memengaruhi peringkat resmi atau streak harian.
            </p>

            <button
              type="button"
              onClick={onStartChallenge}
              aria-label="Mulai Latihan Arsip"
              className="w-full sm:w-auto min-h-[48px] min-w-[48px] px-10 py-3.5 flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-base shadow-2xl active:scale-98 transition-all"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Mulai Latihan (10 Soal)</span>
            </button>
          </div>
        )}
      </div>

      {/* Stage Flow Preview */}
      <section aria-labelledby="stage-heading" className="flex flex-col gap-3">
        <h2 id="stage-heading" className="text-sm font-black text-indigo-300 uppercase tracking-wider">
          Kurikulum Soal (10 Tahap Bertingkat)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {STAGE_PREVIEWS.map((st) => (
            <div
              key={st.num}
              className="flex flex-col items-center p-3 rounded-2xl bg-indigo-950/60 border border-indigo-800/50 text-center"
            >
              <span className="text-xl mb-1">{st.icon}</span>
              <span className="text-[11px] font-bold text-white leading-tight">
                {st.num}. {st.title}
              </span>
              <span className="text-[10px] text-indigo-400 mt-1">{st.diff}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard Benchmark Table */}
      <section aria-labelledby="leaderboard-heading" className="flex flex-col gap-3">
        <h2 id="leaderboard-heading" className="text-sm font-black text-indigo-300 uppercase tracking-wider">
          Peringkat Resmi ({formatIndonesianDate(selectedDate)})
        </h2>

        {eligibility.executionMode !== 'ranked' ? (
          <div className="p-6 text-center text-xs text-indigo-300 bg-indigo-950/60 rounded-2xl border border-indigo-800/50">
            Papan peringkat hanya tersedia untuk pemain terverifikasi (13+ tahun, akun terdaftar, dan mengaktifkan papan peringkat).
          </div>
        ) : isLoadingLeaderboard ? (
          <div className="p-8 flex flex-col items-center justify-center gap-2 bg-indigo-950/60 rounded-2xl border border-indigo-800/50">
            <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-indigo-300">Memuat peringkat resmi...</span>
          </div>
        ) : leaderboardError ? (
          <div className="p-6 text-center text-xs text-indigo-400 bg-indigo-950/60 rounded-2xl border border-indigo-800/50">
            Papan peringkat sedang tidak tersedia. Silakan coba beberapa saat lagi.
          </div>
        ) : serverLeaderboard.length === 0 ? (
          <div className="p-6 text-center text-xs text-indigo-400 bg-indigo-950/60 rounded-2xl border border-indigo-800/50">
            Belum ada catatan peringkat resmi untuk hari ini. Jadilah yang pertama!
          </div>
        ) : (
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
                {serverLeaderboard.slice(0, 10).map((entry, idx) => (
                  <tr key={entry.rank || idx} className="hover:bg-indigo-900/30 transition-colors">
                    <td className="py-2 px-3 text-center font-bold text-amber-400">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : entry.rank}
                    </td>
                    <td className="py-2 px-3">
                      <span className="mr-1.5">{entry.countryFlag || '🇮🇩'}</span>
                      <span className="font-bold">{entry.pseudonym}</span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-indigo-300">
                      {(entry.durationMs / 1000).toFixed(1)}s
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-black text-amber-300">
                      {entry.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
