import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('API Endpoints Integration', () => {
  let app: any;
  let mockSessionService: any;
  let mockValidationService: any;
  let mockLeaderboardService: any;

  beforeEach(() => {
    mockSessionService = {
      createSession: vi.fn().mockResolvedValue({
        session: { sessionId: 'sess-abc', mode: 'sprint', isRanked: true },
        questions: [{ sequence: 1, questionToken: 'tok_1', renderedPrompt: '2 + 2' }],
      }),
      recordAnswerReceipt: vi.fn().mockResolvedValue({
        status: 'ACCEPTED',
        sequence: 1,
        isCorrect: true,
        serverReceivedAt: 1000,
        timeRemainingMs: 50000,
        nextQuestion: null,
      }),
    };
    mockValidationService = {
      validateAndFinalize: vi.fn().mockResolvedValue({
        status: 'VALIDATED',
        result: { resultId: 'res-1', score: 100 },
      }),
    };
    mockLeaderboardService = {
      getLeaderboard: vi.fn().mockResolvedValue({
        periodKey: '2026-09-25',
        mode: 'daily',
        entries: [{ rank: 1, pseudonym: 'Juara', score: 1000 }],
        total: 1,
      }),
      getUserResults: vi.fn().mockResolvedValue({ results: [] }),
    };

    app = createApp({
      sessionService: mockSessionService,
      validationService: mockValidationService,
      leaderboardService: mockLeaderboardService,
      skipAuth: true,
    });
  });

  it('GET /api/health returns 200 OK without auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('POST /api/competitive/sessions validates body and returns 201', async () => {
    const res = await request(app)
      .post('/api/competitive/sessions')
      .send({ mode: 'sprint', idempotencyKey: 'key-1' });

    expect(res.status).toBe(201);
    expect(res.body.session.sessionId).toBe('sess-abc');
  });

  it('POST /api/competitive/sessions rejects invalid mode with 400', async () => {
    const res = await request(app)
      .post('/api/competitive/sessions')
      .send({ mode: 'invalid_mode', idempotencyKey: 'key-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_MODE');
  });

  it('POST /api/competitive/sessions/:sessionId/answers records answer and returns receipt', async () => {
    const res = await request(app)
      .post('/api/competitive/sessions/sess-abc/answers')
      .send({
        sequence: 1,
        questionToken: 'tok_1',
        rawInput: '4',
        clientAnsweredAt: Date.now(),
        inputLatencyMs: 250,
        idempotencyKey: 'ans-1',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACCEPTED');
    expect(res.body.isCorrect).toBe(true);
    expect(mockSessionService.recordAnswerReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-abc',
        sequence: 1,
        questionToken: 'tok_1',
        rawInput: '4',
        idempotencyKey: 'ans-1',
      })
    );
  });

  it('POST /api/competitive/sessions/:sessionId/answers rejects invalid sequence with 400', async () => {
    const res = await request(app)
      .post('/api/competitive/sessions/sess-abc/answers')
      .send({
        sequence: 0,
        questionToken: 'tok_1',
        rawInput: '4',
        idempotencyKey: 'ans-1',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_SEQUENCE');
  });

  it('GET /api/competitive/leaderboard/:periodKey returns ranking', async () => {
    const res = await request(app)
      .get('/api/competitive/leaderboard/2026-09-25?mode=daily');

    expect(res.status).toBe(200);
    expect(res.body.entries[0].rank).toBe(1);
  });

  it('GET /api/competitive/leaderboard/:periodKey rejects missing mode', async () => {
    const res = await request(app)
      .get('/api/competitive/leaderboard/2026-09-25');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_MODE');
  });

  it('POST /api/competitive/sessions/:sessionId/submit validates and returns result', async () => {
    const res = await request(app)
      .post('/api/competitive/sessions/sess-abc/submit')
      .send({
        answers: [{ questionToken: 'tok_1', answer: 4, answeredAt: Date.now() }],
        submissionIdempotencyKey: 'sub-key-1',
        pseudonym: 'Juara',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('VALIDATED');
  });

  it('POST /api/competitive/sessions/:sessionId/submit rejects non-array answers', async () => {
    const res = await request(app)
      .post('/api/competitive/sessions/sess-abc/submit')
      .send({
        answers: 'not-an-array',
        submissionIdempotencyKey: 'sub-key-1',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_ANSWERS');
  });

  it('GET /api/competitive/results/me returns user results', async () => {
    const res = await request(app)
      .get('/api/competitive/results/me');

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });
});
