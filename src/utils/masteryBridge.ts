/**
 * Mastery Event Bridge Utility
 * Single point of answer event ingestion into MasteryStore across all game modes.
 * Maps difficulty to standard target response times (PRD §8.3.3) and filters valid subSkillId answers.
 */

import { createMasteryStore, MasteryStore, StoredAnswerEvent } from '../engine/mastery';

let defaultStoreInstance: MasteryStore | null = null;

export function getMasteryStore(): MasteryStore {
  if (!defaultStoreInstance) {
    defaultStoreInstance = createMasteryStore();
  }
  return defaultStoreInstance;
}

export interface GameAnswerLog {
  questionId: string;
  subSkillId?: string;
  primarySkillId?: string;
  skillTags?: string[];
  templateFamily?: string;
  isCorrect: boolean;
  responseTimeMs: number;
  difficulty: number;
}

const TARGET_RESPONSE_TIMES: Record<number, number> = {
  1: 2500,
  2: 3000,
  3: 3500,
  4: 4000,
  5: 5000,
  6: 6000,
};

export function getTargetResponseTimeMs(difficulty: number): number {
  return TARGET_RESPONSE_TIMES[difficulty] ?? 3500;
}

export function ingestGameAnswers(
  sessionId: string,
  userId: string,
  answers: GameAnswerLog[],
  customStore?: MasteryStore
): void {
  const store = customStore ?? getMasteryStore();
  const validAnswers = answers.filter(
    (a) => typeof a.subSkillId === 'string' && a.subSkillId.trim().length > 0
  );

  if (validAnswers.length === 0) {
    return;
  }

  const now = Date.now();
  const events: StoredAnswerEvent[] = validAnswers.map((a, idx) => {
    const subSkillId = a.subSkillId!.trim();
    const primarySkillId = a.primarySkillId || subSkillId.split('.')[0] || 'arithmetic';
    const templateFamily = a.templateFamily || `${primarySkillId}_family`;
    const difficulty = Math.max(1, Math.min(6, a.difficulty || 1));
    const targetResponseTimeMs = getTargetResponseTimeMs(difficulty);
    const salt = Math.random().toString(36).substring(2, 8);

    return {
      eventId: `evt_${now}_${idx}_${salt}`,
      sessionId,
      questionDefinitionId: a.questionId,
      primarySkillId,
      subSkillId,
      skillTags: a.skillTags || [primarySkillId, subSkillId],
      templateFamily,
      difficulty,
      targetResponseTimeMs,
      responseTimeMs: Math.max(10, Math.round(Number(a.responseTimeMs) || 10)),
      isCorrect: Boolean(a.isCorrect),
      timestamp: now,
    };
  });

  store.recordEvents(events, now);
}
