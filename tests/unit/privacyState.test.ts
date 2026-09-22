// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadPrivacyState,
  savePrivacyState,
  resetPrivacyState,
  DEFAULT_PRIVACY_STATE,
  PRIVACY_STORAGE_KEY,
} from '../../src/utils/privacy/privacyState';

describe('privacyState persistence engine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads safe defaults when localStorage is empty', () => {
    const state = loadPrivacyState();
    expect(state).toEqual(DEFAULT_PRIVACY_STATE);
    expect(state.ageEligibility).toBe('unspecified');
    expect(state.analyticsConsent).toBe(false);
    expect(state.leaderboardOptOut).toBe(false);
    expect(state.pseudonym).toBe('Pemain Kilat');
  });

  it('saves partial updates and persists to localStorage', () => {
    const updated = savePrivacyState({
      ageEligibility: '13plus',
      analyticsConsent: true,
      pseudonym: 'BintangKilat',
    });
    expect(updated.ageEligibility).toBe('13plus');
    expect(updated.analyticsConsent).toBe(true);
    expect(updated.pseudonym).toBe('BintangKilat');

    const reloaded = loadPrivacyState();
    expect(reloaded.ageEligibility).toBe('13plus');
    expect(reloaded.analyticsConsent).toBe(true);
    expect(reloaded.pseudonym).toBe('BintangKilat');
  });

  it('recovers gracefully from corrupted JSON in localStorage', () => {
    localStorage.setItem(PRIVACY_STORAGE_KEY, 'invalid json {[');
    const state = loadPrivacyState();
    expect(state).toEqual(DEFAULT_PRIVACY_STATE);
  });

  it('recovers gracefully from non-object JSON values', () => {
    localStorage.setItem(PRIVACY_STORAGE_KEY, '123');
    expect(loadPrivacyState()).toEqual(DEFAULT_PRIVACY_STATE);

    localStorage.setItem(PRIVACY_STORAGE_KEY, '"just a string"');
    expect(loadPrivacyState()).toEqual(DEFAULT_PRIVACY_STATE);
  });

  it('handles localStorage exceptions during save and reset gracefully', () => {
    const originalSetItem = localStorage.setItem;
    const originalRemoveItem = localStorage.removeItem;

    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const result = savePrivacyState({ pseudonym: 'OfflinePlayer' });
    expect(result.pseudonym).toBe('OfflinePlayer');

    localStorage.removeItem = () => {
      throw new Error('SecurityError');
    };
    const reset = resetPrivacyState();
    expect(reset).toEqual(DEFAULT_PRIVACY_STATE);

    localStorage.setItem = originalSetItem;
    localStorage.removeItem = originalRemoveItem;
  });

  it('resets privacy state to safe defaults', () => {
    savePrivacyState({ ageEligibility: 'under13', pseudonym: 'AnakHebat' });
    const reset = resetPrivacyState();
    expect(reset.ageEligibility).toBe('unspecified');
    expect(reset.pseudonym).toBe('Pemain Kilat');
    expect(loadPrivacyState()).toEqual(DEFAULT_PRIVACY_STATE);
  });
});
