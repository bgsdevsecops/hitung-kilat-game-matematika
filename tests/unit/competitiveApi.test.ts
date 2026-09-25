import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCompetitiveApiClient, CompetitiveApiError } from '../../src/lib/competitiveApi';

describe('CompetitiveApiClient', () => {
  let mockFetch: any;
  let getToken: any;
  let client: ReturnType<typeof createCompetitiveApiClient>;

  beforeEach(() => {
    mockFetch = vi.fn();
    getToken = vi.fn().mockResolvedValue('mock_token_xyz');
    client = createCompetitiveApiClient({
      baseUrl: '/api/competitive',
      getToken,
      fetchFn: mockFetch,
    });
  });

  it('attaches Authorization header with Bearer token for authenticated requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { sessionId: 'sess_1', mode: 'sprint', rulesVersion: '2.0', contentVersion: '72L-v1', serverStartedAt: 1000, serverDeadlineAt: 61000, isRanked: true },
        questions: [{ questionInstanceId: 'q1', sequence: 1, renderedPrompt: '1+1', answerInputKind: 'numeric', questionToken: 'tok_1' }],
      }),
    });

    await client.createSession({ mode: 'sprint', idempotencyKey: 'idemp_1' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/competitive/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock_token_xyz',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('throws UNAUTHENTICATED error when getToken returns null', async () => {
    getToken.mockResolvedValueOnce(null);

    await expect(
      client.createSession({ mode: 'sprint', idempotencyKey: 'idemp_1' })
    ).rejects.toThrow(CompetitiveApiError);
  });

  it('submits answer receipt with idempotency key and parses valid response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ACCEPTED',
        sequence: 1,
        isCorrect: true,
        serverReceivedAt: 2000,
        timeRemainingMs: 58000,
        nextQuestion: null,
      }),
    });

    const res = await client.submitAnswer('sess_1', {
      sequence: 1,
      questionToken: 'tok_1',
      rawInput: '2',
      clientAnsweredAt: 1000,
      inputLatencyMs: 300,
      idempotencyKey: 'ans_1',
    });

    expect(res.status).toBe('ACCEPTED');
    expect(res.isCorrect).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/competitive/sessions/sess_1/answers',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sequence: 1,
          questionToken: 'tok_1',
          rawInput: '2',
          clientAnsweredAt: 1000,
          inputLatencyMs: 300,
          idempotencyKey: 'ans_1',
        }),
      })
    );
  });

  it('submits final session answers and parses finalize result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'VALIDATED',
        result: {
          resultId: 'res_1',
          sessionId: 'sess_1',
          userId: 'user_1',
          mode: 'sprint',
          rulesVersion: '2.0',
          contentVersion: '72L-v1',
          score: 100,
          correctCount: 10,
          incorrectCount: 0,
          accuracy: 1.0,
          durationMs: 60000,
          status: 'VALIDATED',
          isRanked: true,
          rejectionReasons: [],
          finalizedAt: 2000,
        },
      }),
    });

    const res = await client.submitSession('sess_1', {
      answers: [],
      submissionIdempotencyKey: 'sub_1',
      pseudonym: 'Pemain 1',
    });

    expect(res.status).toBe('VALIDATED');
    expect(res.result.resultId).toBe('res_1');
  });

  it('gets leaderboard entries for public viewing without requiring auth token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        entries: [
          { rank: 1, pseudonym: 'Kilat1', score: 500 },
        ],
      }),
    });

    const unauthedClient = createCompetitiveApiClient({
      baseUrl: '/api/competitive',
      fetchFn: mockFetch,
    });

    const entries = await unauthedClient.getLeaderboard('2026-09', 'sprint');
    expect(entries).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/competitive/leaderboard/2026-09?mode=sprint',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('maps HTTP 429 to RATE_LIMIT_EXCEEDED / HTTP_ERROR error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' }),
    });

    await expect(
      client.createSession({ mode: 'sprint', idempotencyKey: 'idemp_1' })
    ).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      status: 429,
    });
  });

  it('maps invalid json structure to INVALID_RESPONSE error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ invalid: 'structure' }),
    });

    await expect(
      client.createSession({ mode: 'sprint', idempotencyKey: 'idemp_1' })
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('maps network failures to NETWORK_UNAVAILABLE error', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(
      client.createSession({ mode: 'sprint', idempotencyKey: 'idemp_1' })
    ).rejects.toMatchObject({
      code: 'NETWORK_UNAVAILABLE',
    });
  });
});
