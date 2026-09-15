// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  V2CampaignState,
  loadCampaignState,
  saveCampaignState,
  initializeOrMigrateCampaignState,
  updateLevelProgress,
  isLevelUnlocked,
  getCompletedBossIds,
  calculateTierStars,
  createDefaultCampaignState,
  CAMPAIGN_V2_STORAGE_KEY,
  LEGACY_PROGRESS_V1_KEY,
} from '../../src/utils/campaignState';
import { LEVEL_MANIFEST_72 } from '../../src/engine/manifest/levels';

describe('Campaign State & DAG Unlocking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes fresh campaign state with T1-ADD-01 unlocked and 0 stars', () => {
    const { state, justMigrated } = initializeOrMigrateCampaignState();
    expect(justMigrated).toBe(false);
    expect(state.version).toBe(2);
    expect(state.totalStars).toBe(0);
    expect(state.legacyStarCredits).toBe(0);
    expect(state.migrationCompleted).toBe(true);
    expect(state.levels['T1-ADD-01']?.unlocked).toBe(true);
    expect(state.levels['T1-ADD-02']?.unlocked).toBe(false);
  });

  it('migrates legacy V1 progress if V2 state is absent and V1 progress exists', () => {
    const v1Progress = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1200, bestTimeSec: 20, accuracy: 100 },
      2: { levelId: 2, unlocked: true, stars: 2, bestScore: 900, bestTimeSec: 25, accuracy: 90 },
    };
    localStorage.setItem('hitung_kilat_progress_v1', JSON.stringify(v1Progress));

    const { state, justMigrated } = initializeOrMigrateCampaignState();
    expect(justMigrated).toBe(true);
    expect(state.levels['T1-ADD-01']?.stars).toBe(3);
    expect(state.totalStars).toBeGreaterThanOrEqual(3);
    expect(localStorage.getItem(CAMPAIGN_V2_STORAGE_KEY)).not.toBeNull();
  });

  it('evaluates DAG prerequisites: unlocks next level when all prerequisiteIds have stars >= 1', () => {
    const { state } = initializeOrMigrateCampaignState();
    const level2 = LEVEL_MANIFEST_72.find((l) => l.id === 'T1-ADD-02')!;
    expect(isLevelUnlocked(state, level2)).toBe(false);

    // Complete Level 1 with 2 stars
    const updatedState = updateLevelProgress(
      state,
      'T1-ADD-01',
      {
        stars: 2,
        isPerfect: false,
        isPassed: true,
        accuracy: 90,
        reason: 'Great',
      },
      1000,
      25,
      9,
      10
    );

    expect(updatedState.levels['T1-ADD-01']?.stars).toBe(2);
    expect(updatedState.totalStars).toBe(2);
    expect(isLevelUnlocked(updatedState, level2)).toBe(true);
  });

  it('tracks completed boss IDs correctly', () => {
    let state = initializeOrMigrateCampaignState().state;
    expect(getCompletedBossIds(state)).toEqual([]);

    state = updateLevelProgress(
      state,
      'T1-BOSS',
      {
        stars: 1,
        isPerfect: false,
        isPassed: true,
        accuracy: 70,
        reason: 'Pass',
      },
      800,
      35,
      11,
      15
    );

    expect(getCompletedBossIds(state)).toEqual(['T1-BOSS']);
  });

  it('calculates tier stars accurately (X / 36 ★)', () => {
    let state = initializeOrMigrateCampaignState().state;
    const tier1Stats = calculateTierStars(state, 1);
    expect(tier1Stats.total).toBe(36);
    expect(tier1Stats.earned).toBe(0);

    state = updateLevelProgress(
      state,
      'T1-ADD-01',
      {
        stars: 3,
        isPerfect: true,
        isPassed: true,
        accuracy: 100,
        reason: 'Perfect',
      },
      1500,
      20,
      10,
      10
    );

    const updatedTier1 = calculateTierStars(state, 1);
    expect(updatedTier1.earned).toBe(3);
  });

  it('does not re-migrate if V2 state already exists in localStorage', () => {
    const initial = createDefaultCampaignState();
    initial.levels['T1-ADD-01'].stars = 3;
    initial.totalStars = 3;
    saveCampaignState(initial);

    // Also put V1 progress in storage
    const v1Progress = {
      1: { levelId: 1, unlocked: true, stars: 1, bestScore: 500, bestTimeSec: 40, accuracy: 70 },
    };
    localStorage.setItem(LEGACY_PROGRESS_V1_KEY, JSON.stringify(v1Progress));

    const { state, justMigrated } = initializeOrMigrateCampaignState();
    expect(justMigrated).toBe(false);
    // V2 stars should be preserved (3), not overwritten by V1 (1)
    expect(state.levels['T1-ADD-01'].stars).toBe(3);
  });

  it('gates Tier 2 on Tier 1 boss completion in DAG evaluation', () => {
    let state = initializeOrMigrateCampaignState().state;
    const t2Level = LEVEL_MANIFEST_72.find((l) => l.id === 'T2-MUL-02')!;
    expect(isLevelUnlocked(state, t2Level)).toBe(false);
    expect(isLevelUnlocked(state, 'T2-MUL-02')).toBe(false);

    // Complete T1-BOSS with 1 star
    state = updateLevelProgress(
      state,
      'T1-BOSS',
      {
        stars: 1,
        isPerfect: false,
        isPassed: true,
        accuracy: 80,
        reason: 'Passed boss',
      },
      900,
      30,
      8,
      10
    );

    expect(isLevelUnlocked(state, t2Level)).toBe(true);
    expect(isLevelUnlocked(state, 'T2-MUL-02')).toBe(true);
  });

  it('handles failed attempt (0 stars) without overwriting high scores or unlocking next level', () => {
    let state = initializeOrMigrateCampaignState().state;
    const level2 = LEVEL_MANIFEST_72.find((l) => l.id === 'T1-ADD-02')!;

    // Initial pass with 2 stars
    state = updateLevelProgress(
      state,
      'T1-ADD-01',
      {
        stars: 2,
        isPerfect: false,
        isPassed: true,
        accuracy: 90,
        reason: 'Good',
      },
      1200,
      22,
      9,
      10
    );

    // Subsequent failed attempt (0 stars, low score, fast fail)
    const failedState = updateLevelProgress(
      state,
      'T1-ADD-01',
      {
        stars: 0,
        isPerfect: false,
        isPassed: false,
        accuracy: 40,
        reason: 'Failed',
      },
      300,
      5,
      4,
      10
    );

    expect(failedState.levels['T1-ADD-01'].stars).toBe(2);
    expect(failedState.levels['T1-ADD-01'].bestScore).toBe(1200);
    // bestTimeSec should not be corrupted by the 5-second failure
    expect(failedState.levels['T1-ADD-01'].bestTimeSec).toBe(22);
    expect(failedState.levels['T1-ADD-01'].accuracy).toBe(90);
    expect(isLevelUnlocked(failedState, level2)).toBe(true);
  });

  it('ensures a 0-star failed attempt does not update or corrupt bestTimeSec from 0', () => {
    let state = initializeOrMigrateCampaignState().state;

    // Fail attempt in 5 seconds with 0 stars
    state = updateLevelProgress(
      state,
      'T1-ADD-01',
      {
        stars: 0,
        isPerfect: false,
        isPassed: false,
        accuracy: 30,
        reason: 'Failed',
      },
      100,
      5,
      3,
      10
    );

    // bestTimeSec should remain 0, NOT 5
    expect(state.levels['T1-ADD-01'].bestTimeSec).toBe(0);
    expect(state.levels['T1-ADD-01'].stars).toBe(0);

    // Subsequent successful run in 25 seconds should properly set bestTimeSec to 25
    state = updateLevelProgress(
      state,
      'T1-ADD-01',
      {
        stars: 2,
        isPerfect: false,
        isPassed: true,
        accuracy: 90,
        reason: 'Passed',
      },
      950,
      25,
      9,
      10
    );

    expect(state.levels['T1-ADD-01'].bestTimeSec).toBe(25);
  });

  it('persists existing V2 state when missing levels are populated', () => {
    const existing = createDefaultCampaignState();
    // Simulate an older V2 state missing one of the levels
    delete existing.levels['T1-BOSS'];
    saveCampaignState(existing);

    const { state } = initializeOrMigrateCampaignState();
    expect(state.levels['T1-BOSS']).toBeDefined();

    // Verify localStorage was updated with the restored level
    const loaded = loadCampaignState();
    expect(loaded?.levels['T1-BOSS']).toBeDefined();
  });

  it('handles corrupted localStorage JSON gracefully', () => {
    localStorage.setItem(CAMPAIGN_V2_STORAGE_KEY, 'invalid-json-{}');
    expect(loadCampaignState()).toBeNull();

    const { state, justMigrated } = initializeOrMigrateCampaignState();
    expect(justMigrated).toBe(false);
    expect(state.version).toBe(2);
  });
});
