import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaderboardService } from '../../src/services/leaderboardService.js';

function makeQuery(docs: Array<{ data(): any }>) {
  const query: any = {
    where: vi.fn(),
    orderBy: vi.fn(),
    offset: vi.fn(),
    limit: vi.fn(),
    get: vi.fn().mockResolvedValue({ docs }),
  };
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.offset.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

describe('LeaderboardService', () => {
  let leaderboardQuery: any;
  let resultQuery: any;
  let firestore: any;

  beforeEach(() => {
    leaderboardQuery = makeQuery([
      {
        data: () => ({
          entryId: 'private-entry',
          mode: 'sprint',
          periodKey: '2026-09',
          pseudonym: 'Juara',
          score: 900,
          accuracy: 100,
          correctCount: 10,
          wrongCount: 0,
          durationMs: 4000,
          finalizedAt: 123,
          resultId: 'private-result',
          userId: 'must-not-leak',
          sessionId: 'must-not-leak',
        }),
      },
    ]);
    resultQuery = makeQuery([
      {
        data: () => ({
          resultId: 'result-1',
          sessionId: 'session-1',
          userId: 'user-1',
          mode: 'sprint',
          status: 'VALIDATED',
          isRanked: true,
          score: 900,
          accuracy: 100,
          correctCount: 10,
          wrongCount: 0,
          questionsAnswered: 10,
          rankedActiveDurationMs: 4000,
          maxStreak: 10,
          difficultyReached: 3,
          rejectionReasons: [],
          finalizedAt: 123,
          rulesVersion: '2.0',
          contentVersion: '72L-v1',
        }),
      },
    ]);
    firestore = {
      collection: vi.fn((name: string) => ({
        where: vi.fn((...args: any[]) => {
          const query = name === 'leaderboardEntries' ? leaderboardQuery : resultQuery;
          query.where(...args);
          return query;
        }),
      })),
    };
  });

  it('returns one-based public leaderboard ranks and strips internal fields', async () => {
    const service = new LeaderboardService(firestore);
    const result = await service.getLeaderboard({
      mode: 'sprint',
      periodKey: '2026-09',
      offset: 4,
      limit: 10,
    });

    expect(result).toEqual({
      periodKey: '2026-09',
      mode: 'sprint',
      entries: [{
        rank: 5,
        pseudonym: 'Juara',
        score: 900,
        accuracy: 100,
        correctCount: 10,
        durationMs: 4000,
        finalizedAt: 123,
      }],
      total: 1,
    });
    expect(result.entries[0]).not.toHaveProperty('userId');
    expect(result.entries[0]).not.toHaveProperty('resultId');
    expect(leaderboardQuery.offset).toHaveBeenCalledWith(4);
    expect(leaderboardQuery.limit).toHaveBeenCalledWith(10);
  });

  it('applies safe defaults and maximums to leaderboard pagination', async () => {
    const service = new LeaderboardService(firestore);
    await service.getLeaderboard({
      mode: 'survival',
      periodKey: '2026-09',
      limit: 999,
      offset: -20,
    });

    expect(leaderboardQuery.offset).toHaveBeenCalledWith(0);
    expect(leaderboardQuery.limit).toHaveBeenCalledWith(100);
  });

  it('rejects invalid leaderboard mode and period', async () => {
    const service = new LeaderboardService(firestore);
    await expect(service.getLeaderboard({ mode: 'arena' as any, periodKey: '2026-09' }))
      .rejects.toMatchObject({ statusCode: 400, errorCode: 'INVALID_COMPETITIVE_MODE' });
    await expect(service.getLeaderboard({ mode: 'sprint', periodKey: '' }))
      .rejects.toMatchObject({ statusCode: 400, errorCode: 'INVALID_PERIOD_KEY' });
  });

  it('returns authenticated user result history with optional mode filtering', async () => {
    const service = new LeaderboardService(firestore);
    const result = await service.getUserResults({
      userId: 'user-1',
      mode: 'sprint',
      limit: 3,
      offset: 2,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].userId).toBe('user-1');
    expect(resultQuery.offset).toHaveBeenCalledWith(2);
    expect(resultQuery.limit).toHaveBeenCalledWith(3);
    expect(resultQuery.where).toHaveBeenCalledWith('userId', '==', 'user-1');
    expect(resultQuery.where).toHaveBeenCalledWith('mode', '==', 'sprint');
  });

  it('clamps result history pagination and validates user and mode', async () => {
    const service = new LeaderboardService(firestore);
    await service.getUserResults({ userId: 'user-1', limit: 999, offset: -3 });
    expect(resultQuery.offset).toHaveBeenCalledWith(0);
    expect(resultQuery.limit).toHaveBeenCalledWith(50);

    await expect(service.getUserResults({ userId: '', limit: 1 }))
      .rejects.toMatchObject({ statusCode: 400, errorCode: 'INVALID_USER_ID' });
    await expect(service.getUserResults({ userId: 'user-1', mode: 'arena' as any }))
      .rejects.toMatchObject({ statusCode: 400, errorCode: 'INVALID_COMPETITIVE_MODE' });
  });
});
