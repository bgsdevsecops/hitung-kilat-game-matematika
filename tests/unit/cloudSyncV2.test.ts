import { describe, it, expect } from 'vitest';
import {
  projectV2ToLegacyV1,
  createDefaultCampaignState,
} from '../../src/utils/campaignState';
import {
  mergeGameProgress,
  SyncedGameDataV2,
  SyncedGameDataLegacy,
} from '../../src/lib/firebase';

describe('projectV2ToLegacyV1', () => {
  it('projects default campaign state with level 1 unlocked and 2-24 locked', () => {
    const defaultState = createDefaultCampaignState();
    const legacy = projectV2ToLegacyV1(defaultState);

    expect(Object.keys(legacy)).toHaveLength(24);
    expect(legacy[1]).toEqual({
      levelId: 1,
      unlocked: true,
      stars: 0,
      bestScore: 0,
      accuracy: 0,
      bestTimeSec: 0,
    });
    expect(legacy[2].unlocked).toBe(false);
    expect(legacy[24].unlocked).toBe(false);
  });

  it('projects completed V2 levels back to their corresponding V1 IDs', () => {
    const state = createDefaultCampaignState();
    // T1-ADD-01 maps to V1 level 1
    state.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 3,
      bestScore: 1500,
      accuracy: 100,
      bestTimeSec: 18.5,
    };
    // T6-GRANDMASTER maps to V1 level 24
    state.levels['T6-GRANDMASTER'] = {
      levelId: 'T6-GRANDMASTER',
      unlocked: true,
      stars: 2,
      bestScore: 3200,
      accuracy: 90,
      bestTimeSec: 54.2,
    };

    const legacy = projectV2ToLegacyV1(state);
    expect(legacy[1].stars).toBe(3);
    expect(legacy[1].bestTimeSec).toBe(18.5);
    expect(legacy[24].stars).toBe(2);
    expect(legacy[24].bestScore).toBe(3200);
  });
});

describe('mergeGameProgress V2', () => {
  it('merges two V2 states keeping max stars, fastest times, and DAG unlocks', () => {
    const localState = createDefaultCampaignState();
    localState.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 3,
      bestScore: 1000,
      accuracy: 100,
      bestTimeSec: 20,
    };

    const cloudState = createDefaultCampaignState();
    cloudState.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 2,
      bestScore: 1200,
      accuracy: 95,
      bestTimeSec: 15,
    };
    cloudState.levels['T1-ADD-02'] = {
      levelId: 'T1-ADD-02',
      unlocked: true,
      stars: 3,
      bestScore: 1100,
      accuracy: 100,
      bestTimeSec: 22,
    };

    const local: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: localState,
      achievementsV2: { stars_15: '2026-09-17T10:00:00Z' },
      stats: {
        totalSolved: 50,
        totalCorrect: 48,
        bestStreak: 12,
        totalTimePlayedSec: 600,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 3,
      },
      dailyState: {
        currentStreak: 3,
        bestStreak: 5,
        lastCompletedDate: '2026-09-16',
        playerName: 'Local',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const cloud: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: cloudState,
      achievementsV2: {
        stars_15: '2026-09-17T09:00:00Z',
        boss_t1: '2026-09-17T09:30:00Z',
      },
      stats: {
        totalSolved: 80,
        totalCorrect: 75,
        bestStreak: 15,
        totalTimePlayedSec: 900,
        highestTimeAttackScore: 100,
        highestSPM: 20,
        starsTotal: 5,
      },
      dailyState: {
        currentStreak: 4,
        bestStreak: 5,
        lastCompletedDate: '2026-09-17',
        playerName: 'Cloud',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const merged = mergeGameProgress(local, cloud);

    expect(merged.schemaVersion).toBe(2);
    // T1-ADD-01: max stars 3, max score 1200, min time 15
    expect(merged.campaignV2.levels['T1-ADD-01'].stars).toBe(3);
    expect(merged.campaignV2.levels['T1-ADD-01'].bestScore).toBe(1200);
    expect(merged.campaignV2.levels['T1-ADD-01'].bestTimeSec).toBe(15);
    // T1-ADD-02 unlocked and kept from cloud
    expect(merged.campaignV2.levels['T1-ADD-02'].stars).toBe(3);
    // DAG cascade: T1-ADD-02 stars 3 satisfies prerequisite for T1-SUB-01
    expect(merged.campaignV2.levels['T1-SUB-01'].unlocked).toBe(true);
    // Achievements union with earliest timestamp
    expect(merged.achievementsV2['boss_t1']).toBe('2026-09-17T09:30:00Z');
    expect(merged.achievementsV2['stars_15']).toBe('2026-09-17T09:00:00Z');
    // Stats maxed
    expect(merged.stats.totalSolved).toBe(80);
    expect(merged.stats.bestStreak).toBe(15);
    // Backward compatibility projection
    expect(merged.progress).toBeDefined();
    expect(merged.progress![1].stars).toBe(3);
  });

  it('auto-migrates legacy V1 cloud data into V2 seamlessly', () => {
    const local: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: createDefaultCampaignState(),
      achievementsV2: {},
      stats: {
        totalSolved: 10,
        totalCorrect: 10,
        bestStreak: 10,
        totalTimePlayedSec: 100,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 0,
      },
      dailyState: {
        currentStreak: 1,
        bestStreak: 1,
        lastCompletedDate: '',
        playerName: 'Player',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const legacyCloud: SyncedGameDataLegacy = {
      progress: {
        1: {
          levelId: 1,
          unlocked: true,
          stars: 3,
          bestScore: 2000,
          accuracy: 100,
          bestTimeSec: 19,
        },
        2: {
          levelId: 2,
          unlocked: true,
          stars: 2,
          bestScore: 1800,
          accuracy: 90,
          bestTimeSec: 25,
        },
      },
      stats: {
        totalSolved: 40,
        totalCorrect: 38,
        bestStreak: 20,
        totalTimePlayedSec: 400,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 5,
      },
      dailyState: {
        currentStreak: 2,
        bestStreak: 3,
        lastCompletedDate: '2026-09-15',
        playerName: 'LegacyUser',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const merged = mergeGameProgress(local, legacyCloud);
    expect(merged.schemaVersion).toBe(2);
    expect(merged.campaignV2.levels['T1-ADD-01'].stars).toBe(3);
    expect(merged.campaignV2.levels['T1-SUB-01'].stars).toBe(2);
    expect(merged.campaignV2.totalStars).toBeGreaterThanOrEqual(5);
    expect(merged.progress![1].stars).toBe(3);
  });

  it('auto-migrates when local is legacy V1 and cloud is V2', () => {
    const legacyLocal: SyncedGameDataLegacy = {
      progress: {
        1: {
          levelId: 1,
          unlocked: true,
          stars: 2,
          bestScore: 1500,
          accuracy: 85,
          bestTimeSec: 22,
        },
      },
      stats: {
        totalSolved: 20,
        totalCorrect: 18,
        bestStreak: 10,
        totalTimePlayedSec: 200,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 2,
      },
      dailyState: {
        currentStreak: 1,
        bestStreak: 2,
        lastCompletedDate: '2026-09-14',
        playerName: 'LegacyLocal',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const cloudState = createDefaultCampaignState();
    cloudState.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 3,
      bestScore: 1800,
      accuracy: 95,
      bestTimeSec: 18,
    };

    const cloud: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: cloudState,
      achievementsV2: { stars_15: '2026-09-17T08:00:00Z' },
      stats: {
        totalSolved: 30,
        totalCorrect: 28,
        bestStreak: 15,
        totalTimePlayedSec: 350,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 3,
      },
      dailyState: {
        currentStreak: 2,
        bestStreak: 3,
        lastCompletedDate: '2026-09-16',
        playerName: 'V2Cloud',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const merged = mergeGameProgress(legacyLocal, cloud);
    expect(merged.schemaVersion).toBe(2);
    expect(merged.campaignV2.levels['T1-ADD-01'].stars).toBe(3);
    expect(merged.campaignV2.levels['T1-ADD-01'].bestScore).toBe(1800);
    expect(merged.campaignV2.levels['T1-ADD-01'].bestTimeSec).toBe(18);
    expect(merged.achievementsV2['stars_15']).toBe('2026-09-17T08:00:00Z');
  });

  it('reconciles 16 standardized V2 achievements via set union keeping earliest unlockedAt timestamp', () => {
    const localState = createDefaultCampaignState();
    const cloudState = createDefaultCampaignState();

    const local: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: localState,
      achievementsV2: {
        stars_15: '2026-09-17T12:00:00Z',
        speed_demon: '2026-09-17T11:00:00Z',
      },
      stats: {
        totalSolved: 10,
        totalCorrect: 10,
        bestStreak: 5,
        totalTimePlayedSec: 100,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 0,
      },
      dailyState: {
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: '',
        playerName: 'P1',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const cloud: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: cloudState,
      achievementsV2: {
        stars_15: '2026-09-17T09:00:00Z',
        boss_t1: '2026-09-17T08:00:00Z',
      },
      stats: {
        totalSolved: 10,
        totalCorrect: 10,
        bestStreak: 5,
        totalTimePlayedSec: 100,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 0,
      },
      dailyState: {
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: '',
        playerName: 'P2',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const merged = mergeGameProgress(local, cloud);
    expect(merged.achievementsV2['stars_15']).toBe('2026-09-17T09:00:00Z');
    expect(merged.achievementsV2['speed_demon']).toBe('2026-09-17T11:00:00Z');
    expect(merged.achievementsV2['boss_t1']).toBe('2026-09-17T08:00:00Z');
    expect(Object.keys(merged.achievementsV2)).toHaveLength(3);
  });

  it('preserves fastest valid positive bestTimeSec and ignores 0 and negative values', () => {
    const localState = createDefaultCampaignState();
    localState.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 1,
      bestScore: 100,
      accuracy: 80,
      bestTimeSec: 25,
    };
    localState.levels['T1-ADD-02'] = {
      levelId: 'T1-ADD-02',
      unlocked: true,
      stars: 1,
      bestScore: 100,
      accuracy: 80,
      bestTimeSec: 0,
    };
    localState.levels['T1-SUB-01'] = {
      levelId: 'T1-SUB-01',
      unlocked: true,
      stars: 1,
      bestScore: 100,
      accuracy: 80,
      bestTimeSec: 18,
    };
    localState.levels['T1-SUB-02'] = {
      levelId: 'T1-SUB-02',
      unlocked: true,
      stars: 1,
      bestScore: 100,
      accuracy: 80,
      bestTimeSec: 30,
    };

    const cloudState = createDefaultCampaignState();
    cloudState.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 1,
      bestScore: 100,
      accuracy: 80,
      bestTimeSec: 0,
    };
    cloudState.levels['T1-ADD-02'] = {
      levelId: 'T1-ADD-02',
      unlocked: true,
      stars: 1,
      bestScore: 100,
      accuracy: 80,
      bestTimeSec: 22,
    };
    cloudState.levels['T1-SUB-01'] = {
      levelId: 'T1-SUB-01',
      unlocked: true,
      stars: 1,
      bestScore: 100,
      accuracy: 80,
      bestTimeSec: 14,
    };
    cloudState.levels['T1-SUB-02'] = {
      levelId: 'T1-SUB-02',
      unlocked: true,
      stars: 1,
      bestScore: 100,
      accuracy: 80,
      bestTimeSec: -5,
    };

    const local: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: localState,
      achievementsV2: {},
      stats: {
        totalSolved: 1,
        totalCorrect: 1,
        bestStreak: 1,
        totalTimePlayedSec: 10,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 4,
      },
      dailyState: {
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: '',
        playerName: 'L',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const cloud: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: cloudState,
      achievementsV2: {},
      stats: {
        totalSolved: 1,
        totalCorrect: 1,
        bestStreak: 1,
        totalTimePlayedSec: 10,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 4,
      },
      dailyState: {
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: '',
        playerName: 'C',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const merged = mergeGameProgress(local, cloud);
    // local 25, cloud 0 -> 25
    expect(merged.campaignV2.levels['T1-ADD-01'].bestTimeSec).toBe(25);
    // local 0, cloud 22 -> 22
    expect(merged.campaignV2.levels['T1-ADD-02'].bestTimeSec).toBe(22);
    // local 18, cloud 14 -> 14 (min)
    expect(merged.campaignV2.levels['T1-SUB-01'].bestTimeSec).toBe(14);
    // local 30, cloud -5 -> 30 (negative ignored)
    expect(merged.campaignV2.levels['T1-SUB-02'].bestTimeSec).toBe(30);
  });

  it('merges stats, daily challenge state, and 7-day daily activity properly', () => {
    const localState = createDefaultCampaignState();
    const cloudState = createDefaultCampaignState();

    const local: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: localState,
      achievementsV2: {},
      stats: {
        totalSolved: 100,
        totalCorrect: 95,
        bestStreak: 20,
        totalTimePlayedSec: 1500,
        highestTimeAttackScore: 250,
        highestSPM: 40,
        starsTotal: 10,
      },
      dailyState: {
        currentStreak: 5,
        bestStreak: 7,
        lastCompletedDate: '2026-09-17',
        playerName: 'LocalUser',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {
          '2026-09-17': {
            date: '2026-09-17',
            score: 900,
            timeTakenSec: 45,
            accuracy: 90,
            completed: true,
            maxStreak: 8,
            correctCount: 9,
            totalQuestions: 10,
            rank: 1,
            completedAt: '2026-09-17T12:00:00Z',
            answers: [],
          },
        },
      },
      dailyActivity: {
        '2026-09-17': {
          date: '2026-09-17',
          questionsTotal: 20,
          correctCount: 18,
          accuracy: 90,
        },
        '2026-09-16': {
          date: '2026-09-16',
          questionsTotal: 15,
          correctCount: 15,
          accuracy: 100,
        },
      },
    };

    const cloud: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: cloudState,
      achievementsV2: {},
      stats: {
        totalSolved: 120,
        totalCorrect: 110,
        bestStreak: 25,
        totalTimePlayedSec: 1200,
        highestTimeAttackScore: 300,
        highestSPM: 35,
        starsTotal: 8,
      },
      dailyState: {
        currentStreak: 6,
        bestStreak: 6,
        lastCompletedDate: '2026-09-16',
        playerName: 'CloudUser',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {
          '2026-09-16': {
            date: '2026-09-16',
            score: 850,
            timeTakenSec: 50,
            accuracy: 85,
            completed: true,
            maxStreak: 7,
            correctCount: 8,
            totalQuestions: 10,
            rank: 2,
            completedAt: '2026-09-16T12:00:00Z',
            answers: [],
          },
        },
      },
      dailyActivity: {
        '2026-09-17': {
          date: '2026-09-17',
          questionsTotal: 25,
          correctCount: 22,
          accuracy: 88,
        },
        '2026-09-15': {
          date: '2026-09-15',
          questionsTotal: 10,
          correctCount: 9,
          accuracy: 90,
        },
      },
    };

    const merged = mergeGameProgress(local, cloud);

    expect(merged.stats.totalSolved).toBe(120);
    expect(merged.stats.totalCorrect).toBe(110);
    expect(merged.stats.bestStreak).toBe(25);
    expect(merged.stats.totalTimePlayedSec).toBe(1500);
    expect(merged.stats.highestTimeAttackScore).toBe(300);
    expect(merged.stats.highestSPM).toBe(40);

    expect(merged.dailyState.currentStreak).toBe(6);
    expect(merged.dailyState.bestStreak).toBe(7);
    expect(merged.dailyState.lastCompletedDate).toBe('2026-09-17');
    expect(merged.dailyState.history['2026-09-17']).toBeDefined();
    expect(merged.dailyState.history['2026-09-16']).toBeDefined();

    expect(merged.dailyActivity['2026-09-17']).toEqual({
      date: '2026-09-17',
      questionsTotal: 25,
      correctCount: 22,
      accuracy: 88,
    });
    expect(merged.dailyActivity['2026-09-16']).toEqual({
      date: '2026-09-16',
      questionsTotal: 15,
      correctCount: 15,
      accuracy: 100,
    });
    expect(merged.dailyActivity['2026-09-15']).toEqual({
      date: '2026-09-15',
      questionsTotal: 10,
      correctCount: 9,
      accuracy: 90,
    });
  });

  it('preserves earlier completedAt ISO timestamp across levels', () => {
    const localState = createDefaultCampaignState();
    localState.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 2,
      bestScore: 800,
      accuracy: 90,
      bestTimeSec: 25,
      completedAt: '2026-09-17T12:00:00Z',
    };

    const cloudState = createDefaultCampaignState();
    cloudState.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 3,
      bestScore: 900,
      accuracy: 95,
      bestTimeSec: 20,
      completedAt: '2026-09-17T09:00:00Z',
    };

    const local: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: localState,
      achievementsV2: {},
      stats: {
        totalSolved: 1,
        totalCorrect: 1,
        bestStreak: 1,
        totalTimePlayedSec: 10,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 2,
      },
      dailyState: {
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: '',
        playerName: 'L',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const cloud: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: cloudState,
      achievementsV2: {},
      stats: {
        totalSolved: 1,
        totalCorrect: 1,
        bestStreak: 1,
        totalTimePlayedSec: 10,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 3,
      },
      dailyState: {
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: '',
        playerName: 'C',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const merged = mergeGameProgress(local, cloud);
    expect(merged.campaignV2.levels['T1-ADD-01'].completedAt).toBe(
      '2026-09-17T09:00:00Z'
    );
  });

  it('caps level stars between 0 and 3', () => {
    const localState = createDefaultCampaignState();
    localState.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 5, // invalid > 3
      bestScore: 1000,
      accuracy: 100,
      bestTimeSec: 20,
    };

    const cloudState = createDefaultCampaignState();
    cloudState.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: -1, // invalid < 0
      bestScore: 800,
      accuracy: 80,
      bestTimeSec: 25,
    };

    const local: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: localState,
      achievementsV2: {},
      stats: {
        totalSolved: 1,
        totalCorrect: 1,
        bestStreak: 1,
        totalTimePlayedSec: 10,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 5,
      },
      dailyState: {
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: '',
        playerName: 'L',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const cloud: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: cloudState,
      achievementsV2: {},
      stats: {
        totalSolved: 1,
        totalCorrect: 1,
        bestStreak: 1,
        totalTimePlayedSec: 10,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 0,
      },
      dailyState: {
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: '',
        playerName: 'C',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    const merged = mergeGameProgress(local, cloud);
    expect(merged.campaignV2.levels['T1-ADD-01'].stars).toBe(3);
  });

  it('reconciles overlapping daily history records preserving highest score, max accuracy, and fastest time', () => {
    const localState = createDefaultCampaignState();
    const cloudState = createDefaultCampaignState();

    const local: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: localState,
      achievementsV2: {},
      stats: {
        totalSolved: 10,
        totalCorrect: 10,
        bestStreak: 5,
        totalTimePlayedSec: 100,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 0,
      },
      dailyState: {
        currentStreak: 2,
        bestStreak: 2,
        lastCompletedDate: '2026-09-17',
        playerName: 'LocalPlayer',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {
          '2026-09-17': {
            date: '2026-09-17',
            score: 750,
            timeTakenSec: 40,
            accuracy: 90,
            completed: true,
            maxStreak: 6,
            correctCount: 9,
            totalQuestions: 10,
            completedAt: '2026-09-17T14:00:00Z',
            rank: 2,
            answers: [],
          },
        },
      },
      dailyActivity: {},
    };

    const cloud: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: cloudState,
      achievementsV2: {},
      stats: {
        totalSolved: 10,
        totalCorrect: 10,
        bestStreak: 5,
        totalTimePlayedSec: 100,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 0,
      },
      dailyState: {
        currentStreak: 1,
        bestStreak: 1,
        lastCompletedDate: '2026-09-17',
        playerName: 'CloudPlayer',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {
          '2026-09-17': {
            date: '2026-09-17',
            score: 850,
            timeTakenSec: 55,
            accuracy: 95,
            completed: true,
            maxStreak: 8,
            correctCount: 9,
            totalQuestions: 10,
            completedAt: '2026-09-17T09:00:00Z',
            rank: 1,
            answers: [],
          },
        },
      },
      dailyActivity: {},
    };

    const merged = mergeGameProgress(local, cloud);
    const dateRecord = merged.dailyState.history['2026-09-17'];
    expect(dateRecord).toBeDefined();
    // Max score: 850
    expect(dateRecord.score).toBe(850);
    // Max accuracy: 95
    expect(dateRecord.accuracy).toBe(95);
    // Max streak: 8
    expect(dateRecord.maxStreak).toBe(8);
    // Fastest time: 40
    expect(dateRecord.timeTakenSec).toBe(40);
    // Earliest completedAt: 09:00:00Z
    expect(dateRecord.completedAt).toBe('2026-09-17T09:00:00Z');
  });
});
