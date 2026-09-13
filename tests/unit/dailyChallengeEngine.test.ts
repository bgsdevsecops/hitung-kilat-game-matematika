import { describe, it, expect } from 'vitest';
import {
  getWIBDateString,
  getYesterdayWIBDateString,
  getWIBTimeUntilMidnight,
  generateDailyQuestions,
} from '../../src/utils/dailyWib';
import { isDailyStreakEligible } from '../../src/engine/competitive/modes/daily';

describe('Daily Challenge Engine Utilities', () => {
  it('formats dates in Asia/Jakarta (WIB) regardless of local timezone', () => {
    // 2026-09-13 16:30:00 UTC is 2026-09-13 23:30:00 WIB
    const utcEvening = new Date('2026-09-13T16:30:00Z');
    expect(getWIBDateString(utcEvening)).toBe('2026-09-13');
    expect(getYesterdayWIBDateString(utcEvening)).toBe('2026-09-12');

    // 2026-09-13 17:30:00 UTC is 2026-09-14 00:30:00 WIB
    const utcMidnightCross = new Date('2026-09-13T17:30:00Z');
    expect(getWIBDateString(utcMidnightCross)).toBe('2026-09-14');
    expect(getYesterdayWIBDateString(utcMidnightCross)).toBe('2026-09-13');
  });

  it('calculates remaining time until midnight WIB correctly', () => {
    // 2026-09-13 16:59:00 UTC is 23:59:00 WIB (1 minute before midnight WIB)
    const justBeforeMidnight = new Date('2026-09-13T16:59:00Z');
    const res = getWIBTimeUntilMidnight(justBeforeMidnight);
    expect(res.hours).toBe(0);
    expect(res.minutes).toBe(1);
    expect(res.seconds).toBe(0);
    expect(res.ms).toBe(60000);
  });

  it('generates 10 deterministic questions from challengeId with answerSpec', () => {
    const challengeId = '2026-09-13@Asia/Jakarta:2.0.0';
    const questions1 = generateDailyQuestions(challengeId);
    const questions2 = generateDailyQuestions(challengeId);

    expect(questions1.length).toBe(10);
    expect(questions1).toEqual(questions2);

    for (let i = 0; i < questions1.length; i++) {
      const q = questions1[i];
      expect(q.id).toBe(`daily_${challengeId}_q${i + 1}`);
      expect(q.prompt).toBeDefined();
      expect(q.answerSpec).toBeDefined();
      expect(q.answerSpec.kind).toBe('integer');
      expect(typeof q.answerSpec.value).toBe('number');
      expect(q.difficulty).toBeGreaterThanOrEqual(1);
      expect(q.difficulty).toBeLessThanOrEqual(5);
    }
  });

  it('evaluates daily streak eligibility according to PRD §15.2', () => {
    // Eligible: VALIDATED, daily, 10 answered, correctCount >= 6
    expect(
      isDailyStreakEligible({
        status: 'VALIDATED',
        mode: 'daily',
        questionsAnswered: 10,
        correctCount: 6,
      })
    ).toBe(true);

    expect(
      isDailyStreakEligible({
        status: 'VALIDATED',
        mode: 'daily',
        questionsAnswered: 10,
        correctCount: 10,
      })
    ).toBe(true);

    // Ineligible: < 6 correct
    expect(
      isDailyStreakEligible({
        status: 'VALIDATED',
        mode: 'daily',
        questionsAnswered: 10,
        correctCount: 5,
      })
    ).toBe(false);

    // Ineligible: < 10 answered
    expect(
      isDailyStreakEligible({
        status: 'VALIDATED',
        mode: 'daily',
        questionsAnswered: 9,
        correctCount: 9,
      })
    ).toBe(false);

    // Ineligible: REJECTED status
    expect(
      isDailyStreakEligible({
        status: 'REJECTED' as any,
        mode: 'daily',
        questionsAnswered: 10,
        correctCount: 8,
      })
    ).toBe(false);
  });
});
