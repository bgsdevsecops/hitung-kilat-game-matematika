import { LevelConfigV2 } from '../engine/types/level';

export interface StarRatingResult {
  stars: number; // 0, 1, 2, or 3
  isPerfect: boolean; // 100% accuracy within targetTimeSec
  isPassed: boolean; // stars >= 1
  accuracy: number; // 0–100 percentage
  reason: string;
}

export function calculateLevelStars(
  level: LevelConfigV2,
  correctCount: number,
  totalQuestions: number,
  durationSec: number,
  isTimedOut: boolean
): StarRatingResult {
  const safeTotal = Math.max(1, totalQuestions);
  const accuracyRatio = Math.max(0, Math.min(1, correctCount / safeTotal));
  const accuracyPercent = Math.round(accuracyRatio * 100);

  if (isTimedOut || durationSec > level.timeLimitSec) {
    return {
      stars: 0,
      isPerfect: false,
      isPassed: false,
      accuracy: accuracyPercent,
      reason: 'Waktu habis / Melebihi batas waktu maksimal',
    };
  }

  const withinTarget = durationSec <= level.targetTimeSec;
  const isPerfect = correctCount === totalQuestions && withinTarget;

  // 3 Stars: Accuracy >= 95% AND completed within targetTimeSec
  if (accuracyRatio >= 0.95 && withinTarget) {
    return {
      stars: 3,
      isPerfect,
      isPassed: true,
      accuracy: accuracyPercent,
      reason: isPerfect ? 'Sempurna & Sangat Kilat! 🏆' : 'Hebat, Cepat & Sangat Akurat! ⭐',
    };
  }

  // 2 Stars: Accuracy >= 85%
  if (accuracyRatio >= 0.85) {
    return {
      stars: 2,
      isPerfect: false,
      isPassed: true,
      accuracy: accuracyPercent,
      reason: 'Bagus & Akurat! ⭐',
    };
  }

  // 1 Star: Meets minimum passing accuracy
  if (accuracyRatio >= level.passingAccuracy) {
    return {
      stars: 1,
      isPerfect: false,
      isPassed: true,
      accuracy: accuracyPercent,
      reason: 'Level Selesai! 👍',
    };
  }

  return {
    stars: 0,
    isPerfect: false,
    isPassed: false,
    accuracy: accuracyPercent,
    reason: `Akurasi (${accuracyPercent}%) di bawah syarat kelulusan (${Math.round(level.passingAccuracy * 100)}%)`,
  };
}
