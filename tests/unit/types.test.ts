import { describe, it, expect } from 'vitest';
import '../../src/engine/types';
import {
  AnswerSpec,
  GeneratorRule,
  LevelConfigV2,
  SessionState,
} from '../../src/engine/types';

describe('Core Domain Types', () => {
  it('instantiates valid AnswerSpec variants', () => {
    const intAnswer: AnswerSpec = { kind: 'integer', value: 42 };
    const rationalAnswer: AnswerSpec = { kind: 'rational', numerator: 3, denominator: 4 };
    const decimalAnswer: AnswerSpec = { kind: 'decimal', scaledValue: 250, scale: 2 };
    const choiceAnswer: AnswerSpec = { kind: 'choice', optionId: 'opt-1', options: [{ id: 'opt-1', label: '10' }] };

    expect(intAnswer.kind).toBe('integer');
    expect(rationalAnswer.kind).toBe('rational');
    expect(decimalAnswer.kind).toBe('decimal');
    expect(choiceAnswer.kind).toBe('choice');
  });

  it('instantiates valid GeneratorRule variants', () => {
    const addRule: GeneratorRule = {
      kind: 'addition',
      minA: 1,
      maxA: 10,
      minB: 1,
      maxB: 10,
    };
    expect(addRule.kind).toBe('addition');
  });

  it('instantiates valid LevelConfigV2', () => {
    const level: LevelConfigV2 = {
      id: 'T1-ADD-01',
      order: 1,
      tier: 1,
      title: 'Penjumlahan Dasar',
      description: 'Latihan penjumlahan bilangan kecil',
      generatorKey: 'addition',
      rules: { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
      answerKind: 'integer',
      difficulty: 1,
      questionCount: 10,
      targetTimeSec: 30,
      timeLimitSec: 60,
      boss: false,
      passingAccuracy: 0.8,
      prerequisiteIds: [],
      primarySkillId: 'add.basic',
      skillTags: ['addition'],
      contentVersion: '1.0.0',
    };
    expect(level.id).toBe('T1-ADD-01');
  });

  it('instantiates valid SessionState', () => {
    const session: SessionState = {
      sessionId: 'sess-123',
      lifecycle: 'ACTIVE',
      levelId: 'T1-ADD-01',
      questions: [],
      currentIndex: 0,
      score: 0,
      streak: 0,
      maxStreak: 0,
      inputLocked: false,
      answerHistory: [],
      startedAtMonotonic: 1000,
      deadlineMonotonic: 61000,
      lastFeedback: null,
      result: null,
    };
    expect(session.lifecycle).toBe('ACTIVE');
  });
});
