import React, { useState, useMemo } from 'react';
import {
  Play,
  Lock,
  Zap,
  Target,
  Award,
  Clock,
  Calendar,
  Sparkles,
  Flame,
  ChevronDown,
  Crown,
  CheckCircle2,
} from 'lucide-react';
import { LevelConfig, UserLevelProgress, DifficultyTier } from '../types';
import { LevelConfigV2 } from '../engine/types/level';
import { LEVEL_MANIFEST_72 } from '../engine/manifest/levels';
import {
  V2CampaignState,
  V2LevelProgress,
  calculateTierStars,
  createDefaultCampaignState,
  loadCampaignState,
  isLevelUnlocked,
} from '../utils/campaignState';
import { migrateV1ToV2 } from '../engine/migration/migrator';
import { soundManager } from '../utils/sound';

export interface LevelMapProps {
  campaignState?: V2CampaignState;
  progress?: Record<string, V2LevelProgress> | Record<number, UserLevelProgress>;
  onSelectLevel: (level: LevelConfigV2 | any) => void;
  onStartTimeAttack: () => void;
  onStartPractice: () => void;
  onStartDailyChallenge: () => void;
  onOpenCompetitiveModal?: () => void;
  dailyStreak?: number;
  isDailyCompletedToday?: boolean;
}

interface TierMetadata {
  id: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  title: string;
  subtitle: string;
  bossId: string;
  badgeBg: string;
  badgeBorder: string;
}

const CAMPAIGN_TIERS: TierMetadata[] = [
  {
    id: 1,
    name: 'Pemula',
    title: 'Tier 1 — Pemula',
    subtitle: 'Number Sense & Dasar +/−',
    bossId: 'T1-BOSS',
    badgeBg: 'bg-emerald-500',
    badgeBorder: 'border-emerald-600',
  },
  {
    id: 2,
    name: 'Menengah',
    title: 'Tier 2 — Menengah',
    subtitle: 'Perkalian & Pembagian Dasar (×/÷)',
    bossId: 'T2-BOSS',
    badgeBg: 'bg-sky-500',
    badgeBorder: 'border-sky-600',
  },
  {
    id: 3,
    name: 'Terampil',
    title: 'Tier 3 — Terampil',
    subtitle: 'Bilangan Bulat Negatif & Operasi Campuran',
    bossId: 'T3-BOSS',
    badgeBg: 'bg-indigo-500',
    badgeBorder: 'border-indigo-600',
  },
  {
    id: 4,
    name: 'Mahir',
    title: 'Tier 4 — Mahir',
    subtitle: 'Pecahan, Desimal & Persentase',
    bossId: 'T4-BOSS',
    badgeBg: 'bg-violet-500',
    badgeBorder: 'border-violet-600',
  },
  {
    id: 5,
    name: 'Master',
    title: 'Tier 5 — Master',
    subtitle: 'Aljabar Dasar & Aritmatika Cepat',
    bossId: 'T5-BOSS',
    badgeBg: 'bg-amber-500',
    badgeBorder: 'border-amber-600',
  },
  {
    id: 6,
    name: 'Legenda',
    title: 'Tier 6 — Legenda',
    subtitle: 'Aljabar Lanjutan & Tantangan Grandmaster',
    bossId: 'T6-BOSS',
    badgeBg: 'bg-rose-500',
    badgeBorder: 'border-rose-600',
  },
];

function resolveCampaignState(
  campaignState?: V2CampaignState,
  progress?: Record<string, V2LevelProgress> | Record<number, UserLevelProgress>
): V2CampaignState {
  if (campaignState) {
    return campaignState;
  }

  if (progress) {
    const keys = Object.keys(progress);
    const isV1 = keys.length > 0 && keys.every((k) => !isNaN(Number(k)) && !k.startsWith('T'));
    if (isV1) {
      const v1Prog = progress as Record<number, UserLevelProgress>;
      const migrationRes = migrateV1ToV2(v1Prog);
      const defaultState = createDefaultCampaignState();
      let totalStars = 0;
      for (const [lvlId, prog] of Object.entries(migrationRes.levels)) {
        if (defaultState.levels[lvlId]) {
          defaultState.levels[lvlId] = {
            ...defaultState.levels[lvlId],
            unlocked: prog.unlocked || defaultState.levels[lvlId].unlocked,
            stars: prog.stars,
            bestScore: prog.bestScore,
            accuracy: prog.accuracy,
            bestTimeSec: prog.bestTimeSec,
            migratedFromV1Id: prog.migratedFromV1Id,
          };
        }
      }
      for (const lvl of LEVEL_MANIFEST_72) {
        defaultState.levels[lvl.id].unlocked =
          defaultState.levels[lvl.id].unlocked || isLevelUnlocked(defaultState, lvl);
        totalStars += defaultState.levels[lvl.id].stars;
      }
      defaultState.totalStars = totalStars;
      defaultState.legacyStarCredits = migrationRes.legacyStarCredits;
      return defaultState;
    } else {
      const v2Levels = progress as Record<string, V2LevelProgress>;
      const defaultState = createDefaultCampaignState();
      let totalStars = 0;
      for (const lvl of LEVEL_MANIFEST_72) {
        if (v2Levels[lvl.id]) {
          defaultState.levels[lvl.id] = { ...v2Levels[lvl.id] };
        }
        defaultState.levels[lvl.id].unlocked =
          defaultState.levels[lvl.id].unlocked || isLevelUnlocked(defaultState, lvl);
        totalStars += defaultState.levels[lvl.id].stars;
      }
      defaultState.totalStars = totalStars;
      return defaultState;
    }
  }

  return loadCampaignState() || createDefaultCampaignState();
}

function getInitialActiveTier(state: V2CampaignState): number {
  for (const lvl of LEVEL_MANIFEST_72) {
    const prog = state.levels[lvl.id];
    if (prog && prog.unlocked && prog.stars === 0) {
      return lvl.tier;
    }
  }
  let highestTier = 1;
  for (const lvl of LEVEL_MANIFEST_72) {
    const prog = state.levels[lvl.id];
    if (prog && prog.unlocked) {
      highestTier = lvl.tier;
    }
  }
  return highestTier;
}

export const LevelMap: React.FC<LevelMapProps> = ({
  campaignState,
  progress,
  onSelectLevel,
  onStartTimeAttack,
  onStartPractice,
  onStartDailyChallenge,
  onOpenCompetitiveModal,
  dailyStreak = 0,
  isDailyCompletedToday = false,
}) => {
  const effectiveState = useMemo(
    () => resolveCampaignState(campaignState, progress),
    [campaignState, progress]
  );

  const initialActiveTier = useMemo(
    () => getInitialActiveTier(effectiveState),
    [effectiveState]
  );

  const [expandedTiers, setExpandedTiers] = useState<Record<number, boolean>>(() => ({
    [initialActiveTier]: true,
  }));

  const toggleTier = (tierId: number) => {
    soundManager.playClick();
    setExpandedTiers((prev) => ({
      ...prev,
      [tierId]: !prev[tierId],
    }));
  };

  const totalUnlocked = useMemo(() => {
    return (Object.values(effectiveState.levels) as V2LevelProgress[]).filter((p) => p.unlocked).length;
  }, [effectiveState]);

  const totalCompleted = useMemo(() => {
    return (Object.values(effectiveState.levels) as V2LevelProgress[]).filter((p) => p.stars > 0).length;
  }, [effectiveState]);

  const totalStars = effectiveState.totalStars || 0;
  const progressPercent = Math.min(100, Math.round((totalStars / 216) * 100));

  return (
    <div className="w-full pb-16">
      {/* Global Header & Mode Shortcuts */}
      <div className="mb-8 rounded-[2.5rem] bg-indigo-900 border-4 border-indigo-800/80 p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden">
        {/* Decorative ambient background */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -top-12 w-48 h-48 rounded-full bg-yellow-400/15 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-pink-500 text-white font-black px-4 py-1 text-xs shadow-md border-b-2 border-pink-700 uppercase tracking-wider">
                <Zap className="h-3.5 w-3.5 text-yellow-300 fill-yellow-300" />
                <span>Peta Kampanye Matematika (72 Level)</span>
              </div>
              {effectiveState.legacyStarCredits > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 text-amber-950 font-black px-3 py-1 text-xs shadow-md border-b-2 border-amber-600">
                  <Sparkles className="h-3 w-3 fill-amber-950" />
                  +{effectiveState.legacyStarCredits} Bintang Warisan V1
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400">
              Tingkatkan Kecepatan Berhitung Otak Anda
            </h1>
            <p className="text-sm sm:text-base text-indigo-200 leading-relaxed font-medium">
              Taklukkan 6 tingkatan dari dasar hingga aljabar lanjutan dan tantangan Grandmaster. Selesaikan tiap level untuk mengumpulkan hingga 216 bintang emas!
            </p>

            {/* Global Star Progress Bar */}
            <div className="pt-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-200">
                <span className="flex items-center gap-1 text-amber-300 font-extrabold text-sm">
                  <span>{totalStars} / 216 ★</span>
                  <span className="text-xs text-indigo-300 font-normal">({progressPercent}%)</span>
                </span>
                <span className="text-indigo-300 text-xs">
                  {totalUnlocked} / 72 Terbuka • {totalCompleted} Selesai
                </span>
              </div>
              <div
                className="w-full bg-indigo-950/80 rounded-full h-3.5 border border-indigo-700/60 p-0.5 overflow-hidden shadow-inner"
                role="progressbar"
                aria-valuenow={totalStars}
                aria-valuemin={0}
                aria-valuemax={216}
                aria-label="Kemajuan Bintang Global"
              >
                <div
                  className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 h-full rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(251,191,36,0.6)]"
                  style={{ width: `${Math.max(2, progressPercent)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Play Alternative Modes */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            {/* Tantangan Harian Button */}
            <button
              id="daily-challenge-mode-button"
              onClick={() => {
                soundManager.playClick();
                onStartDailyChallenge();
              }}
              className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 px-5 py-3.5 min-h-[48px] text-sm font-black text-white border-b-4 border-pink-800 shadow-xl shadow-pink-500/25 transition hover:brightness-110 active:translate-y-0.5 active:border-b-2"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <div className="leading-tight text-base font-black flex items-center gap-1.5">
                    <span>Tantangan Harian</span>
                    {dailyStreak > 0 && (
                      <span className="text-[10px] bg-white/25 px-1.5 py-0.2 rounded-md font-bold">
                        🔥{dailyStreak}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-pink-100">
                    {isDailyCompletedToday ? 'Sudah Selesai • Cek Skor' : '10 Soal Unik Hari Ini'}
                  </div>
                </div>
              </div>
              <Sparkles className="h-4 w-4 fill-white shrink-0 ml-2" />
            </button>

            {/* Lari Kilat 60s / Time Attack Button */}
            <button
              id="time-attack-mode-button"
              onClick={() => {
                soundManager.playClick();
                onStartTimeAttack();
              }}
              className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3.5 min-h-[48px] text-sm font-black text-amber-950 border-b-4 border-amber-700 shadow-xl shadow-orange-500/25 transition hover:brightness-110 active:translate-y-0.5 active:border-b-2"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-950/20 text-amber-950 shrink-0">
                  <Zap className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <div className="leading-tight text-base font-black">Lari Kilat 60s</div>
                  <div className="text-[11px] font-bold text-amber-900/80">Mode Bertahan Waktu</div>
                </div>
              </div>
              <Play className="h-4 w-4 fill-amber-950 shrink-0 ml-2" />
            </button>

            {/* Latihan Bebas / Adaptif Button */}
            <button
              id="practice-mode-button"
              onClick={() => {
                soundManager.playClick();
                onStartPractice();
              }}
              className="flex items-center justify-between gap-3 rounded-2xl bg-indigo-800/90 border-2 border-indigo-700 border-b-4 border-indigo-950 px-5 py-3.5 min-h-[48px] text-sm font-black text-white shadow-lg transition hover:bg-indigo-700 active:translate-y-0.5 active:border-b-2"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-indigo-200 shrink-0">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <div className="leading-tight text-base font-black">Latihan Bebas</div>
                  <div className="text-[11px] font-bold text-indigo-300">Pilih Operasi Sendiri</div>
                </div>
              </div>
              <Play className="h-4 w-4 shrink-0 ml-2 opacity-80" />
            </button>

            {/* Mode Kompetitif Button */}
            {onOpenCompetitiveModal && (
              <button
                id="competitive-mode-button"
                onClick={() => {
                  soundManager.playClick();
                  onOpenCompetitiveModal();
                }}
                className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 border-b-4 border-indigo-950 px-5 py-3.5 min-h-[48px] text-sm font-black text-white shadow-xl shadow-purple-500/25 transition hover:brightness-110 active:translate-y-0.5 active:border-b-2"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white shrink-0">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="leading-tight text-base font-black">Mode Kompetitif (Sprint & Survival)</div>
                    <div className="text-[11px] font-bold text-purple-200">Sprint 60s & Survival Kilat</div>
                  </div>
                </div>
                <Play className="h-4 w-4 fill-white shrink-0 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 6-Tier Accordion Container */}
      <div className="space-y-4">
        {CAMPAIGN_TIERS.map((tier) => {
          const isExpanded = Boolean(expandedTiers[tier.id]);
          const tierStars = calculateTierStars(effectiveState, tier.id);
          const tierLevels = LEVEL_MANIFEST_72.filter((lvl) => lvl.tier === tier.id);

          // Find tier boss and progress
          const tierBoss = tierLevels.find((lvl) => lvl.boss);
          const bossProg = tierBoss ? effectiveState.levels[tierBoss.id] : undefined;
          const isBossCompleted = Boolean(bossProg && bossProg.stars >= 1);
          const isBossUnlocked = Boolean(bossProg && bossProg.unlocked);

          return (
            <div
              key={tier.id}
              className="rounded-3xl border-2 border-indigo-800/80 bg-indigo-950/70 overflow-hidden shadow-lg transition-colors"
            >
              {/* Accordion Header Button */}
              <button
                type="button"
                role="button"
                id={`tier-header-${tier.id}`}
                aria-expanded={isExpanded}
                aria-controls={`tier-section-${tier.id}`}
                onClick={() => toggleTier(tier.id)}
                className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 min-h-[52px] text-left hover:bg-indigo-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-pink-500/50"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-black text-sm text-white shadow-md border-b-2 ${tier.badgeBg} ${tier.badgeBorder}`}
                  >
                    T{tier.id}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                      {tier.title}
                    </h2>
                    <p className="text-xs text-indigo-300 font-medium truncate hidden sm:block">
                      {tier.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Tier Star Meter */}
                  <span className="flex items-center gap-1 text-xs sm:text-sm font-black text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
                    <span>{tierStars.earned} / {tierStars.total} ★</span>
                  </span>

                  {/* Boss Status Chip */}
                  {isBossCompleted ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-950/80 border border-emerald-600/80 px-2.5 py-1 text-xs font-bold text-emerald-300 shadow-sm">
                      <Crown className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400" />
                      <span className="hidden xs:inline">Ditaklukkan</span>
                    </span>
                  ) : isBossUnlocked ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-950/80 border border-amber-500/80 px-2.5 py-1 text-xs font-black text-amber-300 shadow-md animate-pulse">
                      <Flame className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      <span className="hidden xs:inline">Siap Ditantang</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900/60 border border-indigo-800 px-2.5 py-1 text-xs font-medium text-indigo-400">
                      <Lock className="h-3.5 w-3.5 text-indigo-400" />
                      <span className="hidden xs:inline">Terkunci</span>
                    </span>
                  )}

                  {/* Chevron Toggle */}
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-900/80 text-indigo-300 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </div>
              </button>

              {/* Accordion Content (12 Level Cards) */}
              {isExpanded && (
                <div
                  id={`tier-section-${tier.id}`}
                  role="region"
                  aria-labelledby={`tier-header-${tier.id}`}
                  className="p-4 sm:p-5 pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-indigo-900/40"
                >
                  {tierLevels.map((lvl) => {
                    const lvlProgress = effectiveState.levels[lvl.id] || {
                      levelId: lvl.id,
                      unlocked: lvl.order === 1,
                      stars: 0,
                      bestScore: 0,
                      accuracy: 0,
                      bestTimeSec: 0,
                    };
                    const isUnlocked = Boolean(lvlProgress.unlocked);
                    const stars = lvlProgress.stars || 0;
                    const isNextPlayable = isUnlocked && stars === 0;
                    const isBoss = lvl.boss;

                    return (
                      <div
                        key={lvl.id}
                        id={`level-card-${lvl.order}`}
                        data-testid={`level-card-${lvl.id}`}
                        onClick={() => {
                          if (isUnlocked) {
                            soundManager.playClick();
                            onSelectLevel(lvl);
                          }
                        }}
                        className={`group relative flex flex-col justify-between rounded-3xl border-2 p-5 transition-all duration-200 min-h-[160px] ${
                          isBoss
                            ? isUnlocked
                              ? 'bg-gradient-to-br from-rose-950 via-indigo-950 to-amber-950/80 border-amber-500/80 shadow-xl shadow-amber-500/10 hover:border-amber-400 hover:shadow-amber-500/25 hover:-translate-y-1 cursor-pointer text-white'
                              : 'bg-gradient-to-br from-rose-950/40 via-indigo-950/40 to-amber-950/30 border-rose-900/40 opacity-60 cursor-not-allowed text-indigo-300'
                            : isUnlocked
                              ? 'cursor-pointer bg-indigo-900/90 border-indigo-700/80 hover:border-pink-500 hover:shadow-2xl hover:shadow-pink-500/20 hover:-translate-y-1 text-white'
                              : 'bg-indigo-950/60 border-indigo-900/60 opacity-60 cursor-not-allowed text-indigo-400'
                        } ${
                          isNextPlayable && !isBoss
                            ? 'ring-4 ring-pink-500/30 border-pink-500 shadow-lg shadow-pink-500/10'
                            : ''
                        }`}
                      >
                        {/* Hidden anchor element with level ID for DOM lookups */}
                        <span id={`level-card-${lvl.id}`} className="sr-only pointer-events-none" aria-hidden="true" />

                        {/* Card Top: Order Badge, Title, Stars or Lock */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex h-8 w-8 items-center justify-center rounded-xl font-black text-xs shadow-md ${
                                  isBoss
                                    ? 'bg-gradient-to-r from-amber-400 to-rose-500 text-amber-950 border-b-2 border-amber-700'
                                    : isUnlocked
                                      ? 'bg-pink-500 text-white border-b-2 border-pink-700'
                                      : 'bg-indigo-800 text-indigo-400'
                                }`}
                              >
                                {lvl.order}
                              </span>

                              {isBoss ? (
                                <span className="inline-flex items-center gap-1 rounded-xl bg-amber-400/20 border border-amber-400/50 px-2.5 py-0.5 text-[11px] font-black text-amber-300 uppercase tracking-wider">
                                  <Crown className="h-3 w-3 text-amber-400 fill-amber-400" />
                                  {lvl.tier === 6 ? 'GRANDMASTER' : 'TIER BOSS'}
                                </span>
                              ) : (
                                <span
                                  className={`rounded-xl border px-2.5 py-0.5 text-[11px] font-bold ${
                                    isUnlocked
                                      ? 'bg-indigo-800/90 border-indigo-600 text-indigo-200'
                                      : 'bg-indigo-950 border-indigo-900 text-indigo-500'
                                  }`}
                                >
                                  Level {lvl.order}
                                </span>
                              )}
                            </div>

                            {/* Stars earned or Lock icon */}
                            {isUnlocked ? (
                              <div className="flex items-center gap-0.5 text-base" title={`${stars} Bintang`}>
                                {[1, 2, 3].map((starIdx) => (
                                  <span
                                    key={starIdx}
                                    className={`${
                                      starIdx <= stars
                                        ? 'text-yellow-400 scale-110 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]'
                                        : 'text-indigo-700'
                                    } transition`}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-indigo-400 text-xs font-bold">
                                <Lock className="h-3.5 w-3.5" />
                                <span>Terkunci</span>
                              </div>
                            )}
                          </div>

                          {/* Level Title & Description */}
                          <h3 className="font-black text-white group-hover:text-yellow-300 transition text-base sm:text-lg">
                            {lvl.title}
                          </h3>
                          <p className="mt-1 text-xs text-indigo-300 leading-normal line-clamp-2">
                            {lvl.description}
                          </p>

                          {/* Specs: Soal & Waktu */}
                          <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs text-indigo-300/80 font-bold">
                            <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5">
                              <Target className="h-3.5 w-3.5 text-pink-400" />
                              {lvl.questionCount} Soal
                            </span>
                            <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5">
                              <Clock className="h-3.5 w-3.5 text-amber-400" />
                              Batas: {lvl.timeLimitSec}s
                            </span>
                          </div>
                        </div>

                        {/* Card Footer: Best Record or Action CTA */}
                        <div className="mt-4 pt-3 border-t border-indigo-800/80 flex items-center justify-between">
                          {isUnlocked && lvlProgress.bestScore > 0 ? (
                            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold font-mono">
                              <Award className="h-4 w-4 text-amber-400 shrink-0" />
                              <span>
                                {lvlProgress.bestScore} ({lvlProgress.bestTimeSec}s)
                              </span>
                            </div>
                          ) : isUnlocked ? (
                            <span className="text-xs font-black text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                              {isNextPlayable && (
                                <span className="h-2 w-2 rounded-full bg-pink-400 animate-ping" />
                              )}
                              {isBoss ? 'Tantang Boss' : 'Mulai Level'}
                            </span>
                          ) : (
                            <span className="text-xs text-indigo-400 font-medium">
                              {lvl.prerequisiteIds.length > 0
                                ? `Perlu syarat level sebelumnya`
                                : `Terkunci`}
                            </span>
                          )}

                          {isUnlocked && (
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500 text-white group-hover:bg-pink-400 border-b-2 border-pink-700 transition shadow-md shrink-0">
                              <Play className="h-4 w-4 fill-current ml-0.5" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
