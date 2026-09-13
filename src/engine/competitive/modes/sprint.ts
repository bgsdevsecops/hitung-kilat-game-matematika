/**
 * Sprint 60s difficulty progression:
 * 1-5 correct: difficulty 1 (0 to 4 correct -> 1)
 * 6-10 correct: difficulty 2 (5 to 9 correct -> 2)
 * 11-15 correct: difficulty 3 (10 to 14 correct -> 3)
 * 16-20 correct: difficulty 4 (15 to 19 correct -> 4)
 * 21-25 correct: difficulty 5 (20 to 24 correct -> 5)
 * 26+ correct: difficulty 6 (25+ correct -> 6)
 */
export function getSprintDifficulty(correctCount: number): number {
  const c = Math.max(0, Math.floor(correctCount));
  if (c < 5) return 1;
  if (c < 10) return 2;
  if (c < 15) return 3;
  if (c < 20) return 4;
  if (c < 25) return 5;
  return 6;
}

export const SPRINT_DEADLINE_MS = 60000;
