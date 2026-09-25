import { Firestore } from 'firebase-admin/firestore';
import {
  CompetitiveMode,
  CompetitiveResultDoc,
  LeaderboardEntryDoc,
} from '@engine/competitive/types.js';

export interface LeaderboardQuery {
  mode: CompetitiveMode;
  periodKey: string;
  limit?: number;
  offset?: number;
}

export interface RankedLeaderboardEntry {
  rank: number;
  pseudonym: string;
  score: number;
  accuracy: number;
  correctCount: number;
  durationMs: number;
  finalizedAt: number;
}

export interface UserResultsQuery {
  userId: string;
  mode?: CompetitiveMode;
  limit?: number;
  offset?: number;
}

export interface UserResultsResult {
  results: CompetitiveResultDoc[];
}

const COMPETITIVE_MODES: readonly CompetitiveMode[] = [
  'sprint',
  'survival',
  'daily',
];

function serviceError(message: string, statusCode: number, errorCode: string): Error & {
  statusCode: number;
  errorCode: string;
} {
  const error = new Error(message) as Error & {
    statusCode: number;
    errorCode: string;
  };
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

function assertMode(mode: unknown): asserts mode is CompetitiveMode {
  if (!COMPETITIVE_MODES.includes(mode as CompetitiveMode)) {
    throw serviceError('Unsupported competitive mode.', 400, 'INVALID_COMPETITIVE_MODE');
  }
}

function assertPeriodKey(periodKey: unknown): asserts periodKey is string {
  if (typeof periodKey !== 'string' || periodKey.trim().length === 0 || periodKey.length > 64) {
    throw serviceError('A valid leaderboard period is required.', 400, 'INVALID_PERIOD_KEY');
  }
}

function assertUserId(userId: unknown): asserts userId is string {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw serviceError('A valid user is required.', 400, 'INVALID_USER_ID');
  }
}

function clampInteger(value: unknown, defaultValue: number, max: number): number {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultValue;
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

function leaderboardLimit(value: unknown): number {
  return Math.max(1, clampInteger(value, 20, 100));
}

function resultsLimit(value: unknown): number {
  return Math.max(1, clampInteger(value, 10, 50));
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function publicEntry(data: Partial<LeaderboardEntryDoc>, rank: number): RankedLeaderboardEntry {
  return {
    rank,
    pseudonym:
      typeof data.pseudonym === 'string' && data.pseudonym.trim().length > 0
        ? data.pseudonym
        : 'Pemain Kilat',
    score: finiteNumber(data.score),
    accuracy: finiteNumber(data.accuracy),
    correctCount: finiteNumber(data.correctCount),
    durationMs: finiteNumber(data.durationMs),
    finalizedAt: finiteNumber(data.finalizedAt),
  };
}

export class LeaderboardService {
  constructor(private readonly firestore: Firestore) {}

  async getLeaderboard(query: LeaderboardQuery): Promise<{
    periodKey: string;
    mode: CompetitiveMode;
    entries: RankedLeaderboardEntry[];
    total: number;
  }> {
    assertMode(query.mode);
    assertPeriodKey(query.periodKey);

    const limit = leaderboardLimit(query.limit);
    const offset = clampInteger(query.offset, 0, Number.MAX_SAFE_INTEGER);
    const snapshot = await this.firestore
      .collection('leaderboardEntries')
      .where('mode', '==', query.mode)
      .where('periodKey', '==', query.periodKey)
      .orderBy('score', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    const entries = snapshot.docs.map((doc: { data(): Partial<LeaderboardEntryDoc> }, index: number) =>
      publicEntry(doc.data(), offset + index + 1),
    );

    return {
      periodKey: query.periodKey,
      mode: query.mode,
      entries,
      total: entries.length,
    };
  }

  async getUserResults(params: UserResultsQuery): Promise<UserResultsResult> {
    assertUserId(params.userId);
    if (params.mode !== undefined) assertMode(params.mode);

    const limit = resultsLimit(params.limit);
    const offset = clampInteger(params.offset, 0, Number.MAX_SAFE_INTEGER);
    let query: any = this.firestore
      .collection('competitiveResults')
      .where('userId', '==', params.userId);

    if (params.mode !== undefined) {
      query = query.where('mode', '==', params.mode);
    }

    const snapshot = await query
      .orderBy('finalizedAt', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    return {
      results: snapshot.docs.map((doc: { data(): CompetitiveResultDoc }) => doc.data()),
    };
  }
}
