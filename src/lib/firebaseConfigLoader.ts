/**
 * Firebase Runtime Configuration Loader
 * Decouples production credentials from repository artifacts.
 */
import fallbackConfig from '../../firebase-applet-config.json';

export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: FirebaseAppletConfig;
  }
}

/**
 * Retrieves the effective Firebase configuration.
 * Prioritizes window.__FIREBASE_CONFIG__ (injected at runtime in production container).
 * Falls back to local firebase-applet-config.json for local development and testing.
 */
export function getFirebaseConfig(): FirebaseAppletConfig {
  if (
    typeof window !== 'undefined' &&
    window.__FIREBASE_CONFIG__ &&
    typeof window.__FIREBASE_CONFIG__.projectId === 'string' &&
    window.__FIREBASE_CONFIG__.projectId.trim().length > 0
  ) {
    return window.__FIREBASE_CONFIG__;
  }

  return fallbackConfig as FirebaseAppletConfig;
}
