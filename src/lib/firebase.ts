import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  UserLevelProgress,
  UserStats,
  DailyChallengeUserState,
} from '../types';
import { DayAccuracyRecord } from '../utils/dailyActivity';
import {
  V2CampaignState,
  V2LevelProgress,
  createDefaultCampaignState,
  isLevelUnlocked,
  projectV2ToLegacyV1,
} from '../utils/campaignState';
import { migrateV1ToV2 } from '../engine/migration/migrator';
import { LEVEL_MANIFEST_72 } from '../engine/manifest/levels';
import firebaseConfigRaw from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfigRaw) : getApp();

// Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Firestore Database (targets provisioned firestoreDatabaseId)
export const db = getFirestore(
  app,
  firebaseConfigRaw.firestoreDatabaseId || undefined
);

export interface SyncedGameDataV2 {
  schemaVersion: 2;
  // Full 72-level campaign state
  campaignV2: V2CampaignState;
  // Standardized 16 achievements (id -> ISO timestamp string)
  achievementsV2: Record<string, string>;
  // Global aggregated stats
  stats: UserStats;
  // Daily challenge progress & streak state
  dailyState: DailyChallengeUserState;
  // 7-day rolling accuracy tracker
  dailyActivity: Record<string, DayAccuracyRecord>;
  // 24-level legacy progress projected for backward compatibility
  progress?: Record<number, UserLevelProgress>;
  // Server-managed timestamp
  updatedAt?: any;
}

export interface SyncedGameDataLegacy {
  schemaVersion?: 1;
  progress: Record<number, UserLevelProgress>;
  stats: UserStats;
  dailyState: DailyChallengeUserState;
  dailyActivity: Record<string, DayAccuracyRecord>;
  updatedAt?: any;
}

export type SyncedGameData = SyncedGameDataV2 | SyncedGameDataLegacy;

export function isSyncedGameDataV2(
  data: SyncedGameData
): data is SyncedGameDataV2 {
  return (
    data !== null &&
    typeof data === 'object' &&
    'campaignV2' in data &&
    Boolean((data as SyncedGameDataV2).campaignV2?.levels)
  );
}

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/**
 * Sign in anonymously (Guest Sync ID)
 */
export async function loginAsGuest(): Promise<User> {
  const result = await signInAnonymously(auth);
  return result.user;
}

/**
 * Sign out
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Converts legacy V1 progress (Record<number, UserLevelProgress>) to a valid V2CampaignState.
 */
function convertLegacyProgressToV2Campaign(
  v1Progress?: Record<number, UserLevelProgress>
): V2CampaignState {
  const defaultState = createDefaultCampaignState();
  if (!v1Progress || Object.keys(v1Progress).length === 0) {
    defaultState.migrationCompleted = true;
    return defaultState;
  }

  const migrationRes = migrateV1ToV2(v1Progress);
  let totalStars = 0;

  for (const [lvlId, prog] of Object.entries(migrationRes.levels)) {
    if (defaultState.levels[lvlId]) {
      const v1Item = prog.migratedFromV1Id ? v1Progress[prog.migratedFromV1Id] : undefined;
      defaultState.levels[lvlId] = {
        ...defaultState.levels[lvlId],
        unlocked: prog.unlocked || defaultState.levels[lvlId].unlocked,
        stars: Math.min(3, Math.max(0, prog.stars)),
        bestScore: prog.bestScore,
        accuracy: prog.accuracy,
        bestTimeSec: prog.bestTimeSec > 0 ? prog.bestTimeSec : 0,
        migratedFromV1Id: prog.migratedFromV1Id,
        completedAt: v1Item?.completedAt,
      };
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const lvl of LEVEL_MANIFEST_72) {
      if (!defaultState.levels[lvl.id].unlocked) {
        if (isLevelUnlocked(defaultState, lvl)) {
          defaultState.levels[lvl.id].unlocked = true;
          changed = true;
        }
      }
    }
  }

  for (const lvl of LEVEL_MANIFEST_72) {
    totalStars += defaultState.levels[lvl.id].stars;
  }

  defaultState.totalStars = totalStars;
  defaultState.legacyStarCredits = migrationRes.legacyStarCredits;
  defaultState.migrationCompleted = true;

  return defaultState;
}

/**
 * Normalizes any SyncedGameData into a canonical SyncedGameDataV2 structure.
 */
export function normalizeToV2(data: SyncedGameData): SyncedGameDataV2 {
  if (isSyncedGameDataV2(data)) {
    return {
      schemaVersion: 2,
      campaignV2: data.campaignV2,
      achievementsV2: data.achievementsV2 || {},
      stats: data.stats || {
        totalSolved: 0,
        totalCorrect: 0,
        totalTimePlayedSec: 0,
        bestStreak: 0,
        highestTimeAttackScore: 0,
        highestSPM: 0,
        starsTotal: 0,
      },
      dailyState: data.dailyState || {
        currentStreak: 0,
        bestStreak: 0,
        lastCompletedDate: '',
        playerName: 'Jago Hitung',
        playerCountry: 'ID',
        playerFlag: '🇮🇩',
        history: {},
      },
      dailyActivity: data.dailyActivity || {},
      progress: data.progress,
      updatedAt: data.updatedAt,
    };
  }

  const legacyData = data as SyncedGameDataLegacy;
  const legacyProgress = legacyData?.progress || {};
  const campaignV2 = convertLegacyProgressToV2Campaign(legacyProgress);

  return {
    schemaVersion: 2,
    campaignV2,
    achievementsV2: (legacyData as any)?.achievementsV2 || {},
    stats: legacyData?.stats || {
      totalSolved: 0,
      totalCorrect: 0,
      totalTimePlayedSec: 0,
      bestStreak: 0,
      highestTimeAttackScore: 0,
      highestSPM: 0,
      starsTotal: campaignV2.totalStars,
    },
    dailyState: legacyData?.dailyState || {
      currentStreak: 0,
      bestStreak: 0,
      lastCompletedDate: '',
      playerName: 'Jago Hitung',
      playerCountry: 'ID',
      playerFlag: '🇮🇩',
      history: {},
    },
    dailyActivity: legacyData?.dailyActivity || {},
    progress: legacyProgress,
    updatedAt: legacyData?.updatedAt,
  };
}

/**
 * Merges two V2 campaign states with DAG cascade unlocking and zero-progress-loss guarantees.
 */
function mergeCampaignV2(
  localCampaign: V2CampaignState,
  cloudCampaign: V2CampaignState
): V2CampaignState {
  const mergedLevels: Record<string, V2LevelProgress> = {};

  for (const lvl of LEVEL_MANIFEST_72) {
    const locLvl = localCampaign.levels?.[lvl.id];
    const cldLvl = cloudCampaign.levels?.[lvl.id];

    const rawStars = Math.max(locLvl?.stars || 0, cldLvl?.stars || 0);
    const stars = Math.min(3, Math.max(0, rawStars));

    const bestScore = Math.max(locLvl?.bestScore || 0, cldLvl?.bestScore || 0);
    const accuracy = Math.max(locLvl?.accuracy || 0, cldLvl?.accuracy || 0);

    const locTime = locLvl?.bestTimeSec && locLvl.bestTimeSec > 0 ? locLvl.bestTimeSec : 0;
    const cldTime = cldLvl?.bestTimeSec && cldLvl.bestTimeSec > 0 ? cldLvl.bestTimeSec : 0;
    let bestTimeSec = 0;
    if (locTime > 0 && cldTime > 0) {
      bestTimeSec = Math.min(locTime, cldTime);
    } else {
      bestTimeSec = locTime || cldTime || 0;
    }

    let completedAt: string | undefined = undefined;
    if (locLvl?.completedAt && cldLvl?.completedAt) {
      completedAt =
        locLvl.completedAt < cldLvl.completedAt
          ? locLvl.completedAt
          : cldLvl.completedAt;
    } else {
      completedAt = locLvl?.completedAt || cldLvl?.completedAt;
    }

    const migratedFromV1Id = locLvl?.migratedFromV1Id || cldLvl?.migratedFromV1Id;

    const unlocked =
      Boolean(locLvl?.unlocked || cldLvl?.unlocked) ||
      lvl.order === 1 ||
      lvl.prerequisiteIds.length === 0 ||
      stars >= 1;

    mergedLevels[lvl.id] = {
      levelId: lvl.id,
      unlocked,
      stars,
      bestScore,
      accuracy,
      bestTimeSec,
      migratedFromV1Id,
      completedAt,
    };
  }

  const mergedCampaign: V2CampaignState = {
    version: 2,
    levels: mergedLevels,
    totalStars: 0,
    legacyStarCredits: Math.max(
      localCampaign.legacyStarCredits || 0,
      cloudCampaign.legacyStarCredits || 0
    ),
    migrationCompleted: Boolean(
      localCampaign.migrationCompleted || cloudCampaign.migrationCompleted
    ),
  };

  // Re-evaluate DAG unlocks cascade across all 72 levels
  let changed = true;
  while (changed) {
    changed = false;
    for (const lvl of LEVEL_MANIFEST_72) {
      if (!mergedLevels[lvl.id].unlocked) {
        if (isLevelUnlocked(mergedCampaign, lvl)) {
          mergedLevels[lvl.id].unlocked = true;
          changed = true;
        }
      }
    }
  }

  let totalStars = 0;
  for (const lvl of LEVEL_MANIFEST_72) {
    totalStars += mergedLevels[lvl.id].stars;
  }
  mergedCampaign.totalStars = totalStars;

  return mergedCampaign;
}

/**
 * Reconciles 16 standardized V2 achievements via set union keeping earliest unlocked timestamp.
 */
function mergeAchievementsV2(
  localMap: Record<string, string> = {},
  cloudMap: Record<string, string> = {}
): Record<string, string> {
  const result: Record<string, string> = {};
  const allKeys = new Set([...Object.keys(localMap), ...Object.keys(cloudMap)]);

  for (const key of allKeys) {
    const locTime = localMap[key];
    const cldTime = cloudMap[key];

    if (locTime && cldTime) {
      result[key] = locTime < cldTime ? locTime : cldTime;
    } else {
      result[key] = (locTime || cldTime)!;
    }
  }

  return result;
}

/**
 * Save user game state to Cloud Firestore supporting both V2 and legacy contracts.
 */
export async function saveGameDataToCloud(
  userId: string,
  data: SyncedGameData
): Promise<void> {
  if (!userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    if (isSyncedGameDataV2(data)) {
      const v2Data = data;
      await setDoc(
        userRef,
        {
          uid: userId,
          schemaVersion: 2,
          campaignV2: v2Data.campaignV2,
          achievementsV2: v2Data.achievementsV2 || {},
          stats: v2Data.stats,
          dailyState: v2Data.dailyState,
          dailyActivity: v2Data.dailyActivity || {},
          progress: v2Data.progress || projectV2ToLegacyV1(v2Data.campaignV2),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      const legacyData = data as SyncedGameDataLegacy;
      await setDoc(
        userRef,
        {
          uid: userId,
          progress: legacyData.progress,
          stats: legacyData.stats,
          dailyState: legacyData.dailyState,
          dailyActivity: legacyData.dailyActivity || {},
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    console.error('Failed to sync game data to Firebase Firestore:', error);
    throw error;
  }
}

/**
 * Fetch game state from Cloud Firestore
 */
export async function loadGameDataFromCloud(
  userId: string
): Promise<SyncedGameData | null> {
  if (!userId) return null;
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as SyncedGameData;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch user game data from Firebase:', error);
    return null;
  }
}

/**
 * Intelligently and deterministically merges local device progress with cloud progress:
 * - Unlocks level if either local or cloud has it unlocked
 * - Keeps maximum stars (0-3)
 * - Keeps highest score & fastest completion time (positive seconds)
 * - Cascade unlocks downstream DAG prerequisites
 * - Unions 16 standardized achievements preserving earliest unlock timestamp
 * - Maxes cumulative stats appropriately
 * - Projects 72 levels back to 24 legacy levels for dual-write compatibility
 */
export function mergeGameProgress(
  local: SyncedGameData,
  cloud: SyncedGameData
): SyncedGameDataV2 & { progress: Record<number, UserLevelProgress> } {
  const v2Local = normalizeToV2(local);
  const v2Cloud = normalizeToV2(cloud);

  // 1. Merge 72-level campaign
  const mergedCampaign = mergeCampaignV2(v2Local.campaignV2, v2Cloud.campaignV2);

  // 2. Merge 16 V2 achievements
  const mergedAchievements = mergeAchievementsV2(
    v2Local.achievementsV2,
    v2Cloud.achievementsV2
  );

  // 3. Merge global stats
  const mergedStats: UserStats = {
    totalSolved: Math.max(
      v2Local.stats?.totalSolved || 0,
      v2Cloud.stats?.totalSolved || 0
    ),
    totalCorrect: Math.max(
      v2Local.stats?.totalCorrect || 0,
      v2Cloud.stats?.totalCorrect || 0
    ),
    bestStreak: Math.max(
      v2Local.stats?.bestStreak || 0,
      v2Cloud.stats?.bestStreak || 0
    ),
    totalTimePlayedSec: Math.max(
      v2Local.stats?.totalTimePlayedSec || 0,
      v2Cloud.stats?.totalTimePlayedSec || 0
    ),
    highestTimeAttackScore: Math.max(
      v2Local.stats?.highestTimeAttackScore || 0,
      v2Cloud.stats?.highestTimeAttackScore || 0
    ),
    highestSPM: Math.max(
      v2Local.stats?.highestSPM || 0,
      v2Cloud.stats?.highestSPM || 0
    ),
    starsTotal: Math.max(
      mergedCampaign.totalStars,
      v2Local.stats?.starsTotal || 0,
      v2Cloud.stats?.starsTotal || 0
    ),
  };

  // 4. Merge daily state (keep highest streak & combined history)
  const mergedDailyHistory = {
    ...(v2Cloud.dailyState?.history || {}),
    ...(v2Local.dailyState?.history || {}),
  };

  const localDate = v2Local.dailyState?.lastCompletedDate || '';
  const cloudDate = v2Cloud.dailyState?.lastCompletedDate || '';
  const lastCompletedDate = localDate > cloudDate ? localDate : cloudDate;

  const mergedDailyState: DailyChallengeUserState = {
    currentStreak: Math.max(
      v2Local.dailyState?.currentStreak || 0,
      v2Cloud.dailyState?.currentStreak || 0
    ),
    bestStreak: Math.max(
      v2Local.dailyState?.bestStreak || 0,
      v2Cloud.dailyState?.bestStreak || 0
    ),
    lastCompletedDate,
    playerName:
      v2Local.dailyState?.playerName ||
      v2Cloud.dailyState?.playerName ||
      'Jago Hitung',
    playerCountry:
      v2Local.dailyState?.playerCountry ||
      v2Cloud.dailyState?.playerCountry ||
      'ID',
    playerFlag:
      v2Local.dailyState?.playerFlag ||
      v2Cloud.dailyState?.playerFlag ||
      '🇮🇩',
    history: mergedDailyHistory,
  };

  // 5. Merge daily activity (accuracy tracker)
  const mergedDailyActivity: Record<string, DayAccuracyRecord> = {
    ...(v2Cloud.dailyActivity || {}),
  };
  if (v2Local.dailyActivity) {
    Object.keys(v2Local.dailyActivity).forEach((dateKey) => {
      const locAct = v2Local.dailyActivity[dateKey];
      const cldAct = mergedDailyActivity[dateKey];
      if (!cldAct) {
        mergedDailyActivity[dateKey] = locAct;
      } else {
        const total = Math.max(
          locAct.questionsTotal || 0,
          cldAct.questionsTotal || 0
        );
        const correct = Math.max(
          locAct.correctCount || 0,
          cldAct.correctCount || 0
        );
        mergedDailyActivity[dateKey] = {
          date: dateKey,
          questionsTotal: total,
          correctCount: correct,
          accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        };
      }
    });
  }

  // 6. Project 72 levels back to 24 legacy levels for dual-write compatibility
  const projectedProgress = projectV2ToLegacyV1(mergedCampaign);

  return {
    schemaVersion: 2,
    campaignV2: mergedCampaign,
    achievementsV2: mergedAchievements,
    stats: mergedStats,
    dailyState: mergedDailyState,
    dailyActivity: mergedDailyActivity,
    progress: projectedProgress,
    updatedAt: local?.updatedAt || cloud?.updatedAt,
  };
}

export interface TimeAttackLeaderboardEntry {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string | null;
  score: number;
  accuracy: number;
  streak: number;
  solvedCount: number;
  playerFlag?: string;
  updatedAt?: any;
}

/**
 * Fetch top 10 Time Attack scores from Firestore
 */
export async function fetchTopTimeAttackScores(limitCount = 10): Promise<TimeAttackLeaderboardEntry[]> {
  try {
    const q = query(
      collection(db, 'timeAttackLeaderboard'),
      orderBy('score', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const results: TimeAttackLeaderboardEntry[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      results.push({
        id: docSnap.id,
        userId: data.userId || docSnap.id,
        displayName: data.displayName || 'Pemain Kilat',
        photoURL: data.photoURL || null,
        score: Number(data.score) || 0,
        accuracy: Number(data.accuracy) || 0,
        streak: Number(data.streak) || 0,
        solvedCount: Number(data.solvedCount) || 0,
        playerFlag: data.playerFlag || '🇮🇩',
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
      });
    });
    return results;
  } catch (error) {
    console.error('Error fetching top time attack scores from Firestore:', error);
    throw error;
  }
}

/**
 * Submit or update a user's personal best Time Attack score to the global Firestore leaderboard
 */
export async function submitTimeAttackScore(entry: {
  userId: string;
  displayName: string;
  photoURL?: string | null;
  score: number;
  accuracy: number;
  streak: number;
  solvedCount: number;
  playerFlag?: string;
}): Promise<boolean> {
  if (!entry.userId || entry.score <= 0) return false;
  try {
    const leaderRef = doc(db, 'timeAttackLeaderboard', entry.userId);
    // Check if existing score is higher
    const snap = await getDoc(leaderRef);
    if (snap.exists()) {
      const existing = snap.data();
      if ((existing.score || 0) >= entry.score) {
        // Existing score is already higher or equal, keep the best!
        return false;
      }
    }
    await setDoc(leaderRef, {
      userId: entry.userId,
      displayName: entry.displayName || 'Pemain Kilat',
      photoURL: entry.photoURL || null,
      score: entry.score,
      accuracy: entry.accuracy,
      streak: entry.streak,
      solvedCount: entry.solvedCount,
      playerFlag: entry.playerFlag || '🇮🇩',
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error submitting time attack score to Firestore:', error);
    throw error;
  }
}

export { onAuthStateChanged, type User };
