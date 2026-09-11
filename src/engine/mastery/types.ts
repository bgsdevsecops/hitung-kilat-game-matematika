/**
 * Mastery V2.0 Data Contracts and Types
 * Reference: PRD Section 8.3.2, 8.3.3 & Milestone V2.1 Design Spec Section 3
 */

export type MasteryStatus =
  | 'INSUFFICIENT_DATA'
  | 'NEEDS_PRACTICE'
  | 'DEVELOPING'
  | 'COMPETENT'
  | 'PROFICIENT'
  | 'MASTERED';

export interface StoredAnswerEvent {
  eventId: string;
  sessionId: string;
  questionDefinitionId: string;
  primarySkillId: string;
  subSkillId: string;
  skillTags: string[];
  templateFamily: string;
  difficulty: number;
  targetResponseTimeMs: number;
  responseTimeMs: number;
  isCorrect: boolean;
  timestamp: number;
  evidenceWeight?: number;
}

export interface MasteryComputeOptions {
  evaluationTimeMs?: number;
  untimed?: boolean;
  targetSubSkillId?: string;
}

export interface MasteryRecord {
  subSkillId: string;
  status: MasteryStatus;
  statusLabel: string;
  masteryScore: number;
  accuracyComponent: number;
  speedComponent: number | null;
  consistencyComponent: number;
  recentAccuracy: number;
  totalAnswers: number;
  distinctSessions: number;
  isStrongSkill: boolean;
  isWeakSkill: boolean;
  lastEvaluatedAt: number;
  algorithmVersion: string;
}
