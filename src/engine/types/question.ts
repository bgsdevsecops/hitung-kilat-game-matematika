import { AnswerSpec } from './answer';

export interface GenerationContext {
  levelId: string;
  sequenceIndex: number;
  contentVersion?: string;
  rulesVersion?: string;
  existingSignatures?: Set<string>;
}

export interface Question {
  questionDefinitionId?: string;
  questionInstanceId?: string;
  id?: string;
  prompt?: string;
  displayPrompt: string;
  answerSpec: AnswerSpec;
  primarySkillId: string;
  skillTags?: string[];
  difficulty: 1 | 2 | 3 | 4 | 5 | 6 | number;
  generatorKey?: string;
  targetResponseTimeMs?: number;
  templateFamily?: string;
  explanation?: string;
  isCorrect?: boolean;
  timeSpentMs?: number;
}
