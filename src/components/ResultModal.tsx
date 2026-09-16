import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  RotateCcw,
  ArrowRight,
  Home,
  ChevronDown,
  ChevronUp,
  Award,
  Flame,
  CheckCircle,
  XCircle,
  Sparkles,
  Target,
  Trophy,
  Crown,
  Gem,
  Timer,
  Star,
  Zap,
} from 'lucide-react';
import { GameSummary, Achievement } from '../types';
import { soundManager } from '../utils/sound';

interface ResultModalProps {
  summary: GameSummary;
  onRetry: () => void;
  onNextLevel?: () => void;
  onHome: () => void;
  hasNextLevel?: boolean;
  onStartRemediation?: () => void;
}

const renderTierBadge = (tier: Achievement['tier']) => {
  switch (tier) {
    case 'diamond':
      return (
        <span className="rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase">
          Diamond
        </span>
      );
    case 'gold':
      return (
        <span className="rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase">
          Gold
        </span>
      );
    case 'silver':
      return (
        <span className="rounded-md bg-slate-300/20 text-slate-200 border border-slate-300/40 px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase">
          Silver
        </span>
      );
    case 'bronze':
    default:
      return (
        <span className="rounded-md bg-amber-700/20 text-amber-400 border border-amber-600/40 px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase">
          Bronze
        </span>
      );
  }
};

const renderAchievementIcon = (iconName: string, tier: Achievement['tier']) => {
  let colorClass = 'text-amber-400';
  if (tier === 'diamond') colorClass = 'text-cyan-300';
  else if (tier === 'gold') colorClass = 'text-amber-300';
  else if (tier === 'silver') colorClass = 'text-slate-200';
  else if (tier === 'bronze') colorClass = 'text-amber-500';

  const props = { className: `h-5 w-5 ${colorClass}` };

  switch (iconName) {
    case 'Trophy':
      return <Trophy {...props} />;
    case 'Flame':
      return <Flame {...props} />;
    case 'Star':
      return <Star {...props} />;
    case 'Zap':
      return <Zap {...props} />;
    case 'Target':
      return <Target {...props} />;
    case 'Crown':
      return <Crown {...props} />;
    case 'Sparkles':
      return <Sparkles {...props} />;
    case 'Timer':
      return <Timer {...props} />;
    case 'Gem':
      return <Gem {...props} />;
    case 'Award':
    default:
      return <Award {...props} />;
  }
};

export const ResultModal: React.FC<ResultModalProps> = ({
  summary,
  onRetry,
  onNextLevel,
  onHome,
  hasNextLevel = false,
  onStartRemediation,
}) => {
  const [showReview, setShowReview] = useState<boolean>(false);

  // Trigger celebratory confetti effect when achieving a new star rating or high rating
  useEffect(() => {
    // Check if user earned a new star record in campaign mode or earned stars
    const isCampaignNewStar =
      summary.mode === 'campaign' &&
      summary.starsEarned > 0 &&
      (summary.isNewStarRecord ||
        (summary.previousStars !== undefined && summary.starsEarned > summary.previousStars));

    const isBossVictory = summary.isBoss && summary.starsEarned >= 1;

    const shouldTriggerConfetti =
      isCampaignNewStar ||
      isBossVictory ||
      (summary.mode === 'campaign' && summary.starsEarned >= 2) ||
      (summary.mode === 'time_attack' && summary.isNewRecord);

    if (!shouldTriggerConfetti) return;

    try {
      // Stage 1: Immediate celebratory blast from center
      confetti({
        particleCount: isCampaignNewStar && summary.starsEarned === 3 ? 100 : isBossVictory ? 90 : 70,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#fbbf24', '#f59e0b', '#ec4899', '#6366f1', '#10b981', '#38bdf8'],
        ticks: 250,
        gravity: 0.9,
        scalar: 1.1,
      });

      // Stage 2: Left and right cannons for new star records / boss victory
      const timer1 = setTimeout(() => {
        try {
          // Left side cannon
          confetti({
            particleCount: 40,
            angle: 60,
            spread: 55,
            origin: { x: 0.05, y: 0.65 },
            colors: ['#fbbf24', '#f59e0b', '#3b82f6', '#10b981'],
          });
          // Right side cannon
          confetti({
            particleCount: 40,
            angle: 120,
            spread: 55,
            origin: { x: 0.95, y: 0.65 },
            colors: ['#ec4899', '#a855f7', '#fbbf24', '#38bdf8'],
          });
        } catch {
          // Ignore
        }
      }, 250);

      // Stage 3: Extra golden star shower if 3 stars achieved
      let timer2: NodeJS.Timeout | null = null;
      if (summary.starsEarned === 3 || isBossVictory) {
        timer2 = setTimeout(() => {
          try {
            confetti({
              particleCount: 60,
              spread: 100,
              origin: { y: 0.4 },
              shapes: ['star', 'circle'],
              colors: ['#fef08a', '#facc15', '#f59e0b', '#fb923c'],
              scalar: 1.25,
              ticks: 300,
            });
          } catch {
            // Ignore
          }
        }, 550);
      }

      return () => {
        clearTimeout(timer1);
        if (timer2) clearTimeout(timer2);
      };
    } catch {
      // Fallback if canvas is unavailable
    }
  }, [summary]);

  const isLevelSuccess = summary.starsEarned > 0;
  const isNewStarAchieved =
    summary.mode === 'campaign' &&
    summary.starsEarned > 0 &&
    (summary.isNewStarRecord ||
      (summary.previousStars !== undefined && summary.starsEarned > summary.previousStars));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md rounded-[2.5rem] border-4 border-indigo-800 bg-indigo-900 text-white p-6 sm:p-8 shadow-2xl transition-all my-8 animate-in fade-in zoom-in-95 duration-200">

        {/* Header Ribbon / Stars */}
        <div className="text-center">
          {summary.mode === 'campaign' ? (
            <div className="space-y-2">
              {/* Star Rating Badge / Counter */}
              <div className="relative inline-flex items-center justify-center">
                <div className="flex items-center justify-center gap-2 text-4xl sm:text-5xl">
                  {[1, 2, 3].map((starIdx) => (
                    <span
                      key={starIdx}
                      className={`transition-all duration-300 transform ${
                        starIdx <= summary.starsEarned
                          ? 'text-yellow-400 scale-110 drop-shadow-[0_4px_12px_rgba(250,204,21,0.6)] animate-bounce'
                          : 'text-indigo-800 scale-95'
                      }`}
                      style={{
                        animationDelay: `${(starIdx - 1) * 150}ms`,
                        animationIterationCount: starIdx <= summary.starsEarned ? 2 : 0,
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>

              {/* Badges and Fanfares */}
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 pt-1">
                {/* Boss victory fanfare banner */}
                {summary.isBoss && summary.starsEarned >= 1 && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 via-amber-500 to-red-600 border-2 border-yellow-300 px-4 py-1.5 text-xs font-black text-yellow-100 shadow-[0_0_20px_rgba(239,68,68,0.7)] uppercase tracking-wider animate-pulse">
                    <Crown className="h-4 w-4 text-yellow-200" />
                    <span>★ TIER BOSS DITAKLUKKAN! ★</span>
                  </div>
                )}

                {/* Perfect Badge */}
                {summary.isPerfect && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-950/90 border border-cyan-400/80 px-3.5 py-1 text-xs font-black text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.5)] uppercase tracking-wider">
                    <Gem className="h-3.5 w-3.5 text-cyan-300" />
                    <span>PERFECT RUN</span>
                  </div>
                )}

                {/* New Star Achieved Banner */}
                {isNewStarAchieved && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 border-b-2 border-amber-600 px-3.5 py-1 text-xs font-black text-amber-950 shadow-lg uppercase tracking-wider animate-pulse">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Rekor Bintang Baru! ({summary.starsEarned} ★)</span>
                  </div>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400">
                {summary.isBoss && summary.starsEarned >= 1
                  ? 'Kemenangan Boss Spektakuler! 👑'
                  : summary.starsEarned === 3
                  ? 'Sempurna & Sangat Kilat! 🏆'
                  : summary.starsEarned === 2
                  ? 'Hebat & Akurat! ⭐'
                  : summary.starsEarned === 1
                  ? 'Level Selesai! 👍'
                  : 'Waktu Habis / Coba Lagi! 💪'}
              </h2>

              <p className="text-xs sm:text-sm text-indigo-200 font-medium">
                {summary.isBoss && summary.starsEarned >= 1
                  ? 'Luar biasa! Anda berhasil menumbangkan Boss dan membuktikan keahlian berhitung kilat!'
                  : isNewStarAchieved
                  ? `Selamat! Anda berhasil meningkatkan rating menjadi ${summary.starsEarned} Bintang!`
                  : isLevelSuccess
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

              <div className="flex flex-wrap items-center justify-center gap-2">
                {summary.isPerfect && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-950/90 border border-cyan-400/80 px-3.5 py-1 text-xs font-black text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.5)] uppercase tracking-wider">
                    <Gem className="h-3.5 w-3.5 text-cyan-300" />
                    <span>PERFECT RUN</span>
                  </div>
                )}

                {summary.isNewRecord && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 border-b-2 border-amber-600 px-4 py-1 text-xs font-black text-amber-950 shadow-md uppercase tracking-wider animate-pulse">
                    <Award className="h-4 w-4" />
                    Rekor Skor Baru Tercapai!
                  </div>
                )}
              </div>
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

        {/* Target vs Actual Speed Comparison Card */}
        {summary.targetTimeSec !== undefined && (
          <div className="mb-4 rounded-2xl bg-indigo-950/70 border border-indigo-700/60 p-3.5 shadow-md">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-200">
                <Timer className="h-4 w-4 text-amber-400" />
                <span>Perbandingan Kecepatan</span>
              </div>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  summary.timeSpentSec <= summary.targetTimeSec
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-400/30'
                }`}
              >
                {summary.timeSpentSec <= summary.targetTimeSec ? 'Tercapai' : 'Perlu Dipercepat'}
              </span>
            </div>
            <div className="text-sm font-black font-mono text-white text-center py-1 bg-white/5 rounded-xl border border-white/10">
              Waktu: {summary.timeSpentSec}s / Target: {summary.targetTimeSec}s
            </div>
          </div>
        )}

        {/* Newly Unlocked Achievements Pop-up Cards */}
        {summary.unlockedAchievements && summary.unlockedAchievements.length > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span>Pencapaian Terbuka!</span>
            </div>
            <div className="space-y-2">
              {summary.unlockedAchievements.map((ach) => (
                <div
                  key={ach.id}
                  className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-indigo-950/80 to-purple-950/40 p-3 flex items-center gap-3 shadow-lg"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-950/90 border border-amber-400/40 shadow-inner">
                    {renderAchievementIcon(ach.icon, ach.tier)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-sm text-yellow-300 truncate">{ach.title}</span>
                      {renderTierBadge(ach.tier)}
                    </div>
                    <p className="text-xs text-indigo-200 line-clamp-1">{ach.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

          {summary.wrongCount > 0 && onStartRemediation && (
            <button
              id="result-remediation-button"
              onClick={() => {
                soundManager.playClick();
                onStartRemediation();
              }}
              className="w-full flex min-h-[48px] h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:brightness-110 text-sm font-black text-white border-b-4 border-rose-800 shadow-xl transition active:translate-y-0.5 uppercase tracking-wider"
            >
              <Target className="h-4 w-4 stroke-[2.5]" />
              <span>Latih Kesalahan ({summary.wrongCount})</span>
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
