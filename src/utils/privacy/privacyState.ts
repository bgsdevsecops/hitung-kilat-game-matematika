import { AgeEligibility, PrivacyState } from '../../types';

export type { AgeEligibility, PrivacyState };

export const PRIVACY_STORAGE_KEY = 'hitung_kilat_privacy_v2';
export const CURRENT_POLICY_VERSION = '2.0.0';

export const DEFAULT_PRIVACY_STATE: PrivacyState = {
  schemaVersion: 2,
  policyVersion: CURRENT_POLICY_VERSION,
  ageEligibility: 'unspecified',
  analyticsConsent: false,
  leaderboardOptOut: false,
  pseudonym: 'Pemain Kilat',
  playerCountry: 'ID',
  playerFlag: '🇮🇩',
  accountEpoch: 1,
};

export function loadPrivacyState(): PrivacyState {
  if (typeof localStorage === 'undefined') return DEFAULT_PRIVACY_STATE;
  try {
    const raw = localStorage.getItem(PRIVACY_STORAGE_KEY);
    if (!raw) return DEFAULT_PRIVACY_STATE;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PRIVACY_STATE;
    return {
      ...DEFAULT_PRIVACY_STATE,
      ...parsed,
      schemaVersion: 2,
      policyVersion: CURRENT_POLICY_VERSION,
    };
  } catch {
    return DEFAULT_PRIVACY_STATE;
  }
}

export function savePrivacyState(patch: Partial<PrivacyState>): PrivacyState {
  const current = loadPrivacyState();
  const next: PrivacyState = {
    ...current,
    ...patch,
    schemaVersion: 2,
    policyVersion: CURRENT_POLICY_VERSION,
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to save privacy state', e);
    }
  }
  return next;
}

export function resetPrivacyState(): PrivacyState {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(PRIVACY_STORAGE_KEY);
    } catch {}
  }
  return DEFAULT_PRIVACY_STATE;
}
