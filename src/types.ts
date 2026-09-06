export type OperationType = '+' | '-' | '*' | '/' | 'mix' | 'algebra' | 'order_of_ops';

export type DifficultyTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface TierInfo {
  id: DifficultyTier;
  name: string;
  badgeColor: string;
  description: string;
}

export interface LevelConfig {
  id: number;
  title: string;
  tier: DifficultyTier;
  tierName: string;
  description: string;
  questionsCount: number;
  timeLimitSec: number; // Waktu total untuk menyelesaikan level
  operations: ('+' | '-' | '*' | '/')[];
  specialType?: 'normal' | 'missing_operand' | 'three_terms' | 'extreme';
  maxNum1: number;
  maxNum2: number;
  allowNegative?: boolean;
}

export interface UserLevelProgress {
  levelId: number;
  unlocked: boolean;
  stars: number; // 0, 1, 2, 3
  bestScore: number;
  bestTimeSec: number;
  accuracy: number;
  completedAt?: string;
}

export interface Question {
  id: string;
  prompt: string; // Teks yang ditampilkan, misal "14 + 27" atau "7 × ? = 42"
  missingPosition?: 'first' | 'second' | 'result';
  num1: number;
  num2: number;
  num3?: number;
  operation: string;
  correctAnswer: number;
  explanation: string;
  userAnswer?: number;
  isCorrect?: boolean;
  timeSpentMs?: number;
}

export type GameMode = 'campaign' | 'time_attack' | 'practice';

export interface GameSummary {
  mode: GameMode;
  levelId?: number;
  score: number;
  questionsTotal: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  timeSpentSec: number;
  avgTimePerQuestionSec: number;
  questionsPerMinute: number;
  maxStreak: number;
  starsEarned: number;
  history: Question[];
  isNewRecord: boolean;
}

export interface UserStats {
  totalSolved: number;
  totalCorrect: number;
  totalTimePlayedSec: number;
  bestStreak: number;
  highestTimeAttackScore: number;
  highestSPM: number; // Soal per menit tertinggi
  starsTotal: number;
}
