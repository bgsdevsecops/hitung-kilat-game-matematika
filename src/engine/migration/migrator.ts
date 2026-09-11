import { V1_TO_V2_LEVEL_MAPPING } from './mapping';
import { UserLevelProgress } from '../../types';

export interface V2LevelProgress {
  levelId: string;
  unlocked: boolean;
  stars: number;
  bestScore: number;
  accuracy: number;
  bestTimeSec: number;
  migratedFromV1Id?: number;
}

export interface V2MigrationResult {
  migrationVersion: 1;
  levels: Record<string, V2LevelProgress>;
  legacyStarCredits: number;
  legacySnapshot: Record<number, UserLevelProgress>;
}

export function migrateV1ToV2(
  v1Progress: Record<number, UserLevelProgress>
): V2MigrationResult {
  const safeProgress = v1Progress || {};
  const levels: Record<string, V2LevelProgress> = {};
  let totalV1Stars = 0;

  // Initialize all mapped levels as locked except T1-ADD-01
  for (const mapping of Object.values(V1_TO_V2_LEVEL_MAPPING)) {
    levels[mapping.primaryLevelId] = {
      levelId: mapping.primaryLevelId,
      unlocked: mapping.primaryLevelId === 'T1-ADD-01',
      stars: 0,
      bestScore: 0,
      accuracy: 0,
      bestTimeSec: 0,
    };
  }

  const v1Keys = Object.keys(safeProgress)
    .map(Number)
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  for (const v1Id of v1Keys) {
    const v1Level = safeProgress[v1Id];
    if (!v1Level) continue;

    totalV1Stars += Math.max(0, v1Level.stars || 0);
    const mapping = V1_TO_V2_LEVEL_MAPPING[v1Id];
    if (!mapping) continue;

    const v2Id = mapping.primaryLevelId;
    const existing = levels[v2Id];

    const stars = Math.max(existing?.stars || 0, v1Level.stars || 0);
    const bestScore = Math.max(existing?.bestScore || 0, v1Level.bestScore || 0);
    const accuracy = Math.max(existing?.accuracy || 0, v1Level.accuracy || 0);
    const bestTimeSec =
      (existing?.bestTimeSec || 0) > 0 && (v1Level.bestTimeSec || 0) > 0
        ? Math.min(existing!.bestTimeSec, v1Level.bestTimeSec)
        : existing?.bestTimeSec || v1Level.bestTimeSec || 0;

    levels[v2Id] = {
      levelId: v2Id,
      unlocked: existing?.unlocked || v1Level.unlocked,
      stars,
      bestScore,
      accuracy,
      bestTimeSec,
      migratedFromV1Id: v1Id,
    };

    // If level was completed (≥1 star), unlock prerequisite chain up to this level
    // and unlock the next level in sequence
    if (v1Level.stars && v1Level.stars >= 1) {
      for (let prevId = 1; prevId <= v1Id; prevId++) {
        const prevMapping = V1_TO_V2_LEVEL_MAPPING[prevId];
        if (prevMapping && levels[prevMapping.primaryLevelId]) {
          levels[prevMapping.primaryLevelId].unlocked = true;
        }
      }
      const nextMapping = V1_TO_V2_LEVEL_MAPPING[v1Id + 1];
      if (nextMapping && levels[nextMapping.primaryLevelId]) {
        levels[nextMapping.primaryLevelId].unlocked = true;
      }
    }
  }

  const totalImportedStars = Object.values(levels).reduce(
    (sum, lvl) => sum + (lvl.stars || 0),
    0
  );
  const legacyStarCredits = Math.max(0, totalV1Stars - totalImportedStars);

  return {
    migrationVersion: 1,
    levels,
    legacyStarCredits,
    legacySnapshot: { ...safeProgress },
  };
}

export { V1_TO_V2_LEVEL_MAPPING };
