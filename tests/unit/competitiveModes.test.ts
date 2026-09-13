import { describe, it, expect } from 'vitest';
import {
  getSprintDifficulty,
  SPRINT_DEADLINE_MS,
} from '../../src/engine/competitive/modes/sprint';
import {
  getSurvivalDifficulty,
  applySurvivalTimerStep,
  SURVIVAL_INITIAL_TIMER_MS,
  SURVIVAL_MAX_TIMER_MS,
  SURVIVAL_HARD_CAP_MS,
  SURVIVAL_CORRECT_ADDITION_MS,
  SURVIVAL_WRONG_PENALTY_MS,
  SURVIVAL_MAX_HEARTBEAT_GAP_MS,
} from '../../src/engine/competitive/modes/survival';
import {
  generateDailyChallengeId,
  hashDailySeed,
  isDailyStreakEligible,
  DAILY_TARGET_DURATION_MS,
  DAILY_HARD_DEADLINE_MS,
  DAILY_QUESTION_COUNT,
  DAILY_TIMEZONE,
} from '../../src/engine/competitive/modes/daily';
import * as CompetitiveEngine from '../../src/engine/competitive';

describe('Competitive Game Mode Rules', () => {
  describe('Sprint 60s Rules', () => {
    it('maps Sprint correct count to difficulty brackets 1-6', () => {
      // Bracket 1: 0-4 correct
      expect(getSprintDifficulty(0)).toBe(1);
      expect(getSprintDifficulty(1)).toBe(1);
      expect(getSprintDifficulty(4)).toBe(1);

      // Bracket 2: 5-9 correct
      expect(getSprintDifficulty(5)).toBe(2);
      expect(getSprintDifficulty(9)).toBe(2);

      // Bracket 3: 10-14 correct
      expect(getSprintDifficulty(10)).toBe(3);
      expect(getSprintDifficulty(14)).toBe(3);

      // Bracket 4: 15-19 correct
      expect(getSprintDifficulty(15)).toBe(4);
      expect(getSprintDifficulty(19)).toBe(4);

      // Bracket 5: 20-24 correct
      expect(getSprintDifficulty(20)).toBe(5);
      expect(getSprintDifficulty(24)).toBe(5);

      // Bracket 6: 25+ correct
      expect(getSprintDifficulty(25)).toBe(6);
      expect(getSprintDifficulty(26)).toBe(6);
      expect(getSprintDifficulty(50)).toBe(6);
      expect(getSprintDifficulty(100)).toBe(6);
    });

    it('handles negative numbers and non-integer inputs gracefully', () => {
      expect(getSprintDifficulty(-1)).toBe(1);
      expect(getSprintDifficulty(-10)).toBe(1);
      expect(getSprintDifficulty(4.9)).toBe(1);
      expect(getSprintDifficulty(5.1)).toBe(2);
      expect(getSprintDifficulty(24.99)).toBe(5);
      expect(getSprintDifficulty(25.01)).toBe(6);
    });

    it('exports SPRINT_DEADLINE_MS constant as 60000ms', () => {
      expect(SPRINT_DEADLINE_MS).toBe(60000);
    });
  });

  describe('Survival Kilat Rules', () => {
    it('maps Survival correct count to progressive difficulty', () => {
      expect(getSurvivalDifficulty(0)).toBe(1);
      expect(getSurvivalDifficulty(4)).toBe(1);
      expect(getSurvivalDifficulty(5)).toBe(2);
      expect(getSurvivalDifficulty(9)).toBe(2);
      expect(getSurvivalDifficulty(10)).toBe(3);
      expect(getSurvivalDifficulty(14)).toBe(3);
      expect(getSurvivalDifficulty(15)).toBe(4);
      expect(getSurvivalDifficulty(19)).toBe(4);
      expect(getSurvivalDifficulty(20)).toBe(5);
      expect(getSurvivalDifficulty(24)).toBe(5);
      expect(getSurvivalDifficulty(25)).toBe(6);
      expect(getSurvivalDifficulty(50)).toBe(6);
    });

    it('handles negative and floating values for Survival difficulty', () => {
      expect(getSurvivalDifficulty(-5)).toBe(1);
      expect(getSurvivalDifficulty(4.8)).toBe(1);
      expect(getSurvivalDifficulty(5.2)).toBe(2);
    });

    it('handles timer addition (+2000ms) with max timer cap at 60000ms', () => {
      expect(applySurvivalTimerStep(30000, true)).toBe(32000);
      expect(applySurvivalTimerStep(58000, true)).toBe(60000);
      expect(applySurvivalTimerStep(59000, true)).toBe(60000);
      expect(applySurvivalTimerStep(60000, true)).toBe(60000);
      expect(applySurvivalTimerStep(65000, true)).toBe(60000);
    });

    it('handles timer deduction (-4000ms) with floor at 0ms', () => {
      expect(applySurvivalTimerStep(30000, false)).toBe(26000);
      expect(applySurvivalTimerStep(4000, false)).toBe(0);
      expect(applySurvivalTimerStep(2000, false)).toBe(0);
      expect(applySurvivalTimerStep(0, false)).toBe(0);
      expect(applySurvivalTimerStep(-1000, false)).toBe(0);
    });

    it('exports all Survival constants matching design specifications', () => {
      expect(SURVIVAL_INITIAL_TIMER_MS).toBe(60000);
      expect(SURVIVAL_MAX_TIMER_MS).toBe(60000);
      expect(SURVIVAL_HARD_CAP_MS).toBe(600000);
      expect(SURVIVAL_CORRECT_ADDITION_MS).toBe(2000);
      expect(SURVIVAL_WRONG_PENALTY_MS).toBe(4000);
      expect(SURVIVAL_MAX_HEARTBEAT_GAP_MS).toBe(10000);
    });
  });

  describe('Daily Challenge V2 Rules', () => {
    it('formats Daily challenge ID with Asia/Jakarta timezone and version', () => {
      const id = generateDailyChallengeId('2026-09-13', 'v2.0');
      expect(id).toBe('2026-09-13@Asia/Jakarta:v2.0');
    });

    it('produces deterministic, positive 32-bit integer seeds from challengeId', () => {
      const id = '2026-09-13@Asia/Jakarta:v2.0';
      const seed1 = hashDailySeed(id);
      const seed2 = hashDailySeed(id);

      expect(seed1).toBe(seed2);
      expect(seed1).toBeGreaterThan(0);
      expect(Number.isInteger(seed1)).toBe(true);

      // Different dates produce different seeds
      const seedDiffDate = hashDailySeed('2026-09-14@Asia/Jakarta:v2.0');
      expect(seedDiffDate).not.toBe(seed1);

      // Different versions produce different seeds
      const seedDiffVersion = hashDailySeed('2026-09-13@Asia/Jakarta:v2.1');
      expect(seedDiffVersion).not.toBe(seed1);
    });

    it('always returns a non-zero positive integer even for empty strings or 0 hash', () => {
      const emptySeed = hashDailySeed('');
      expect(emptySeed).toBeGreaterThan(0);
      expect(Number.isInteger(emptySeed)).toBe(true);
    });

    it('exports all Daily constants matching design specifications', () => {
      expect(DAILY_TARGET_DURATION_MS).toBe(75000);
      expect(DAILY_HARD_DEADLINE_MS).toBe(90000);
      expect(DAILY_QUESTION_COUNT).toBe(10);
      expect(DAILY_TIMEZONE).toBe('Asia/Jakarta');
    });

    it('evaluates isDailyStreakEligible correctly (PRD §15.2)', () => {
      // Must be VALIDATED, mode === 'daily', 10 questions answered, correctCount >= 6
      expect(
        isDailyStreakEligible({
          status: 'VALIDATED',
          mode: 'daily',
          questionsAnswered: 10,
          correctCount: 6,
        })
      ).toBe(true);

      expect(
        isDailyStreakEligible({
          status: 'VALIDATED',
          mode: 'daily',
          questionsAnswered: 10,
          correctCount: 10,
        })
      ).toBe(true);

      // Less than 6 correct
      expect(
        isDailyStreakEligible({
          status: 'VALIDATED',
          mode: 'daily',
          questionsAnswered: 10,
          correctCount: 5,
        })
      ).toBe(false);

      // Incomplete session (<10 questions)
      expect(
        isDailyStreakEligible({
          status: 'VALIDATED',
          mode: 'daily',
          questionsAnswered: 9,
          correctCount: 8,
        })
      ).toBe(false);

      // Rejected status
      expect(
        isDailyStreakEligible({
          status: 'REJECTED',
          mode: 'daily',
          questionsAnswered: 10,
          correctCount: 10,
        })
      ).toBe(false);

      // Non-daily mode
      expect(
        isDailyStreakEligible({
          status: 'VALIDATED',
          mode: 'sprint',
          questionsAnswered: 10,
          correctCount: 10,
        })
      ).toBe(false);
    });
  });

  describe('Competitive Barrel Exports', () => {
    it('exports all mode functions and constants through the barrel index', () => {
      expect(typeof CompetitiveEngine.getSprintDifficulty).toBe('function');
      expect(CompetitiveEngine.SPRINT_DEADLINE_MS).toBe(60000);

      expect(typeof CompetitiveEngine.getSurvivalDifficulty).toBe('function');
      expect(typeof CompetitiveEngine.applySurvivalTimerStep).toBe('function');
      expect(CompetitiveEngine.SURVIVAL_INITIAL_TIMER_MS).toBe(60000);
      expect(CompetitiveEngine.SURVIVAL_MAX_TIMER_MS).toBe(60000);
      expect(CompetitiveEngine.SURVIVAL_HARD_CAP_MS).toBe(600000);
      expect(CompetitiveEngine.SURVIVAL_CORRECT_ADDITION_MS).toBe(2000);
      expect(CompetitiveEngine.SURVIVAL_WRONG_PENALTY_MS).toBe(4000);
      expect(CompetitiveEngine.SURVIVAL_MAX_HEARTBEAT_GAP_MS).toBe(10000);

      expect(typeof CompetitiveEngine.generateDailyChallengeId).toBe('function');
      expect(typeof CompetitiveEngine.hashDailySeed).toBe('function');
      expect(typeof CompetitiveEngine.isDailyStreakEligible).toBe('function');
      expect(CompetitiveEngine.DAILY_TARGET_DURATION_MS).toBe(75000);
      expect(CompetitiveEngine.DAILY_HARD_DEADLINE_MS).toBe(90000);
      expect(CompetitiveEngine.DAILY_QUESTION_COUNT).toBe(10);
      expect(CompetitiveEngine.DAILY_TIMEZONE).toBe('Asia/Jakarta');
    });
  });
});
