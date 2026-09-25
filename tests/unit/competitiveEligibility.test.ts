import { describe, it, expect } from 'vitest';
import { evaluateCompetitiveEligibility } from '../../src/lib/competitiveEligibility';

describe('evaluateCompetitiveEligibility', () => {
  it('forces practice mode for under13 regardless of other flags', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: 'under13',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: true,
    });
    expect(res.isEligibleForRanked).toBe(false);
    expect(res.executionMode).toBe('practice');
    expect(res.reason).toBe('under13');
  });

  it('marks unspecified age as not eligible for ranked', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: 'unspecified',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: true,
    });
    expect(res.isEligibleForRanked).toBe(false);
    expect(res.executionMode).toBe('practice');
    expect(res.reason).toBe('unspecified_age');
  });

  it('forces practice for guest users even if 13+', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: true,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: true,
    });
    expect(res.isEligibleForRanked).toBe(false);
    expect(res.executionMode).toBe('practice');
    expect(res.reason).toBe('guest');
  });

  it('forces practice for opt-out users even if authenticated 13+', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: true,
      featureFlagEnabled: true,
    });
    expect(res.isEligibleForRanked).toBe(false);
    expect(res.executionMode).toBe('practice');
    expect(res.reason).toBe('leaderboard_opt_out');
  });

  it('forces practice if feature flag is disabled', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: false,
    });
    expect(res.isEligibleForRanked).toBe(false);
    expect(res.executionMode).toBe('practice');
    expect(res.reason).toBe('flag_disabled');
  });

  it('forces practice if unauthenticated', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: false,
      leaderboardOptOut: false,
      featureFlagEnabled: true,
    });
    expect(res.isEligibleForRanked).toBe(false);
    expect(res.executionMode).toBe('practice');
    expect(res.reason).toBe('unauthenticated');
  });

  it('allows ranked mode for authenticated 13+ with flag enabled and not opted out', () => {
    const res = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: true,
    });
    expect(res.isEligibleForRanked).toBe(true);
    expect(res.executionMode).toBe('ranked');
    expect(res.reason).toBeUndefined();
  });
});
