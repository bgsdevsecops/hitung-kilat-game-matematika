import { useState, useCallback, useRef } from 'react';
import { PrivacyState } from '../types';
import { loadPrivacyState, savePrivacyState } from '../utils/privacy/privacyState';
import { validatePseudonym, PseudonymValidationResult } from '../utils/privacy/pseudonymValidator';

export function usePrivacySettings(): {
  privacyState: PrivacyState;
  isAgeGateOpen: boolean;
  openAgeGate: () => void;
  closeAgeGate: () => void;
  confirmAge: (eligibility: 'under13' | '13plus') => void;
  updatePseudonym: (newName: string) => PseudonymValidationResult;
  updateCountryFlag: (country: string, flag: string) => void;
  toggleAnalyticsConsent: () => void;
  toggleLeaderboardOptOut: () => void;
  requestAgeProtectedAction: (action: () => void | Promise<void>, fallback?: () => void) => void;
} {
  const [privacyState, setPrivacyState] = useState<PrivacyState>(() => loadPrivacyState());
  const [isAgeGateOpen, setIsAgeGateOpen] = useState<boolean>(false);
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const pendingFallbackRef = useRef<(() => void) | null>(null);

  const confirmAge = useCallback((eligibility: 'under13' | '13plus') => {
    const updated = savePrivacyState({
      ageEligibility: eligibility,
      ageConfirmedAt: new Date().toISOString(),
    });
    setPrivacyState(updated);
    setIsAgeGateOpen(false);

    if (eligibility === '13plus' && pendingActionRef.current) {
      pendingActionRef.current();
    } else if (eligibility === 'under13' && pendingFallbackRef.current) {
      pendingFallbackRef.current();
    }

    pendingActionRef.current = null;
    pendingFallbackRef.current = null;
  }, []);

  const openAgeGate = useCallback(() => {
    setIsAgeGateOpen(true);
  }, []);

  const closeAgeGate = useCallback(() => {
    setIsAgeGateOpen(false);
    pendingActionRef.current = null;
    pendingFallbackRef.current = null;
  }, []);

  const requestAgeProtectedAction = useCallback(
    (action: () => void | Promise<void>, fallback?: () => void) => {
      if (privacyState.ageEligibility === '13plus') {
        action();
      } else if (privacyState.ageEligibility === 'under13') {
        if (fallback) fallback();
      } else {
        pendingActionRef.current = action;
        pendingFallbackRef.current = fallback || null;
        setIsAgeGateOpen(true);
      }
    },
    [privacyState.ageEligibility]
  );

  const updatePseudonym = useCallback(
    (candidate: string): PseudonymValidationResult => {
      const result = validatePseudonym(
        candidate,
        privacyState.lastPseudonymChangeTimestamp,
        privacyState.pseudonym
      );
      if (result.valid) {
        const updated = savePrivacyState({
          pseudonym: result.sanitized,
          lastPseudonymChangeTimestamp: Date.now(),
        });
        setPrivacyState(updated);
      }
      return result;
    },
    [privacyState.lastPseudonymChangeTimestamp, privacyState.pseudonym]
  );

  const updateCountryFlag = useCallback((country: string, flag: string) => {
    const updated = savePrivacyState({
      playerCountry: country,
      playerFlag: flag,
    });
    setPrivacyState(updated);
  }, []);

  const toggleAnalyticsConsent = useCallback(() => {
    const updated = savePrivacyState({
      analyticsConsent: !privacyState.analyticsConsent,
      analyticsConsentChangedAt: new Date().toISOString(),
    });
    setPrivacyState(updated);
  }, [privacyState.analyticsConsent]);

  const toggleLeaderboardOptOut = useCallback(() => {
    const updated = savePrivacyState({
      leaderboardOptOut: !privacyState.leaderboardOptOut,
      leaderboardOptOutChangedAt: new Date().toISOString(),
    });
    setPrivacyState(updated);
  }, [privacyState.leaderboardOptOut]);

  return {
    privacyState,
    isAgeGateOpen,
    openAgeGate,
    closeAgeGate,
    confirmAge,
    updatePseudonym,
    updateCountryFlag,
    toggleAnalyticsConsent,
    toggleLeaderboardOptOut,
    requestAgeProtectedAction,
  };
}
