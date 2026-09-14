// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ingestGameAnswers,
  getTargetResponseTimeMs,
  getMasteryStore,
  GameAnswerLog,
} from '../../src/utils/masteryBridge';
import { createMasteryStore } from '../../src/engine/mastery';

describe('Mastery Bridge Utility', () => {
  beforeEach(() => {
    localStorage.clear();
    getMasteryStore().clear();
  });

  it('maps difficulty to correct target response times according to PRD §8.3.3', () => {
    expect(getTargetResponseTimeMs(1)).toBe(2500);
    expect(getTargetResponseTimeMs(2)).toBe(3000);
    expect(getTargetResponseTimeMs(3)).toBe(3500);
    expect(getTargetResponseTimeMs(4)).toBe(4000);
    expect(getTargetResponseTimeMs(5)).toBe(5000);
    expect(getTargetResponseTimeMs(6)).toBe(6000);
    expect(getTargetResponseTimeMs(99)).toBe(3500); // default fallback
  });

  it('ingests valid answers with subSkillId and ignores answers without subSkillId', () => {
    const store = createMasteryStore();
    const answers: GameAnswerLog[] = [
      {
        questionId: 'q1',
        subSkillId: 'multiplication.x7',
        primarySkillId: 'multiplication',
        skillTags: ['multiplication', 'multiplication.x7'],
        isCorrect: true,
        responseTimeMs: 2400,
        difficulty: 3,
      },
      {
        questionId: 'q2',
        // subSkillId missing
        isCorrect: false,
        responseTimeMs: 3800,
        difficulty: 2,
      },
      {
        questionId: 'q3',
        subSkillId: 'addition.carry',
        isCorrect: false,
        responseTimeMs: 4100,
        difficulty: 3,
      },
    ];

    ingestGameAnswers('sess_123', 'user_abc', answers, store);

    const allEvents = store.getAllEvents();
    expect(allEvents.length).toBe(2);

    const multEvents = store.getEventsForSubSkill('multiplication.x7');
    expect(multEvents.length).toBe(1);
    expect(multEvents[0].isCorrect).toBe(true);
    expect(multEvents[0].responseTimeMs).toBe(2400);
    expect(multEvents[0].targetResponseTimeMs).toBe(3500);
    expect(multEvents[0].primarySkillId).toBe('multiplication');

    const addEvents = store.getEventsForSubSkill('addition.carry');
    expect(addEvents.length).toBe(1);
    expect(addEvents[0].isCorrect).toBe(false);
  });

  it('defaults primarySkillId to subSkill namespace if omitted', () => {
    const store = createMasteryStore();
    const answers: GameAnswerLog[] = [
      {
        questionId: 'q1',
        subSkillId: 'division.basic_235',
        isCorrect: true,
        responseTimeMs: 1800,
        difficulty: 1,
      },
    ];

    ingestGameAnswers('sess_1', 'user_1', answers, store);
    const events = store.getEventsForSubSkill('division.basic_235');
    expect(events.length).toBe(1);
    expect(events[0].primarySkillId).toBe('division');
    expect(events[0].templateFamily).toBe('division_family');
    expect(events[0].skillTags).toEqual(['division', 'division.basic_235']);
  });

  it('returns singleton instance from getMasteryStore and ingests to default store if customStore is omitted', () => {
    const store1 = getMasteryStore();
    const store2 = getMasteryStore();
    expect(store1).toBe(store2);

    const answers: GameAnswerLog[] = [
      {
        questionId: 'q_default_store',
        subSkillId: 'percentage.to_fraction',
        isCorrect: true,
        responseTimeMs: 2200,
        difficulty: 4,
      },
    ];

    ingestGameAnswers('sess_default', 'user_default', answers);
    const events = store1.getEventsForSubSkill('percentage.to_fraction');
    expect(events.length).toBe(1);
    expect(events[0].targetResponseTimeMs).toBe(4000);
  });

  it('ignores answers if array is empty or all subSkillIds are whitespace/invalid', () => {
    const store = createMasteryStore();
    ingestGameAnswers('sess_empty', 'user_1', [], store);
    expect(store.getAllEvents().length).toBe(0);

    const whitespaceAnswers: GameAnswerLog[] = [
      {
        questionId: 'q_ws',
        subSkillId: '   ',
        isCorrect: true,
        responseTimeMs: 1500,
        difficulty: 2,
      },
    ];
    ingestGameAnswers('sess_ws', 'user_1', whitespaceAnswers, store);
    expect(store.getAllEvents().length).toBe(0);
  });

  it('clamps responseTimeMs to minimum 10ms and difficulty to 1-6 range', () => {
    const store = createMasteryStore();
    const answers: GameAnswerLog[] = [
      {
        questionId: 'q_low',
        subSkillId: 'addition.single_digit',
        isCorrect: true,
        responseTimeMs: -50,
        difficulty: -2,
      },
      {
        questionId: 'q_high',
        subSkillId: 'addition.double_digit',
        isCorrect: true,
        responseTimeMs: 3200.7,
        difficulty: 10,
      },
    ];

    ingestGameAnswers('sess_clamp', 'user_1', answers, store);
    const lowEvents = store.getEventsForSubSkill('addition.single_digit');
    expect(lowEvents[0].responseTimeMs).toBe(10);
    expect(lowEvents[0].difficulty).toBe(1);
    expect(lowEvents[0].targetResponseTimeMs).toBe(2500);

    const highEvents = store.getEventsForSubSkill('addition.double_digit');
    expect(highEvents[0].responseTimeMs).toBe(3201);
    expect(highEvents[0].difficulty).toBe(6);
    expect(highEvents[0].targetResponseTimeMs).toBe(6000);
  });
});
