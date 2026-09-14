/**
 * Mastery Event Bridge Utility
 * Single point of answer event ingestion into MasteryStore across all game modes.
 * Maps difficulty to standard target response times (PRD §8.3.3) and filters valid subSkillId answers.
 */

import { createMasteryStore, MasteryStore, StoredAnswerEvent } from '../engine/mastery';
import { Question } from '../types';

let defaultStoreInstance: MasteryStore | null = null;

export function getMasteryStore(): MasteryStore {
  if (!defaultStoreInstance) {
    defaultStoreInstance = createMasteryStore();
  }
  return defaultStoreInstance;
}

export interface GameAnswerLog {
  questionId?: string;
  id?: string;
  subSkillId?: string;
  primarySkillId?: string;
  skillId?: string;
  skillTags?: string[];
  templateFamily?: string;
  isCorrect?: boolean;
  responseTimeMs?: number;
  timeSpentMs?: number;
  difficulty?: number;
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
  answers: (GameAnswerLog | Question)[],
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
    const item = a as GameAnswerLog & Partial<Question>;
    const subSkillId = item.subSkillId!.trim();
    const primarySkillId = item.primarySkillId || item.skillId || subSkillId.split('.')[0] || 'arithmetic';
    const templateFamily = item.templateFamily || `${primarySkillId}_family`;
    const difficulty = Math.max(1, Math.min(6, item.difficulty || 1));
    const targetResponseTimeMs = getTargetResponseTimeMs(difficulty);
    const salt = Math.random().toString(36).substring(2, 8);
    const rawTime = item.responseTimeMs ?? item.timeSpentMs;
    const isCorrect = Boolean(item.isCorrect);

    return {
      eventId: `evt_${now}_${idx}_${salt}`,
      sessionId,
      questionDefinitionId: item.questionId || item.id || `q_${idx}`,
      primarySkillId,
      subSkillId,
      skillTags: item.skillTags || [primarySkillId, subSkillId],
      templateFamily,
      difficulty,
      targetResponseTimeMs,
      responseTimeMs: Math.max(10, Math.round(Number(rawTime) || 10)),
      isCorrect,
      timestamp: now,
    };
  });

  store.recordEvents(events, now);
}
