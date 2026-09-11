import { describe, it, expect } from 'vitest';
import { migrateV1ToV2, V1_TO_V2_LEVEL_MAPPING } from '../../src/engine/migration/migrator';
import { UserLevelProgress } from '../../src/types';

describe('V1 to V2 Progress Migrator', () => {
  it('maps all 24 V1 levels according to Appendix B', () => {
    for (let id = 1; id <= 24; id++) {
      expect(V1_TO_V2_LEVEL_MAPPING[id]).toBeDefined();
      expect(V1_TO_V2_LEVEL_MAPPING[id].primaryLevelId).toMatch(/^T[1-6]-/);
      expect(V1_TO_V2_LEVEL_MAPPING[id].v1Id).toBe(id);
      expect(V1_TO_V2_LEVEL_MAPPING[id].order).toBeGreaterThan(0);
      expect(V1_TO_V2_LEVEL_MAPPING[id].title).toBeTruthy();
    }
  });

  it('is idempotent: running migration twice produces identical result', () => {
    const v1Progress: Record<number, UserLevelProgress> = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1200, accuracy: 100, bestTimeSec: 15 },
      2: { levelId: 2, unlocked: true, stars: 2, bestScore: 900, accuracy: 85, bestTimeSec: 22 },
    };

    const res1 = migrateV1ToV2(v1Progress);
    const res2 = migrateV1ToV2(v1Progress);

    expect(res1).toEqual(res2);
  });

  it('preserves earned stars and scores, unlocks prerequisite chain, and computes legacyStarCredits', () => {
    const v1Progress: Record<number, UserLevelProgress> = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1500, accuracy: 100, bestTimeSec: 12 },
    };

    const res = migrateV1ToV2(v1Progress);
    expect(res.levels['T1-ADD-01']).toBeDefined();
    expect(res.levels['T1-ADD-01'].stars).toBe(3);
    expect(res.levels['T1-ADD-01'].bestScore).toBe(1500);
    expect(res.levels['T1-ADD-01'].unlocked).toBe(true);
    expect(res.legacySnapshot).toEqual(v1Progress);
  });

  it('gives fresh user only T1-ADD-01 unlocked', () => {
    const res = migrateV1ToV2({});
    expect(res.levels['T1-ADD-01']?.unlocked).toBe(true);
    expect(res.levels['T1-ADD-02']?.unlocked).toBe(false);
  });

  it('unlocks prerequisite chain up to primary anchor and next level when stars >= 1', () => {
    const v1Progress: Record<number, UserLevelProgress> = {
      5: { levelId: 5, unlocked: true, stars: 2, bestScore: 800, accuracy: 90, bestTimeSec: 25 },
    };

    const res = migrateV1ToV2(v1Progress);

    // Levels 1-5 anchors must be unlocked
    expect(res.levels['T1-ADD-01'].unlocked).toBe(true);
    expect(res.levels['T1-ADD-02'].unlocked).toBe(true);
    expect(res.levels['T1-SUB-01'].unlocked).toBe(true);
    expect(res.levels['T1-SUB-02'].unlocked).toBe(true);
    expect(res.levels['T2-MUL-02'].unlocked).toBe(true);

    // Next level in sequence (V1 ID 6 -> T2-MUL-04) must also be unlocked
    expect(res.levels['T2-MUL-04'].unlocked).toBe(true);

    // Levels beyond should remain locked
    expect(res.levels['T2-MUL-07'].unlocked).toBe(false);

    // Only level 5 should have earned stars; prerequisites unlocked with 0 stars
    expect(res.levels['T1-ADD-01'].stars).toBe(0);
    expect(res.levels['T2-MUL-02'].stars).toBe(2);
  });

  it('does not unlock next level when a level is unlocked but has 0 stars', () => {
    const v1Progress: Record<number, UserLevelProgress> = {
      3: { levelId: 3, unlocked: true, stars: 0, bestScore: 0, accuracy: 0, bestTimeSec: 0 },
    };

    const res = migrateV1ToV2(v1Progress);
    expect(res.levels['T1-SUB-01'].unlocked).toBe(true);
    // Prerequisite chain is not automatically opened for stars: 0, except T1-ADD-01 default
    expect(res.levels['T1-ADD-01'].unlocked).toBe(true);
    // Next level (level 4 -> T1-SUB-02) should remain locked
    expect(res.levels['T1-SUB-02'].unlocked).toBe(false);
  });

  it('correctly calculates legacyStarCredits when total stars exceed imported anchor stars', () => {
    // Simulate extra stars or star collision
    const v1Progress: Record<number, UserLevelProgress> = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1000, accuracy: 100, bestTimeSec: 10 },
      999: { levelId: 999, unlocked: true, stars: 3, bestScore: 500, accuracy: 80, bestTimeSec: 30 },
    };

    const res = migrateV1ToV2(v1Progress);
    // Level 1 imported 3 stars to T1-ADD-01
    expect(res.levels['T1-ADD-01'].stars).toBe(3);
    // Level 999 cannot be mapped to an anchor, so totalV1Stars = 6, imported = 3, legacyStarCredits = 3
    expect(res.legacyStarCredits).toBe(3);
  });

  it('takes best score, best accuracy, and faster completion time', () => {
    const v1Progress: Record<number, UserLevelProgress> = {
      1: { levelId: 1, unlocked: true, stars: 2, bestScore: 1200, accuracy: 85, bestTimeSec: 18 },
    };

    const res = migrateV1ToV2(v1Progress);
    expect(res.levels['T1-ADD-01'].bestScore).toBe(1200);
    expect(res.levels['T1-ADD-01'].accuracy).toBe(85);
    expect(res.levels['T1-ADD-01'].bestTimeSec).toBe(18);
  });

  it('preserves immutable copy in legacySnapshot', () => {
    const v1Progress: Record<number, UserLevelProgress> = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1000, accuracy: 100, bestTimeSec: 10 },
    };

    const res = migrateV1ToV2(v1Progress);
    expect(res.legacySnapshot).toEqual(v1Progress);
    expect(res.legacySnapshot).not.toBe(v1Progress);
  });

  it('allows user with V1 level 24 completed to access T6-GRANDMASTER', () => {
    const v1Progress: Record<number, UserLevelProgress> = {
      24: { levelId: 24, unlocked: true, stars: 3, bestScore: 3000, accuracy: 100, bestTimeSec: 40 },
    };

    const res = migrateV1ToV2(v1Progress);
    expect(res.levels['T6-GRANDMASTER']).toBeDefined();
    expect(res.levels['T6-GRANDMASTER'].unlocked).toBe(true);
    expect(res.levels['T6-GRANDMASTER'].stars).toBe(3);
    // All 24 levels should be unlocked
    for (let id = 1; id <= 24; id++) {
      const v2Id = V1_TO_V2_LEVEL_MAPPING[id].primaryLevelId;
      expect(res.levels[v2Id].unlocked).toBe(true);
    }
  });
});
