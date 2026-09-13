import { CompetitiveResultDoc } from './types';

/**
 * Implements exact integer rounding: floor((2n + d) / (2d)) for non-negative integers.
 */
export function roundHalfUp(n: number, d: number): number {
  if (d <= 0) return 0;
  if (n <= 0) return 0;
  return Math.floor((2 * n + d) / (2 * d));
}

/**
 * Sprint points calculation:
 * basePoints = 100 + 25 * (difficulty - 1)
 * comboTenths = min(30, 10 + currentStreak - 1)
 * points = roundHalfUp(basePoints * comboTenths, 10)
 */
export function calculateSprintScore(difficulty: number, currentStreak: number): number {
  const d = Math.max(1, Math.min(6, Math.floor(difficulty)));
  const basePoints = 100 + 25 * (d - 1);
  const streak = Math.max(1, Math.floor(currentStreak));
  const comboTenths = Math.min(30, 10 + streak - 1);
  return roundHalfUp(basePoints * comboTenths, 10);
}

/**
 * Daily Challenge scoring:
 * base = correctCount * 120
 * streakBonus = min(300, maxStreak * 30)
 * speedBonus = roundHalfUp(max(0, 75000 - durationMs) * 800 * correctCount, 750000)
 * perfectBonus = (correctCount === 10) ? 200 : 0
 */
export function calculateDailyScore(
  correctCount: number,
  maxStreak: number,
  activeDurationMs: number
): { score: number; base: number; streakBonus: number; speedBonus: number; perfectBonus: number } {
  const c = Math.max(0, Math.min(10, Math.floor(correctCount)));
  const s = Math.max(0, Math.floor(maxStreak));
  const dur = Math.max(0, Math.floor(activeDurationMs));

  const base = c * 120;
  const streakBonus = Math.min(300, s * 30);
  const speedNum = Math.max(0, 75000 - dur) * 800 * c;
  const speedBonus = roundHalfUp(speedNum, 750000);
  const perfectBonus = c === 10 ? 200 : 0;
  const score = base + streakBonus + speedBonus + perfectBonus;

  return { score, base, streakBonus, speedBonus, perfectBonus };
}

/**
 * Exact cross-multiplication fraction comparator: c1/a1 vs c2/a2.
 * Returns > 0 if a > b, < 0 if a < b, 0 if equal.
 */
function compareAccuracyFraction(
  c1: number,
  a1: number,
  c2: number,
  a2: number
): number {
  if (a1 === 0 && a2 === 0) return 0;
  if (a1 === 0) return -1;
  if (a2 === 0) return 1;
  return c1 * a2 - c2 * a1;
}

/**
 * Sprint Comparator:
 * score DESC -> accuracy DESC -> correctCount DESC -> wrongCount ASC -> finalizedAt ASC -> resultId ASC
 */
export function compareSprintRecords(a: CompetitiveResultDoc, b: CompetitiveResultDoc): number {
  if (a.score !== b.score) return b.score - a.score;
  const accComp = compareAccuracyFraction(
    b.correctCount,
    b.questionsAnswered,
    a.correctCount,
    a.questionsAnswered
  );
  if (accComp !== 0) return accComp;
  if (a.correctCount !== b.correctCount) return b.correctCount - a.correctCount;
  if (a.wrongCount !== b.wrongCount) return a.wrongCount - b.wrongCount;
  if (a.finalizedAt !== b.finalizedAt) return a.finalizedAt - b.finalizedAt;
  return a.resultId.localeCompare(b.resultId);
}

/**
 * Survival Comparator:
 * score DESC -> survivalDurationMs DESC -> accuracy DESC -> finalizedAt ASC -> resultId ASC
 */
export function compareSurvivalRecords(a: CompetitiveResultDoc, b: CompetitiveResultDoc): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.rankedActiveDurationMs !== b.rankedActiveDurationMs) {
    return b.rankedActiveDurationMs - a.rankedActiveDurationMs;
  }
  const accComp = compareAccuracyFraction(
    b.correctCount,
    b.questionsAnswered,
    a.correctCount,
    a.questionsAnswered
  );
  if (accComp !== 0) return accComp;
  if (a.finalizedAt !== b.finalizedAt) return a.finalizedAt - b.finalizedAt;
  return a.resultId.localeCompare(b.resultId);
}

/**
 * Daily Comparator:
 * score DESC -> correctCount DESC -> rankedActiveDurationMs ASC -> finalizedAt ASC -> resultId ASC
 */
export function compareDailyRecords(a: CompetitiveResultDoc, b: CompetitiveResultDoc): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.correctCount !== b.correctCount) return b.correctCount - a.correctCount;
  if (a.rankedActiveDurationMs !== b.rankedActiveDurationMs) {
    return a.rankedActiveDurationMs - b.rankedActiveDurationMs;
  }
  if (a.finalizedAt !== b.finalizedAt) return a.finalizedAt - b.finalizedAt;
  return a.resultId.localeCompare(b.resultId);
}
