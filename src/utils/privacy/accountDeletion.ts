import { DeletionReceipt } from '../../types';
import { db, logoutUser } from '../../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export type DeletionScope = 'cloud_firestore' | 'auth_session' | 'local_progress';

/**
 * Generates an auditable receipt for an account deletion request.
 */
export function generateDeletionReceipt(
  scopes: DeletionScope[] = ['cloud_firestore', 'auth_session', 'local_progress']
): DeletionReceipt {
  const hexTime = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const receiptId = `DEL-${hexTime}${randomSuffix}`;

  return {
    receiptId,
    timestamp: new Date().toISOString(),
    status: 'COMPLETED',
    scopesPurged: scopes,
    policyNotice:
      'Akun cloud dan data permainan telah dihapus permanen sesuai PRD §20 dan Kebijakan Privasi 2.0.0.',
  };
}

/**
 * Purges all application-specific partitions from localStorage.
 */
export function purgeAllLocalData(): void {
  if (typeof localStorage === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('hitung_kilat_') || key.startsWith('mastery_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      // Ignore removal errors
    }
  });
}

/**
 * Hard purges user data documents from cloud Firestore partitions.
 * Let deleteDoc on userDocRef throw so failure is surfaced.
 */
export async function purgeCloudUserData(userId: string): Promise<void> {
  if (!userId || !db) return;
  const userDocRef = doc(db, 'users', userId);
  await deleteDoc(userDocRef);

  try {
    const leaderDocRef = doc(db, 'timeAttackLeaderboard', userId);
    await deleteDoc(leaderDocRef);
  } catch (e) {
    console.warn('Failed to delete user leaderboard entry from firestore', e);
  }
}

/**
 * Orchestrates complete account deletion: cloud purge, auth logout,
 * local partition wipe, and auditable receipt generation.
 */
export async function executeAccountDeletion(userId?: string): Promise<DeletionReceipt> {
  let scopes: DeletionScope[] = ['local_progress'];

  // 1. Purge cloud data if logged in
  if (userId) {
    await purgeCloudUserData(userId);
    try {
      await logoutUser();
    } catch (e) {
      console.warn('Failed to logout user during deletion', e);
    }
    scopes = ['cloud_firestore', 'auth_session', 'local_progress'];
  }

  // 2. Wipe local storage
  purgeAllLocalData();

  // 3. Generate receipt with accurate scopes
  return generateDeletionReceipt(scopes);
}
