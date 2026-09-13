export const DAILY_TARGET_DURATION_MS = 75000;
export const DAILY_HARD_DEADLINE_MS = 90000;
export const DAILY_QUESTION_COUNT = 10;
export const DAILY_TIMEZONE = 'Asia/Jakarta';

/**
 * challengeId format: YYYY-MM-DD@Asia/Jakarta:<dailyContentVersion>
 */
export function generateDailyChallengeId(dateStr: string, contentVersion: string): string {
  return `${dateStr}@${DAILY_TIMEZONE}:${contentVersion}`;
}

/**
 * Deterministic 32-bit positive integer seed from challengeId
 */
export function hashDailySeed(challengeId: string): number {
  let hash = 0;
  for (let i = 0; i < challengeId.length; i++) {
    const char = challengeId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}
