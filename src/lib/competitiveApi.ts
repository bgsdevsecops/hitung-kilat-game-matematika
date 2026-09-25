import {
  CompetitiveMode,
  CompetitiveQuestionView,
  SubmittedAnswerPayload,
  CompetitiveResultDoc,
  LeaderboardEntryDoc,
} from '../engine/competitive/types';

export type { CompetitiveQuestionView } from '../engine/competitive/types';
export type CompetitiveLeaderboardEntry = LeaderboardEntryDoc;

export type CompetitiveApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'AGE_RESTRICTED'
  | 'NETWORK_UNAVAILABLE'
  | 'TIMEOUT'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE';

function sanitizeErrorDetails(details: unknown): unknown {
  if (!details || typeof details !== 'object') return details;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    // Strip sensitive fields
    if (/secret|answer|key|token|auth/i.test(key)) continue;
    safe[key] = value;
  }
  return safe;
}

export class CompetitiveApiError extends Error {
  public details?: unknown;

  constructor(
    public code: CompetitiveApiErrorCode,
    message: string,
    public status?: number,
    details?: unknown
  ) {
    super(message);
    this.name = 'CompetitiveApiError';
    this.details = sanitizeErrorDetails(details);
  }
}

export interface CreateSessionResult {
  session: {
    sessionId: string;
    mode: CompetitiveMode;
    rulesVersion: string;
    contentVersion: string;
    serverStartedAt: number;
    serverDeadlineAt: number;
    isRanked: boolean;
  };
  questions: CompetitiveQuestionView[];
}

export interface RecordAnswerParams {
  sequence: number;
  questionToken: string;
  rawInput: string;
  clientAnsweredAt: number;
  inputLatencyMs: number;
  idempotencyKey: string;
}

export interface AnswerReceiptResult {
  status: 'ACCEPTED';
  sequence: number;
  isCorrect: boolean;
  serverReceivedAt: number;
  timeRemainingMs: number;
  nextQuestion: CompetitiveQuestionView | null;
}

export interface FinalizeSessionResult {
  status: 'VALIDATED' | 'REJECTED';
  result: CompetitiveResultDoc;
  leaderboardPosition?: number;
}

export interface CompetitiveApiClientOptions {
  baseUrl?: string;
  getToken?: () => Promise<string | null>;
  fetchFn?: typeof fetch;
  defaultTimeoutMs?: number;
}

export interface CompetitiveApiClient {
  createSession(params: { mode: CompetitiveMode; challengeId?: string; idempotencyKey: string }): Promise<CreateSessionResult>;
  submitAnswer(sessionId: string, params: RecordAnswerParams): Promise<AnswerReceiptResult>;
  submitSession(sessionId: string, params: { answers: SubmittedAnswerPayload[]; submissionIdempotencyKey: string; pseudonym?: string }): Promise<FinalizeSessionResult>;
  getLeaderboard(periodKey: string, mode: CompetitiveMode, options?: { limit?: number; offset?: number }): Promise<LeaderboardEntryDoc[]>;
  getMyResults(mode?: CompetitiveMode, options?: { limit?: number; offset?: number }): Promise<CompetitiveResultDoc[]>;
}

export function createCompetitiveApiClient(options: CompetitiveApiClientOptions = {}): CompetitiveApiClient {
  const baseUrl = (options.baseUrl ?? '/api/competitive').replace(/\/+$/, '');
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const defaultTimeoutMs = options.defaultTimeoutMs ?? 10_000;

  async function request<T>(
    endpoint: string,
    reqOptions: {
      method?: string;
      body?: unknown;
      requiresAuth?: boolean;
      timeoutMs?: number;
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      requiresAuth = true,
      timeoutMs = defaultTimeoutMs,
    } = reqOptions;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (requiresAuth) {
      if (!options.getToken) {
        throw new CompetitiveApiError('UNAUTHENTICATED', 'No authentication provider configured.');
      }
      const token = await options.getToken();
      if (!token) {
        throw new CompetitiveApiError('UNAUTHENTICATED', 'User is not authenticated.');
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errData: any;
        try {
          errData = await response.json();
        } catch {
          errData = null;
        }
        const message = errData?.message || `HTTP request failed with status ${response.status}`;
        throw new CompetitiveApiError('HTTP_ERROR', message, response.status, errData);
      }

      const json = await response.json();
      return json as T;
    } catch (err: any) {
      if (err instanceof CompetitiveApiError) {
        throw err;
      }
      if (err.name === 'AbortError') {
        throw new CompetitiveApiError('TIMEOUT', `Request timed out after ${timeoutMs}ms.`);
      }
      throw new CompetitiveApiError('NETWORK_UNAVAILABLE', err.message || 'Network request failed.');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    async createSession(params) {
      const res = await request<CreateSessionResult>('/sessions', {
        method: 'POST',
        body: params,
        requiresAuth: true,
      });

      if (!res?.session?.sessionId || !Array.isArray(res?.questions)) {
        throw new CompetitiveApiError('INVALID_RESPONSE', 'Invalid createSession response from server.');
      }
      return res;
    },

    async submitAnswer(sessionId, params) {
      const res = await request<AnswerReceiptResult>(`/sessions/${encodeURIComponent(sessionId)}/answers`, {
        method: 'POST',
        body: params,
        requiresAuth: true,
        timeoutMs: 5_000,
      });

      if (res?.status !== 'ACCEPTED' || typeof res?.isCorrect !== 'boolean' || typeof res?.sequence !== 'number') {
        throw new CompetitiveApiError('INVALID_RESPONSE', 'Invalid answer receipt response from server.');
      }
      return res;
    },

    async submitSession(sessionId, params) {
      const res = await request<FinalizeSessionResult>(`/sessions/${encodeURIComponent(sessionId)}/submit`, {
        method: 'POST',
        body: params,
        requiresAuth: true,
      });

      if (!res?.status || !res?.result?.resultId) {
        throw new CompetitiveApiError('INVALID_RESPONSE', 'Invalid submitSession response from server.');
      }
      return res;
    },

    async getLeaderboard(periodKey, mode, opts = {}) {
      const query = new URLSearchParams({ mode });
      if (opts.limit) query.set('limit', String(opts.limit));
      if (opts.offset) query.set('offset', String(opts.offset));

      const res = await request<{ entries: LeaderboardEntryDoc[] }>(
        `/leaderboard/${encodeURIComponent(periodKey)}?${query.toString()}`,
        {
          method: 'GET',
          requiresAuth: false,
        }
      );

      if (!Array.isArray(res?.entries)) {
        throw new CompetitiveApiError('INVALID_RESPONSE', 'Invalid leaderboard response from server.');
      }
      return res.entries;
    },

    async getMyResults(mode, opts = {}) {
      const query = new URLSearchParams();
      if (mode) query.set('mode', mode);
      if (opts.limit) query.set('limit', String(opts.limit));
      if (opts.offset) query.set('offset', String(opts.offset));

      const qs = query.toString();
      const endpoint = qs ? `/results/me?${qs}` : '/results/me';

      const res = await request<{ results: CompetitiveResultDoc[] }>(endpoint, {
        method: 'GET',
        requiresAuth: true,
      });

      if (!Array.isArray(res?.results)) {
        throw new CompetitiveApiError('INVALID_RESPONSE', 'Invalid user results response from server.');
      }
      return res.results;
    },
  };
}
