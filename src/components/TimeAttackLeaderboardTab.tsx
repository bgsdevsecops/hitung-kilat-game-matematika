import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Timer,
  RefreshCw,
  Sparkles,
  Flame,
  Target,
  Medal,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  LogIn,
  Send,
  Zap,
} from 'lucide-react';
import {
  fetchTopTimeAttackScores,
  submitTimeAttackScore,
  TimeAttackLeaderboardEntry,
  User,
} from '../lib/firebase';
import { UserStats } from '../types';
import { soundManager } from '../utils/sound';

interface TimeAttackLeaderboardTabProps {
  stats: UserStats;
  currentUser: User | null;
  playerName: string;
  playerFlag?: string;
  onOpenSyncModal: () => void;
}

export const TimeAttackLeaderboardTab: React.FC<TimeAttackLeaderboardTabProps> = ({
  stats,
  currentUser,
  playerName,
  playerFlag = '🇮🇩',
  onOpenSyncModal,
}) => {
  const [scores, setScores] = useState<TimeAttackLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTopTimeAttackScores(10);
      setScores(data);
    } catch (err: any) {
      console.error('Failed to load top 10 scores:', err);
      setError('Gagal memuat papan peringkat. Pastikan koneksi internet aktif.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const handleManualSubmit = async () => {
    if (!currentUser) {
      onOpenSyncModal();
      return;
    }

    if (stats.highestTimeAttackScore <= 0) {
      setError('Anda belum memiliki rekor skor Time Attack. Mainkan mode Time Attack terlebih dahulu!');
      return;
    }

    setSubmitting(true);
    setSubmitSuccess(null);
    setError(null);
    try {
      const displayName = currentUser.displayName || playerName || 'Pemain Kilat';
      const photoURL = currentUser.photoURL || null;

      const accuracy =
        stats.totalSolved > 0 ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) : 100;

      await submitTimeAttackScore({
        userId: currentUser.uid,
        displayName,
        photoURL,
        score: stats.highestTimeAttackScore,
        accuracy,
        streak: stats.bestStreak || 0,
        solvedCount: Math.round(stats.highestTimeAttackScore / 10),
        playerFlag,
      });

      soundManager.playFanfare();
      setSubmitSuccess('Skor terbaik Anda berhasil disinkronkan ke Top 10!');
      await loadLeaderboard();
    } catch (err: any) {
      console.error('Submit error:', err);
      setError('Gagal mengirim skor. Coba beberapa saat lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  const isUserInTop10 = scores.some((s) => s.userId === currentUser?.uid);
  const userBestScore = stats.highestTimeAttackScore || 0;

  return (
    <div className="space-y-4 text-white">
      {/* Tab Subheader & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-950/70 p-4 rounded-3xl border-2 border-indigo-800 shadow-inner">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              <span>Papan Peringkat Global</span>
              <span className="rounded-md bg-amber-500/20 text-amber-300 px-1.5 py-0.5 text-[10px] font-bold border border-amber-500/30">
                Top 10
              </span>
            </h3>
            <p className="text-[11px] text-indigo-300">
              Skor tertinggi mode Time Attack (Lari Kilat 60 Detik) dari semua pemain
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            id="refresh-top10-scores"
            onClick={() => {
              soundManager.playClick();
              loadLeaderboard();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-indigo-800 hover:bg-indigo-700 text-indigo-200 hover:text-white text-xs font-bold transition border border-indigo-700 disabled:opacity-50"
            title="Muat ulang skor dari Firestore"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* User Personal Record Callout & Quick Submit */}
      <div className="rounded-2xl border border-indigo-700/60 bg-gradient-to-r from-indigo-950/90 via-indigo-900/80 to-purple-950/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 font-black">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
              Rekor Time Attack Anda
            </div>
            <div className="text-lg font-black text-yellow-300 font-mono flex items-center gap-2">
              <span>{userBestScore.toLocaleString()} Poin</span>
              {isUserInTop10 && (
                <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5">
                  ✓ Terdaftar di Top 10
                </span>
              )}
            </div>
          </div>
        </div>

        {currentUser ? (
          <button
            id="submit-my-score-top10"
            onClick={() => {
              soundManager.playClick();
              handleManualSubmit();
            }}
            disabled={submitting || userBestScore <= 0}
            className="flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-amber-950 font-black text-xs transition border-b-2 border-amber-700 shadow disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{submitting ? 'Mengirim...' : 'Kirim / Perbarui Skor'}</span>
          </button>
        ) : (
          <button
            id="login-to-submit-score"
            onClick={() => {
              soundManager.playClick();
              onOpenSyncModal();
            }}
            className="flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs transition border border-indigo-600 shadow"
          >
            <LogIn className="h-3.5 w-3.5 text-indigo-300" />
            <span>Masuk untuk Catat ke Leaderboard</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {submitSuccess && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 p-3 text-xs text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-950/80 border border-rose-500/40 p-3 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Scores Table / List */}
      <div className="space-y-2">
        {loading && scores.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-indigo-300">
            <RefreshCw className="h-8 w-8 animate-spin text-amber-400" />
            <p className="text-xs font-medium">Mengambil data skor dari Firestore...</p>
          </div>
        ) : scores.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-indigo-800 bg-indigo-950/40 p-8 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-900 text-indigo-300 border border-indigo-700">
              <Trophy className="h-7 w-7 text-amber-400" />
            </div>
            <div>
              <h4 className="font-black text-sm text-white">Belum Ada Skor di Top 10</h4>
              <p className="text-xs text-indigo-300 mt-1 max-w-sm mx-auto">
                Papan peringkat Firestore masih kosong. Jadilah pemain pertama yang mencatat nama dan skor tertinggi Anda di mode Time Attack!
              </p>
            </div>
            {userBestScore > 0 && (
              <button
                onClick={handleManualSubmit}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 px-4 py-2 font-black text-xs transition border-b-2 border-amber-700 shadow"
              >
                <Sparkles className="h-4 w-4" />
                <span>Kirimkan Skor Saya ({userBestScore.toLocaleString()} Poin) Sekarang</span>
              </button>
            )}
          </div>
        ) : (
          scores.map((entry, index) => {
            const rank = index + 1;
            const isMe = currentUser && entry.userId === currentUser.uid;

            // Highlight medals for top 3
            let rankBadge = (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-800 border border-indigo-700 text-xs font-black text-indigo-300">
                #{rank}
              </div>
            );

            let rowBorder = 'border-indigo-800/80 bg-indigo-950/60';
            if (rank === 1) {
              rankBadge = (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 font-black text-sm shadow-md border border-amber-200">
                  🥇
                </div>
              );
              rowBorder = 'border-amber-500/50 bg-gradient-to-r from-amber-950/40 via-indigo-950/80 to-indigo-950/60 shadow-amber-900/10 shadow-lg';
            } else if (rank === 2) {
              rankBadge = (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 font-black text-sm shadow-md border border-slate-100">
                  🥈
                </div>
              );
              rowBorder = 'border-slate-400/40 bg-gradient-to-r from-slate-950/40 via-indigo-950/80 to-indigo-950/60';
            } else if (rank === 3) {
              rankBadge = (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 font-black text-sm shadow-md border border-amber-600">
                  🥉
                </div>
              );
              rowBorder = 'border-amber-700/40 bg-gradient-to-r from-amber-950/30 via-indigo-950/80 to-indigo-950/60';
            }

            if (isMe) {
              rowBorder += ' ring-2 ring-emerald-400/60';
            }

            return (
              <div
                key={entry.id || entry.userId || index}
                id={`leaderboard-rank-${rank}`}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-3 sm:p-3.5 transition ${rowBorder}`}
              >
                {/* Left: Rank & User Profile */}
                <div className="flex items-center gap-3 min-w-0">
                  {rankBadge}

                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {entry.photoURL ? (
                      <img
                        src={entry.photoURL}
                        alt={entry.displayName}
                        className="h-9 w-9 rounded-full object-cover border border-white/20"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-800 border border-indigo-700 text-indigo-300 font-black text-xs">
                        {entry.displayName?.charAt(0)?.toUpperCase() || 'P'}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 text-xs leading-none">
                      {entry.playerFlag || '🇮🇩'}
                    </span>
                  </div>

                  {/* Name & Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-sm text-white truncate max-w-[120px] sm:max-w-[180px]">
                        {entry.displayName}
                      </span>
                      {isMe && (
                        <span className="rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-bold">
                          Anda
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-indigo-300 mt-0.5">
                      {entry.accuracy > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Target className="h-3 w-3 text-emerald-400" />
                          <span>{entry.accuracy}% Tepat</span>
                        </span>
                      )}
                      {entry.streak > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Flame className="h-3 w-3 text-orange-400" />
                          <span>{entry.streak}x Kombo</span>
                        </span>
                      )}
                      {entry.solvedCount > 0 && (
                        <span className="hidden sm:inline text-indigo-400">
                          • {entry.solvedCount} Soal
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Score Display */}
                <div className="text-right shrink-0">
                  <div className="text-base sm:text-lg font-black font-mono text-amber-300 tracking-tight">
                    {entry.score.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-indigo-300 font-medium">Poin Kilat</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="text-center text-[11px] text-indigo-400 pt-2 border-t border-indigo-800/60">
        Papan peringkat diperbarui secara langsung melalui Firebase Cloud Firestore.
      </div>
    </div>
  );
};
