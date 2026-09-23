// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getFirebaseConfig, FirebaseAppletConfig } from '../../src/lib/firebaseConfigLoader';
import fallbackConfig from '../../firebase-applet-config.json';

describe('firebaseConfigLoader', () => {
  const originalWindowConfig = window.__FIREBASE_CONFIG__;

  beforeEach(() => {
    delete (window as any).__FIREBASE_CONFIG__;
  });

  afterEach(() => {
    (window as any).__FIREBASE_CONFIG__ = originalWindowConfig;
  });

  it('falls back to local firebase-applet-config.json when window.__FIREBASE_CONFIG__ is undefined', () => {
    const config = getFirebaseConfig();
    expect(config.projectId).toBe(fallbackConfig.projectId);
    expect(config.appId).toBe(fallbackConfig.appId);
    expect(config.apiKey).toBe(fallbackConfig.apiKey);
  });

  it('uses window.__FIREBASE_CONFIG__ when provided', () => {
    const mockProdConfig: FirebaseAppletConfig = {
      projectId: 'prod-hitung-kilat-app',
      appId: '1:123456789:web:abcdef123456',
      apiKey: 'AIzaSyPROD_MOCK_KEY_999999',
      authDomain: 'prod-hitung-kilat-app.firebaseapp.com',
      firestoreDatabaseId: 'prod-db-hitung-kilat',
      storageBucket: 'prod-hitung-kilat-app.firebasestorage.app',
      messagingSenderId: '123456789',
    };

    (window as any).__FIREBASE_CONFIG__ = mockProdConfig;

    const config = getFirebaseConfig();
    expect(config.projectId).toBe('prod-hitung-kilat-app');
    expect(config.apiKey).toBe('AIzaSyPROD_MOCK_KEY_999999');
    expect(config.firestoreDatabaseId).toBe('prod-db-hitung-kilat');
  });

  it('falls back to local config if window.__FIREBASE_CONFIG__ is empty or lacks projectId', () => {
    (window as any).__FIREBASE_CONFIG__ = {} as any;
    const config = getFirebaseConfig();
    expect(config.projectId).toBe(fallbackConfig.projectId);
  });

  it('falls back to local config if window.__FIREBASE_CONFIG__.projectId is whitespace only', () => {
    (window as any).__FIREBASE_CONFIG__ = { projectId: '   ', apiKey: 'valid-key' } as any;
    const config = getFirebaseConfig();
    expect(config.projectId).toBe(fallbackConfig.projectId);
  });

  it('falls back to local config if window.__FIREBASE_CONFIG__ lacks or has empty apiKey', () => {
    (window as any).__FIREBASE_CONFIG__ = { projectId: 'valid-id' } as any;
    const config1 = getFirebaseConfig();
    expect(config1.projectId).toBe(fallbackConfig.projectId);

    (window as any).__FIREBASE_CONFIG__ = { projectId: 'valid-id', apiKey: '   ' } as any;
    const config2 = getFirebaseConfig();
    expect(config2.projectId).toBe(fallbackConfig.projectId);
  });
});
