export type CompetitiveMode = 'sprint' | 'survival' | 'daily';

export type CompetitiveSessionStatus =
  | 'ACTIVE'
  | 'PENDING'
  | 'VALIDATED'
  | 'REJECTED'
  | 'FAILED'
  | 'ABANDONED';

export interface CompetitiveSessionContract {
  sessionId: string;
  userId: string;
  mode: CompetitiveMode;
  rulesVersion: string;
  contentVersion: string;
  challengeId?: string;
  serverStartedAt: number;
  serverDeadlineAt: number;
  status: CompetitiveSessionStatus;
  isRanked: boolean;
  idempotencyKey: string;
}

export interface CompetitiveQuestionView {
  questionInstanceId: string;
  sequence: number;
  renderedPrompt: string;
  answerInputKind: 'numeric' | 'fraction' | 'decimal';
  constraints?: {
    min?: number;
    max?: number;
    allowNegative?: boolean;
    precision?: number;
  };
  questionToken: string;
}

export interface SubmittedAnswerPayload {
  sequence: number;
  questionToken: string;
  rawInput: string;
  clientAnsweredAt: number;
  inputLatencyMs: number;
  idempotencyKey: string;
}

export interface CompetitiveResultDoc {
  resultId: string;
  sessionId: string;
  userId: string;
  mode: CompetitiveMode;
  status: 'VALIDATED' | 'REJECTED';
  isRanked: boolean;
  score: number;
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  questionsAnswered: number;
  rankedActiveDurationMs: number;
  maxStreak: number;
  difficultyReached: number;
  rejectionReasons: string[];
  finalizedAt: number;
  rulesVersion: string;
  contentVersion: string;
  challengeId?: string;
}

export interface LeaderboardEntryDoc {
  entryId: string;
  mode: CompetitiveMode;
  periodKey: string;
  rulesVersion: string;
  contentVersion: string;
  pseudonym: string;
  score: number;
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  durationMs: number;
  finalizedAt: number;
  resultId: string;
}
