import { AgeEligibility } from '../types';

export type CompetitiveIneligibilityReason =
  | 'under13'
  | 'unspecified_age'
  | 'guest'
  | 'leaderboard_opt_out'
  | 'flag_disabled'
  | 'unauthenticated';

export interface CompetitiveEligibilityResult {
  isEligibleForRanked: boolean;
  reason?: CompetitiveIneligibilityReason;
  executionMode: 'ranked' | 'practice';
}

export function evaluateCompetitiveEligibility(params: {
  ageEligibility: AgeEligibility;
  isGuest: boolean;
  isAuthenticated: boolean;
  leaderboardOptOut: boolean;
  featureFlagEnabled: boolean;
}): CompetitiveEligibilityResult {
  const { ageEligibility, isGuest, isAuthenticated, leaderboardOptOut, featureFlagEnabled } = params;

  if (ageEligibility === 'under13') {
    return { isEligibleForRanked: false, reason: 'under13', executionMode: 'practice' };
  }

  if (ageEligibility === 'unspecified') {
    return { isEligibleForRanked: false, reason: 'unspecified_age', executionMode: 'practice' };
  }

  if (!featureFlagEnabled) {
    return { isEligibleForRanked: false, reason: 'flag_disabled', executionMode: 'practice' };
  }

  if (!isAuthenticated) {
    return { isEligibleForRanked: false, reason: 'unauthenticated', executionMode: 'practice' };
  }

  if (isGuest) {
    return { isEligibleForRanked: false, reason: 'guest', executionMode: 'practice' };
  }

  if (leaderboardOptOut) {
    return { isEligibleForRanked: false, reason: 'leaderboard_opt_out', executionMode: 'practice' };
  }

  return { isEligibleForRanked: true, executionMode: 'ranked' };
}
