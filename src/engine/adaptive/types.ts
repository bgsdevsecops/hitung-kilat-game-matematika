import { Question } from '../types/question';
import { MasteryRecord } from '../mastery/types';
import { FailedQuestionEvidence } from '../remediation/types';
import { QuestionGeneratorRegistry } from '../registry';

export type AdaptiveBucket =
  | 'WEAK_SKILLS'
  | 'MEDIUM_SKILLS'
  | 'RECENT_ERRORS'
  | 'STRONG_MAINTENANCE'
  | 'COLD_START_DIAGNOSTIC';

export interface AdaptiveSelectorPolicy {
  version: string;
  weakSkillsRatio: number;
  mediumSkillsRatio: number;
  recentErrorsRatio: number;
  strongMaintenanceRatio: number;
  maxSubSkillShare: number;
  minSessionSize: number;
}

export const DEFAULT_ADAPTIVE_POLICY: AdaptiveSelectorPolicy = {
  version: '2.2.0',
  weakSkillsRatio: 0.50,
  mediumSkillsRatio: 0.25,
  recentErrorsRatio: 0.15,
  strongMaintenanceRatio: 0.10,
  maxSubSkillShare: 0.40,
  minSessionSize: 10,
};

export interface AdaptiveRecommendation {
  primarySubSkillId: string;
  reason: string;
  suggestedAction: 'focus_practice' | 'remediate_errors' | 'maintain_strength';
  alternateSubSkillIds: string[];
}

export interface AdaptiveBuilderOptions {
  masteryRecords: Record<string, MasteryRecord>;
  recentErrors?: (Question | FailedQuestionEvidence)[];
  playerDifficultyCeiling?: 1 | 2 | 3 | 4 | 5 | 6;
  sessionSize?: number;
  untimed?: boolean;
  seed?: number | string;
  policy?: Partial<AdaptiveSelectorPolicy>;
  registry: QuestionGeneratorRegistry;
}

export interface AdaptiveSessionPlan {
  questions: Question[];
  bucketAssignments: Record<AdaptiveBucket, number>;
  recommendation: AdaptiveRecommendation;
  isColdStart: boolean;
  metadata: {
    sessionSize: number;
    seed: number | string;
    policyVersion: string;
    generatedAt: number;
    difficultyCeiling: number;
    untimed: boolean;
  };
}
