import { describe, it, expect } from 'vitest';
import { computeSubSkillMastery } from '../../src/engine/mastery/calculator';
import {
  createMasteryStore,
  MAX_EVENTS_PER_SUBSKILL,
  RETENTION_WINDOW_MS
} from '../../src/engine/mastery/store';
import { StoredAnswerEvent, MasteryStatus } from '../../src/engine/mastery/types';
import { buildRemediationSession } from '../../src/engine/remediation/builder';
import { createGeneratorRegistry } from '../../src/engine/registry/generatorRegistry';
import { Question } from '../../src/engine/types/question';
import { createMulberry32, randomInt } from '../../src/engine/utils/prng';

describe('Mastery & Remediation Property-Based Invariant Suite', () => {
  const VALID_STATUSES: MasteryStatus[] = [
    'INSUFFICIENT_DATA',
    'NEEDS_PRACTICE',
    'DEVELOPING',
    'COMPETENT',
    'PROFICIENT',
    'MASTERED'
  ];

  describe('Mathematical Bounds [0, 100] Invariant (5,000 randomized cases)', () => {
    it('enforces strict mathematical bounds [0, 100], guardrails, and valid statuses across 5,000 cases', () => {
      const prng = createMulberry32('mastery-bounds-invariant-seed-2026');
      const baseEvalTime = 1773360000000;
      const targetSubSkill = 'arithmetic.multiplication.basic';
      const relatedSubSkill = 'arithmetic.multiplication.advanced';
      const unrelatedSubSkill = 'geometry.shapes.angles';

      for (let i = 0; i < 5000; i++) {
        const eventCount = randomInt(prng, 1, 40);
        const sessionCount = randomInt(prng, 1, 8);
        const untimed = prng() < 0.35; // ~35% untimed mode
        const evalTime = baseEvalTime + randomInt(prng, 0, 86400000);

        const events: StoredAnswerEvent[] = [];
        for (let j = 0; j < eventCount; j++) {
          const sessId = `session-${randomInt(prng, 1, sessionCount)}`;
          const daysAgo = randomInt(prng, 0, 90);
          const difficulty = randomInt(prng, 1, 6);
          const responseTimeMs = randomInt(prng, 200, 12000);
          const isCorrect = prng() < 0.7; // ~70% correct rate

          // Mix of primary skill match, supporting skill tag, and unrelated skill
          const skillRoll = prng();
          let subSkillId: string;
          let primarySkillId: string;
          let skillTags: string[];

          if (skillRoll < 0.5) {
            // Direct primary match
            subSkillId = targetSubSkill;
            primarySkillId = targetSubSkill;
            skillTags = [targetSubSkill, 'arithmetic'];
          } else if (skillRoll < 0.8) {
            // Supporting tag match (evidence weight 0.5)
            subSkillId = relatedSubSkill;
            primarySkillId = relatedSubSkill;
            skillTags = [targetSubSkill, 'arithmetic'];
          } else {
            // Ineligible / unrelated skill
            subSkillId = unrelatedSubSkill;
            primarySkillId = unrelatedSubSkill;
            skillTags = ['geometry'];
          }

          events.push({
            eventId: `evt-${i}-${j}`,
            sessionId: sessId,
            questionDefinitionId: `q-${i}-${j}`,
            primarySkillId,
            subSkillId,
            skillTags,
            templateFamily: 'family_var',
            difficulty,
            targetResponseTimeMs: difficulty * 1000,
            responseTimeMs,
            isCorrect,
            timestamp: evalTime - daysAgo * 86400000
          });
        }

        const result = computeSubSkillMastery(events, {
          evaluationTimeMs: evalTime,
          untimed,
          targetSubSkillId: targetSubSkill
        });

        // 1. Mastery Score bounded [0, 100]
        expect(result.masteryScore).toBeGreaterThanOrEqual(0);
        expect(result.masteryScore).toBeLessThanOrEqual(100);
        expect(Number.isFinite(result.masteryScore)).toBe(true);

        // 2. Accuracy Component bounded [0, 100]
        expect(result.accuracyComponent).toBeGreaterThanOrEqual(0);
        expect(result.accuracyComponent).toBeLessThanOrEqual(100);
        expect(Number.isFinite(result.accuracyComponent)).toBe(true);

        // 3. Consistency Component bounded [0, 100]
        expect(result.consistencyComponent).toBeGreaterThanOrEqual(0);
        expect(result.consistencyComponent).toBeLessThanOrEqual(100);
        expect(Number.isFinite(result.consistencyComponent)).toBe(true);

        // 4. Speed Component bounds based on profile
        if (result.status === 'INSUFFICIENT_DATA') {
          expect(result.speedComponent).toBeNull();
          expect(result.masteryScore).toBe(0);
        } else if (untimed) {
          expect(result.speedComponent).toBeNull();
        } else {
          expect(result.speedComponent).not.toBeNull();
          expect(result.speedComponent!).toBeGreaterThanOrEqual(0);
          expect(result.speedComponent!).toBeLessThanOrEqual(100);
          expect(Number.isFinite(result.speedComponent!)).toBe(true);
        }

        // 5. Valid status enum
        expect(VALID_STATUSES).toContain(result.status);

        // 6. Guardrail: If totalEligibleAnswers < 10 or distinctSessions < 2, MUST be INSUFFICIENT_DATA
        if (result.totalAnswers < 10 || result.distinctSessions < 2) {
          expect(result.status).toBe('INSUFFICIENT_DATA');
        } else {
          expect(result.status).not.toBe('INSUFFICIENT_DATA');
        }
      }
    });
  });

  describe('Determinism Invariant', () => {
    it('produces 100% strictly identical results (deepEqual) for identical inputs across 1,000 cases', () => {
      const prng = createMulberry32('mastery-determinism-seed-4040');
      const baseEvalTime = 1773360000000;
      const targetSubSkill = 'arithmetic.multiplication.basic';

      for (let i = 0; i < 1000; i++) {
        const eventCount = randomInt(prng, 5, 35);
        const sessionCount = randomInt(prng, 1, 6);
        const untimed = prng() < 0.5;
        const evalTime = baseEvalTime + randomInt(prng, 0, 100000);

        const events: StoredAnswerEvent[] = [];
        for (let j = 0; j < eventCount; j++) {
          events.push({
            eventId: `evt-det-${i}-${j}`,
            sessionId: `sess-${randomInt(prng, 1, sessionCount)}`,
            questionDefinitionId: `q-${j}`,
            primarySkillId: targetSubSkill,
            subSkillId: targetSubSkill,
            skillTags: [targetSubSkill],
            templateFamily: 'mult_family',
            difficulty: randomInt(prng, 1, 6),
            targetResponseTimeMs: randomInt(prng, 2000, 5000),
            responseTimeMs: randomInt(prng, 500, 6000),
            isCorrect: prng() < 0.75,
            timestamp: evalTime - randomInt(prng, 0, 80) * 86400000
          });
        }

        const options = {
          evaluationTimeMs: evalTime,
          untimed,
          targetSubSkillId: targetSubSkill
        };

        // Compute from original events
        const result1 = computeSubSkillMastery(events, options);

        // Compute from independent deep clone with identical options
        const eventsClone: StoredAnswerEvent[] = JSON.parse(JSON.stringify(events));
        const result2 = computeSubSkillMastery(eventsClone, { ...options });

        expect(result1).toEqual(result2);
      }
    });
  });

  describe('Monotonic Positive Feedback Invariant', () => {
    it('ensures appending fast, high-accuracy answers at target speed never decreases masteryScore across 2,000 cases', () => {
      const prng = createMulberry32('mastery-monotonicity-seed-8080');
      const baseEvalTime = 1773360000000;
      const targetSubSkill = 'arithmetic.addition.basic';

      let testedBaselineCount = 0;

      for (let i = 0; i < 2000; i++) {
        const untimed = i % 2 === 1;
        const eventCount = randomInt(prng, 10, 25); // within 30-event rolling window
        const sessionCount = randomInt(prng, 2, 5);
        const evalTime = baseEvalTime + i * 10000;

        const events: StoredAnswerEvent[] = [];
        for (let j = 0; j < eventCount; j++) {
          events.push({
            eventId: `evt-mono-${i}-${j}`,
            sessionId: `session-${randomInt(prng, 1, sessionCount)}`,
            questionDefinitionId: `q-${j}`,
            primarySkillId: targetSubSkill,
            subSkillId: targetSubSkill,
            skillTags: [targetSubSkill],
            templateFamily: 'addition_basic',
            difficulty: 2,
            targetResponseTimeMs: 3000,
            responseTimeMs: randomInt(prng, 1000, 6000),
            isCorrect: prng() < 0.65,
            timestamp: evalTime - randomInt(prng, 1, 60) * 86400000
          });
        }

        const baseline = computeSubSkillMastery(events, {
          evaluationTimeMs: evalTime,
          targetSubSkillId: targetSubSkill,
          untimed
        });

        // Only evaluate baselines that have reached sufficient data
        if (baseline.status === 'INSUFFICIENT_DATA') {
          continue;
        }

        testedBaselineCount++;

        // Append 1 to 4 new correct answers at target response speed (e.g. 1,500ms <= 3,000ms target)
        const appendCount = randomInt(prng, 1, 4);
        const targetSessionId =
          i % 2 === 0
            ? `session-new-${i}` // new session with 100% accuracy
            : events[events.length - 1].sessionId; // append to active session

        const updatedEvents = [...events];
        for (let k = 0; k < appendCount; k++) {
          updatedEvents.push({
            eventId: `evt-new-${i}-${k}`,
            sessionId: targetSessionId,
            questionDefinitionId: `q-new-${k}`,
            primarySkillId: targetSubSkill,
            subSkillId: targetSubSkill,
            skillTags: [targetSubSkill],
            templateFamily: 'addition_basic',
            difficulty: 2,
            targetResponseTimeMs: 3000,
            responseTimeMs: 1500, // fast, target speed
            isCorrect: true,
            timestamp: evalTime + (k + 1) * 1000
          });
        }

        const updated = computeSubSkillMastery(updatedEvents, {
          evaluationTimeMs: evalTime + 5000,
          targetSubSkillId: targetSubSkill,
          untimed
        });

        // Invariant: New mastery score must be greater than or equal to baseline
        expect(updated.masteryScore).toBeGreaterThanOrEqual(baseline.masteryScore);
        expect(updated.accuracyComponent).toBeGreaterThanOrEqual(baseline.accuracyComponent);
        if (!untimed && baseline.speedComponent !== null && updated.speedComponent !== null) {
          expect(updated.speedComponent).toBeGreaterThanOrEqual(baseline.speedComponent);
        }
      }

      // Verify we evaluated a significant volume of computable baselines
      expect(testedBaselineCount).toBeGreaterThanOrEqual(1800);
    });
  });

  describe('Remediation Session Invariant Property (500 randomized failure sets)', () => {
    it('verifies 100% skill carryover, sizing bounds [5, 15], difficulty ceiling, repeat limits, and family cap', () => {
      const registry = createGeneratorRegistry();
      const prng = createMulberry32('remediation-fuzzing-seed-9999');

      const failureTemplates = [
        { skill: 'addition', family: 'addition_basic', gen: 'addition', prompt: '14 + 19' },
        { skill: 'subtraction', family: 'subtraction_basic', gen: 'subtraction', prompt: '31 - 14' },
        { skill: 'multiplication', family: 'multiplication_basic', gen: 'multiplication', prompt: '8 × 7' },
        { skill: 'division', family: 'division_clean', gen: 'division', prompt: '56 ÷ 8' },
        { skill: 'signed', family: 'signed_arithmetic', gen: 'signed', prompt: '-7 + 15' },
        {
          skill: 'missing_operand',
          family: 'missing_operand_basic',
          gen: 'missing_operand',
          prompt: '? + 6 = 15'
        }
      ];

      for (let i = 0; i < 500; i++) {
        const numFailed = randomInt(prng, 1, 6);
        const failed: Question[] = [];

        for (let j = 0; j < numFailed; j++) {
          const tmpl = failureTemplates[randomInt(prng, 0, failureTemplates.length - 1)];
          const difficulty = randomInt(prng, 1, 4) as 1 | 2 | 3 | 4 | 5 | 6;
          failed.push({
            questionDefinitionId: `q-fail-${i}-${j}`,
            questionInstanceId: `inst-fail-${i}-${j}`,
            displayPrompt: tmpl.prompt,
            answerSpec: { kind: 'integer', value: 42 },
            primarySkillId: tmpl.skill,
            skillTags: [tmpl.skill, 'arithmetic'],
            difficulty,
            generatorKey: tmpl.gen,
            targetResponseTimeMs: 3000,
            templateFamily: tmpl.family,
            explanation: 'Fuzzed failure evidence'
          });
        }

        const plan = buildRemediationSession({
          failedQuestions: failed,
          registry,
          seed: `remediation-seed-${i}`
        });

        // 1. Sizing strictly in [5, 15]
        expect(plan.questions.length).toBeGreaterThanOrEqual(5);
        expect(plan.questions.length).toBeLessThanOrEqual(15);

        // 2. 100% of questions carry failed skills or tags
        const failedSkillSet = new Set<string>();
        for (const f of failed) {
          if (f.primarySkillId) failedSkillSet.add(f.primarySkillId);
          for (const t of f.skillTags || []) {
            if (t) failedSkillSet.add(t);
          }
        }

        for (const q of plan.questions) {
          const matchesSkill = failedSkillSet.has(q.primarySkillId);
          const matchesTag = q.skillTags.some((t) => failedSkillSet.has(t));
          expect(matchesSkill || matchesTag).toBe(true);
        }

        // 3. Difficulty ceiling strictly respected
        const maxFailedDiff = Math.max(...failed.map((f) => f.difficulty));
        for (const q of plan.questions) {
          expect(q.difficulty).toBeLessThanOrEqual(maxFailedDiff);
        }

        // 4. Exact failed prompt repeats <= 1
        for (const f of failed) {
          const exactRepeats = plan.questions.filter(
            (q) => q.displayPrompt === f.displayPrompt
          ).length;
          expect(exactRepeats).toBeLessThanOrEqual(1);
        }

        // 5. Template family share <= 30% when >= 3 distinct failed families exist
        const distinctFailedFamilies = new Set(failed.map((f) => f.templateFamily)).size;
        if (distinctFailedFamilies >= 3) {
          const familyCounts = new Map<string, number>();
          for (const q of plan.questions) {
            familyCounts.set(q.templateFamily, (familyCounts.get(q.templateFamily) || 0) + 1);
          }
          for (const [, count] of familyCounts.entries()) {
            const share = count / plan.questions.length;
            expect(share).toBeLessThanOrEqual(0.3);
          }
        }
      }
    });
  });

  describe('Mastery Store Invariants: Retention Window, Rolling Window Cap & Snapshot Consistency', () => {
    it('preserves storage invariants across 200 randomized storage sessions', () => {
      const prng = createMulberry32('mastery-store-invariant-seed-5555');
      const now = 1773360000000;
      const subSkill = 'arithmetic.subtraction.basic';

      for (let i = 0; i < 200; i++) {
        const store = createMasteryStore();
        const eventCount = randomInt(prng, 20, 60);
        const events: StoredAnswerEvent[] = [];

        for (let j = 0; j < eventCount; j++) {
          const daysAgo = randomInt(prng, 0, 120); // includes events older than 90 days
          events.push({
            eventId: `evt-store-${i}-${j}`,
            sessionId: `sess-${randomInt(prng, 1, 4)}`,
            questionDefinitionId: `q-${j}`,
            primarySkillId: subSkill,
            subSkillId: subSkill,
            skillTags: [subSkill],
            templateFamily: 'subtraction_basic',
            difficulty: 2,
            targetResponseTimeMs: 3000,
            responseTimeMs: randomInt(prng, 1500, 4000),
            isCorrect: prng() < 0.7,
            timestamp: now - daysAgo * 86400000
          });
        }

        store.recordEvents(events, now);

        const retained = store.getEventsForSubSkill(subSkill);

        // 1. Sub-skill rolling window cap: never more than 30 events
        expect(retained.length).toBeLessThanOrEqual(MAX_EVENTS_PER_SUBSKILL);

        // 2. 90-day retention pruning: no event older than retention window
        const cutoff = now - RETENTION_WINDOW_MS;
        for (const evt of retained) {
          expect(evt.timestamp).toBeGreaterThanOrEqual(cutoff);
        }

        // 3. Snapshot cache consistency: snapshot matches direct pure computation
        const snapshot = store.getMasteryRecord(subSkill, now);
        const direct = computeSubSkillMastery(retained, {
          evaluationTimeMs: now,
          targetSubSkillId: subSkill
        });

        expect(snapshot.masteryScore).toBe(direct.masteryScore);
        expect(snapshot.status).toBe(direct.status);
        expect(snapshot.accuracyComponent).toBe(direct.accuracyComponent);
        expect(snapshot.speedComponent).toBe(direct.speedComponent);
        expect(snapshot.consistencyComponent).toBe(direct.consistencyComponent);
        expect(snapshot.distinctSessions).toBe(direct.distinctSessions);
      }
    });
  });
});
