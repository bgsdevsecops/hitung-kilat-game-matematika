import { AnswerSpec } from './answer';

export interface GenerationContext {
  levelId: string;
  sequenceIndex: number;
  contentVersion?: string;
  rulesVersion?: string;
  existingSignatures?: Set<string>;
}

export interface Question {
  questionDefinitionId: string;
  questionInstanceId: string;
  displayPrompt: string;
  answerSpec: AnswerSpec;
  primarySkillId: string;
  skillTags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5 | 6;
  generatorKey: string;
  targetResponseTimeMs: number;
  templateFamily: string;
  explanation: string;
}
