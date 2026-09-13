import { describe, it, expect } from 'vitest';
import {
  generateLeaderboardSubjectId,
  generateLeaderboardEntryId,
  projectToLeaderboardEntry,
  shouldReplaceLeaderboardEntry,
} from '../../src/engine/competitive/projection';
import { CompetitiveResultDoc, LeaderboardEntryDoc } from '../../src/engine/competitive/types';

describe('Competitive Leaderboard Projection', () => {
  const secret = 'proj-secret-super-key-2026';

  describe('generateLeaderboardSubjectId', () => {
    it('generates consistent 8-character hex string for the same userId and secret', () => {
      const id1 = generateLeaderboardSubjectId('user_abc', secret);
      const id2 = generateLeaderboardSubjectId('user_abc', secret);
      expect(id1).toBe(id2);
      expect(id1).toHaveLength(8);
      expect(id1).toMatch(/^[0-9a-f]{8}$/);
    });

    it('generates different subjectId for different userIds', () => {
      const id1 = generateLeaderboardSubjectId('user_1', secret);
      const id2 = generateLeaderboardSubjectId('user_2', secret);
      expect(id1).not.toBe(id2);
    });

    it('generates different subjectId for different secrets', () => {
      const id1 = generateLeaderboardSubjectId('user_1', 'secret_a');
      const id2 = generateLeaderboardSubjectId('user_1', 'secret_b');
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateLeaderboardEntryId', () => {
    it('assembles entryId correctly from components', () => {
      const entryId = generateLeaderboardEntryId('sprint', '2026-W37', '1.0', '1.0', 'a1b2c3d4');
      expect(entryId).toBe('sprint_2026-W37_1.0_1.0_a1b2c3d4');
    });
  });

  describe('projectToLeaderboardEntry', () => {
    const baseResult: CompetitiveResultDoc = {
      resultId: 'res_1',
      sessionId: 'sess_1',
      userId: 'secret_user_uid_123',
      mode: 'sprint',
      status: 'VALIDATED',
      isRanked: true,
      score: 2000,
      accuracy: 95,
      correctCount: 19,
      wrongCount: 1,
      questionsAnswered: 20,
      rankedActiveDurationMs: 60000,
      maxStreak: 15,
      difficultyReached: 4,
      rejectionReasons: [],
      finalizedAt: 1700000000,
      rulesVersion: '1.0',
      contentVersion: '1.0',
    };

    it('creates sanitized public projection stripped of sensitive user identifiers', () => {
      const entry = projectToLeaderboardEntry(baseResult, 'JuaraKilat', '2026-09-13', secret);

      expect(entry.pseudonym).toBe('JuaraKilat');
      expect(entry.score).toBe(2000);
      expect(entry.accuracy).toBe(95);
      expect(entry.correctCount).toBe(19);
      expect(entry.wrongCount).toBe(1);
      expect(entry.durationMs).toBe(60000);
      expect(entry.finalizedAt).toBe(1700000000);
      expect(entry.resultId).toBe('res_1');
      expect(entry.mode).toBe('sprint');
      expect(entry.periodKey).toBe('2026-09-13');
      expect(entry.rulesVersion).toBe('1.0');
      expect(entry.contentVersion).toBe('1.0');

      // Sensitive fields must NOT exist on entry
      expect((entry as any).userId).toBeUndefined();
      expect((entry as any).sessionId).toBeUndefined();
      expect((entry as any).rejectionReasons).toBeUndefined();
      expect((entry as any).maxStreak).toBeUndefined();
      expect((entry as any).difficultyReached).toBeUndefined();

      // entryId contains mode, periodKey, versions, and hashed subjectId
      expect(entry.entryId).toContain('sprint_2026-09-13_1.0_1.0_');
      expect(entry.entryId).not.toContain('secret_user_uid_123');
    });

    it('defaults pseudonym to Pemain Kilat if empty or whitespace', () => {
      const entry1 = projectToLeaderboardEntry(baseResult, '', 'all', secret);
      expect(entry1.pseudonym).toBe('Pemain Kilat');

      const entry2 = projectToLeaderboardEntry(baseResult, '   ', 'all', secret);
      expect(entry2.pseudonym).toBe('Pemain Kilat');
    });

    it('trims leading/trailing whitespace from pseudonym', () => {
      const entry = projectToLeaderboardEntry(baseResult, '  BintangMat  ', 'all', secret);
      expect(entry.pseudonym).toBe('BintangMat');
    });
  });

  describe('shouldReplaceLeaderboardEntry', () => {
    it('returns true if existing entry is null', () => {
      const candidate: LeaderboardEntryDoc = {
        entryId: 'e1',
        mode: 'sprint',
        periodKey: 'all',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        pseudonym: 'P1',
        score: 1000,
        accuracy: 90,
        correctCount: 10,
        wrongCount: 1,
        durationMs: 30000,
        finalizedAt: 1000,
        resultId: 'r1',
      };

      expect(shouldReplaceLeaderboardEntry(null, candidate)).toBe(true);
    });

    describe('Sprint mode replacement', () => {
      const existingSprint: LeaderboardEntryDoc = {
        entryId: 'e1',
        mode: 'sprint',
        periodKey: 'all',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        pseudonym: 'P1',
        score: 1500,
        accuracy: 90,
        correctCount: 18,
        wrongCount: 2,
        durationMs: 60000,
        finalizedAt: 1000,
        resultId: 'r1',
      };

      it('replaces when candidate score is higher', () => {
        const candidate = { ...existingSprint, score: 1600, resultId: 'r2' };
        expect(shouldReplaceLeaderboardEntry(existingSprint, candidate)).toBe(true);
      });

      it('does not replace when candidate score is lower', () => {
        const candidate = { ...existingSprint, score: 1400, resultId: 'r2' };
        expect(shouldReplaceLeaderboardEntry(existingSprint, candidate)).toBe(false);
      });

      it('breaks tie on higher accuracy', () => {
        const higherAcc = { ...existingSprint, accuracy: 95, correctCount: 19, wrongCount: 1, resultId: 'r2' };
        expect(shouldReplaceLeaderboardEntry(existingSprint, higherAcc)).toBe(true);
      });
    });

    describe('Survival mode replacement', () => {
      const existingSurvival: LeaderboardEntryDoc = {
        entryId: 'e2',
        mode: 'survival',
        periodKey: 'all',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        pseudonym: 'P2',
        score: 2000,
        accuracy: 100,
        correctCount: 20,
        wrongCount: 0,
        durationMs: 80000,
        finalizedAt: 2000,
        resultId: 'r1',
      };

      it('replaces when candidate has longer survival duration at equal score', () => {
        const candidate = { ...existingSurvival, durationMs: 90000, resultId: 'r2' };
        expect(shouldReplaceLeaderboardEntry(existingSurvival, candidate)).toBe(true);
      });

      it('does not replace when candidate has shorter duration at equal score', () => {
        const candidate = { ...existingSurvival, durationMs: 70000, resultId: 'r2' };
        expect(shouldReplaceLeaderboardEntry(existingSurvival, candidate)).toBe(false);
      });
    });

    describe('Daily mode replacement', () => {
      const existingDaily: LeaderboardEntryDoc = {
        entryId: 'e3',
        mode: 'daily',
        periodKey: '2026-09-13',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        pseudonym: 'P3',
        score: 1800,
        accuracy: 100,
        correctCount: 10,
        wrongCount: 0,
        durationMs: 45000,
        finalizedAt: 3000,
        resultId: 'r1',
      };

      it('replaces when candidate has faster (shorter) duration at equal score', () => {
        const candidate = { ...existingDaily, durationMs: 40000, resultId: 'r2' };
        expect(shouldReplaceLeaderboardEntry(existingDaily, candidate)).toBe(true);
      });

      it('does not replace when candidate has slower (longer) duration at equal score', () => {
        const candidate = { ...existingDaily, durationMs: 50000, resultId: 'r2' };
        expect(shouldReplaceLeaderboardEntry(existingDaily, candidate)).toBe(false);
      });
    });
  });
});
