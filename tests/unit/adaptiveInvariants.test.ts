// tests/unit/adaptiveInvariants.test.ts
import { describe, it, expect } from 'vitest';
import { buildAdaptiveSession } from '../../src/engine/adaptive/builder';
import { createGeneratorRegistry } from '../../src/engine/registry/generatorRegistry';
import { MasteryRecord } from '../../src/engine/mastery/types';
import { createMulberry32, randomInt } from '../../src/engine/utils/prng';
import { getSubSkill, getAllSubSkills } from '../../src/engine/taxonomy';
import { isSubSkillPrerequisiteSatisfied } from '../../src/engine/adaptive/selector';

describe('Epic E6: Adaptive Practice Property-Based Invariant Suite', () => {
  const registry = createGeneratorRegistry();

  it('verifies AC-E6-01: bucket distribution across 100 seeded sessions falls within ±10% points of policy', () => {
    let totalWeak = 0;
    let totalMedium = 0;
    let totalErrors = 0;
    let totalStrong = 0;
    const runCount = 100;

    for (let run = 0; run < runCount; run++) {
      // Mock rich mastery dataset with all categories represented
      // Using foundational sub-skills with satisfied prerequisites across all buckets
      const records: Record<string, MasteryRecord> = {
        'addition.single_digit': {
          subSkillId: 'addition.single_digit',
          status: 'NEEDS_PRACTICE',
          statusLabel: 'Perlu Latihan',
          masteryScore: 40,
          accuracyComponent: 40,
          speedComponent: 30,
          consistencyComponent: 40,
          recentAccuracy: 50,
          totalAnswers: 20,
          distinctSessions: 3,
          isStrongSkill: false,
          isWeakSkill: true,
          lastEvaluatedAt: 1773360000000,
          algorithmVersion: '2.0.0',
        },
        'subtraction.single_digit': {
          subSkillId: 'subtraction.single_digit',
          status: 'COMPETENT',
          statusLabel: 'Cukup',
          masteryScore: 70,
          accuracyComponent: 70,
          speedComponent: 70,
          consistencyComponent: 70,
          recentAccuracy: 75,
          totalAnswers: 20,
          distinctSessions: 3,
          isStrongSkill: false,
          isWeakSkill: false,
          lastEvaluatedAt: 1773360000000,
          algorithmVersion: '2.0.0',
        },
        'multiplication.x7': {
          subSkillId: 'multiplication.x7',
          status: 'MASTERED',
          statusLabel: 'Dikuasai',
          masteryScore: 95,
          accuracyComponent: 95,
          speedComponent: 90,
          consistencyComponent: 100,
          recentAccuracy: 100,
          totalAnswers: 30,
          distinctSessions: 4,
          isStrongSkill: true,
          isWeakSkill: false,
          lastEvaluatedAt: 1773360000000,
          algorithmVersion: '2.0.0',
        },
      };

      const plan = buildAdaptiveSession({
        masteryRecords: records,
        recentErrors: [{
          questionDefinitionId: 'err-1',
          primarySkillId: 'division',
          skillTags: ['division'],
          difficulty: 2,
          generatorKey: 'division',
          templateFamily: 'division_clean',
        }],
        registry,
        seed: `run-${run}`,
        sessionSize: 10,
      });

      totalWeak += plan.bucketAssignments.WEAK_SKILLS || 0;
      totalMedium += plan.bucketAssignments.MEDIUM_SKILLS || 0;
      totalErrors += plan.bucketAssignments.RECENT_ERRORS || 0;
      totalStrong += plan.bucketAssignments.STRONG_MAINTENANCE || 0;

      // Invariant: allocated slots across buckets must equal sessionSize (10)
      const allocatedSum =
        (plan.bucketAssignments.WEAK_SKILLS || 0) +
        (plan.bucketAssignments.MEDIUM_SKILLS || 0) +
        (plan.bucketAssignments.RECENT_ERRORS || 0) +
        (plan.bucketAssignments.STRONG_MAINTENANCE || 0);
      expect(allocatedSum).toBe(10);
    }

    const totalQuestions = runCount * 10;
    const weakRate = totalWeak / totalQuestions;
    const medRate = totalMedium / totalQuestions;
    const errRate = totalErrors / totalQuestions;
    const strongRate = totalStrong / totalQuestions;

    // AC-E6-01: Policy 50/25/15/10 within ±10% points (0.40..0.60, 0.15..0.35, 0.05..0.25, 0.00..0.20)
    expect(weakRate).toBeGreaterThanOrEqual(0.40);
    expect(weakRate).toBeLessThanOrEqual(0.60);

    expect(medRate).toBeGreaterThanOrEqual(0.15);
    expect(medRate).toBeLessThanOrEqual(0.35);

    expect(errRate).toBeGreaterThanOrEqual(0.05);
    expect(errRate).toBeLessThanOrEqual(0.25);

    expect(strongRate).toBeGreaterThanOrEqual(0.00);
    expect(strongRate).toBeLessThanOrEqual(0.20);
  });

  it('verifies AC-E6-02: sub-skill cap <= 40% and zero consecutive identical templates across 100 runs in cold-start', () => {
    for (let i = 0; i < 100; i++) {
      const plan = buildAdaptiveSession({
        masteryRecords: {},
        registry,
        seed: `consec-test-${i}`,
        sessionSize: 10,
      });

      // Invariant 1: Zero consecutive identical template families
      for (let j = 1; j < plan.questions.length; j++) {
        expect(plan.questions[j].templateFamily).not.toBe(plan.questions[j - 1].templateFamily);
      }

      // Invariant 2: Sub-skill cap <= 40% (max 4 questions per 10-question session)
      const subSkillCounts = new Map<string, number>();
      for (const q of plan.questions) {
        subSkillCounts.set(q.primarySkillId, (subSkillCounts.get(q.primarySkillId) || 0) + 1);
      }
      for (const count of subSkillCounts.values()) {
        expect(count).toBeLessThanOrEqual(4);
      }
    }
  });

  it('verifies AC-E6-02: sub-skill cap <= 40% and zero consecutive identical templates across 100 runs in mastery-driven sessions', () => {
    const records: Record<string, MasteryRecord> = {
      'addition.single_digit': {
        subSkillId: 'addition.single_digit',
        status: 'NEEDS_PRACTICE',
        statusLabel: 'Perlu Latihan',
        masteryScore: 40,
        accuracyComponent: 40,
        speedComponent: 30,
        consistencyComponent: 40,
        recentAccuracy: 50,
        totalAnswers: 20,
        distinctSessions: 3,
        isStrongSkill: false,
        isWeakSkill: true,
        lastEvaluatedAt: 1773360000000,
        algorithmVersion: '2.0.0',
      },
      'subtraction.single_digit': {
        subSkillId: 'subtraction.single_digit',
        status: 'COMPETENT',
        statusLabel: 'Cukup',
        masteryScore: 70,
        accuracyComponent: 70,
        speedComponent: 70,
        consistencyComponent: 70,
        recentAccuracy: 75,
        totalAnswers: 20,
        distinctSessions: 3,
        isStrongSkill: false,
        isWeakSkill: false,
        lastEvaluatedAt: 1773360000000,
        algorithmVersion: '2.0.0',
      },
      'multiplication.x2': {
        subSkillId: 'multiplication.x2',
        status: 'MASTERED',
        statusLabel: 'Dikuasai',
        masteryScore: 95,
        accuracyComponent: 95,
        speedComponent: 90,
        consistencyComponent: 100,
        recentAccuracy: 100,
        totalAnswers: 30,
        distinctSessions: 4,
        isStrongSkill: true,
        isWeakSkill: false,
        lastEvaluatedAt: 1773360000000,
        algorithmVersion: '2.0.0',
      },
    };

    for (let i = 0; i < 100; i++) {
      const plan = buildAdaptiveSession({
        masteryRecords: records,
        recentErrors: [{
          questionDefinitionId: `err-${i}`,
          primarySkillId: 'division',
          skillTags: ['division'],
          difficulty: 2,
          generatorKey: 'division',
          templateFamily: 'division_clean',
        }],
        registry,
        seed: `mastery-consec-test-${i}`,
        sessionSize: 10,
      });

      // Invariant 1: Zero consecutive identical template families
      for (let j = 1; j < plan.questions.length; j++) {
        expect(plan.questions[j].templateFamily).not.toBe(plan.questions[j - 1].templateFamily);
      }

      // Invariant 2: Sub-skill cap <= 40% (max 4 per 10 questions)
      const subSkillCounts = new Map<string, number>();
      for (const q of plan.questions) {
        subSkillCounts.set(q.primarySkillId, (subSkillCounts.get(q.primarySkillId) || 0) + 1);
      }
      for (const count of subSkillCounts.values()) {
        expect(count).toBeLessThanOrEqual(4);
      }
    }
  });

  it('verifies AC-E6-03 & AC-E6-04: prerequisite satisfaction, difficulty ceiling adherence, and bit-for-bit determinism', () => {
    const plan1 = buildAdaptiveSession({
      masteryRecords: {},
      registry,
      seed: 'deterministic-seed-123',
      playerDifficultyCeiling: 2,
    });

    const plan2 = buildAdaptiveSession({
      masteryRecords: {},
      registry,
      seed: 'deterministic-seed-123',
      playerDifficultyCeiling: 2,
    });

    // Bit-for-bit determinism
    expect(plan1.questions).toEqual(plan2.questions);
    expect(plan1.bucketAssignments).toEqual(plan2.bucketAssignments);
    expect(plan1.recommendation).toEqual(plan2.recommendation);
    expect(plan1.isColdStart).toBe(plan2.isColdStart);

    // Difficulty ceiling
    for (const q of plan1.questions) {
      expect(q.difficulty).toBeLessThanOrEqual(2);
    }

    // Prerequisite satisfaction for cold-start (all foundational sub-skills)
    for (const q of plan1.questions) {
      expect(isSubSkillPrerequisiteSatisfied(q.primarySkillId, {})).toBe(true);
    }
  });

  it('verifies AC-E6-03: 100% prerequisite satisfaction verified from SKILL_TAXONOMY across 100 randomized player profiles', () => {
    const prng = createMulberry32('prereq-invariant-seed-2026');
    const allSubSkills = getAllSubSkills();

    for (let run = 0; run < 100; run++) {
      const records: Record<string, MasteryRecord> = {};
      const ceiling = randomInt(prng, 1, 6) as 1 | 2 | 3 | 4 | 5 | 6;

      // Randomly populate mastery records with varied mastery levels
      for (const skill of allSubSkills) {
        const roll = prng();
        if (roll < 0.25) {
          // Unassessed / insufficient data
          continue;
        } else if (roll < 0.50) {
          // Needs practice (weak)
          records[skill.id] = {
            subSkillId: skill.id,
            status: 'NEEDS_PRACTICE',
            statusLabel: 'Perlu Latihan',
            masteryScore: randomInt(prng, 20, 55),
            accuracyComponent: 40,
            speedComponent: 30,
            consistencyComponent: 40,
            recentAccuracy: 50,
            totalAnswers: 15,
            distinctSessions: 2,
            isStrongSkill: false,
            isWeakSkill: true,
            lastEvaluatedAt: 1773360000000,
            algorithmVersion: '2.0.0',
          };
        } else if (roll < 0.75) {
          // Competent (medium)
          records[skill.id] = {
            subSkillId: skill.id,
            status: 'COMPETENT',
            statusLabel: 'Cukup',
            masteryScore: randomInt(prng, 60, 79),
            accuracyComponent: 70,
            speedComponent: 65,
            consistencyComponent: 70,
            recentAccuracy: 75,
            totalAnswers: 20,
            distinctSessions: 3,
            isStrongSkill: false,
            isWeakSkill: false,
            lastEvaluatedAt: 1773360000000,
            algorithmVersion: '2.0.0',
          };
        } else {
          // Mastered (strong)
          records[skill.id] = {
            subSkillId: skill.id,
            status: 'MASTERED',
            statusLabel: 'Dikuasai',
            masteryScore: randomInt(prng, 80, 100),
            accuracyComponent: 95,
            speedComponent: 90,
            consistencyComponent: 95,
            recentAccuracy: 95,
            totalAnswers: 30,
            distinctSessions: 4,
            isStrongSkill: true,
            isWeakSkill: false,
            lastEvaluatedAt: 1773360000000,
            algorithmVersion: '2.0.0',
          };
        }
      }

      const plan = buildAdaptiveSession({
        masteryRecords: records,
        registry,
        seed: `prereq-run-${run}`,
        playerDifficultyCeiling: ceiling,
        sessionSize: 10,
      });

      expect(plan.questions.length).toBe(10);

      for (const q of plan.questions) {
        // 1. Question difficulty <= playerDifficultyCeiling
        expect(q.difficulty).toBeLessThanOrEqual(ceiling);

        // 2. 100% prerequisite satisfaction verified directly from SKILL_TAXONOMY
        const def = getSubSkill(q.primarySkillId);
        if (def && def.prerequisiteSubSkillIds && def.prerequisiteSubSkillIds.length > 0) {
          for (const preId of def.prerequisiteSubSkillIds) {
            const preRecord = records[preId];
            expect(preRecord).toBeDefined();
            expect(preRecord?.status).not.toBe('INSUFFICIENT_DATA');
            expect(preRecord?.masteryScore).toBeGreaterThanOrEqual(60);
          }
        }
        expect(isSubSkillPrerequisiteSatisfied(q.primarySkillId, records)).toBe(true);
      }
    }
  });

  it('verifies AC-E6-04: bit-for-bit determinism across 100 identical seeded runs with varied configurations', () => {
    const prng = createMulberry32('determinism-invariant-seed-2026');

    for (let run = 0; run < 100; run++) {
      const seed = `det-seed-${run}-${randomInt(prng, 1000, 999999)}`;
      const ceiling = randomInt(prng, 1, 6) as 1 | 2 | 3 | 4 | 5 | 6;
      const sessionSize = randomInt(prng, 10, 15);

      const records: Record<string, MasteryRecord> = {
        'addition.single_digit': {
          subSkillId: 'addition.single_digit',
          status: 'NEEDS_PRACTICE',
          statusLabel: 'Perlu Latihan',
          masteryScore: 40,
          accuracyComponent: 40,
          speedComponent: 30,
          consistencyComponent: 40,
          recentAccuracy: 50,
          totalAnswers: 20,
          distinctSessions: 3,
          isStrongSkill: false,
          isWeakSkill: true,
          lastEvaluatedAt: 1773360000000,
          algorithmVersion: '2.0.0',
        },
        'multiplication.x2': {
          subSkillId: 'multiplication.x2',
          status: 'MASTERED',
          statusLabel: 'Dikuasai',
          masteryScore: 90,
          accuracyComponent: 90,
          speedComponent: 85,
          consistencyComponent: 90,
          recentAccuracy: 95,
          totalAnswers: 25,
          distinctSessions: 4,
          isStrongSkill: true,
          isWeakSkill: false,
          lastEvaluatedAt: 1773360000000,
          algorithmVersion: '2.0.0',
        },
      };

      const planA = buildAdaptiveSession({
        masteryRecords: records,
        registry,
        seed,
        playerDifficultyCeiling: ceiling,
        sessionSize,
      });

      const planB = buildAdaptiveSession({
        masteryRecords: records,
        registry,
        seed,
        playerDifficultyCeiling: ceiling,
        sessionSize,
      });

      expect(planA.questions).toEqual(planB.questions);
      expect(planA.bucketAssignments).toEqual(planB.bucketAssignments);
      expect(planA.recommendation).toEqual(planB.recommendation);
      expect(planA.isColdStart).toBe(planB.isColdStart);
      expect(planA.metadata.seed).toBe(planB.metadata.seed);
      expect(planA.metadata.sessionSize).toBe(planB.metadata.sessionSize);
      expect(planA.metadata.difficultyCeiling).toBe(planB.metadata.difficultyCeiling);
    }
  });
});
