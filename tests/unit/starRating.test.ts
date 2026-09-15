import { describe, it, expect } from 'vitest';
import { calculateLevelStars } from '../../src/utils/starRating';
import { LevelConfigV2 } from '../../src/engine/types/level';

describe('calculateLevelStars (PRD §8.2.1 & §8.3.1)', () => {
  const mockLevel: LevelConfigV2 = {
    id: 'T1-ADD-01',
    order: 1,
    tier: 1,
    title: 'Penjumlahan 1–10',
    description: 'Tambah satuan',
    generatorKey: 'addition',
    rules: { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
    answerKind: 'integer',
    difficulty: 1,
    questionCount: 10,
    targetTimeSec: 30,
    timeLimitSec: 45,
    boss: false,
    passingAccuracy: 0.7,
    prerequisiteIds: [],
    primarySkillId: 'addition.single_digit',
    skillTags: ['addition'],
    contentVersion: '2.0.0',
  };

  const mockBossLevel: LevelConfigV2 = {
    ...mockLevel,
    id: 'T1-BOSS',
    order: 12,
    boss: true,
    questionCount: 15,
    targetTimeSec: 36,
    timeLimitSec: 45,
    passingAccuracy: 0.7,
  };

  const mockBossLv60: LevelConfigV2 = {
    ...mockLevel,
    id: 'T5-BOSS',
    order: 60,
    tier: 5,
    boss: true,
    questionCount: 20,
    targetTimeSec: 60,
    timeLimitSec: 90,
    passingAccuracy: 0.8,
  };

  const mockBossLv72: LevelConfigV2 = {
    ...mockLevel,
    id: 'T6-GRANDMASTER',
    order: 72,
    tier: 6,
    boss: true,
    questionCount: 25,
    targetTimeSec: 75,
    timeLimitSec: 100,
    passingAccuracy: 0.85,
  };

  it('returns 0 stars if game timed out', () => {
    const result = calculateLevelStars(mockLevel, 10, 10, 45, true);
    expect(result.stars).toBe(0);
    expect(result.isPassed).toBe(false);
    expect(result.isPerfect).toBe(false);
    expect(result.reason).toContain('Waktu habis');
  });

  it('returns 0 stars if duration exceeded timeLimitSec', () => {
    const result = calculateLevelStars(mockLevel, 10, 10, 46, false);
    expect(result.stars).toBe(0);
    expect(result.isPassed).toBe(false);
  });

  it('returns 0 stars if accuracy is below passingAccuracy', () => {
    // 6 / 10 = 60% < 70%
    const result = calculateLevelStars(mockLevel, 6, 10, 20, false);
    expect(result.stars).toBe(0);
    expect(result.isPassed).toBe(false);
  });

  it('returns 1 star when accuracy meets passingAccuracy (70%) but < 85%', () => {
    // 7 / 10 = 70%
    const result = calculateLevelStars(mockLevel, 7, 10, 25, false);
    expect(result.stars).toBe(1);
    expect(result.isPassed).toBe(true);
    expect(result.isPerfect).toBe(false);
  });

  it('returns 2 stars when accuracy >= 85% but not meeting 3 star speed/accuracy', () => {
    // 9 / 10 = 90% (>= 85%) but duration 35s > targetTimeSec 30s
    const result = calculateLevelStars(mockLevel, 9, 10, 35, false);
    expect(result.stars).toBe(2);
    expect(result.isPassed).toBe(true);
    expect(result.isPerfect).toBe(false);
  });

  it('returns 3 stars when accuracy >= 95% within targetTimeSec', () => {
    // 10 / 10 = 100% in 25s <= targetTimeSec (30s)
    const result = calculateLevelStars(mockLevel, 10, 10, 25, false);
    expect(result.stars).toBe(3);
    expect(result.isPassed).toBe(true);
    expect(result.isPerfect).toBe(true);
  });

  it('returns 3 stars without perfect flag if accuracy is 95% (e.g. 19/20 in boss level) within targetTimeSec', () => {
    const bossLevel20: LevelConfigV2 = { ...mockBossLevel, questionCount: 20, targetTimeSec: 60 };
    // 19 / 20 = 95% in 40s
    const result = calculateLevelStars(bossLevel20, 19, 20, 40, false);
    expect(result.stars).toBe(3);
    expect(result.isPassed).toBe(true);
    expect(result.isPerfect).toBe(false);
  });

  it('handles boundary duration exactly at targetTimeSec for 3 stars', () => {
    const result = calculateLevelStars(mockLevel, 10, 10, 30, false);
    expect(result.stars).toBe(3);
    expect(result.isPassed).toBe(true);
    expect(result.isPerfect).toBe(true);
  });

  it('handles boundary duration exactly at timeLimitSec without timeout', () => {
    const result = calculateLevelStars(mockLevel, 7, 10, 45, false);
    expect(result.stars).toBe(1);
    expect(result.isPassed).toBe(true);
  });

  it('safely handles 0 total questions without division by zero', () => {
    const result = calculateLevelStars(mockLevel, 0, 0, 10, false);
    expect(result.stars).toBe(0);
    expect(result.accuracy).toBe(0);
    expect(result.isPassed).toBe(false);
    expect(result.isPerfect).toBe(false);
  });

  describe('Boss Level 60 (T5-BOSS) & Level 72 (T6-GRANDMASTER) 2-star threshold (PRD §8.2)', () => {
    it('yields 1 star for Boss Lv60 at 85% accuracy and 2 stars at 90% accuracy', () => {
      // 17 / 20 = 85% with duration 70s (> targetTimeSec 60s)
      const res85 = calculateLevelStars(mockBossLv60, 17, 20, 70, false);
      expect(res85.stars).toBe(1);
      expect(res85.isPassed).toBe(true);
      expect(res85.isPerfect).toBe(false);

      // 18 / 20 = 90% with duration 70s (> targetTimeSec 60s)
      const res90 = calculateLevelStars(mockBossLv60, 18, 20, 70, false);
      expect(res90.stars).toBe(2);
      expect(res90.isPassed).toBe(true);
      expect(res90.isPerfect).toBe(false);
    });

    it('yields 1 star for Boss Lv72 at 88% accuracy and 2 stars at 92% accuracy', () => {
      // 22 / 25 = 88% with duration 80s (> targetTimeSec 75s)
      const res88 = calculateLevelStars(mockBossLv72, 22, 25, 80, false);
      expect(res88.stars).toBe(1);
      expect(res88.isPassed).toBe(true);
      expect(res88.isPerfect).toBe(false);

      // 23 / 25 = 92% with duration 80s (> targetTimeSec 75s)
      const res92 = calculateLevelStars(mockBossLv72, 23, 25, 80, false);
      expect(res92.stars).toBe(2);
      expect(res92.isPassed).toBe(true);
      expect(res92.isPerfect).toBe(false);
    });
  });
});
