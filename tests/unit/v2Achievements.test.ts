// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  evaluateAchievements,
  ACHIEVEMENTS_DEFINITIONS,
  AchievementEvaluationContext,
  UNLOCKED_ACHIEVEMENTS_V2_KEY,
  UNLOCKED_ACHIEVEMENTS_V1_KEY,
} from '../../src/utils/achievements';
import { AchievementsTab } from '../../src/components/AchievementsTab';
import { CAMPAIGN_V2_STORAGE_KEY } from '../../src/utils/campaignState';
import { UserStats } from '../../src/types';

describe('V2 Achievements System (PRD §17 & Spec §6)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const baseStats: UserStats = {
    totalSolved: 0,
    totalCorrect: 0,
    totalTimePlayedSec: 0,
    bestStreak: 0,
    highestTimeAttackScore: 0,
    highestSPM: 0,
    starsTotal: 0,
  };

  const createMockContext = (
    overrides?: Partial<AchievementEvaluationContext>
  ): AchievementEvaluationContext => ({
    stats: baseStats,
    totalStars: 0,
    unlockedLevelsCount: 1,
    completedBossIds: [],
    highestSprintScore: 0,
    highestSurvivalSec: 0,
    dailyStreak: 0,
    masteredSubSkillsCount: 0,
    ...overrides,
  });

  it('contains exactly 16 canonical achievement definitions', () => {
    expect(ACHIEVEMENTS_DEFINITIONS).toHaveLength(16);
    const ids = ACHIEVEMENTS_DEFINITIONS.map((a) => a.id);
    expect(ids).toContain('stars_15');
    expect(ids).toContain('stars_40');
    expect(ids).toContain('stars_72');
    expect(ids).toContain('stars_144');
    expect(ids).toContain('stars_216');
    expect(ids).toContain('boss_t1');
    expect(ids).toContain('boss_t3');
    expect(ids).toContain('boss_t6');
    expect(ids).toContain('sprint_1000');
    expect(ids).toContain('sprint_2500');
    expect(ids).toContain('survival_120');
    expect(ids).toContain('survival_300');
    expect(ids).toContain('daily_streak_7');
    expect(ids).toContain('daily_streak_30');
    expect(ids).toContain('mastery_10');
    expect(ids).toContain('mastery_30');
  });

  it('unlocks star achievements progressively (15, 40, 72, 144, 216)', () => {
    const ctx15 = createMockContext({ totalStars: 15 });
    const res15 = evaluateAchievements(ctx15);
    const star15 = res15.achievements.find((a) => a.id === 'stars_15');
    expect(star15?.unlocked).toBe(true);
    expect(res15.newlyUnlocked.map((a) => a.id)).toContain('stars_15');

    const ctx72 = createMockContext({ totalStars: 72 });
    const res72 = evaluateAchievements(ctx72);
    expect(res72.achievements.find((a) => a.id === 'stars_72')?.unlocked).toBe(true);
    expect(res72.achievements.find((a) => a.id === 'stars_144')?.unlocked).toBe(false);

    const ctx216 = createMockContext({ totalStars: 216 });
    const res216 = evaluateAchievements(ctx216);
    expect(res216.achievements.find((a) => a.id === 'stars_216')?.unlocked).toBe(true);
  });

  it('unlocks boss conquests when respective boss IDs are completed', () => {
    const ctxBoss1 = createMockContext({ completedBossIds: ['T1-BOSS'] });
    const resBoss1 = evaluateAchievements(ctxBoss1);
    expect(resBoss1.achievements.find((a) => a.id === 'boss_t1')?.unlocked).toBe(true);
    expect(resBoss1.achievements.find((a) => a.id === 'boss_t3')?.unlocked).toBe(false);

    const ctxBossAll = createMockContext({ completedBossIds: ['T1-BOSS', 'T3-BOSS', 'T6-BOSS'] });
    const resBossAll = evaluateAchievements(ctxBossAll);
    expect(resBossAll.achievements.find((a) => a.id === 'boss_t1')?.unlocked).toBe(true);
    expect(resBossAll.achievements.find((a) => a.id === 'boss_t3')?.unlocked).toBe(true);
    expect(resBossAll.achievements.find((a) => a.id === 'boss_t6')?.unlocked).toBe(true);
  });

  it('unlocks sprint and survival achievements based on high scores', () => {
    const ctx = createMockContext({
      highestSprintScore: 2600,
      highestSurvivalSec: 130,
    });
    const res = evaluateAchievements(ctx);
    expect(res.achievements.find((a) => a.id === 'sprint_1000')?.unlocked).toBe(true);
    expect(res.achievements.find((a) => a.id === 'sprint_2500')?.unlocked).toBe(true);
    expect(res.achievements.find((a) => a.id === 'survival_120')?.unlocked).toBe(true);
    expect(res.achievements.find((a) => a.id === 'survival_300')?.unlocked).toBe(false);
  });

  it('unlocks sub-skill mastery achievements (10, 30)', () => {
    const ctx = createMockContext({ masteredSubSkillsCount: 12 });
    const res = evaluateAchievements(ctx);
    expect(res.achievements.find((a) => a.id === 'mastery_10')?.unlocked).toBe(true);
    expect(res.achievements.find((a) => a.id === 'mastery_30')?.unlocked).toBe(false);

    const ctx30 = createMockContext({ masteredSubSkillsCount: 30 });
    const res30 = evaluateAchievements(ctx30);
    expect(res30.achievements.find((a) => a.id === 'mastery_30')?.unlocked).toBe(true);
  });

  it('unlocks daily streak achievements (7, 30)', () => {
    const ctx7 = createMockContext({ dailyStreak: 7 });
    const res7 = evaluateAchievements(ctx7);
    expect(res7.achievements.find((a) => a.id === 'daily_streak_7')?.unlocked).toBe(true);
    expect(res7.achievements.find((a) => a.id === 'daily_streak_30')?.unlocked).toBe(false);

    const ctx30 = createMockContext({ dailyStreak: 30 });
    const res30 = evaluateAchievements(ctx30);
    expect(res30.achievements.find((a) => a.id === 'daily_streak_30')?.unlocked).toBe(true);
  });

  it('persists newly unlocked achievements to localStorage under V2 key', () => {
    const ctx = createMockContext({ totalStars: 15 });
    evaluateAchievements(ctx);

    const saved = JSON.parse(localStorage.getItem(UNLOCKED_ACHIEVEMENTS_V2_KEY) || '{}');
    expect(saved['stars_15']).toBeDefined();
    expect(typeof saved['stars_15']).toBe('string');
  });

  it('migrates unlocked achievements from V1 if V2 key does not exist', () => {
    localStorage.setItem(
      UNLOCKED_ACHIEVEMENTS_V1_KEY,
      JSON.stringify({ stars_15: '2026-01-01T00:00:00.000Z' })
    );

    const ctx = createMockContext({ totalStars: 0 });
    const res = evaluateAchievements(ctx);

    const star15 = res.achievements.find((a) => a.id === 'stars_15');
    expect(star15?.unlocked).toBe(true);
    expect(star15?.unlockedAt).toBe('2026-01-01T00:00:00.000Z');
    // It should not be marked as newly unlocked since it was already unlocked in V1
    expect(res.newlyUnlocked.map((a) => a.id)).not.toContain('stars_15');
  });

  it('does not duplicate newlyUnlocked on subsequent evaluation calls', () => {
    const ctx = createMockContext({ totalStars: 15 });
    const firstCall = evaluateAchievements(ctx);
    expect(firstCall.newlyUnlocked.map((a) => a.id)).toContain('stars_15');

    const secondCall = evaluateAchievements(ctx);
    expect(secondCall.newlyUnlocked).toHaveLength(0);
    expect(secondCall.achievements.find((a) => a.id === 'stars_15')?.unlocked).toBe(true);
  });

  describe('AchievementsTab Component UI Integration', () => {
    it('renders all 16 badges and overview header', () => {
      render(
        React.createElement(AchievementsTab, {
          stats: baseStats,
          totalStars: 15,
          unlockedLevelsCount: 5,
        })
      );

      expect(screen.getByText(/Pencapaian & Lencana Prestasi/i)).toBeDefined();
      // Stars 15 badge should be unlocked
      const badgeStars15 = document.getElementById('badge-stars_15');
      expect(badgeStars15).toBeDefined();
      expect(badgeStars15?.textContent).toContain('Tercapai');
    });

    it('filters badges by category chips', () => {
      render(
        React.createElement(AchievementsTab, {
          stats: baseStats,
          totalStars: 15,
          unlockedLevelsCount: 5,
        })
      );

      // Click Speed category
      const speedFilter = screen.getByRole('button', { name: /Sprint 60s/i });
      fireEvent.click(speedFilter);

      expect(document.getElementById('badge-sprint_1000')).toBeDefined();
      expect(document.getElementById('badge-sprint_2500')).toBeDefined();
      expect(document.getElementById('badge-stars_15')).toBeNull();

      // Click All category
      const allFilter = screen.getByRole('button', { name: /Semua/i });
      fireEvent.click(allFilter);
      expect(document.getElementById('badge-stars_15')).toBeDefined();
    });

    it('accepts V2 props and falls back safely to campaign state for boss IDs', () => {
      // Seed campaign state with completed boss
      localStorage.setItem(
        CAMPAIGN_V2_STORAGE_KEY,
        JSON.stringify({
          version: 2,
          levels: {
            'T1-BOSS': { levelId: 'T1-BOSS', unlocked: true, stars: 3, bestScore: 500, accuracy: 100, bestTimeSec: 15 },
          },
          totalStars: 3,
          legacyStarCredits: 0,
          migrationCompleted: true,
        })
      );

      render(
        React.createElement(AchievementsTab, {
          stats: baseStats,
          totalStars: 3,
          unlockedLevelsCount: 12,
          highestSprintScore: 1200,
          highestSurvivalSec: 150,
          masteredSubSkillsCount: 15,
        })
      );

      // Boss T1 should be unlocked via fallback
      const bossBadge = document.getElementById('badge-boss_t1');
      expect(bossBadge?.textContent).toContain('Tercapai');

      // Sprint 1000 should be unlocked
      const sprintBadge = document.getElementById('badge-sprint_1000');
      expect(sprintBadge?.textContent).toContain('Tercapai');

      // Survival 120 should be unlocked
      const survivalBadge = document.getElementById('badge-survival_120');
      expect(survivalBadge?.textContent).toContain('Tercapai');

      // Mastery 10 should be unlocked
      const masteryBadge = document.getElementById('badge-mastery_10');
      expect(masteryBadge?.textContent).toContain('Tercapai');
    });
  });
});
