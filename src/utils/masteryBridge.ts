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
  operation?: string;
  num1?: number;
  num2?: number;
  prompt?: string;
  displayPrompt?: string;
  text?: string;
}

/**
 * Infers a valid subSkillId from an answer log or question.
 * Fallback mechanism for Campaign and Time Attack questions that do not have explicit subSkillId.
 */
export function inferSubSkillId(item: GameAnswerLog | Question): string | undefined {
  const anyItem = item as any;

  // 1. If item.subSkillId is a non-empty string, return it
  if (typeof anyItem.subSkillId === 'string' && anyItem.subSkillId.trim().length > 0) {
    return anyItem.subSkillId.trim();
  }

  // 2. If item.primarySkillId contains a dot (e.g. 'multiplication.x7'), return it as subSkillId
  if (typeof anyItem.primarySkillId === 'string' && anyItem.primarySkillId.includes('.')) {
    return anyItem.primarySkillId.trim();
  }
  if (typeof anyItem.skillId === 'string' && anyItem.skillId.includes('.')) {
    return anyItem.skillId.trim();
  }

  // 3. Otherwise infer from operation (or op from prompt), num1, num2
  let op: string | undefined = anyItem.operation;
  let a: number | undefined = typeof anyItem.num1 === 'number' && !isNaN(anyItem.num1) ? anyItem.num1 : undefined;
  let b: number | undefined = typeof anyItem.num2 === 'number' && !isNaN(anyItem.num2) ? anyItem.num2 : undefined;

  const textPrompt = anyItem.prompt || anyItem.displayPrompt || anyItem.text;
  if (typeof textPrompt === 'string') {
    // If operands missing, attempt to extract from text prompt (e.g. "14 + 27", "7 × 8", "45 ÷ 5", "6 + ? = 14")
    const match = textPrompt.match(/(\d+)\s*([+\-−*×x/÷:])\s*(\d+)/);
    if (match) {
      if (!op) op = match[2];
      if (a === undefined) a = parseInt(match[1], 10);
      if (b === undefined) b = parseInt(match[3], 10);
    } else if (!op) {
      if (textPrompt.includes('+')) op = '+';
      else if (textPrompt.includes('-') || textPrompt.includes('−')) op = '-';
      else if (textPrompt.includes('*') || textPrompt.includes('×') || textPrompt.includes('x')) op = '*';
      else if (textPrompt.includes('/') || textPrompt.includes('÷') || textPrompt.includes(':')) op = '/';
    }
  }

  if (!op) {
    const skill = anyItem.primarySkillId || anyItem.skillId;
    if (skill === 'addition') op = '+';
    else if (skill === 'subtraction') op = '-';
    else if (skill === 'multiplication') op = '*';
    else if (skill === 'division') op = '/';
  }

  if (!op) return undefined;

  // Normalize operator symbols
  if (op === '−') op = '-';
  if (op === '×' || op === 'x') op = '*';
  if (op === '÷' || op === ':') op = '/';

  const numA = typeof a === 'number' ? Math.abs(a) : 0;
  const numB = typeof b === 'number' ? Math.abs(b) : 0;
  const maxOperand = Math.max(numA, numB);

  // Addition (Taxonomy: single_digit, within_20, tens, carry, hundreds):
  if (op === '+') {
    if (maxOperand <= 9) return 'addition.single_digit';
    if (maxOperand <= 20) return 'addition.within_20';
    if (numA > 0 && numB > 0 && numA % 10 === 0 && numB % 10 === 0 && maxOperand < 100) {
      return 'addition.tens';
    }
    if (maxOperand >= 100) return 'addition.hundreds';
    return 'addition.carry';
  }

  // Subtraction (Taxonomy: single_digit, within_20, tens, borrow, hundreds):
  if (op === '-') {
    if (maxOperand <= 9) return 'subtraction.single_digit';
    if (maxOperand <= 20) return 'subtraction.within_20';
    if (numA > 0 && numB > 0 && numA % 10 === 0 && numB % 10 === 0 && maxOperand < 100) {
      return 'subtraction.tens';
    }
    if (maxOperand >= 100) return 'subtraction.hundreds';
    return 'subtraction.borrow';
  }

  // Multiplication (Taxonomy: x2..x9, tens, 11_19):
  if (op === '*') {
    const hasA = typeof a === 'number';
    const hasB = typeof b === 'number';
    if (hasA && hasB) {
      if (numA === 10 || numB === 10 || (numA % 10 === 0 && numB % 10 === 0)) {
        return 'multiplication.tens';
      }
      if (numA <= 9 || numB <= 9) {
        const factor = Math.min(9, Math.max(2, Math.min(numA, numB)));
        return `multiplication.x${factor}`;
      }
      return 'multiplication.11_19';
    } else if (hasA || hasB) {
      const known = hasA ? numA : numB;
      if (known === 10 || known % 10 === 0) {
        return 'multiplication.tens';
      }
      if (known <= 9) {
        const factor = Math.min(9, Math.max(2, known));
        return `multiplication.x${factor}`;
      }
      return 'multiplication.11_19';
    }
    return 'multiplication.x2';
  }

  // Division:
  if (op === '/') {
    if (numB === 2 || numB === 3 || numB === 5) {
      return 'division.basic_235';
    }
    if (numB >= 4 && numB <= 9) {
      return 'division.x4_9_inverse';
    }
    return 'division.basic_235';
  }

  return undefined;
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
  const validAnswers: { item: GameAnswerLog | Question; subSkillId: string }[] = [];

  for (const a of answers) {
    const inferred = inferSubSkillId(a);
    if (inferred && inferred.trim().length > 0) {
      validAnswers.push({ item: a, subSkillId: inferred.trim() });
    }
  }

  if (validAnswers.length === 0) {
    return;
  }

  const now = Date.now();
  const events: StoredAnswerEvent[] = validAnswers.map(({ item: a, subSkillId }, idx) => {
    const item = a as GameAnswerLog & Partial<Question>;
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
