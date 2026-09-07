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

export type GameMode = 'campaign' | 'time_attack' | 'practice' | 'daily_challenge';

export interface DailyChallengeQuestion extends Question {
  stageNumber: number; // 1 to 10
  stageTitle: string;
  stageIcon?: string;
  difficultyRating: number;
}

export interface DailyChallengePuzzle {
  date: string; // YYYY-MM-DD
  seed: number;
  formattedDate: string;
  title: string;
  theme: string;
  description: string;
  questions: DailyChallengeQuestion[];
  targetTimeSec: number;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  playerName: string;
  countryCode: string;
  flag: string;
  score: number;
  timeTakenSec: number;
  accuracy: number;
  maxStreak: number;
  isCurrentUser?: boolean;
  date: string;
  timestamp: number;
  badge?: string;
}

export interface DailyChallengeRecord {
  date: string;
  completed: boolean;
  score: number;
  timeTakenSec: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
  maxStreak: number;
  rank: number;
  completedAt: string;
  answers: Question[];
}

export interface DailyChallengeUserState {
  currentStreak: number;
  bestStreak: number;
  lastCompletedDate?: string;
  playerName: string;
  playerCountry: string;
  playerFlag: string;
  history: Record<string, DailyChallengeRecord>;
}

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
  isNewStarRecord?: boolean;
  previousStars?: number;
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
