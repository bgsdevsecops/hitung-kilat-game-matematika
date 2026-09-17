// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import App from '../../src/App';
import * as firebaseLib from '../../src/lib/firebase';
import {
  createDefaultCampaignState,
  loadCampaignState,
  saveCampaignState,
} from '../../src/utils/campaignState';
import {
  loadUnlockedAchievementsMap,
  saveUnlockedAchievementsMap,
} from '../../src/utils/achievements';
import { soundManager } from '../../src/utils/sound';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock recharts ResponsiveContainer
vi.mock('recharts', async () => {
  const original = await vi.importActual<any>('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

let authStateCallback: ((user: any) => Promise<void> | void) | null = null;

// Mock firebase
vi.mock('../../src/lib/firebase', async () => {
  const actual = await vi.importActual<any>('../../src/lib/firebase');
  return {
    ...actual,
    auth: { currentUser: null },
    onAuthStateChanged: vi.fn((_auth: any, cb: any) => {
      authStateCallback = cb;
      return vi.fn();
    }),
    loginWithGoogle: vi.fn(),
    loginAsGuest: vi.fn(),
    logoutUser: vi.fn(),
    saveGameDataToCloud: vi.fn().mockResolvedValue(undefined),
    loadGameDataFromCloud: vi.fn().mockResolvedValue(null),
    mergeGameProgress: vi.fn(actual.mergeGameProgress),
    submitTimeAttackScore: vi.fn().mockResolvedValue(true),
    fetchTopTimeAttackScores: vi.fn().mockResolvedValue([]),
  };
});

// Mock PlayScreen for rapid level completion simulation
vi.mock('../../src/components/PlayScreen', () => ({
  PlayScreen: ({ onFinishLevel }: any) => (
    <div data-testid="mock-play-screen">
      <button
        data-testid="simulate-finish-level-1"
        onClick={() =>
          onFinishLevel({
            sessionId: 'session_1',
            mode: 'campaign',
            levelId: 'T1-ADD-01',
            score: 500,
            questionsTotal: 5,
            correctCount: 5,
            wrongCount: 0,
            accuracy: 100,
            timeSpentSec: 10,
            avgTimePerQuestionSec: 2,
            questionsPerMinute: 30,
            maxStreak: 5,
            starsEarned: 3,
            isNewRecord: true,
            history: [],
          })
        }
      >
        Finish 1
      </button>
      <button
        data-testid="simulate-finish-level-2"
        onClick={() =>
          onFinishLevel({
            sessionId: 'session_2',
            mode: 'campaign',
            levelId: 'T1-ADD-02',
            score: 600,
            questionsTotal: 5,
            correctCount: 5,
            wrongCount: 0,
            accuracy: 100,
            timeSpentSec: 9,
            avgTimePerQuestionSec: 1.8,
            questionsPerMinute: 33,
            maxStreak: 5,
            starsEarned: 3,
            isNewRecord: true,
            history: [],
          })
        }
      >
        Finish 2
      </button>
    </div>
  ),
}));

describe('App Cloud Sync V2 Integration (Task 4)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('hitung_kilat_migration_ack_v2', 'true');
    vi.clearAllMocks();
    vi.spyOn(soundManager, 'playClick').mockImplementation(() => {});
    vi.spyOn(soundManager, 'playFanfare').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('performs V2 two-way merge on login when cloud data exists', async () => {
    // 1. Seed local device with local progress
    const localCampaign = createDefaultCampaignState();
    localCampaign.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 1,
      bestScore: 200,
      accuracy: 80,
      bestTimeSec: 25,
    };
    localCampaign.totalStars = 1;
    saveCampaignState(localCampaign);
    saveUnlockedAchievementsMap({ local_ach: '2026-09-17T08:00:00.000Z' });

    // 2. Prepare mock cloud data with 72-level campaign and V2 achievements
    const cloudCampaign = createDefaultCampaignState();
    cloudCampaign.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 3,
      bestScore: 500,
      accuracy: 100,
      bestTimeSec: 12,
    };
    cloudCampaign.levels['T1-ADD-02'] = {
      levelId: 'T1-ADD-02',
      unlocked: true,
      stars: 2,
      bestScore: 400,
      accuracy: 90,
      bestTimeSec: 18,
    };
    cloudCampaign.totalStars = 5;

    const cloudData: firebaseLib.SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: cloudCampaign,
      achievementsV2: {
        stars_15: '2026-09-17T09:00:00.000Z',
      },
      stats: {
        totalSolved: 100,
        totalCorrect: 95,
        totalTimePlayedSec: 600,
        bestStreak: 20,
        highestTimeAttackScore: 800,
        highestSPM: 40,
        starsTotal: 5,
      },
      dailyState: {
        currentStreak: 4,
        bestStreak: 7,
        lastCompletedDate: '2026-09-16',
        playerName: 'Budi Super',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: {},
    };

    vi.mocked(firebaseLib.loadGameDataFromCloud).mockResolvedValue(cloudData);

    render(<App />);

    // Trigger auth state change to logged-in user
    const mockUser = { uid: 'user_v2_abc', displayName: 'Budi' };
    await act(async () => {
      if (authStateCallback) {
        await authStateCallback(mockUser);
      }
    });

    // Verify loadGameDataFromCloud called
    expect(firebaseLib.loadGameDataFromCloud).toHaveBeenCalledWith('user_v2_abc');

    // Verify mergeGameProgress was called with V2 data containing campaignV2 & achievementsV2
    expect(firebaseLib.mergeGameProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 2,
        campaignV2: expect.objectContaining({
          levels: expect.any(Object),
        }),
        achievementsV2: expect.objectContaining({
          local_ach: '2026-09-17T08:00:00.000Z',
        }),
      }),
      cloudData
    );

    // Verify saveGameDataToCloud called with merged V2 state
    expect(firebaseLib.saveGameDataToCloud).toHaveBeenCalledWith(
      'user_v2_abc',
      expect.objectContaining({
        schemaVersion: 2,
        campaignV2: expect.objectContaining({
          totalStars: expect.any(Number),
        }),
        achievementsV2: expect.objectContaining({
          local_ach: '2026-09-17T08:00:00.000Z',
          stars_15: '2026-09-17T09:00:00.000Z',
        }),
      })
    );

    // Verify localStorage was updated with merged V2 states
    const persistedCampaign = loadCampaignState();
    expect(persistedCampaign?.levels['T1-ADD-01']?.stars).toBe(3);
    expect(persistedCampaign?.levels['T1-ADD-02']?.stars).toBe(2);
    expect(persistedCampaign?.totalStars).toBe(5);

    const persistedAchievements = loadUnlockedAchievementsMap();
    expect(persistedAchievements.local_ach).toBeDefined();
    expect(persistedAchievements.stars_15).toBeDefined();
  });

  it('uploads local V2 state when cloud data is null on first login', async () => {
    vi.mocked(firebaseLib.loadGameDataFromCloud).mockResolvedValue(null);

    const localCampaign = createDefaultCampaignState();
    localCampaign.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 2,
      bestScore: 350,
      accuracy: 90,
      bestTimeSec: 20,
    };
    localCampaign.totalStars = 2;
    saveCampaignState(localCampaign);
    saveUnlockedAchievementsMap({ local_first: '2026-09-17T07:00:00.000Z' });

    render(<App />);

    const mockUser = { uid: 'brand_new_user', displayName: 'Newbie' };
    await act(async () => {
      if (authStateCallback) {
        await authStateCallback(mockUser);
      }
    });

    expect(firebaseLib.loadGameDataFromCloud).toHaveBeenCalledWith('brand_new_user');
    expect(firebaseLib.saveGameDataToCloud).toHaveBeenCalledWith(
      'brand_new_user',
      expect.objectContaining({
        schemaVersion: 2,
        campaignV2: expect.objectContaining({
          totalStars: 2,
        }),
        achievementsV2: expect.objectContaining({
          local_first: '2026-09-17T07:00:00.000Z',
        }),
      })
    );
  });

  it('debounces rapid auto-sync writes to Cloud Firestore within 300ms', async () => {
    vi.useFakeTimers();
    vi.mocked(firebaseLib.loadGameDataFromCloud).mockResolvedValue(null);

    const mockUser = { uid: 'user_rapid_sync', displayName: 'Speeder' };

    render(<App />);

    // Login user
    await act(async () => {
      if (authStateCallback) {
        await authStateCallback(mockUser);
      }
    });

    // Clear initial login saveGameDataToCloud calls
    vi.mocked(firebaseLib.saveGameDataToCloud).mockClear();

    // Select Level 1 to enter PlayScreen
    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();
    fireEvent.click(level1Card!);

    // Rapidly trigger 2 game completions within 100ms
    const finishBtn1 = screen.getByTestId('simulate-finish-level-1');
    const finishBtn2 = screen.getByTestId('simulate-finish-level-2');

    act(() => {
      fireEvent.click(finishBtn1);
    });

    // Advance 100ms (still within 300ms window)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      fireEvent.click(finishBtn2);
    });

    // Before debounce timer expires, saveGameDataToCloud should not have been called yet
    expect(firebaseLib.saveGameDataToCloud).not.toHaveBeenCalled();

    // Advance 350ms to let debounce fire
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Coalesced into exactly 1 call with latest V2 data
    expect(firebaseLib.saveGameDataToCloud).toHaveBeenCalledTimes(1);
    expect(firebaseLib.saveGameDataToCloud).toHaveBeenCalledWith(
      'user_rapid_sync',
      expect.objectContaining({
        schemaVersion: 2,
        campaignV2: expect.any(Object),
        achievementsV2: expect.any(Object),
      })
    );

    vi.useRealTimers();
  });

  it('resets V2 campaign, achievements, and immediately overwrites Firestore on reset progress', async () => {
    vi.mocked(firebaseLib.loadGameDataFromCloud).mockResolvedValue(null);

    // Prepopulate progress
    const campaign = createDefaultCampaignState();
    campaign.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 3,
      bestScore: 500,
      accuracy: 100,
      bestTimeSec: 10,
    };
    campaign.totalStars = 3;
    saveCampaignState(campaign);
    saveUnlockedAchievementsMap({ stars_15: '2026-09-17T11:00:00.000Z' });

    render(<App />);

    const mockUser = { uid: 'user_reset_test', displayName: 'Reseter' };
    await act(async () => {
      if (authStateCallback) {
        await authStateCallback(mockUser);
      }
    });

    vi.mocked(firebaseLib.saveGameDataToCloud).mockClear();

    // Open stats modal via header badge
    const starsBadge = screen.getByTitle(/Total Bintang Diraih/i);
    fireEvent.click(starsBadge);

    // Click reset trigger
    const resetTrigger = screen.getByText(/Reset Seluruh Progres Permainan/i);
    fireEvent.click(resetTrigger);

    // Click confirm reset button
    const confirmBtn = screen.getByRole('button', { name: /Ya, Reset Sekarang/i });
    fireEvent.click(confirmBtn);

    // Verify localStorage states are reset
    const resetCampaign = loadCampaignState();
    expect(resetCampaign?.totalStars).toBe(0);
    expect(resetCampaign?.levels['T1-ADD-01']?.stars).toBe(0);

    const resetAchievements = loadUnlockedAchievementsMap();
    expect(Object.keys(resetAchievements)).toHaveLength(0);

    // Verify immediate write to Firestore with clean reset state and merge: false for complete overwrite
    expect(firebaseLib.saveGameDataToCloud).toHaveBeenCalledWith(
      'user_reset_test',
      expect.objectContaining({
        schemaVersion: 2,
        campaignV2: expect.objectContaining({
          totalStars: 0,
        }),
        achievementsV2: {},
      }),
      { merge: false }
    );
  });
});
