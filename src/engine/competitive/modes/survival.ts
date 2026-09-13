export const SURVIVAL_INITIAL_TIMER_MS = 60000;
export const SURVIVAL_MAX_TIMER_MS = 60000;
export const SURVIVAL_HARD_CAP_MS = 600000; // 10 minutes
export const SURVIVAL_CORRECT_ADDITION_MS = 2000;
export const SURVIVAL_WRONG_PENALTY_MS = 4000;
export const SURVIVAL_MAX_HEARTBEAT_GAP_MS = 10000;

/**
 * Survival difficulty: min(6, 1 + floor(correctCount / 5))
 */
export function getSurvivalDifficulty(correctCount: number): number {
  const c = Math.max(0, Math.floor(correctCount));
  return Math.min(6, 1 + Math.floor(c / 5));
}

/**
 * Applies time reward (+2s capped at 60s) or penalty (-4s floor at 0).
 */
export function applySurvivalTimerStep(currentTimerMs: number, isCorrect: boolean): number {
  if (isCorrect) {
    return Math.min(SURVIVAL_MAX_TIMER_MS, currentTimerMs + SURVIVAL_CORRECT_ADDITION_MS);
  }
  return Math.max(0, currentTimerMs - SURVIVAL_WRONG_PENALTY_MS);
}
