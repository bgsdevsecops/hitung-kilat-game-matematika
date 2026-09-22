// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrivacySettings } from '../../src/hooks/usePrivacySettings';

describe('usePrivacySettings hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides safe initial defaults and opens age gate for unspecified users', () => {
    const { result } = renderHook(() => usePrivacySettings());
    expect(result.current.privacyState.ageEligibility).toBe('unspecified');
    expect(result.current.isAgeGateOpen).toBe(false);

    const targetAction = vi.fn();
    act(() => {
      result.current.requestAgeProtectedAction(targetAction);
    });

    expect(result.current.isAgeGateOpen).toBe(true);
    expect(targetAction).not.toHaveBeenCalled();
  });

  it('permits protected action immediately if already 13plus', () => {
    const { result } = renderHook(() => usePrivacySettings());
    act(() => {
      result.current.confirmAge('13plus');
    });

    const targetAction = vi.fn();
    act(() => {
      result.current.requestAgeProtectedAction(targetAction);
    });

    expect(result.current.isAgeGateOpen).toBe(false);
    expect(targetAction).toHaveBeenCalledTimes(1);
  });

  it('triggers fallback and blocks protected action if under13', () => {
    const { result } = renderHook(() => usePrivacySettings());
    act(() => {
      result.current.confirmAge('under13');
    });

    const targetAction = vi.fn();
    const fallbackAction = vi.fn();
    act(() => {
      result.current.requestAgeProtectedAction(targetAction, fallbackAction);
    });

    expect(result.current.isAgeGateOpen).toBe(false);
    expect(targetAction).not.toHaveBeenCalled();
    expect(fallbackAction).toHaveBeenCalledTimes(1);
  });

  it('executes pending action when unspecified user confirms 13plus after age gate prompt', () => {
    const { result } = renderHook(() => usePrivacySettings());
    const targetAction = vi.fn();

    act(() => {
      result.current.requestAgeProtectedAction(targetAction);
    });

    expect(result.current.isAgeGateOpen).toBe(true);
    expect(targetAction).not.toHaveBeenCalled();

    act(() => {
      result.current.confirmAge('13plus');
    });

    expect(result.current.isAgeGateOpen).toBe(false);
    expect(result.current.privacyState.ageEligibility).toBe('13plus');
    expect(targetAction).toHaveBeenCalledTimes(1);
  });

  it('executes pending fallback when unspecified user confirms under13 after age gate prompt', () => {
    const { result } = renderHook(() => usePrivacySettings());
    const targetAction = vi.fn();
    const fallbackAction = vi.fn();

    act(() => {
      result.current.requestAgeProtectedAction(targetAction, fallbackAction);
    });

    expect(result.current.isAgeGateOpen).toBe(true);

    act(() => {
      result.current.confirmAge('under13');
    });

    expect(result.current.isAgeGateOpen).toBe(false);
    expect(result.current.privacyState.ageEligibility).toBe('under13');
    expect(targetAction).not.toHaveBeenCalled();
    expect(fallbackAction).toHaveBeenCalledTimes(1);
  });

  it('allows manual openAgeGate and closeAgeGate, clearing pending actions on close', () => {
    const { result } = renderHook(() => usePrivacySettings());
    const targetAction = vi.fn();

    act(() => {
      result.current.requestAgeProtectedAction(targetAction);
    });
    expect(result.current.isAgeGateOpen).toBe(true);

    act(() => {
      result.current.closeAgeGate();
    });
    expect(result.current.isAgeGateOpen).toBe(false);

    // Later confirming age should not trigger the old pending action
    act(() => {
      result.current.confirmAge('13plus');
    });
    expect(targetAction).not.toHaveBeenCalled();

    act(() => {
      result.current.openAgeGate();
    });
    expect(result.current.isAgeGateOpen).toBe(true);
  });

  it('validates and updates pseudonym correctly', () => {
    const { result } = renderHook(() => usePrivacySettings());

    act(() => {
      const res = result.current.updatePseudonym('Alpha-Numeric_1');
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe('Alpha-Numeric_1');
    });

    expect(result.current.privacyState.pseudonym).toBe('Alpha-Numeric_1');
    expect(result.current.privacyState.lastPseudonymChangeTimestamp).toBeTypeOf('number');

    // Invalid pseudonym with profanity
    act(() => {
      const res = result.current.updatePseudonym('anjing');
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    });

    // Should retain previous pseudonym
    expect(result.current.privacyState.pseudonym).toBe('Alpha-Numeric_1');
  });

  it('updates country flag in privacy state', () => {
    const { result } = renderHook(() => usePrivacySettings());

    act(() => {
      result.current.updateCountryFlag('MY', '🇲🇾');
    });

    expect(result.current.privacyState.playerCountry).toBe('MY');
    expect(result.current.privacyState.playerFlag).toBe('🇲🇾');
  });

  it('toggles analytics consent and tracks change timestamp', () => {
    const { result } = renderHook(() => usePrivacySettings());
    expect(result.current.privacyState.analyticsConsent).toBe(false);

    act(() => {
      result.current.toggleAnalyticsConsent();
    });

    expect(result.current.privacyState.analyticsConsent).toBe(true);
    expect(result.current.privacyState.analyticsConsentChangedAt).toBeDefined();

    act(() => {
      result.current.toggleAnalyticsConsent();
    });

    expect(result.current.privacyState.analyticsConsent).toBe(false);
  });

  it('toggles leaderboard opt-out and tracks change timestamp', () => {
    const { result } = renderHook(() => usePrivacySettings());
    expect(result.current.privacyState.leaderboardOptOut).toBe(false);

    act(() => {
      result.current.toggleLeaderboardOptOut();
    });

    expect(result.current.privacyState.leaderboardOptOut).toBe(true);
    expect(result.current.privacyState.leaderboardOptOutChangedAt).toBeDefined();

    act(() => {
      result.current.toggleLeaderboardOptOut();
    });

    expect(result.current.privacyState.leaderboardOptOut).toBe(false);
  });
});
