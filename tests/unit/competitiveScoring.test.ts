import { describe, it, expect } from 'vitest';
import {
  roundHalfUp,
  calculateSprintScore,
  calculateDailyScore,
  compareSprintRecords,
  compareSurvivalRecords,
  compareDailyRecords,
} from '../../src/engine/competitive/scoring';
import {
  CompetitiveResultDoc,
  CompetitiveSessionContract,
  CompetitiveQuestionView,
  SubmittedAnswerPayload,
  LeaderboardEntryDoc,
} from '../../src/engine/competitive/types';

describe('Competitive Scoring & Comparators', () => {
  describe('roundHalfUp', () => {
    it('implements roundHalfUp correctly across edge cases and integer boundaries', () => {
      expect(roundHalfUp(15, 10)).toBe(2); // 1.5 -> 2
      expect(roundHalfUp(14, 10)).toBe(1); // 1.4 -> 1
      expect(roundHalfUp(25, 10)).toBe(3); // 2.5 -> 3
      expect(roundHalfUp(0, 10)).toBe(0);
    });

    it('handles non-positive divisors and negative numerators gracefully', () => {
      expect(roundHalfUp(10, 0)).toBe(0);
      expect(roundHalfUp(10, -5)).toBe(0);
      expect(roundHalfUp(-15, 10)).toBe(0);
      expect(roundHalfUp(-1, 2)).toBe(0);
    });

    it('rounds exact halves upward', () => {
      expect(roundHalfUp(1, 2)).toBe(1); // 0.5 -> 1
      expect(roundHalfUp(3, 2)).toBe(2); // 1.5 -> 2
      expect(roundHalfUp(5, 2)).toBe(3); // 2.5 -> 3
    });

    it('handles large integer arithmetic accurately without precision loss', () => {
      // speedNum = 120,000,000, speedDen = 750,000 -> 160
      expect(roundHalfUp(120000000, 750000)).toBe(160);
      // 600,000,000 / 750,000 -> 800
      expect(roundHalfUp(600000000, 750000)).toBe(800);
    });
  });

  describe('calculateSprintScore', () => {
    it('computes Sprint points with base points and combo tenths capped at 3.0x', () => {
      // Difficulty 1: base = 100
      // streak 1: combo = min(30, 10 + 1 - 1) = 10 (1.0x) -> 100
      expect(calculateSprintScore(1, 1)).toBe(100);
      // streak 5: combo = 14 (1.4x) -> roundHalfUp(1400, 10) = 140
      expect(calculateSprintScore(1, 5)).toBe(140);
      // Difficulty 3: base = 100 + 25*2 = 150
      // streak 25: combo capped at 30 (3.0x) -> roundHalfUp(4500, 10) = 450
      expect(calculateSprintScore(3, 25)).toBe(450);
    });

    it('handles difficulty tiers correctly up to maximum difficulty 6', () => {
      // Difficulty 2: base = 125, streak 1 -> 125
      expect(calculateSprintScore(2, 1)).toBe(125);
      // Difficulty 4: base = 175, streak 1 -> 175
      expect(calculateSprintScore(4, 1)).toBe(175);
      // Difficulty 5: base = 200, streak 1 -> 200
      expect(calculateSprintScore(5, 1)).toBe(200);
      // Difficulty 6: base = 225, streak 1 -> 225
      expect(calculateSprintScore(6, 1)).toBe(225);
      // Difficulty 6 with max combo (30 tenths = 3.0x): 225 * 3 = 675
      expect(calculateSprintScore(6, 30)).toBe(675);
    });

    it('clamps difficulty and streak out-of-bounds inputs', () => {
      // Difficulty < 1 clamped to 1
      expect(calculateSprintScore(0, 1)).toBe(100);
      expect(calculateSprintScore(-2, 1)).toBe(100);
      // Difficulty > 6 clamped to 6
      expect(calculateSprintScore(10, 1)).toBe(225);
      // Streak < 1 clamped to 1 (1.0x)
      expect(calculateSprintScore(1, 0)).toBe(100);
      expect(calculateSprintScore(1, -5)).toBe(100);
      // Streak beyond 21 capped at 30 tenths (3.0x)
      expect(calculateSprintScore(1, 100)).toBe(300);
    });
  });

  describe('calculateDailyScore', () => {
    it('computes Daily Challenge score with accurate speed and perfect bonuses', () => {
      // 10 correct, 60s (60000ms), maxStreak 10
      // base = 10 * 120 = 1200
      // streakBonus = min(300, 10 * 30) = 300
      // speedNum = (75000 - 60000) * 800 * 10 = 15000 * 8000 = 120,000,000
      // speedBonus = roundHalfUp(120,000,000 / 750,000) = 160
      // perfectBonus = 200
      // total = 1200 + 300 + 160 + 200 = 1860
      const res = calculateDailyScore(10, 10, 60000);
      expect(res.base).toBe(1200);
      expect(res.streakBonus).toBe(300);
      expect(res.speedBonus).toBe(160);
      expect(res.perfectBonus).toBe(200);
      expect(res.score).toBe(1860);

      // If duration >= 75000ms, speedBonus is 0
      const slowRes = calculateDailyScore(8, 5, 80000);
      expect(slowRes.base).toBe(960);
      expect(slowRes.streakBonus).toBe(150);
      expect(slowRes.speedBonus).toBe(0);
      expect(slowRes.perfectBonus).toBe(0);
      expect(slowRes.score).toBe(1110);
    });

    it('awards max speed bonus when activeDurationMs is 0ms', () => {
      // speedNum = 75000 * 800 * 10 = 600,000,000
      // speedBonus = roundHalfUp(600,000,000 / 750,000) = 800
      const fastRes = calculateDailyScore(10, 10, 0);
      expect(fastRes.speedBonus).toBe(800);
      expect(fastRes.perfectBonus).toBe(200);
      expect(fastRes.score).toBe(1200 + 300 + 800 + 200);
    });

    it('handles zero correct answers cleanly', () => {
      const zeroRes = calculateDailyScore(0, 0, 50000);
      expect(zeroRes.base).toBe(0);
      expect(zeroRes.streakBonus).toBe(0);
      expect(zeroRes.speedBonus).toBe(0);
      expect(zeroRes.perfectBonus).toBe(0);
      expect(zeroRes.score).toBe(0);
    });

    it('caps maxStreak bonus at 300', () => {
      // 9 correct, streak 15 -> streakBonus capped at 300
      const res = calculateDailyScore(9, 15, 60000);
      expect(res.streakBonus).toBe(300);
      expect(res.perfectBonus).toBe(0);
    });
  });

  describe('Record Comparators', () => {
    const baseRecord: CompetitiveResultDoc = {
      resultId: 'r1',
      sessionId: 's1',
      userId: 'u1',
      mode: 'sprint',
      status: 'VALIDATED',
      isRanked: true,
      score: 1500,
      accuracy: 90,
      correctCount: 20,
      wrongCount: 2,
      questionsAnswered: 22,
      rankedActiveDurationMs: 60000,
      maxStreak: 12,
      difficultyReached: 4,
      rejectionReasons: [],
      finalizedAt: 1000,
      rulesVersion: '1.0',
      contentVersion: '1.0',
    };

    describe('compareSprintRecords', () => {
      it('ranks higher score first', () => {
        const r1: CompetitiveResultDoc = { ...baseRecord, score: 1500, resultId: 'r1' };
        const r2: CompetitiveResultDoc = { ...baseRecord, score: 1400, resultId: 'r2' };
        expect(compareSprintRecords(r1, r2)).toBeLessThan(0);
        expect(compareSprintRecords(r2, r1)).toBeGreaterThan(0);
      });

      it('breaks score tie with accuracy using exact cross-multiplication', () => {
        // Same score 1500: r1 has 18/20 = 90%, r2 has 17/20 = 85%
        const r1: CompetitiveResultDoc = {
          ...baseRecord,
          resultId: 'r1',
          score: 1500,
          correctCount: 18,
          questionsAnswered: 20,
        };
        const r2: CompetitiveResultDoc = {
          ...baseRecord,
          resultId: 'r2',
          score: 1500,
          correctCount: 17,
          questionsAnswered: 20,
        };
        expect(compareSprintRecords(r1, r2)).toBeLessThan(0);
        expect(compareSprintRecords(r2, r1)).toBeGreaterThan(0);
      });

      it('breaks accuracy tie with correctCount DESC', () => {
        // Same score 1500, 100% accuracy: r1 has 20/20, r2 has 10/10
        const r1: CompetitiveResultDoc = {
          ...baseRecord,
          resultId: 'r1',
          score: 1500,
          correctCount: 20,
          wrongCount: 0,
          questionsAnswered: 20,
        };
        const r2: CompetitiveResultDoc = {
          ...baseRecord,
          resultId: 'r2',
          score: 1500,
          correctCount: 10,
          wrongCount: 0,
          questionsAnswered: 10,
        };
        expect(compareSprintRecords(r1, r2)).toBeLessThan(0);
        expect(compareSprintRecords(r2, r1)).toBeGreaterThan(0);
      });

      it('breaks correctCount tie with wrongCount ASC', () => {
        const r1: CompetitiveResultDoc = {
          ...baseRecord,
          resultId: 'r1',
          score: 1500,
          correctCount: 20,
          questionsAnswered: 22,
          wrongCount: 2,
        };
        const r2: CompetitiveResultDoc = {
          ...baseRecord,
          resultId: 'r2',
          score: 1500,
          correctCount: 20,
          questionsAnswered: 22,
          wrongCount: 4,
        };
        expect(compareSprintRecords(r1, r2)).toBeLessThan(0);
        expect(compareSprintRecords(r2, r1)).toBeGreaterThan(0);
      });

      it('breaks wrongCount tie with finalizedAt ASC', () => {
        const r1: CompetitiveResultDoc = { ...baseRecord, resultId: 'r1', finalizedAt: 1000 };
        const r2: CompetitiveResultDoc = { ...baseRecord, resultId: 'r2', finalizedAt: 2000 };
        expect(compareSprintRecords(r1, r2)).toBeLessThan(0);
        expect(compareSprintRecords(r2, r1)).toBeGreaterThan(0);
      });

      it('breaks finalizedAt tie with resultId ASC', () => {
        const r1: CompetitiveResultDoc = { ...baseRecord, resultId: 'result-a', finalizedAt: 1000 };
        const r2: CompetitiveResultDoc = { ...baseRecord, resultId: 'result-b', finalizedAt: 1000 };
        expect(compareSprintRecords(r1, r2)).toBeLessThan(0);
        expect(compareSprintRecords(r2, r1)).toBeGreaterThan(0);
      });
    });

    describe('compareSurvivalRecords', () => {
      it('ranks higher score first', () => {
        const r1: CompetitiveResultDoc = { ...baseRecord, mode: 'survival', score: 2000, resultId: 'r1' };
        const r2: CompetitiveResultDoc = { ...baseRecord, mode: 'survival', score: 1800, resultId: 'r2' };
        expect(compareSurvivalRecords(r1, r2)).toBeLessThan(0);
      });

      it('breaks score tie with rankedActiveDurationMs DESC (longer survival)', () => {
        const r1: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'survival',
          score: 2000,
          rankedActiveDurationMs: 120000,
          resultId: 'r1',
        };
        const r2: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'survival',
          score: 2000,
          rankedActiveDurationMs: 90000,
          resultId: 'r2',
        };
        expect(compareSurvivalRecords(r1, r2)).toBeLessThan(0);
        expect(compareSurvivalRecords(r2, r1)).toBeGreaterThan(0);
      });

      it('breaks duration tie with accuracy DESC', () => {
        const r1: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'survival',
          score: 2000,
          rankedActiveDurationMs: 90000,
          correctCount: 20,
          questionsAnswered: 22,
          resultId: 'r1',
        };
        const r2: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'survival',
          score: 2000,
          rankedActiveDurationMs: 90000,
          correctCount: 18,
          questionsAnswered: 22,
          resultId: 'r2',
        };
        expect(compareSurvivalRecords(r1, r2)).toBeLessThan(0);
        expect(compareSurvivalRecords(r2, r1)).toBeGreaterThan(0);
      });

      it('breaks accuracy tie with finalizedAt ASC', () => {
        const r1: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'survival',
          score: 2000,
          rankedActiveDurationMs: 90000,
          finalizedAt: 1000,
          resultId: 'r1',
        };
        const r2: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'survival',
          score: 2000,
          rankedActiveDurationMs: 90000,
          finalizedAt: 2000,
          resultId: 'r2',
        };
        expect(compareSurvivalRecords(r1, r2)).toBeLessThan(0);
      });

      it('breaks finalizedAt tie with resultId ASC', () => {
        const r1: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'survival',
          score: 2000,
          resultId: 'a-surv',
          finalizedAt: 1000,
        };
        const r2: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'survival',
          score: 2000,
          resultId: 'b-surv',
          finalizedAt: 1000,
        };
        expect(compareSurvivalRecords(r1, r2)).toBeLessThan(0);
      });
    });

    describe('compareDailyRecords', () => {
      it('ranks higher score first', () => {
        const r1: CompetitiveResultDoc = { ...baseRecord, mode: 'daily', score: 1860, resultId: 'r1' };
        const r2: CompetitiveResultDoc = { ...baseRecord, mode: 'daily', score: 1600, resultId: 'r2' };
        expect(compareDailyRecords(r1, r2)).toBeLessThan(0);
      });

      it('breaks score tie with correctCount DESC', () => {
        const r1: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'daily',
          score: 1500,
          correctCount: 10,
          resultId: 'r1',
        };
        const r2: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'daily',
          score: 1500,
          correctCount: 9,
          resultId: 'r2',
        };
        expect(compareDailyRecords(r1, r2)).toBeLessThan(0);
        expect(compareDailyRecords(r2, r1)).toBeGreaterThan(0);
      });

      it('breaks correctCount tie with rankedActiveDurationMs ASC (faster is better)', () => {
        const r1: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'daily',
          score: 1500,
          correctCount: 10,
          rankedActiveDurationMs: 45000,
          resultId: 'r1',
        };
        const r2: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'daily',
          score: 1500,
          correctCount: 10,
          rankedActiveDurationMs: 60000,
          resultId: 'r2',
        };
        expect(compareDailyRecords(r1, r2)).toBeLessThan(0);
        expect(compareDailyRecords(r2, r1)).toBeGreaterThan(0);
      });

      it('breaks duration tie with finalizedAt ASC', () => {
        const r1: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'daily',
          score: 1500,
          correctCount: 10,
          rankedActiveDurationMs: 60000,
          finalizedAt: 1000,
          resultId: 'r1',
        };
        const r2: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'daily',
          score: 1500,
          correctCount: 10,
          rankedActiveDurationMs: 60000,
          finalizedAt: 2000,
          resultId: 'r2',
        };
        expect(compareDailyRecords(r1, r2)).toBeLessThan(0);
      });

      it('breaks finalizedAt tie with resultId ASC', () => {
        const r1: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'daily',
          score: 1500,
          resultId: 'daily-1',
          finalizedAt: 1000,
        };
        const r2: CompetitiveResultDoc = {
          ...baseRecord,
          mode: 'daily',
          score: 1500,
          resultId: 'daily-2',
          finalizedAt: 1000,
        };
        expect(compareDailyRecords(r1, r2)).toBeLessThan(0);
      });
    });
  });

  describe('Contract Interfaces Type Checks', () => {
    it('allows valid CompetitiveSessionContract initialization', () => {
      const contract: CompetitiveSessionContract = {
        sessionId: 'sess-123',
        userId: 'user-456',
        mode: 'sprint',
        rulesVersion: '1.0.0',
        contentVersion: '2026.09.13',
        serverStartedAt: 1773400000000,
        serverDeadlineAt: 1773400060000,
        status: 'ACTIVE',
        isRanked: true,
        idempotencyKey: 'idem-abc',
      };
      expect(contract.sessionId).toBe('sess-123');
      expect(contract.status).toBe('ACTIVE');
    });

    it('allows valid CompetitiveQuestionView and SubmittedAnswerPayload initialization', () => {
      const view: CompetitiveQuestionView = {
        questionInstanceId: 'q-1',
        sequence: 1,
        renderedPrompt: '12 + 15',
        answerInputKind: 'numeric',
        constraints: { min: 0, max: 100, allowNegative: false },
        questionToken: 'token-xyz',
      };
      const submission: SubmittedAnswerPayload = {
        sequence: 1,
        questionToken: 'token-xyz',
        rawInput: '27',
        clientAnsweredAt: 1500,
        inputLatencyMs: 1200,
        idempotencyKey: 'ans-1',
      };
      expect(view.sequence).toBe(1);
      expect(submission.rawInput).toBe('27');
    });

    it('allows valid LeaderboardEntryDoc initialization', () => {
      const entry: LeaderboardEntryDoc = {
        entryId: 'sprint_all_1.0_1.0_u1',
        mode: 'sprint',
        periodKey: 'all',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        pseudonym: 'KilatMaster',
        score: 3500,
        accuracy: 95,
        correctCount: 30,
        wrongCount: 1,
        durationMs: 60000,
        finalizedAt: 1773400000000,
        resultId: 'res-789',
      };
      expect(entry.pseudonym).toBe('KilatMaster');
      expect(entry.score).toBe(3500);
    });
  });
});
