import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ADAPTIVE_POLICY,
  AdaptiveBucket,
  AdaptiveRecommendation,
  AdaptiveSessionPlan,
} from '../../src/engine/adaptive';

describe('Adaptive Types & Policy Defaults', () => {
  it('defines valid default policy parameters', () => {
    expect(DEFAULT_ADAPTIVE_POLICY.version).toBe('2.2.0');
    expect(DEFAULT_ADAPTIVE_POLICY.weakSkillsRatio).toBe(0.50);
    expect(DEFAULT_ADAPTIVE_POLICY.mediumSkillsRatio).toBe(0.25);
    expect(DEFAULT_ADAPTIVE_POLICY.recentErrorsRatio).toBe(0.15);
    expect(DEFAULT_ADAPTIVE_POLICY.strongMaintenanceRatio).toBe(0.10);
    expect(DEFAULT_ADAPTIVE_POLICY.maxSubSkillShare).toBe(0.40);
    expect(DEFAULT_ADAPTIVE_POLICY.minSessionSize).toBe(10);

    const totalRatio =
      DEFAULT_ADAPTIVE_POLICY.weakSkillsRatio +
      DEFAULT_ADAPTIVE_POLICY.mediumSkillsRatio +
      DEFAULT_ADAPTIVE_POLICY.recentErrorsRatio +
      DEFAULT_ADAPTIVE_POLICY.strongMaintenanceRatio;
    expect(totalRatio).toBeCloseTo(1.0);
  });

  it('verifies type contract integrity for AdaptiveRecommendation', () => {
    const recommendation: AdaptiveRecommendation = {
      primarySubSkillId: 'addition.single_digit',
      reason: 'Akurasi rendah pada penjumlahan dasar',
      suggestedAction: 'focus_practice',
      alternateSubSkillIds: ['subtraction.single_digit'],
    };

    expect(recommendation.primarySubSkillId).toBe('addition.single_digit');
    expect(recommendation.suggestedAction).toBe('focus_practice');
    expect(recommendation.alternateSubSkillIds).toHaveLength(1);
  });

  it('verifies type contract integrity for AdaptiveSessionPlan and bucket allocations', () => {
    const buckets: Record<AdaptiveBucket, number> = {
      WEAK_SKILLS: 5,
      MEDIUM_SKILLS: 2,
      RECENT_ERRORS: 2,
      STRONG_MAINTENANCE: 1,
      COLD_START_DIAGNOSTIC: 0,
    };

    const plan: AdaptiveSessionPlan = {
      questions: [],
      bucketAssignments: buckets,
      recommendation: {
        primarySubSkillId: 'multiplication.tables_6_to_9',
        reason: 'Perkalian ×7 perlu latihan',
        suggestedAction: 'focus_practice',
        alternateSubSkillIds: [],
      },
      isColdStart: false,
      metadata: {
        sessionSize: 10,
        seed: 12345,
        policyVersion: '2.2.0',
        generatedAt: 1726135200000,
        difficultyCeiling: 3,
        untimed: false,
      },
    };

    expect(plan.isColdStart).toBe(false);
    expect(plan.bucketAssignments.WEAK_SKILLS).toBe(5);
    expect(plan.metadata.difficultyCeiling).toBe(3);
  });
});
