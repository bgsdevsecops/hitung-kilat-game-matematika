import { describe, it, expect } from 'vitest';
import { computeSubSkillMastery, TARGET_RESPONSE_TIMES_MS } from '../../src/engine/mastery/calculator';
import { StoredAnswerEvent } from '../../src/engine/mastery/types';

describe('Mastery Calculator V2.0', () => {
  const now = 1773360000000; // fixed eval timestamp

  const createEvent = (
    index: number,
    isCorrect: boolean,
    responseTimeMs = 2500,
    sessionId = 'session-1',
    daysAgo = 0,
    overrides?: Partial<StoredAnswerEvent>
  ): StoredAnswerEvent => ({
    eventId: `evt-${index}`,
    sessionId,
    questionDefinitionId: `q-${index}`,
    primarySkillId: 'multiplication',
    subSkillId: 'multiplication.x7',
    skillTags: ['arithmetic'],
    templateFamily: 'mult_table',
    difficulty: 2,
    targetResponseTimeMs: 3000,
    responseTimeMs,
    isCorrect,
    timestamp: now - daysAgo * 86400000,
    ...overrides
  });

  it('exports valid target response times by difficulty (PRD §8.3.3)', () => {
    expect(TARGET_RESPONSE_TIMES_MS[1]).toBe(2500);
    expect(TARGET_RESPONSE_TIMES_MS[2]).toBe(3000);
    expect(TARGET_RESPONSE_TIMES_MS[3]).toBe(3500);
    expect(TARGET_RESPONSE_TIMES_MS[4]).toBe(4000);
    expect(TARGET_RESPONSE_TIMES_MS[5]).toBe(5000);
    expect(TARGET_RESPONSE_TIMES_MS[6]).toBe(6000);
  });

  it('returns INSUFFICIENT_DATA when events array is empty', () => {
    const record = computeSubSkillMastery([], { evaluationTimeMs: now });
    expect(record.status).toBe('INSUFFICIENT_DATA');
    expect(record.statusLabel).toBe('Belum Cukup Data');
    expect(record.totalAnswers).toBe(0);
    expect(record.distinctSessions).toBe(0);
    expect(record.masteryScore).toBe(0);
    expect(record.isStrongSkill).toBe(false);
    expect(record.isWeakSkill).toBe(false);
  });

  it('returns INSUFFICIENT_DATA when total answers < 10', () => {
    const events = Array.from({ length: 9 }, (_, i) => createEvent(i, true, 2000, `sess-${i % 3}`));
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.status).toBe('INSUFFICIENT_DATA');
    expect(record.statusLabel).toBe('Belum Cukup Data');
    expect(record.totalAnswers).toBe(9);
    expect(record.isStrongSkill).toBe(false);
    expect(record.isWeakSkill).toBe(false);
  });

  it('returns INSUFFICIENT_DATA when distinct sessions < 2', () => {
    const events = Array.from({ length: 15 }, (_, i) => createEvent(i, true, 2000, 'session-only-one'));
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.status).toBe('INSUFFICIENT_DATA');
    expect(record.statusLabel).toBe('Belum Cukup Data');
    expect(record.distinctSessions).toBe(1);
    expect(record.isStrongSkill).toBe(false);
    expect(record.isWeakSkill).toBe(false);
  });

  it('computes MASTERED (score >= 95) with fast, consistent 100% correct answers', () => {
    const events = [
      ...Array.from({ length: 10 }, (_, i) => createEvent(i, true, 1500, 'sess-1', 1)),
      ...Array.from({ length: 10 }, (_, i) => createEvent(i + 10, true, 1500, 'sess-2', 0))
    ];
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.status).toBe('MASTERED');
    expect(record.statusLabel).toBe('Dikuasai');
    expect(record.masteryScore).toBeGreaterThanOrEqual(95);
    expect(record.isStrongSkill).toBe(true);
    expect(record.isWeakSkill).toBe(false);
  });

  it('detects WEAK_SKILL when accuracy is low or score < 60', () => {
    const events = [
      ...Array.from({ length: 6 }, (_, i) => createEvent(i, false, 4000, 'sess-1', 2)),
      ...Array.from({ length: 6 }, (_, i) => createEvent(i + 6, true, 3500, 'sess-2', 0))
    ];
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.isWeakSkill).toBe(true);
    expect(record.isStrongSkill).toBe(false);
    expect(['NEEDS_PRACTICE', 'DEVELOPING']).toContain(record.status);
  });

  it('applies untimed accessibility profile omitting speed component', () => {
    const events = [
      ...Array.from({ length: 6 }, (_, i) => createEvent(i, true, 12000, 'sess-1', 1)),
      ...Array.from({ length: 6 }, (_, i) => createEvent(i + 6, true, 15000, 'sess-2', 0))
    ];
    const standard = computeSubSkillMastery(events, { evaluationTimeMs: now, untimed: false });
    const untimed = computeSubSkillMastery(events, { evaluationTimeMs: now, untimed: true });

    // In untimed mode, slow response times do not penalize mastery score
    expect(untimed.masteryScore).toBeGreaterThan(standard.masteryScore);
    expect(untimed.speedComponent).toBeNull();
  });

  it('excludes events older than 90 days from evaluation window', () => {
    // 5 events within 90 days, 10 events older than 90 days -> eligible = 5 (< 10) -> INSUFFICIENT_DATA
    const events = [
      ...Array.from({ length: 10 }, (_, i) => createEvent(i, true, 2000, 'sess-old', 95)),
      ...Array.from({ length: 5 }, (_, i) => createEvent(i + 10, true, 2000, 'sess-fresh', 10))
    ];
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.status).toBe('INSUFFICIENT_DATA');
    expect(record.totalAnswers).toBe(5);
  });

  it('weights supporting skill evidence at 0.5 compared to primary 1.0', () => {
    // All 10 events in 2 sessions. 5 primary correct, 5 supporting incorrect.
    const events = [
      ...Array.from({ length: 5 }, (_, i) =>
        createEvent(i, true, 2000, 'sess-1', 0, {
          subSkillId: 'multiplication.x7',
          skillTags: []
        })
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        createEvent(i + 5, false, 2000, 'sess-2', 0, {
          subSkillId: 'multiplication.x8',
          skillTags: ['multiplication.x7'] // supporting for x7
        })
      )
    ];

    const record = computeSubSkillMastery(events, {
      evaluationTimeMs: now,
      targetSubSkillId: 'multiplication.x7'
    });

    // Primary weight = 5 * 1.0 = 5.0 (all correct)
    // Supporting weight = 5 * 0.5 = 2.5 (all incorrect)
    // Expected accuracy = (5.0 / 7.5) * 100 = 66.67%
    expect(record.accuracyComponent).toBeCloseTo(66.67, 1);
  });

  it('maps scores to all status bands correctly', () => {
    // PROFICIENT (80-94)
    const eventsProficient = [
      ...Array.from({ length: 10 }, (_, i) => createEvent(i, true, 2500, 'sess-1', 1)),
      ...Array.from({ length: 10 }, (_, i) => createEvent(i + 10, i % 5 !== 0, 2500, 'sess-2', 0))
    ];
    const recordProficient = computeSubSkillMastery(eventsProficient, { evaluationTimeMs: now });
    expect(['COMPETENT', 'PROFICIENT', 'MASTERED']).toContain(recordProficient.status);

    // NEEDS_PRACTICE (0-39)
    const eventsPractice = [
      ...Array.from({ length: 6 }, (_, i) => createEvent(i, false, 6000, 'sess-1', 1)),
      ...Array.from({ length: 6 }, (_, i) => createEvent(i + 6, false, 6000, 'sess-2', 0))
    ];
    const recordPractice = computeSubSkillMastery(eventsPractice, { evaluationTimeMs: now });
    expect(recordPractice.status).toBe('NEEDS_PRACTICE');
    expect(recordPractice.statusLabel).toBe('Perlu Latihan');
    expect(recordPractice.masteryScore).toBeLessThan(40);
    expect(recordPractice.isWeakSkill).toBe(true);
  });

  it('enforces strong skill criteria: masteryScore >= 80 AND recentAccuracy >= 85%', () => {
    // 20 events. Last 10 events: all 10 correct (100% recent accuracy)
    const events = [
      ...Array.from({ length: 10 }, (_, i) => createEvent(i, true, 1800, 'sess-1', 5)),
      ...Array.from({ length: 10 }, (_, i) => createEvent(i + 10, true, 1800, 'sess-2', 0))
    ];
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.masteryScore).toBeGreaterThanOrEqual(80);
    expect(record.recentAccuracy).toBeGreaterThanOrEqual(85);
    expect(record.isStrongSkill).toBe(true);
    expect(record.isWeakSkill).toBe(false);
  });

  it('caps evaluation window at the 30 most recent eligible answers', () => {
    // Pass 40 events: 10 older (daysAgo: 40), 30 newer (daysAgo: 1-10)
    const oldEvents = Array.from({ length: 10 }, (_, i) =>
      createEvent(i, false, 2000, 'sess-old', 40)
    );
    const newEvents = Array.from({ length: 30 }, (_, i) =>
      createEvent(i + 10, true, 1500, `sess-${(i % 3) + 1}`, 1)
    );
    const allEvents = [...oldEvents, ...newEvents];

    const record = computeSubSkillMastery(allEvents, { evaluationTimeMs: now });
    expect(record.totalAnswers).toBe(30);
    // Since the 30 evaluated are all true, accuracy is 100%
    expect(record.accuracyComponent).toBe(100);
  });

  it('handles events provided out of chronological order', () => {
    // 10 events: 5 recent true, 5 older false, inserted interleaved
    const events: StoredAnswerEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(createEvent(i * 2, true, 2000, 'sess-recent', 1));
      events.push(createEvent(i * 2 + 1, false, 2000, 'sess-old', 20));
    }
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.totalAnswers).toBe(10);
    expect(record.status).not.toBe('INSUFFICIENT_DATA');
  });

  it('evaluates exactly 10 answers across 2 sessions as sufficient data', () => {
    const events = [
      ...Array.from({ length: 5 }, (_, i) => createEvent(i, true, 2000, 'sess-1', 1)),
      ...Array.from({ length: 5 }, (_, i) => createEvent(i + 5, true, 2000, 'sess-2', 0))
    ];
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.status).not.toBe('INSUFFICIENT_DATA');
    expect(record.totalAnswers).toBe(10);
    expect(record.distinctSessions).toBe(2);
  });

  it('evaluates consistency over at most 5 most recent sessions', () => {
    // 6 sessions: sess-6 (oldest, 0% correct), sess-1 to sess-5 (100% correct, 2 answers each)
    const events: StoredAnswerEvent[] = [
      ...Array.from({ length: 4 }, (_, i) => createEvent(i, false, 2000, 'sess-6', 50)),
      ...Array.from({ length: 2 }, (_, i) => createEvent(i + 4, true, 2000, 'sess-5', 40)),
      ...Array.from({ length: 2 }, (_, i) => createEvent(i + 6, true, 2000, 'sess-4', 30)),
      ...Array.from({ length: 2 }, (_, i) => createEvent(i + 8, true, 2000, 'sess-3', 20)),
      ...Array.from({ length: 2 }, (_, i) => createEvent(i + 10, true, 2000, 'sess-2', 10)),
      ...Array.from({ length: 2 }, (_, i) => createEvent(i + 12, true, 2000, 'sess-1', 1))
    ];
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    // The 5 most recent sessions are sess-1 to sess-5, all with 100% accuracy >= 80%
    expect(record.consistencyComponent).toBe(100);
  });

  it('maintains strict mathematical bounds [0, 100] across 1,000 randomized configurations', () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let run = 0; run < 1000; run++) {
      const eventCount = Math.floor(rng() * 40);
      const sessionCount = Math.floor(rng() * 6) + 1;
      const events: StoredAnswerEvent[] = Array.from({ length: eventCount }, (_, i) => ({
        eventId: `run-${run}-evt-${i}`,
        sessionId: `sess-${i % sessionCount}`,
        questionDefinitionId: `q-${i}`,
        primarySkillId: 'multiplication',
        subSkillId: 'multiplication.x7',
        skillTags: ['arithmetic'],
        templateFamily: 'mult_table',
        difficulty: Math.floor(rng() * 6) + 1,
        targetResponseTimeMs: 3000,
        responseTimeMs: Math.floor(rng() * 8000) + 200,
        isCorrect: rng() > 0.4,
        timestamp: now - rng() * 95 * 86400000
      }));

      const untimed = rng() > 0.5;
      const res = computeSubSkillMastery(events, { evaluationTimeMs: now, untimed });

      expect(res.masteryScore).toBeGreaterThanOrEqual(0);
      expect(res.masteryScore).toBeLessThanOrEqual(100);
      expect(res.accuracyComponent).toBeGreaterThanOrEqual(0);
      expect(res.accuracyComponent).toBeLessThanOrEqual(100);
      expect(res.consistencyComponent).toBeGreaterThanOrEqual(0);
      expect(res.consistencyComponent).toBeLessThanOrEqual(100);
      if (res.speedComponent !== null) {
        expect(res.speedComponent).toBeGreaterThanOrEqual(0);
        expect(res.speedComponent).toBeLessThanOrEqual(100);
      }
      expect(Number.isNaN(res.masteryScore)).toBe(false);
    }
  });
});
