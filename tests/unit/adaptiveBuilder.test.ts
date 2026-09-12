import { describe, it, expect } from 'vitest';
import {
  buildAdaptiveSession,
  generateAdaptiveRecommendation,
} from '../../src/engine/adaptive/builder';
import { createGeneratorRegistry } from '../../src/engine/registry/generatorRegistry';
import { MasteryRecord } from '../../src/engine/mastery/types';

describe('Adaptive Session Builder', () => {
  const registry = createGeneratorRegistry();

  it('synthesizes cold-start diagnostic session when insufficient data (< 2 evaluated skills)', () => {
    const plan = buildAdaptiveSession({
      masteryRecords: {},
      registry,
      seed: 4242,
    });

    expect(plan.isColdStart).toBe(true);
    expect(plan.questions.length).toBe(10);
    expect(plan.bucketAssignments.COLD_START_DIAGNOSTIC).toBe(10);
    expect(plan.recommendation.reason).toContain('diagnostik');

    // Check operation mix: 3 addition, 3 subtraction, 2 multiplication, 2 division
    const additionCount = plan.questions.filter((q) => q.generatorKey === 'addition').length;
    const subtractionCount = plan.questions.filter((q) => q.generatorKey === 'subtraction').length;
    const multCount = plan.questions.filter((q) => q.generatorKey === 'multiplication').length;
    const divCount = plan.questions.filter((q) => q.generatorKey === 'division').length;

    expect(additionCount).toBe(3);
    expect(subtractionCount).toBe(3);
    expect(multCount).toBe(2);
    expect(divCount).toBe(2);
  });

  it('builds mastery-driven session adhering to sub-skill cap <= 40% and non-consecutive template invariant', () => {
    const records: Record<string, MasteryRecord> = {
      'addition.single_digit': {
        subSkillId: 'addition.single_digit',
        status: 'NEEDS_PRACTICE',
        statusLabel: 'Perlu Latihan',
        masteryScore: 45,
        accuracyComponent: 50,
        speedComponent: 40,
        consistencyComponent: 40,
        recentAccuracy: 50,
        totalAnswers: 20,
        distinctSessions: 3,
        isStrongSkill: false,
        isWeakSkill: true,
        lastEvaluatedAt: Date.now(),
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
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
      'multiplication.x2': {
        subSkillId: 'multiplication.x2',
        status: 'MASTERED',
        statusLabel: 'Dikuasai',
        masteryScore: 95,
        accuracyComponent: 95,
        speedComponent: 95,
        consistencyComponent: 100,
        recentAccuracy: 100,
        totalAnswers: 30,
        distinctSessions: 4,
        isStrongSkill: true,
        isWeakSkill: false,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
    };

    const plan = buildAdaptiveSession({
      masteryRecords: records,
      registry,
      seed: 8888,
    });

    expect(plan.isColdStart).toBe(false);
    expect(plan.questions.length).toBe(10);

    // AC-E6-02: No single sub-skill exceeds 40% of session (<= 4 questions)
    const subSkillCounts = new Map<string, number>();
    for (const q of plan.questions) {
      const id = q.primarySkillId || 'unknown';
      subSkillCounts.set(id, (subSkillCounts.get(id) || 0) + 1);
    }
    for (const [, count] of subSkillCounts) {
      expect(count).toBeLessThanOrEqual(4);
    }

    // AC-E6-02: No consecutive identical templateFamily
    for (let i = 1; i < plan.questions.length; i++) {
      expect(plan.questions[i].templateFamily).not.toBe(plan.questions[i - 1].templateFamily);
    }
  });

  it('enforces template family diversity when multiple weak skills share a template family', () => {
    // Both addition.single_digit and addition.within_20 share addition_basic
    const records: Record<string, MasteryRecord> = {
      'addition.single_digit': {
        subSkillId: 'addition.single_digit',
        status: 'NEEDS_PRACTICE',
        statusLabel: 'Perlu Latihan',
        masteryScore: 40,
        accuracyComponent: 40,
        speedComponent: 40,
        consistencyComponent: 40,
        recentAccuracy: 40,
        totalAnswers: 20,
        distinctSessions: 3,
        isStrongSkill: false,
        isWeakSkill: true,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
      'addition.within_20': {
        subSkillId: 'addition.within_20',
        status: 'NEEDS_PRACTICE',
        statusLabel: 'Perlu Latihan',
        masteryScore: 45,
        accuracyComponent: 45,
        speedComponent: 40,
        consistencyComponent: 40,
        recentAccuracy: 45,
        totalAnswers: 20,
        distinctSessions: 3,
        isStrongSkill: false,
        isWeakSkill: true,
        lastEvaluatedAt: Date.now(),
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
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
    };

    const plan = buildAdaptiveSession({
      masteryRecords: records,
      registry,
      seed: 5555,
      sessionSize: 10,
    });

    expect(plan.questions.length).toBe(10);

    // Template family usage cap: no family exceeds Math.floor(10 / 2) = 5
    const familyCounts = new Map<string, number>();
    for (const q of plan.questions) {
      familyCounts.set(q.templateFamily, (familyCounts.get(q.templateFamily) || 0) + 1);
    }
    for (const [, count] of familyCounts) {
      expect(count).toBeLessThanOrEqual(5);
    }

    // Zero consecutive identical templateFamily
    for (let i = 1; i < plan.questions.length; i++) {
      expect(plan.questions[i].templateFamily).not.toBe(plan.questions[i - 1].templateFamily);
    }
  });

  it('filters recent errors with unsatisfied prerequisites (AC-E6-03)', () => {
    const records: Record<string, MasteryRecord> = {
      'addition.single_digit': {
        subSkillId: 'addition.single_digit',
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
        lastEvaluatedAt: Date.now(),
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
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
    };

    // division.signed requires division.x4_9_inverse which is not in records
    const recentErrors = [
      {
        questionDefinitionId: 'err-unsatisfied',
        primarySkillId: 'division.signed',
        skillTags: ['division', 'signed'],
        difficulty: 4 as const,
        generatorKey: 'division',
        templateFamily: 'division_clean',
      },
    ];

    const plan = buildAdaptiveSession({
      masteryRecords: records,
      recentErrors,
      registry,
      seed: 7777,
      sessionSize: 10,
    });

    // Recent error with unsatisfied prerequisite should not appear as primarySkillId
    for (const q of plan.questions) {
      expect(q.primarySkillId).not.toBe('division.signed');
    }
  });

  it('filters candidate sub-skills exceeding playerDifficultyCeiling (AC-E6-03)', () => {
    const records: Record<string, MasteryRecord> = {
      'addition.single_digit': {
        subSkillId: 'addition.single_digit',
        status: 'NEEDS_PRACTICE',
        statusLabel: 'Perlu Latihan',
        masteryScore: 50,
        accuracyComponent: 50,
        speedComponent: 50,
        consistencyComponent: 50,
        recentAccuracy: 50,
        totalAnswers: 20,
        distinctSessions: 3,
        isStrongSkill: false,
        isWeakSkill: true,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
      // addition.hundreds has difficultyBase 4
      'addition.hundreds': {
        subSkillId: 'addition.hundreds',
        status: 'NEEDS_PRACTICE',
        statusLabel: 'Perlu Latihan',
        masteryScore: 30,
        accuracyComponent: 30,
        speedComponent: 30,
        consistencyComponent: 30,
        recentAccuracy: 30,
        totalAnswers: 20,
        distinctSessions: 3,
        isStrongSkill: false,
        isWeakSkill: true,
        lastEvaluatedAt: Date.now(),
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
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
    };

    const plan = buildAdaptiveSession({
      masteryRecords: records,
      registry,
      seed: 999,
      playerDifficultyCeiling: 1,
    });

    for (const q of plan.questions) {
      expect(q.difficulty).toBeLessThanOrEqual(1);
      expect(q.primarySkillId).not.toBe('addition.hundreds');
    }
  });

  it('clamps sessionSize to minimum 10 and floors fractional sessionSize', () => {
    const planClamped = buildAdaptiveSession({
      masteryRecords: {},
      registry,
      seed: 111,
      sessionSize: 6,
    });
    expect(planClamped.questions.length).toBe(10);

    const planFloored = buildAdaptiveSession({
      masteryRecords: {},
      registry,
      seed: 222,
      sessionSize: 11.8,
    });
    expect(planFloored.questions.length).toBe(11);
  });

  it('respects playerDifficultyCeiling across all questions', () => {
    const plan = buildAdaptiveSession({
      masteryRecords: {},
      registry,
      seed: 333,
      playerDifficultyCeiling: 1,
    });

    for (const q of plan.questions) {
      expect(q.difficulty).toBeLessThanOrEqual(1);
    }
  });

  it('generates accurate recommendations for cold-start, weak focus, errors, and maintenance', () => {
    // 1. Cold start
    const recCold = generateAdaptiveRecommendation({}, 0, true);
    expect(recCold.suggestedAction).toBe('focus_practice');
    expect(recCold.reason).toContain('diagnostik');

    // 2. Weak skill focus
    const recordsWithWeak: Record<string, MasteryRecord> = {
      'addition.carry': {
        subSkillId: 'addition.carry',
        status: 'NEEDS_PRACTICE',
        statusLabel: 'Perlu Latihan',
        masteryScore: 42,
        accuracyComponent: 45,
        speedComponent: 40,
        consistencyComponent: 40,
        recentAccuracy: 45,
        totalAnswers: 20,
        distinctSessions: 2,
        isStrongSkill: false,
        isWeakSkill: true,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
      'addition.single_digit': {
        subSkillId: 'addition.single_digit',
        status: 'MASTERED',
        statusLabel: 'Dikuasai',
        masteryScore: 90,
        accuracyComponent: 95,
        speedComponent: 90,
        consistencyComponent: 90,
        recentAccuracy: 95,
        totalAnswers: 30,
        distinctSessions: 3,
        isStrongSkill: true,
        isWeakSkill: false,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
    };
    const recWeak = generateAdaptiveRecommendation(recordsWithWeak, 0, false);
    expect(recWeak.suggestedAction).toBe('focus_practice');
    expect(recWeak.primarySubSkillId).toBe('addition.carry');
    expect(recWeak.reason).toContain('Perlu Latihan');

    // 3. Remediate recent errors
    const recordsCompetent: Record<string, MasteryRecord> = {
      'addition.single_digit': {
        subSkillId: 'addition.single_digit',
        status: 'COMPETENT',
        statusLabel: 'Cukup',
        masteryScore: 75,
        accuracyComponent: 75,
        speedComponent: 75,
        consistencyComponent: 75,
        recentAccuracy: 80,
        totalAnswers: 20,
        distinctSessions: 3,
        isStrongSkill: false,
        isWeakSkill: false,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
      'subtraction.single_digit': {
        subSkillId: 'subtraction.single_digit',
        status: 'COMPETENT',
        statusLabel: 'Cukup',
        masteryScore: 72,
        accuracyComponent: 72,
        speedComponent: 70,
        consistencyComponent: 75,
        recentAccuracy: 75,
        totalAnswers: 20,
        distinctSessions: 3,
        isStrongSkill: false,
        isWeakSkill: false,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
    };
    const recError = generateAdaptiveRecommendation(recordsCompetent, 3, false);
    expect(recError.suggestedAction).toBe('remediate_errors');
    expect(recError.reason).toContain('3 kesalahan terbaru');

    // 4. Strong maintenance
    const recordsStrong: Record<string, MasteryRecord> = {
      'addition.single_digit': {
        subSkillId: 'addition.single_digit',
        status: 'MASTERED',
        statusLabel: 'Dikuasai',
        masteryScore: 92,
        accuracyComponent: 95,
        speedComponent: 90,
        consistencyComponent: 95,
        recentAccuracy: 95,
        totalAnswers: 25,
        distinctSessions: 4,
        isStrongSkill: true,
        isWeakSkill: false,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
      'multiplication.x2': {
        subSkillId: 'multiplication.x2',
        status: 'MASTERED',
        statusLabel: 'Dikuasai',
        masteryScore: 95,
        accuracyComponent: 95,
        speedComponent: 95,
        consistencyComponent: 100,
        recentAccuracy: 100,
        totalAnswers: 30,
        distinctSessions: 4,
        isStrongSkill: true,
        isWeakSkill: false,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
    };
    const recStrong = generateAdaptiveRecommendation(recordsStrong, 0, false);
    expect(recStrong.suggestedAction).toBe('maintain_strength');
    expect(recStrong.reason).toContain('Pertahankan');
  });

  it('guarantees bit-for-bit determinism across identical seeds', () => {
    const planA = buildAdaptiveSession({
      masteryRecords: {},
      registry,
      seed: 9999,
    });

    const planB = buildAdaptiveSession({
      masteryRecords: {},
      registry,
      seed: 9999,
    });

    expect(planA.questions).toEqual(planB.questions);
    expect(planA.bucketAssignments).toEqual(planB.bucketAssignments);
  });

  it('guarantees AC-E6-02 non-consecutive invariant and template family cap across varied seeds', () => {
    const candidateSkills = [
      'addition.single_digit',
      'addition.within_20',
      'addition.tens',
      'subtraction.single_digit',
      'subtraction.within_20',
      'multiplication.x2',
      'multiplication.x3',
    ];

    for (let seed = 1000; seed < 1020; seed++) {
      const records: Record<string, MasteryRecord> = {};
      for (const skillId of candidateSkills) {
        records[skillId] = {
          subSkillId: skillId,
          status: seed % 2 === 0 ? 'NEEDS_PRACTICE' : 'COMPETENT',
          statusLabel: 'Test',
          masteryScore: 40 + (seed % 50),
          accuracyComponent: 50,
          speedComponent: 50,
          consistencyComponent: 50,
          recentAccuracy: 50,
          totalAnswers: 20,
          distinctSessions: 3,
          isStrongSkill: false,
          isWeakSkill: seed % 2 === 0,
          lastEvaluatedAt: Date.now(),
          algorithmVersion: '2.0.0',
        };
      }

      const plan = buildAdaptiveSession({
        masteryRecords: records,
        registry,
        seed,
        sessionSize: 10,
      });

      expect(plan.questions.length).toBe(10);

      // Sub-skill cap <= 40% (max 4 per 10 questions)
      const subSkillCounts = new Map<string, number>();
      const familyCounts = new Map<string, number>();
      for (let i = 0; i < plan.questions.length; i++) {
        const q = plan.questions[i];
        subSkillCounts.set(q.primarySkillId || 'unknown', (subSkillCounts.get(q.primarySkillId || 'unknown') || 0) + 1);
        familyCounts.set(q.templateFamily, (familyCounts.get(q.templateFamily) || 0) + 1);

        if (i > 0) {
          expect(q.templateFamily).not.toBe(plan.questions[i - 1].templateFamily);
        }
      }

      for (const [, count] of subSkillCounts) {
        expect(count).toBeLessThanOrEqual(4);
      }
      for (const [, count] of familyCounts) {
        expect(count).toBeLessThanOrEqual(5);
      }
    }
  });
});
