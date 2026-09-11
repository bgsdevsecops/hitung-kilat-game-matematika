import { Question } from './question';

export type SessionLifecycle =
  | 'CREATED'
  | 'ACTIVE'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABANDONED';

export interface AnswerEvent {
  eventId: string;
  questionInstanceId: string;
  questionDefinitionId: string;
  submittedAnswer: string;
  isCorrect: boolean;
  responseTimeMs: number;
  primarySkillId: string;
  skillTags: string[];
  submittedAtMonotonic: number;
}

export interface SessionResult {
  sessionId: string;
  levelId: string;
  sessionStatus: 'COMPLETED' | 'FAILED' | 'ABANDONED';
  questionsPresented: number;
  questionsAnswered: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: number;
  score: number;
  totalTimeSec: number;
  avgResponseTimeMs: number;
  maxCombo: number;
  stars: 0 | 1 | 2 | 3;
  perfect: boolean;
  history: AnswerEvent[];
}

export interface SessionState {
  sessionId: string;
  lifecycle: SessionLifecycle;
  levelId: string;
  questions: Question[];
  currentIndex: number;
  score: number;
  streak: number;
  maxStreak: number;
  inputLocked: boolean;
  answerHistory: AnswerEvent[];
  startedAtMonotonic: number;
  deadlineMonotonic: number;
  lastFeedback: {
    isCorrect: boolean;
    explanation: string;
  } | null;
  result: SessionResult | null;
}
