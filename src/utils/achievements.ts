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
  dailyStreak: number;
  dailyCompletedCount: number;
}

export const ACHIEVEMENTS_DEFINITIONS: AchievementConfig[] = [
  // Problem Solving Milestones
  {
    id: 'solve_25',
    title: 'Langkah Awal',
    description: 'Selesaikan 25 soal matematika',
    category: 'milestone',
    tier: 'bronze',
    icon: 'Sparkles',
    targetValue: 25,
    getValue: (ctx) => ctx.stats.totalSolved,
  },
  {
    id: 'solve_100',
    title: 'Kalkulator Cilik',
    description: 'Selesaikan 100 soal matematika',
    category: 'milestone',
    tier: 'silver',
    icon: 'Brain',
    targetValue: 100,
    getValue: (ctx) => ctx.stats.totalSolved,
  },
  {
    id: 'solve_500',
    title: 'Pakar Hitung Cepat',
    description: 'Selesaikan 500 soal matematika',
    category: 'milestone',
    tier: 'gold',
    icon: 'Zap',
    targetValue: 500,
    getValue: (ctx) => ctx.stats.totalSolved,
  },
  {
    id: 'solve_1000',
    title: 'Legenda 1000 Soal',
    description: 'Tuntaskan rekor 1.000 soal matematika',
    category: 'milestone',
    tier: 'diamond',
    icon: 'Trophy',
    targetValue: 1000,
    getValue: (ctx) => ctx.stats.totalSolved,
  },

  // Daily Streak Milestones
  {
    id: 'streak_3_days',
    title: 'Konsistensi Terbit',
    description: 'Pertahankan 3 hari streak tantangan harian',
    category: 'streak',
    tier: 'bronze',
    icon: 'Flame',
    targetValue: 3,
    getValue: (ctx) => ctx.dailyStreak,
  },
  {
    id: 'streak_7_days',
    title: 'Seminggu Disiplin',
    description: 'Pertahankan 7 hari berturut-turut streak harian',
    category: 'streak',
    tier: 'silver',
    icon: 'Calendar',
    targetValue: 7,
    getValue: (ctx) => ctx.dailyStreak,
  },
  {
    id: 'streak_10_days',
    title: '10-Day Daily Streak',
    description: 'Raih rekor 10 hari berturut-turut menyelesaikan puzzle harian',
    category: 'streak',
    tier: 'gold',
    icon: 'Flame',
    targetValue: 10,
    getValue: (ctx) => ctx.dailyStreak,
  },
  {
    id: 'streak_30_days',
    title: 'Kebiasaan Sejati',
    description: 'Pertahankan 30 hari berturut-turut tantangan harian',
    category: 'streak',
    tier: 'diamond',
    icon: 'Crown',
    targetValue: 30,
    getValue: (ctx) => ctx.dailyStreak,
  },

  // Combo Streak in a Single Game
  {
    id: 'combo_10',
    title: 'Fokus Tajam',
    description: 'Raih kombo 10 jawaban benar beruntun',
    category: 'streak',
    tier: 'bronze',
    icon: 'Flame',
    targetValue: 10,
    getValue: (ctx) => ctx.stats.bestStreak,
  },
  {
    id: 'combo_25',
    title: 'Refleks Tak Terhentikan',
    description: 'Raih kombo 25 jawaban benar beruntun',
    category: 'streak',
    tier: 'silver',
    icon: 'Zap',
    targetValue: 25,
    getValue: (ctx) => ctx.stats.bestStreak,
  },
  {
    id: 'combo_50',
    title: 'Jenius Beruntun',
    description: 'Raih kombo 50 jawaban benar beruntun tanpa salah',
    category: 'streak',
    tier: 'gold',
    icon: 'Award',
    targetValue: 50,
    getValue: (ctx) => ctx.stats.bestStreak,
  },

  // Campaign Stars Mastery
  {
    id: 'stars_15',
    title: 'Pengumpul Bintang',
    description: 'Kumpulkan 15 bintang di Peta Kampanye',
    category: 'mastery',
    tier: 'bronze',
    icon: 'Star',
    targetValue: 15,
    getValue: (ctx) => ctx.totalStars,
  },
  {
    id: 'stars_40',
    title: 'Bintang Terang',
    description: 'Kumpulkan 40 bintang di Peta Kampanye',
    category: 'mastery',
    tier: 'silver',
    icon: 'Star',
    targetValue: 40,
    getValue: (ctx) => ctx.totalStars,
  },
  {
    id: 'stars_72',
    title: 'Mahkota Sempurna 72★',
    description: 'Raih seluruh 72 bintang penuh di semua level kampanye',
    category: 'mastery',
    tier: 'diamond',
    icon: 'Crown',
    targetValue: 72,
    getValue: (ctx) => ctx.totalStars,
  },

  // Speed & Time Attack
  {
    id: 'time_attack_500',
    title: 'Kilat Pertama',
    description: 'Raih skor minimal 500 di mode Lari Kilat 60 Detik',
    category: 'speed',
    tier: 'bronze',
    icon: 'Timer',
    targetValue: 500,
    getValue: (ctx) => ctx.stats.highestTimeAttackScore,
  },
  {
    id: 'time_attack_1500',
    title: 'Badai Aritmatika',
    description: 'Raih skor 1.500 poin di mode Lari Kilat',
    category: 'speed',
    tier: 'silver',
    icon: 'Zap',
    targetValue: 1500,
    getValue: (ctx) => ctx.stats.highestTimeAttackScore,
  },
  {
    id: 'time_attack_3000',
    title: 'Kecepatan Cahaya 3000+',
    description: 'Tembus skor 3.000 poin di Lari Kilat 60 Detik',
    category: 'speed',
    tier: 'gold',
    icon: 'Flame',
    targetValue: 3000,
    getValue: (ctx) => ctx.stats.highestTimeAttackScore,
  },

  // High Accuracy
  {
    id: 'accuracy_90_min_100',
    title: 'Presisi Tinggi',
    description: 'Pertahankan akurasi kumulatif minimal 90% (min. 100 soal)',
    category: 'accuracy',
    tier: 'silver',
    icon: 'Target',
    targetValue: 90,
    getValue: (ctx) => {
      if (ctx.stats.totalSolved < 100) return 0;
      return Math.round((ctx.stats.totalCorrect / ctx.stats.totalSolved) * 100);
    },
  },
  {
    id: 'speed_spm_30',
    title: '30 Soal / Menit',
    description: 'Raih laju kecepatan berhitung minimal 30 soal per menit (SPM)',
    category: 'speed',
    tier: 'gold',
    icon: 'Timer',
    targetValue: 30,
    getValue: (ctx) => ctx.stats.highestSPM || 0,
  },
];

const UNLOCKED_ACHIEVEMENTS_KEY = 'hitung_kilat_unlocked_achievements_v1';

export function loadUnlockedAchievementsMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(UNLOCKED_ACHIEVEMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveUnlockedAchievementsMap(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UNLOCKED_ACHIEVEMENTS_KEY, JSON.stringify(map));
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
