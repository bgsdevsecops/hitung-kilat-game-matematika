import { LEVEL_MANIFEST_72 } from '../engine/manifest/levels';
import { LevelConfigV2 } from '../engine/types/level';
import { migrateV1ToV2 } from '../engine/migration/migrator';
import { V1_TO_V2_LEVEL_MAPPING } from '../engine/migration/mapping';
import { StarRatingResult } from './starRating';
import { UserLevelProgress } from '../types';

export const CAMPAIGN_V2_STORAGE_KEY = 'hitung_kilat_campaign_v2';
export const LEGACY_PROGRESS_V1_KEY = 'hitung_kilat_progress_v1';

export interface V2LevelProgress {
  levelId: string;
  unlocked: boolean;
  stars: number; // 0..3
  bestScore: number;
  accuracy: number;
  bestTimeSec: number;
  migratedFromV1Id?: number;
  completedAt?: string;
}

export interface V2CampaignState {
  version: 2;
  levels: Record<string, V2LevelProgress>;
  totalStars: number;
  legacyStarCredits: number;
  migrationCompleted: boolean;
}

/**
 * Creates default empty campaign state with all 72 levels defined
 * and only T1-ADD-01 (order 1) unlocked.
 */
export function createDefaultCampaignState(): V2CampaignState {
  const levels: Record<string, V2LevelProgress> = {};
  for (const lvl of LEVEL_MANIFEST_72) {
    levels[lvl.id] = {
      levelId: lvl.id,
      unlocked: lvl.order === 1 || lvl.prerequisiteIds.length === 0,
      stars: 0,
      bestScore: 0,
      accuracy: 0,
      bestTimeSec: 0,
    };
  }
  return {
    version: 2,
    levels,
    totalStars: 0,
    legacyStarCredits: 0,
    migrationCompleted: false,
  };
}

export function loadCampaignState(): V2CampaignState | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CAMPAIGN_V2_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as V2CampaignState;
    if (parsed && parsed.version === 2 && parsed.levels) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCampaignState(state: V2CampaignState): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CAMPAIGN_V2_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save V2 campaign state:', err);
  }
}

/**
 * Checks DAG unlocking for a level:
 * Returns true if level is order 1 or all prerequisiteIds have stars >= 1.
 */
export function isLevelUnlocked(
  state: V2CampaignState,
  levelOrId: LevelConfigV2 | string
): boolean {
  const level =
    typeof levelOrId === 'string'
      ? LEVEL_MANIFEST_72.find((l) => l.id === levelOrId)
      : levelOrId;

  if (!level) return false;

  // Level 1 or zero-prerequisite levels are always unlocked
  if (level.order === 1 || level.prerequisiteIds.length === 0) return true;

  // If already marked unlocked or has stars in state, it remains unlocked
  const currentProgress = state.levels[level.id];
  if (currentProgress && (currentProgress.unlocked || currentProgress.stars >= 1)) {
    return true;
  }

  return level.prerequisiteIds.every((prereqId) => {
    const progress = state.levels[prereqId];
    return progress && progress.stars >= 1;
  });
}

/**
 * Initializes or runs migration from V1.
 */
export function initializeOrMigrateCampaignState(): {
  state: V2CampaignState;
  justMigrated: boolean;
} {
  const existing = loadCampaignState();
  if (existing) {
    let modified = false;
    // Refresh unlocks in case manifest was updated
    for (const lvl of LEVEL_MANIFEST_72) {
      if (!existing.levels[lvl.id]) {
        existing.levels[lvl.id] = {
          levelId: lvl.id,
          unlocked: isLevelUnlocked(existing, lvl),
          stars: 0,
          bestScore: 0,
          accuracy: 0,
          bestTimeSec: 0,
        };
        modified = true;
      } else if (!existing.levels[lvl.id].unlocked) {
        const shouldUnlock = isLevelUnlocked(existing, lvl);
        if (shouldUnlock) {
          existing.levels[lvl.id].unlocked = true;
          modified = true;
        }
      }
    }
    if (modified) {
      saveCampaignState(existing);
    }
    return { state: existing, justMigrated: false };
  }

  // Check for legacy V1 progress
  let v1Progress: Record<number, UserLevelProgress> | null = null;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LEGACY_PROGRESS_V1_KEY);
      if (raw) v1Progress = JSON.parse(raw);
    } catch {
      v1Progress = null;
    }
  }

  const defaultState = createDefaultCampaignState();
  if (v1Progress && Object.keys(v1Progress).length > 0) {
    const migrationRes = migrateV1ToV2(v1Progress);
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

    // Recompute unlocks across all 72 levels
    for (const lvl of LEVEL_MANIFEST_72) {
      defaultState.levels[lvl.id].unlocked =
        defaultState.levels[lvl.id].unlocked || isLevelUnlocked(defaultState, lvl);
      totalStars += defaultState.levels[lvl.id].stars;
    }

    defaultState.totalStars = totalStars;
    defaultState.legacyStarCredits = migrationRes.legacyStarCredits;
    defaultState.migrationCompleted = true;

    saveCampaignState(defaultState);
    const hasV1Activity = Object.values(v1Progress).some((p) => p.stars > 0);
    return { state: defaultState, justMigrated: hasV1Activity };
  }

  defaultState.migrationCompleted = true;
  saveCampaignState(defaultState);
  return { state: defaultState, justMigrated: false };
}

/**
 * Updates level progress with result and re-evaluates unlocks across all levels.
 */
export function updateLevelProgress(
  state: V2CampaignState,
  levelId: string,
  result: StarRatingResult,
  score: number,
  timeSpentSec: number,
  correctCount: number,
  totalCount: number
): V2CampaignState {
  const current = state.levels[levelId] || {
    levelId,
    unlocked: true,
    stars: 0,
    bestScore: 0,
    accuracy: 0,
    bestTimeSec: 0,
  };

  const isPassed = result.stars >= 1 || result.isPassed;
  const newStars = Math.max(current.stars, result.stars);
  const newBestScore = Math.max(current.bestScore, score);
  const newBestTime =
    isPassed && timeSpentSec > 0
      ? current.bestTimeSec > 0
        ? Math.min(current.bestTimeSec, timeSpentSec)
        : timeSpentSec
      : current.bestTimeSec;
  const newAccuracy = Math.max(current.accuracy, result.accuracy);

  const updatedLevels: Record<string, V2LevelProgress> = {
    ...state.levels,
    [levelId]: {
      ...current,
      unlocked: true,
      stars: newStars,
      bestScore: newBestScore,
      bestTimeSec: newBestTime,
      accuracy: newAccuracy,
      completedAt: isPassed ? new Date().toISOString() : current.completedAt,
    },
  };

  // Re-evaluate unlocking for all levels
  let totalStars = 0;
  for (const lvl of LEVEL_MANIFEST_72) {
    if (!updatedLevels[lvl.id]) {
      updatedLevels[lvl.id] = {
        levelId: lvl.id,
        unlocked: false,
        stars: 0,
        bestScore: 0,
        accuracy: 0,
        bestTimeSec: 0,
      };
    }
    const isUnlocked =
      lvl.order === 1 ||
      lvl.prerequisiteIds.length === 0 ||
      updatedLevels[lvl.id].unlocked ||
      lvl.prerequisiteIds.every((pId) => (updatedLevels[pId]?.stars || 0) >= 1);
    updatedLevels[lvl.id].unlocked = isUnlocked;
    totalStars += updatedLevels[lvl.id].stars;
  }

  const nextState: V2CampaignState = {
    ...state,
    levels: updatedLevels,
    totalStars,
  };

  saveCampaignState(nextState);
  return nextState;
}

export function getCompletedBossIds(state: V2CampaignState): string[] {
  const bossLevels = LEVEL_MANIFEST_72.filter((lvl) => lvl.boss);
  return bossLevels
    .filter((lvl) => (state.levels[lvl.id]?.stars || 0) >= 1)
    .map((lvl) => lvl.id);
}

export function calculateTierStars(
  state: V2CampaignState,
  tier: number
): { earned: number; total: number } {
  const tierLevels = LEVEL_MANIFEST_72.filter((lvl) => lvl.tier === tier);
  const earned = tierLevels.reduce(
    (acc, lvl) => acc + (state.levels[lvl.id]?.stars || 0),
    0
  );
  return { earned, total: tierLevels.length * 3 };
}

/**
 * Projects the full 72-level V2 campaign state back to the 24 legacy levels
 * for backward compatibility with older clients and legacy cloud sync readers.
 */
export function projectV2ToLegacyV1(
  campaignState: V2CampaignState
): Record<number, UserLevelProgress> {
  const legacy: Record<number, UserLevelProgress> = {};
  for (let v1Id = 1; v1Id <= 24; v1Id++) {
    const mapping = V1_TO_V2_LEVEL_MAPPING[v1Id];
    if (!mapping) continue;
    const v2Level = campaignState.levels[mapping.primaryLevelId];
    legacy[v1Id] = {
      levelId: v1Id,
      unlocked: v2Level ? v2Level.unlocked : v1Id === 1,
      stars: v2Level ? v2Level.stars : 0,
      bestScore: v2Level ? v2Level.bestScore : 0,
      accuracy: v2Level ? v2Level.accuracy : 0,
      bestTimeSec: v2Level ? v2Level.bestTimeSec : 0,
    };
  }
  return legacy;
}
