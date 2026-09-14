import { Question } from '../types/question';
import { QuestionGeneratorRegistry } from '../registry';

/**
 * Evidence collected from a failed question during a gameplay session.
 * Fully compatible with the Question interface.
 */
export interface FailedQuestionEvidence {
  questionDefinitionId?: string;
  displayPrompt?: string;
  primarySkillId: string;
  skillTags?: string[];
  difficulty: 1 | 2 | 3 | 4 | 5 | 6 | number;
  generatorKey?: string;
  templateFamily?: string;
  targetResponseTimeMs?: number;
  explanation?: string;
  userAnswer?: string | number;
  expectedAnswer?: string | number;
  responseTimeMs?: number;
}

/**
 * Input configuration for the Remediation Session Builder ("Latih Kesalahan Saya").
 */
export interface RemediationBuilderOptions {
  failedQuestions: (Question | FailedQuestionEvidence)[];
  registry: QuestionGeneratorRegistry;
  seed?: number | string;
  sessionSize?: number;
}

/**
 * Metadata describing the generated remediation session.
 */
export interface RemediationSessionMetadata {
  sessionSize: number;
  distinctFailedFamiliesCount: number;
  maxDifficultyCeiling: number;
  seed: number | string;
  generatedAt: number;
}

/**
 * Generated remediation session plan containing questions targeted at user errors.
 */
export interface RemediationSessionPlan {
  questions: Question[];
  targetSkillIds: string[];
  metadata: RemediationSessionMetadata;
}
