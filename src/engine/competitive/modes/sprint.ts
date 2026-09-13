/**
 * Sprint 60s difficulty progression (PRD §15.3, Spec §3.1):
 * 1-5 correct: difficulty 1
 * 6-10 correct: difficulty 2
 * 11-15 correct: difficulty 3
 * 16-20 correct: difficulty 4
 * 21-25 correct: difficulty 5
 * 26+ correct: difficulty 6
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
