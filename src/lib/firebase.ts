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

export interface SyncedGameData {
  progress: Record<number, UserLevelProgress>;
  stats: UserStats;
  dailyState: DailyChallengeUserState;
  dailyActivity: Record<string, DayAccuracyRecord>;
  updatedAt?: any;
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
 * Save user game state to Cloud Firestore
 */
export async function saveGameDataToCloud(
  userId: string,
  data: SyncedGameData
): Promise<void> {
  if (!userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        uid: userId,
        progress: data.progress,
        stats: data.stats,
        dailyState: data.dailyState,
        dailyActivity: data.dailyActivity,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
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
 * Intelligently merges local device progress with cloud progress:
 * - Unlocks level if either local or cloud has it unlocked
 * - Keeps maximum stars (1-3)
 * - Keeps highest score & fastest completion time
 * - Sums/maxes cumulative stats appropriately
 */
export function mergeGameProgress(
  local: SyncedGameData,
  cloud: SyncedGameData
): SyncedGameData {
  // 1. Merge Level Progress
  const mergedProgress: Record<number, UserLevelProgress> = { ...local.progress };
  if (cloud.progress) {
    Object.keys(cloud.progress).forEach((lvlStr) => {
      const lvl = Number(lvlStr);
      const cloudLvl = cloud.progress[lvl];
      const localLvl = mergedProgress[lvl];

      if (!localLvl) {
        mergedProgress[lvl] = cloudLvl;
      } else {
        mergedProgress[lvl] = {
          levelId: lvl,
          unlocked: localLvl.unlocked || cloudLvl.unlocked,
          stars: Math.max(localLvl.stars || 0, cloudLvl.stars || 0),
          bestScore: Math.max(localLvl.bestScore || 0, cloudLvl.bestScore || 0),
          accuracy: Math.max(localLvl.accuracy || 0, cloudLvl.accuracy || 0),
          bestTimeSec:
            localLvl.bestTimeSec > 0 && cloudLvl.bestTimeSec > 0
              ? Math.min(localLvl.bestTimeSec, cloudLvl.bestTimeSec)
              : localLvl.bestTimeSec || cloudLvl.bestTimeSec || 0,
        };
      }
    });
  }

  // 2. Merge Global Stats
  const mergedStats: UserStats = {
    totalSolved: Math.max(local.stats?.totalSolved || 0, cloud.stats?.totalSolved || 0),
    totalCorrect: Math.max(local.stats?.totalCorrect || 0, cloud.stats?.totalCorrect || 0),
    bestStreak: Math.max(local.stats?.bestStreak || 0, cloud.stats?.bestStreak || 0),
    totalTimePlayedSec: Math.max(
      local.stats?.totalTimePlayedSec || 0,
      cloud.stats?.totalTimePlayedSec || 0
    ),
    highestTimeAttackScore: Math.max(
      local.stats?.highestTimeAttackScore || 0,
      cloud.stats?.highestTimeAttackScore || 0
    ),
    highestSPM: Math.max(local.stats?.highestSPM || 0, cloud.stats?.highestSPM || 0),
    starsTotal: Math.max(local.stats?.starsTotal || 0, cloud.stats?.starsTotal || 0),
  };

  // 3. Merge Daily State (keep highest streak & combined history)
  const mergedDailyHistory = {
    ...(cloud.dailyState?.history || {}),
    ...(local.dailyState?.history || {}),
  };

  const lastCompletedDate =
    (local.dailyState?.lastCompletedDate || '') > (cloud.dailyState?.lastCompletedDate || '')
      ? local.dailyState?.lastCompletedDate || cloud.dailyState?.lastCompletedDate
      : cloud.dailyState?.lastCompletedDate || local.dailyState?.lastCompletedDate;

  const mergedDailyState: DailyChallengeUserState = {
    currentStreak: Math.max(local.dailyState?.currentStreak || 0, cloud.dailyState?.currentStreak || 0),
    bestStreak: Math.max(local.dailyState?.bestStreak || 0, cloud.dailyState?.bestStreak || 0),
    lastCompletedDate,
    playerName: local.dailyState?.playerName || cloud.dailyState?.playerName || 'Jago Hitung',
    playerCountry: local.dailyState?.playerCountry || cloud.dailyState?.playerCountry || 'ID',
    playerFlag: local.dailyState?.playerFlag || cloud.dailyState?.playerFlag || '🇮🇩',
    history: mergedDailyHistory,
  };

  // 4. Merge Daily Activity (accuracy tracker)
  const mergedDailyActivity: Record<string, DayAccuracyRecord> = {
    ...(cloud.dailyActivity || {}),
  };
  if (local.dailyActivity) {
    Object.keys(local.dailyActivity).forEach((dateKey) => {
      const locAct = local.dailyActivity[dateKey];
      const cldAct = mergedDailyActivity[dateKey];
      if (!cldAct) {
        mergedDailyActivity[dateKey] = locAct;
      } else {
        const total = Math.max(locAct.questionsTotal, cldAct.questionsTotal);
        const correct = Math.max(locAct.correctCount, cldAct.correctCount);
        mergedDailyActivity[dateKey] = {
          date: dateKey,
          questionsTotal: total,
          correctCount: correct,
          accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
        };
      }
    });
  }

  return {
    progress: mergedProgress,
    stats: mergedStats,
    dailyState: mergedDailyState,
    dailyActivity: mergedDailyActivity,
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
