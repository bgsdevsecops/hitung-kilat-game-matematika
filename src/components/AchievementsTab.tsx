import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Flame,
  Star,
  Zap,
  Target,
  Crown,
  Calendar,
  Brain,
  Sparkles,
  Award,
  Timer,
  Lock,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { Achievement, AchievementCategory, UserStats } from '../types';
import { evaluateAchievements } from '../utils/achievements';
import { soundManager } from '../utils/sound';

interface AchievementsTabProps {
  stats: UserStats;
  totalStars: number;
  unlockedLevelsCount: number;
  dailyStreak?: number;
  dailyCompletedCount?: number;
}

export const AchievementsTab: React.FC<AchievementsTabProps> = ({
  stats,
  totalStars,
  unlockedLevelsCount,
  dailyStreak = 0,
  dailyCompletedCount = 0,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');

  const { achievements } = useMemo(() => {
    return evaluateAchievements({
      stats,
      totalStars,
      unlockedLevelsCount,
      dailyStreak,
      dailyCompletedCount,
    });
  }, [stats, totalStars, unlockedLevelsCount, dailyStreak, dailyCompletedCount]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const progressPercent = Math.round((unlockedCount / totalCount) * 100);

  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'all') return achievements;
    return achievements.filter((a) => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  // Helper to render icon by name
  const renderIcon = (iconName: string, unlocked: boolean, tier: Achievement['tier']) => {
    let colorClass = 'text-indigo-400';
    if (unlocked) {
      if (tier === 'diamond') colorClass = 'text-cyan-300';
      else if (tier === 'gold') colorClass = 'text-amber-400';
      else if (tier === 'silver') colorClass = 'text-slate-200';
      else colorClass = 'text-amber-600';
    }

    const props = { className: `h-6 w-6 ${colorClass}` };

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
      case 'Calendar':
        return <Calendar {...props} />;
      case 'Brain':
        return <Brain {...props} />;
      case 'Sparkles':
        return <Sparkles {...props} />;
      case 'Timer':
        return <Timer {...props} />;
      case 'Award':
      default:
        return <Award {...props} />;
    }
  };

  const getTierBadge = (tier: Achievement['tier']) => {
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
          <span className="rounded-md bg-amber-800/30 text-amber-500 border border-amber-700/40 px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase">
            Bronze
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 text-white">
      {/* Overview Progress Header */}
      <div className="rounded-3xl border-2 border-indigo-800 bg-gradient-to-r from-indigo-950/90 via-indigo-900/80 to-purple-950/80 p-4 sm:p-5 shadow-inner space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>Pencapaian & Lencana Prestasi</span>
                <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
                  {unlockedCount}/{totalCount}
                </span>
              </h3>
              <p className="text-[11px] text-indigo-300">
                Koleksi lencana torehan rekor berhitung dan konsistensi latihan Anda
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg sm:text-xl font-black font-mono text-amber-400">
              {progressPercent}%
            </div>
            <div className="text-[10px] text-indigo-300">Terselesaikan</div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-indigo-950 rounded-full h-2.5 overflow-hidden border border-indigo-800/80 p-0.5">
          <div
            className="bg-gradient-to-r from-amber-400 via-orange-400 to-pink-500 h-full rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          id="filter-achievements-all"
          onClick={() => {
            soundManager.playClick();
            setSelectedCategory('all');
          }}
          className={`h-8 px-3 rounded-xl font-black whitespace-nowrap transition border ${
            selectedCategory === 'all'
              ? 'bg-indigo-700 text-white border-indigo-500 shadow'
              : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/80 hover:bg-indigo-800'
          }`}
        >
          Semua ({totalCount})
        </button>
        <button
          id="filter-achievements-milestone"
          onClick={() => {
            soundManager.playClick();
            setSelectedCategory('milestone');
          }}
          className={`h-8 px-3 rounded-xl font-black whitespace-nowrap transition border ${
            selectedCategory === 'milestone'
              ? 'bg-indigo-700 text-white border-indigo-500 shadow'
              : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/80 hover:bg-indigo-800'
          }`}
        >
          Soal Matematika
        </button>
        <button
          id="filter-achievements-streak"
          onClick={() => {
            soundManager.playClick();
            setSelectedCategory('streak');
          }}
          className={`h-8 px-3 rounded-xl font-black whitespace-nowrap transition border ${
            selectedCategory === 'streak'
              ? 'bg-indigo-700 text-white border-indigo-500 shadow'
              : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/80 hover:bg-indigo-800'
          }`}
        >
          Streak & Kombo
        </button>
        <button
          id="filter-achievements-speed"
          onClick={() => {
            soundManager.playClick();
            setSelectedCategory('speed');
          }}
          className={`h-8 px-3 rounded-xl font-black whitespace-nowrap transition border ${
            selectedCategory === 'speed'
              ? 'bg-indigo-700 text-white border-indigo-500 shadow'
              : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/80 hover:bg-indigo-800'
          }`}
        >
          Kecepatan Kilat
        </button>
        <button
          id="filter-achievements-mastery"
          onClick={() => {
            soundManager.playClick();
            setSelectedCategory('mastery');
          }}
          className={`h-8 px-3 rounded-xl font-black whitespace-nowrap transition border ${
            selectedCategory === 'mastery'
              ? 'bg-indigo-700 text-white border-indigo-500 shadow'
              : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/80 hover:bg-indigo-800'
          }`}
        >
          Kampanye Bintang
        </button>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredAchievements.map((badge) => {
          const percent = Math.min(100, Math.round((badge.currentValue / badge.targetValue) * 100));

          let cardBorder = badge.unlocked
            ? 'border-indigo-700/80 bg-indigo-950/70 shadow-md'
            : 'border-indigo-900/60 bg-indigo-950/30 opacity-75';

          if (badge.unlocked && badge.tier === 'diamond') {
            cardBorder = 'border-cyan-500/50 bg-gradient-to-br from-indigo-950/90 via-cyan-950/30 to-indigo-950/90 shadow-cyan-900/20 shadow-lg';
          } else if (badge.unlocked && badge.tier === 'gold') {
            cardBorder = 'border-amber-500/50 bg-gradient-to-br from-indigo-950/90 via-amber-950/25 to-indigo-950/90 shadow-amber-900/20 shadow-lg';
          }

          return (
            <div
              key={badge.id}
              id={`badge-${badge.id}`}
              className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition ${cardBorder}`}
            >
              <div className="flex items-start gap-3">
                {/* Badge Icon Frame */}
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition ${
                    badge.unlocked
                      ? badge.tier === 'diamond'
                        ? 'bg-cyan-500/20 border-cyan-400/50 shadow-inner'
                        : badge.tier === 'gold'
                        ? 'bg-amber-500/20 border-amber-400/50 shadow-inner'
                        : badge.tier === 'silver'
                        ? 'bg-slate-300/20 border-slate-300/50 shadow-inner'
                        : 'bg-amber-800/20 border-amber-700/50 shadow-inner'
                      : 'bg-indigo-900/40 border-indigo-800 text-indigo-600'
                  }`}
                >
                  {badge.unlocked ? (
                    renderIcon(badge.icon, badge.unlocked, badge.tier)
                  ) : (
                    <Lock className="h-5 w-5 text-indigo-500" />
                  )}
                </div>

                {/* Badge Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`font-black text-xs sm:text-sm truncate ${
                        badge.unlocked ? 'text-white' : 'text-indigo-300'
                      }`}
                    >
                      {badge.title}
                    </h4>
                    {getTierBadge(badge.tier)}
                  </div>
                  <p className="text-[11px] text-indigo-300 mt-0.5 line-clamp-2 leading-relaxed">
                    {badge.description}
                  </p>
                </div>
              </div>

              {/* Progress Bar & Status */}
              <div className="space-y-1.5 pt-1 border-t border-indigo-900/60">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-indigo-300 font-medium">
                    {badge.unlocked ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-black">
                        <CheckCircle2 className="h-3 w-3" />
                        Tercapai
                      </span>
                    ) : (
                      <span>Progres:</span>
                    )}
                  </span>
                  <span className="font-mono text-indigo-200 font-bold">
                    {Math.min(badge.currentValue, badge.targetValue).toLocaleString()} /{' '}
                    {badge.targetValue.toLocaleString()} ({percent}%)
                  </span>
                </div>

                <div className="w-full bg-indigo-900/70 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      badge.unlocked
                        ? badge.tier === 'diamond'
                          ? 'bg-cyan-400'
                          : badge.tier === 'gold'
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
