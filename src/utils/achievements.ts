import { Achievement, UserStats } from '../types';

export interface AchievementConfig {
  id: string;
  title: string;
  description: string;
  category: 'milestone' | 'streak' | 'accuracy' | 'speed' | 'mastery';
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  icon: string;
  targetValue: number;
  getValue: (context: AchievementEvaluationContext) => number;
}

export interface AchievementEvaluationContext {
  stats: UserStats;
  totalStars: number;
  unlockedLevelsCount: number;
  completedBossIds: string[];
  highestSprintScore: number;
  highestSurvivalSec: number;
  dailyStreak: number;
  masteredSubSkillsCount: number;
  dailyCompletedCount?: number;
}

export const ACHIEVEMENTS_DEFINITIONS: AchievementConfig[] = [
  // 1. Campaign Stars
  {
    id: 'stars_15',
    title: 'Pengumpul Bintang',
    description: 'Raih 15★ di Peta Kampanye',
    category: 'milestone',
    tier: 'bronze',
    icon: 'Star',
    targetValue: 15,
    getValue: (ctx) => ctx.totalStars,
  },
  {
    id: 'stars_40',
    title: 'Bintang Terang',
    description: 'Raih 40★ di Peta Kampanye',
    category: 'milestone',
    tier: 'silver',
    icon: 'Star',
    targetValue: 40,
    getValue: (ctx) => ctx.totalStars,
  },
  {
    id: 'stars_72',
    title: 'Veteran Kampanye',
    description: 'Raih 72★ di Peta Kampanye',
    category: 'milestone',
    tier: 'silver',
    icon: 'Sparkles',
    targetValue: 72,
    getValue: (ctx) => ctx.totalStars,
  },
  {
    id: 'stars_144',
    title: 'Master Kampanye',
    description: 'Raih 144★ di Peta Kampanye',
    category: 'milestone',
    tier: 'gold',
    icon: 'Award',
    targetValue: 144,
    getValue: (ctx) => ctx.totalStars,
  },
  {
    id: 'stars_216',
    title: 'Mahkota Sempurna',
    description: 'Tuntaskan 216★ penuh di 72 level kampanye',
    category: 'milestone',
    tier: 'diamond',
    icon: 'Crown',
    targetValue: 216,
    getValue: (ctx) => ctx.totalStars,
  },

  // 2. Boss Conquests
  {
    id: 'boss_t1',
    title: 'Penakluk Pemula',
    description: 'Kalahkan Boss Tier 1 (Level 12)',
    category: 'milestone',
    tier: 'bronze',
    icon: 'Trophy',
    targetValue: 1,
    getValue: (ctx) => (ctx.completedBossIds?.includes('T1-BOSS') ? 1 : 0),
  },
  {
    id: 'boss_t3',
    title: 'Penakluk Terampil',
    description: 'Kalahkan Boss Tier 3 (Level 36)',
    category: 'milestone',
    tier: 'silver',
    icon: 'Trophy',
    targetValue: 1,
    getValue: (ctx) => (ctx.completedBossIds?.includes('T3-BOSS') ? 1 : 0),
  },
  {
    id: 'boss_t6',
    title: 'Grandmaster Sejati',
    description: 'Kalahkan Grandmaster (Level 72)',
    category: 'milestone',
    tier: 'diamond',
    icon: 'Crown',
    targetValue: 1,
    getValue: (ctx) =>
      ctx.completedBossIds?.includes('T6-BOSS') || ctx.completedBossIds?.includes('T6-GRANDMASTER') ? 1 : 0,
  },

  // 3. Competitive Sprint 60s
  {
    id: 'sprint_1000',
    title: 'Kilat Pertama',
    description: 'Tembus 1.000 poin di Sprint 60s',
    category: 'speed',
    tier: 'bronze',
    icon: 'Timer',
    targetValue: 1000,
    getValue: (ctx) => ctx.highestSprintScore || 0,
  },
  {
    id: 'sprint_2500',
    title: 'Kecepatan Suara',
    description: 'Tembus 2.500 poin di Sprint 60s',
    category: 'speed',
    tier: 'gold',
    icon: 'Zap',
    targetValue: 2500,
    getValue: (ctx) => ctx.highestSprintScore || 0,
  },

  // 4. Competitive Survival
  {
    id: 'survival_120',
    title: 'Penyintas Tangguh',
    description: 'Bertahan min. 2 menit (120s) di Survival',
    category: 'streak',
    tier: 'silver',
    icon: 'Flame',
    targetValue: 120,
    getValue: (ctx) => ctx.highestSurvivalSec || 0,
  },
  {
    id: 'survival_300',
    title: 'Dewa Ketahanan',
    description: 'Bertahan min. 5 menit (300s) di Survival',
    category: 'streak',
    tier: 'diamond',
    icon: 'Flame',
    targetValue: 300,
    getValue: (ctx) => ctx.highestSurvivalSec || 0,
  },

  // 5. Daily Streak
  {
    id: 'daily_streak_7',
    title: 'Seminggu Disiplin',
    description: 'Pertahankan 7 hari streak harian',
    category: 'streak',
    tier: 'silver',
    icon: 'Calendar',
    targetValue: 7,
    getValue: (ctx) => ctx.dailyStreak || 0,
  },
  {
    id: 'daily_streak_30',
    title: 'Kebiasaan Juara',
    description: 'Pertahankan 30 hari streak harian',
    category: 'streak',
    tier: 'diamond',
    icon: 'Crown',
    targetValue: 30,
    getValue: (ctx) => ctx.dailyStreak || 0,
  },

  // 6. Sub-Skill Mastery
  {
    id: 'mastery_10',
    title: 'Multi-Talenta',
    description: 'Kuasai min. 10 sub-skill (skor ≥ 85)',
    category: 'mastery',
    tier: 'silver',
    icon: 'Brain',
    targetValue: 10,
    getValue: (ctx) => ctx.masteredSubSkillsCount || 0,
  },
  {
    id: 'mastery_30',
    title: 'Ahli Matematika',
    description: 'Kuasai min. 30 sub-skill (skor ≥ 85)',
    category: 'mastery',
    tier: 'gold',
    icon: 'Brain',
    targetValue: 30,
    getValue: (ctx) => ctx.masteredSubSkillsCount || 0,
  },
];

export const UNLOCKED_ACHIEVEMENTS_V2_KEY = 'hitung_kilat_unlocked_achievements_v2';
export const UNLOCKED_ACHIEVEMENTS_V1_KEY = 'hitung_kilat_unlocked_achievements_v1';

export function loadUnlockedAchievementsMap(): Record<string, string> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return {};
  try {
    const rawV2 = localStorage.getItem(UNLOCKED_ACHIEVEMENTS_V2_KEY);
    if (rawV2) return JSON.parse(rawV2);

    // Fallback migration from V1 if present
    const rawV1 = localStorage.getItem(UNLOCKED_ACHIEVEMENTS_V1_KEY);
    if (rawV1) {
      const v1Map = JSON.parse(rawV1);
      return v1Map;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveUnlockedAchievementsMap(map: Record<string, string>): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(UNLOCKED_ACHIEVEMENTS_V2_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Error saving unlocked achievements', e);
  }
}

/**
 * Calculates all achievements with their current progress and unlocked status.
 * Automatically saves new unlocks and returns list of newly unlocked achievements.
 */
export function evaluateAchievements(context: AchievementEvaluationContext): {
  achievements: Achievement[];
  newlyUnlocked: Achievement[];
} {
  const savedUnlocks = loadUnlockedAchievementsMap();
  const newlyUnlocked: Achievement[] = [];
  const updatedUnlocks = { ...savedUnlocks };
  let hasNew = false;

  const list: Achievement[] = ACHIEVEMENTS_DEFINITIONS.map((def) => {
    const currentValue = def.getValue(context);
    const wasUnlocked = !!savedUnlocks[def.id];
    const isNowUnlocked = currentValue >= def.targetValue;

    if (isNowUnlocked && !wasUnlocked) {
      const unlockTime = new Date().toISOString();
      updatedUnlocks[def.id] = unlockTime;
      hasNew = true;
      const item: Achievement = {
        id: def.id,
        title: def.title,
        description: def.description,
        category: def.category,
        icon: def.icon,
        targetValue: def.targetValue,
        currentValue,
        unlocked: true,
        unlockedAt: unlockTime,
        tier: def.tier,
      };
      newlyUnlocked.push(item);
      return item;
    }

    return {
      id: def.id,
      title: def.title,
      description: def.description,
      category: def.category,
      icon: def.icon,
      targetValue: def.targetValue,
      currentValue,
      unlocked: wasUnlocked || isNowUnlocked,
      unlockedAt: savedUnlocks[def.id],
      tier: def.tier,
    };
  });

  if (hasNew) {
    saveUnlockedAchievementsMap(updatedUnlocks);
  }

  return {
    achievements: list,
    newlyUnlocked,
  };
}
