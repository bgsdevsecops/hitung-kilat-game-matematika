// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ingestGameAnswers,
  getTargetResponseTimeMs,
  getMasteryStore,
  inferSubSkillId,
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

  describe('inferSubSkillId Helper', () => {
    it('returns explicit subSkillId if present and non-empty', () => {
      expect(inferSubSkillId({ subSkillId: 'addition.carry' })).toBe('addition.carry');
      expect(inferSubSkillId({ subSkillId: '  multiplication.x7  ' })).toBe('multiplication.x7');
    });

    it('returns primarySkillId or skillId if it contains a dot', () => {
      expect(inferSubSkillId({ primarySkillId: 'multiplication.x8' })).toBe('multiplication.x8');
      expect(inferSubSkillId({ skillId: 'division.basic_235' })).toBe('division.basic_235');
    });

    it('correctly infers addition subSkillId from operands or prompt according to taxonomy', () => {
      expect(inferSubSkillId({ operation: '+', num1: 4, num2: 5 })).toBe('addition.single_digit');
      expect(inferSubSkillId({ operation: '+', num1: 12, num2: 8 })).toBe('addition.within_20');
      expect(inferSubSkillId({ operation: '+', num1: 30, num2: 40 })).toBe('addition.tens');
      expect(inferSubSkillId({ operation: '+', num1: 45, num2: 32 })).toBe('addition.carry');
      expect(inferSubSkillId({ operation: '+', num1: 150, num2: 250 })).toBe('addition.hundreds');
      expect(inferSubSkillId({ prompt: '3 + 6 = ?' })).toBe('addition.single_digit');
      expect(inferSubSkillId({ prompt: '14 + 5' })).toBe('addition.within_20');
    });

    it('correctly infers subtraction subSkillId from operands or prompt according to taxonomy', () => {
      expect(inferSubSkillId({ operation: '-', num1: 9, num2: 4 })).toBe('subtraction.single_digit');
      expect(inferSubSkillId({ operation: '-', num1: 18, num2: 7 })).toBe('subtraction.within_20');
      expect(inferSubSkillId({ operation: '-', num1: 80, num2: 30 })).toBe('subtraction.tens');
      expect(inferSubSkillId({ operation: '-', num1: 65, num2: 24 })).toBe('subtraction.borrow');
      expect(inferSubSkillId({ operation: '-', num1: 350, num2: 120 })).toBe('subtraction.hundreds');
      expect(inferSubSkillId({ prompt: '8 - 3' })).toBe('subtraction.single_digit');
    });

    it('correctly infers multiplication subSkillId according to taxonomy', () => {
      expect(inferSubSkillId({ operation: '*', num1: 7, num2: 8 })).toBe('multiplication.x7');
      expect(inferSubSkillId({ operation: '×', num1: 12, num2: 4 })).toBe('multiplication.x4');
      expect(inferSubSkillId({ operation: '*', num1: 6, num2: 10 })).toBe('multiplication.tens');
      expect(inferSubSkillId({ operation: '*', num1: 15, num2: 25 })).toBe('multiplication.11_19');
      expect(inferSubSkillId({ prompt: '6 × 9 = ?' })).toBe('multiplication.x6');
    });

    it('correctly infers division subSkillId based on divisor', () => {
      expect(inferSubSkillId({ operation: '/', num1: 15, num2: 3 })).toBe('division.basic_235');
      expect(inferSubSkillId({ operation: '÷', num1: 10, num2: 5 })).toBe('division.basic_235');
      expect(inferSubSkillId({ operation: '÷', num1: 56, num2: 7 })).toBe('division.x4_9_inverse');
      expect(inferSubSkillId({ operation: '÷', num1: 32, num2: 4 })).toBe('division.x4_9_inverse');
      expect(inferSubSkillId({ prompt: '45 ÷ 5' })).toBe('division.basic_235');
    });

    it('returns undefined if no subSkillId can be inferred', () => {
      expect(inferSubSkillId({})).toBeUndefined();
      expect(inferSubSkillId({ difficulty: 2 })).toBeUndefined();
    });
  });

  it('correctly ingests campaign questions without explicit subSkillId into MasteryStore', () => {
    const store = createMasteryStore();
    // Simulating campaign mode answers where questions only have operation, num1, num2, prompt
    const campaignAnswers = [
      {
        id: 'camp_q1',
        prompt: '7 × 8',
        num1: 7,
        num2: 8,
        operation: '*',
        isCorrect: false, // Player made a mistake!
        timeSpentMs: 3200,
        difficulty: 3,
      },
      {
        id: 'camp_q2',
        prompt: '14 + 5',
        num1: 14,
        num2: 5,
        operation: '+',
        isCorrect: true,
        timeSpentMs: 1800,
        difficulty: 2,
      },
    ];

    ingestGameAnswers('campaign_sess_1', 'user_camp', campaignAnswers, store);

    const allEvents = store.getAllEvents();
    expect(allEvents.length).toBe(2);

    const failedEvents = allEvents.filter((e) => !e.isCorrect);
    expect(failedEvents.length).toBe(1);
    expect(failedEvents[0].subSkillId).toBe('multiplication.x7');
    expect(failedEvents[0].primarySkillId).toBe('multiplication');

    const multEvents = store.getEventsForSubSkill('multiplication.x7');
    expect(multEvents.length).toBe(1);
    expect(multEvents[0].isCorrect).toBe(false);

    const addEvents = store.getEventsForSubSkill('addition.within_20');
    expect(addEvents.length).toBe(1);
    expect(addEvents[0].isCorrect).toBe(true);
  });
});
