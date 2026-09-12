import { describe, it, expect } from 'vitest';
import {
  allocateBucketSlots,
  classifyMasteryBuckets,
  isSubSkillPrerequisiteSatisfied,
} from '../../src/engine/adaptive/selector';
import { DEFAULT_ADAPTIVE_POLICY } from '../../src/engine/adaptive/types';
import { MasteryRecord } from '../../src/engine/mastery/types';
import { Question } from '../../src/engine/types/question';
import { FailedQuestionEvidence } from '../../src/engine/remediation/types';

describe('Adaptive Selector & Bucket Allocator', () => {
  const createMockRecord = (
    id: string,
    score: number,
    recentAcc = 80,
    isWeak = false,
    isStrong = false,
    status?: MasteryRecord['status']
  ): MasteryRecord => ({
    subSkillId: id,
    status:
      status ??
      (score >= 80 ? 'PROFICIENT' : score >= 60 ? 'COMPETENT' : 'NEEDS_PRACTICE'),
    statusLabel: 'Test',
    masteryScore: score,
    accuracyComponent: score,
    speedComponent: 80,
    consistencyComponent: 80,
    recentAccuracy: recentAcc,
    totalAnswers: 20,
    distinctSessions: 3,
    isStrongSkill: isStrong,
    isWeakSkill: isWeak,
    lastEvaluatedAt: Date.now(),
    algorithmVersion: '2.0.0',
  });

  describe('allocateBucketSlots', () => {
    it('allocates 10 slots with Hare-Niemeyer largest remainder: 5 weak, 2/3 med, 1/2 err, 1 strong', () => {
      const available = new Set([
        'WEAK_SKILLS',
        'MEDIUM_SKILLS',
        'RECENT_ERRORS',
        'STRONG_MAINTENANCE',
      ] as const);
      const slots = allocateBucketSlots(10, DEFAULT_ADAPTIVE_POLICY, available);
      expect(slots.WEAK_SKILLS).toBe(5);
      expect(slots.MEDIUM_SKILLS).toBe(2);
      expect(slots.RECENT_ERRORS).toBe(2);
      expect(slots.STRONG_MAINTENANCE).toBe(1);
      expect(
        slots.WEAK_SKILLS +
          slots.MEDIUM_SKILLS +
          slots.RECENT_ERRORS +
          slots.STRONG_MAINTENANCE
      ).toBe(10);
    });

    it('redistributes slots proportionally when RECENT_ERRORS bucket is empty', () => {
      const available = new Set([
        'WEAK_SKILLS',
        'MEDIUM_SKILLS',
        'STRONG_MAINTENANCE',
      ] as const);
      const slots = allocateBucketSlots(10, DEFAULT_ADAPTIVE_POLICY, available);
      expect(slots.RECENT_ERRORS).toBe(0);
      expect(
        slots.WEAK_SKILLS + slots.MEDIUM_SKILLS + slots.STRONG_MAINTENANCE
      ).toBe(10);
      expect(slots.WEAK_SKILLS).toBeGreaterThanOrEqual(5);
    });

    it('allocates all slots to available bucket when only one bucket is available', () => {
      const available = new Set(['WEAK_SKILLS'] as const);
      const slots = allocateBucketSlots(10, DEFAULT_ADAPTIVE_POLICY, available);
      expect(slots.WEAK_SKILLS).toBe(10);
      expect(slots.MEDIUM_SKILLS).toBe(0);
      expect(slots.RECENT_ERRORS).toBe(0);
      expect(slots.STRONG_MAINTENANCE).toBe(0);
    });

    it('handles session size 15 and 20 with exact sum matching session size', () => {
      const available = new Set([
        'WEAK_SKILLS',
        'MEDIUM_SKILLS',
        'RECENT_ERRORS',
        'STRONG_MAINTENANCE',
      ] as const);

      const slots15 = allocateBucketSlots(15, DEFAULT_ADAPTIVE_POLICY, available);
      const sum15 =
        slots15.WEAK_SKILLS +
        slots15.MEDIUM_SKILLS +
        slots15.RECENT_ERRORS +
        slots15.STRONG_MAINTENANCE;
      expect(sum15).toBe(15);

      const slots20 = allocateBucketSlots(20, DEFAULT_ADAPTIVE_POLICY, available);
      const sum20 =
        slots20.WEAK_SKILLS +
        slots20.MEDIUM_SKILLS +
        slots20.RECENT_ERRORS +
        slots20.STRONG_MAINTENANCE;
      expect(sum20).toBe(20);
    });

    it('handles zero or negative session size safely', () => {
      const available = new Set(['WEAK_SKILLS', 'MEDIUM_SKILLS'] as const);
      const slots = allocateBucketSlots(0, DEFAULT_ADAPTIVE_POLICY, available);
      expect(slots.WEAK_SKILLS).toBe(0);
      expect(slots.MEDIUM_SKILLS).toBe(0);
    });

    it('allocates to COLD_START_DIAGNOSTIC when it is the only available bucket', () => {
      const available = new Set(['COLD_START_DIAGNOSTIC'] as const);
      const slots = allocateBucketSlots(10, DEFAULT_ADAPTIVE_POLICY, available);
      expect(slots.COLD_START_DIAGNOSTIC).toBe(10);
      expect(slots.WEAK_SKILLS).toBe(0);
    });
  });

  describe('classifyMasteryBuckets', () => {
    it('classifies records into appropriate buckets based on PRD §14', () => {
      const records: Record<string, MasteryRecord> = {
        'addition.carry': createMockRecord('addition.carry', 50, 60, true, false), // Weak
        'multiplication.x7': createMockRecord('multiplication.x7', 70, 75, false, false), // Medium
        'division.basic_235': createMockRecord('division.basic_235', 90, 95, false, true), // Strong
      };

      const classified = classifyMasteryBuckets(records, []);
      expect(classified.WEAK_SKILLS).toContain('addition.carry');
      expect(classified.MEDIUM_SKILLS).toContain('multiplication.x7');
      expect(classified.STRONG_MAINTENANCE).toContain('division.basic_235');
    });

    it('ignores records with INSUFFICIENT_DATA status', () => {
      const records: Record<string, MasteryRecord> = {
        'addition.single_digit': {
          ...createMockRecord('addition.single_digit', 0, 0, false, false),
          status: 'INSUFFICIENT_DATA',
        },
      };

      const classified = classifyMasteryBuckets(records, []);
      expect(classified.WEAK_SKILLS).not.toContain('addition.single_digit');
      expect(classified.MEDIUM_SKILLS).not.toContain('addition.single_digit');
      expect(classified.STRONG_MAINTENANCE).not.toContain('addition.single_digit');
    });

    it('classifies low recent accuracy (<70%) as WEAK_SKILLS even with high score', () => {
      const records: Record<string, MasteryRecord> = {
        'addition.hundreds': createMockRecord('addition.hundreds', 82, 65, false, false),
      };

      const classified = classifyMasteryBuckets(records, []);
      expect(classified.WEAK_SKILLS).toContain('addition.hundreds');
    });

    it('extracts unique skill IDs from recentErrors (both primarySkillId and skillTags)', () => {
      const records: Record<string, MasteryRecord> = {};
      const recentErrors: (Question | FailedQuestionEvidence)[] = [
        {
          questionDefinitionId: 'q1',
          questionInstanceId: 'i1',
          displayPrompt: '7 x 8',
          answerSpec: { kind: 'integer', value: 56 },
          primarySkillId: 'multiplication.x7',
          skillTags: ['multiplication.x8', 'multiplication.single_digit'],
          difficulty: 3,
          generatorKey: 'multiplication',
          targetResponseTimeMs: 4000,
          templateFamily: 'mul_basic',
          explanation: '7 x 8 = 56',
        },
        {
          primarySkillId: 'addition.carry',
          skillTags: ['addition.within_20'],
          difficulty: 3,
          templateFamily: 'add_carry',
        },
      ];

      const classified = classifyMasteryBuckets(records, recentErrors);
      expect(classified.RECENT_ERRORS).toContain('multiplication.x7');
      expect(classified.RECENT_ERRORS).toContain('multiplication.x8');
      expect(classified.RECENT_ERRORS).toContain('multiplication.single_digit');
      expect(classified.RECENT_ERRORS).toContain('addition.carry');
      expect(classified.RECENT_ERRORS).toContain('addition.within_20');
    });
  });

  describe('isSubSkillPrerequisiteSatisfied', () => {
    it('validates prerequisite satisfaction using SKILL_TAXONOMY', () => {
      const records: Record<string, MasteryRecord> = {
        'multiplication.x7': createMockRecord('multiplication.x7', 85, 90, false, true),
      };
      // Introductory skill with no prerequisites passes
      expect(isSubSkillPrerequisiteSatisfied('addition.single_digit', records)).toBe(true);
    });

    it('returns false when required prerequisite has not been practiced at all', () => {
      const records: Record<string, MasteryRecord> = {};
      // addition.within_20 requires addition.single_digit
      expect(isSubSkillPrerequisiteSatisfied('addition.within_20', records)).toBe(false);
    });

    it('returns false when prerequisite has INSUFFICIENT_DATA', () => {
      const records: Record<string, MasteryRecord> = {
        'addition.single_digit': {
          ...createMockRecord('addition.single_digit', 0, 0),
          status: 'INSUFFICIENT_DATA',
        },
      };
      expect(isSubSkillPrerequisiteSatisfied('addition.within_20', records)).toBe(false);
    });

    it('returns false when prerequisite mastery score is below 60', () => {
      const records: Record<string, MasteryRecord> = {
        'addition.single_digit': createMockRecord('addition.single_digit', 55, 60),
      };
      expect(isSubSkillPrerequisiteSatisfied('addition.within_20', records)).toBe(false);
    });

    it('returns true when prerequisite mastery score is >= 60', () => {
      const records: Record<string, MasteryRecord> = {
        'addition.single_digit': createMockRecord('addition.single_digit', 60, 80),
      };
      expect(isSubSkillPrerequisiteSatisfied('addition.within_20', records)).toBe(true);
    });

    it('returns true for unknown subskill ID without blocking', () => {
      const records: Record<string, MasteryRecord> = {};
      expect(isSubSkillPrerequisiteSatisfied('unknown.skill', records)).toBe(true);
    });
  });
});
