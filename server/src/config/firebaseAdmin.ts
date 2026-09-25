import { initializeApp, getApps, applicationDefault, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { logger } from '../utils/logger.js';

let appInstance: App | null = null;

export function initializeFirebaseAdmin(): App {
  if (appInstance) return appInstance;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    appInstance = existingApps[0];
    return appInstance;
  }

  try {
    appInstance = initializeApp({
      credential: applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID,
    });
    logger.info('firebase_admin_initialized', {
      projectId: appInstance.options.projectId ?? 'auto-detected',
    });
    return appInstance;
  } catch (err: any) {
    logger.error('firebase_admin_init_failed', { error: err?.message });
    throw new Error(`Failed to initialize Firebase Admin SDK: ${err?.message}`);
  }
}

export function getAdminAuth(): Auth {
  const app = appInstance ?? initializeFirebaseAdmin();
  return getAuth(app);
}

export function getAdminFirestore(): Firestore {
  const app = appInstance ?? initializeFirebaseAdmin();
  return getFirestore(app);
}
