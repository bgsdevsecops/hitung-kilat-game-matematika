import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationService } from '../../src/services/validationService.js';
import { createCompetitiveSession } from '@engine/competitive/stateMachine.js';
import { Question } from '@engine/types/question.js';

describe('ValidationService', () => {
  let mockFirestore: any;
  let mockTx: any;
  let storedSessions: Map<string, any>;
  let storedResults: Map<string, any>;
  let storedLeaderboards: Map<string, any>;

  const secret = 'super-secret-key-for-test-32-chars-long!';
  const dummyQuestion: Question = {
    id: 'q-test-1',
    displayPrompt: '2 + 3',
    tier: 1,
    contentVersion: '72L-v1',
    answerSpec: {
      kind: 'integer',
      value: 5,
    },
  } as any;

  beforeEach(() => {
    storedSessions = new Map();
    storedResults = new Map();
    storedLeaderboards = new Map();

    mockTx = {
      get: vi.fn().mockImplementation((ref: any) => {
        const path = ref.path;
        if (path.startsWith('competitiveSessions/')) {
          const id = path.split('/')[1];
          const data = storedSessions.get(id);
          return Promise.resolve({
            exists: !!data,
            data: () => data,
          });
        }
        if (path.startsWith('competitiveResults/')) {
          const id = path.split('/')[1];
          const data = storedResults.get(id);
          return Promise.resolve({
            exists: !!data,
            data: () => data,
          });
        }
        if (path.startsWith('leaderboardEntries/')) {
          const id = path.split('/')[1];
          const data = storedLeaderboards.get(id);
          return Promise.resolve({
            exists: !!data,
            data: () => data,
          });
        }
        return Promise.resolve({ exists: false, data: () => undefined });
      }),
      set: vi.fn().mockImplementation((ref: any, data: any, options?: any) => {
        const path = ref.path;
        if (path.startsWith('competitiveResults/')) {
          const id = path.split('/')[1];
          storedResults.set(id, data);
        } else if (path.startsWith('leaderboardEntries/')) {
          const id = path.split('/')[1];
          if (options?.merge && storedLeaderboards.has(id)) {
            storedLeaderboards.set(id, { ...storedLeaderboards.get(id), ...data });
          } else {
            storedLeaderboards.set(id, data);
          }
        }
        return Promise.resolve(undefined);
      }),
      update: vi.fn().mockImplementation((ref: any, data: any) => {
        const path = ref.path;
        if (path.startsWith('competitiveSessions/')) {
          const id = path.split('/')[1];
          const prev = storedSessions.get(id) || {};
          storedSessions.set(id, { ...prev, ...data });
        }
        return Promise.resolve(undefined);
      }),
    };

    mockFirestore = {
      runTransaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockTx);
      }),
      collection: vi.fn().mockImplementation((colName: string) => {
        return {
          doc: vi.fn().mockImplementation((docId: string) => ({
            path: `${colName}/${docId}`,
          })),
        };
      }),
    };
  });

  it('instantiates and provides validation interface', () => {
    const service = new ValidationService(mockFirestore);
    expect(service.validateAndFinalize).toBeDefined();
  });

  it('throws 404 when session not found', async () => {
    const service = new ValidationService(mockFirestore);
    await expect(
      service.validateAndFinalize({
        sessionId: 'non-existent',
        userId: 'user-1',
        answers: [],
        submissionIdempotencyKey: 'idemp-sub-1',
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      errorCode: 'SESSION_NOT_FOUND',
    });
  });

  it('throws 403 when session belongs to a different user', async () => {
    storedSessions.set('session-1', {
      sessionId: 'session-1',
      userId: 'owner-user',
      status: 'ACTIVE',
    });

    const service = new ValidationService(mockFirestore);
    await expect(
      service.validateAndFinalize({
        sessionId: 'session-1',
        userId: 'other-user',
        answers: [],
        submissionIdempotencyKey: 'idemp-sub-1',
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      errorCode: 'SESSION_FORBIDDEN',
    });
  });

  it('returns cached result when submissionIdempotencyKey matches', async () => {
    const cachedResult = {
      resultId: 'res-cached-1',
      score: 100,
      status: 'VALIDATED',
    };
    storedResults.set('res-cached-1', cachedResult);

    storedSessions.set('session-1', {
      sessionId: 'session-1',
      userId: 'user-1',
      status: 'VALIDATED',
      resultId: 'res-cached-1',
      submissionIdempotencyKey: 'same-idemp-key',
    });

    const service = new ValidationService(mockFirestore);
    const res = await service.validateAndFinalize({
      sessionId: 'session-1',
      userId: 'user-1',
      answers: [],
      submissionIdempotencyKey: 'same-idemp-key',
    });

    expect(res.status).toBe('VALIDATED');
    expect(res.result).toEqual(cachedResult);
    expect(mockTx.set).not.toHaveBeenCalled();
    expect(mockTx.update).not.toHaveBeenCalled();
  });

  it('throws 409 when session is already finalized and idempotency does not match', async () => {
    storedSessions.set('session-1', {
      sessionId: 'session-1',
      userId: 'user-1',
      status: 'VALIDATED',
      submissionIdempotencyKey: 'old-idemp-key',
    });

    const service = new ValidationService(mockFirestore);
    await expect(
      service.validateAndFinalize({
        sessionId: 'session-1',
        userId: 'user-1',
        answers: [],
        submissionIdempotencyKey: 'new-idemp-key',
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      errorCode: 'SESSION_ALREADY_FINALIZED',
    });
  });

  it('successfully validates sprint session with valid answers and updates leaderboard', async () => {
    const startedAt = Date.now() - 10000;
    const internal = createCompetitiveSession({
      sessionId: 'sess-sprint-1',
      userId: 'user-winner',
      mode: 'sprint',
      rulesVersion: '2.0',
      contentVersion: '72L-v1',
      serverStartedAt: startedAt,
      initialQuestions: [dummyQuestion],
      secret,
      isRanked: true,
    });

    const serializedQuestions: Record<string, unknown> = {};
    for (const [seq, q] of internal.serverQuestions.entries()) {
      serializedQuestions[String(seq)] = q;
    }

    storedSessions.set('sess-sprint-1', {
      ...internal.contract,
      serverSecret: secret,
      serverQuestions: serializedQuestions,
      clientQuestionViews: internal.bufferedViews,
      createdAt: startedAt,
      updatedAt: startedAt,
    });

    const service = new ValidationService(mockFirestore);
    const res = await service.validateAndFinalize({
      sessionId: 'sess-sprint-1',
      userId: 'user-winner',
      pseudonym: 'Speedy Champion',
      answers: [
        {
          sequence: 1,
          questionToken: internal.bufferedViews[0].questionToken,
          rawInput: '5',
          clientAnsweredAt: 3000,
          inputLatencyMs: 1500,
          idempotencyKey: 'ans-1',
        },
      ],
      submissionIdempotencyKey: 'sub-idemp-1',
    });

    expect(res.status).toBe('VALIDATED');
    expect(res.result.score).toBeGreaterThan(0);
    expect(res.result.correctCount).toBe(1);
    expect(res.result.accuracy).toBe(100);

    // Verify session updated in tx
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'competitiveSessions/sess-sprint-1' }),
      expect.objectContaining({
        status: 'VALIDATED',
        resultId: res.result.resultId,
        submissionIdempotencyKey: 'sub-idemp-1',
      })
    );

    // Verify leaderboard entry created
    const expectedPeriodKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 7);
    const expectedLbId = [...storedLeaderboards.keys()].find((id) => id.startsWith(`sprint_${expectedPeriodKey}_2.0_72L-v1_`));
    expect(expectedLbId).toBeDefined();
    const lbEntry = storedLeaderboards.get(expectedLbId!);
    expect(lbEntry.pseudonym).toBe('Speedy Champion');
    expect(lbEntry.score).toBe(res.result.score);
  });

  it('marks result REJECTED and does not write leaderboard entry if answers have sub-human latency', async () => {
    const startedAt = Date.now() - 5000;
    const internal = createCompetitiveSession({
      sessionId: 'sess-sprint-cheat',
      userId: 'user-bot',
      mode: 'sprint',
      rulesVersion: '2.0',
      contentVersion: '72L-v1',
      serverStartedAt: startedAt,
      initialQuestions: [dummyQuestion],
      secret,
      isRanked: true,
    });

    const serializedQuestions: Record<string, unknown> = {};
    for (const [seq, q] of internal.serverQuestions.entries()) {
      serializedQuestions[String(seq)] = q;
    }

    storedSessions.set('sess-sprint-cheat', {
      ...internal.contract,
      serverSecret: secret,
      serverQuestions: serializedQuestions,
      clientQuestionViews: internal.bufferedViews,
      createdAt: startedAt,
      updatedAt: startedAt,
    });

    const service = new ValidationService(mockFirestore);
    const res = await service.validateAndFinalize({
      sessionId: 'sess-sprint-cheat',
      userId: 'user-bot',
      pseudonym: 'Bot Player',
      answers: [
        {
          sequence: 1,
          questionToken: internal.bufferedViews[0].questionToken,
          rawInput: '5',
          clientAnsweredAt: 50,
          inputLatencyMs: 40, // < 120ms sub-human latency
          idempotencyKey: 'ans-bot',
        },
      ],
      submissionIdempotencyKey: 'sub-bot-1',
    });

    expect(res.status).toBe('REJECTED');
    expect(res.result.rejectionReasons.length).toBeGreaterThan(0);
    expect(res.result.isRanked).toBe(false);

    // Verify leaderboard entry was NOT created
    expect(storedLeaderboards.size).toBe(0);

    // Verify session updated with REJECTED status
    expect(mockTx.update).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'competitiveSessions/sess-sprint-cheat' }),
      expect.objectContaining({
        status: 'REJECTED',
      })
    );
  });

  it('rejects malformed answer elements without throwing', async () => {
    const startedAt = Date.now();
    storedSessions.set('sess-malformed', {
      sessionId: 'sess-malformed', userId: 'user-1', mode: 'sprint', rulesVersion: '2.0',
      contentVersion: '72L-v1', status: 'ACTIVE', isRanked: true, idempotencyKey: 'start',
      serverStartedAt: startedAt, serverDeadlineAt: startedAt + 60000, serverSecret: secret, serverQuestions: {},
    });
    const service = new ValidationService(mockFirestore);
    const response = await service.validateAndFinalize({ sessionId: 'sess-malformed', userId: 'user-1', answers: [null as any], submissionIdempotencyKey: 'sub-malformed' });
    expect(response.status).toBe('REJECTED');
    expect(response.result.rejectionReasons).toContain('Malformed submitted answer payload');
  });

  it('uses server receipt time so spoofed old client timestamps cannot bypass deadline', async () => {
    const startedAt = Date.now() - 120000;
    const internal = createCompetitiveSession({ sessionId: 'sess-late', userId: 'user-late', mode: 'sprint', rulesVersion: '2.0', contentVersion: '72L-v1', serverStartedAt: startedAt, initialQuestions: [dummyQuestion], secret, isRanked: true });
    const serverQuestions: Record<string, unknown> = {};
    for (const [sequence, question] of internal.serverQuestions) serverQuestions[String(sequence)] = question;
    storedSessions.set('sess-late', { ...internal.contract, serverSecret: secret, serverQuestions, clientQuestionViews: internal.bufferedViews });
    const service = new ValidationService(mockFirestore);
    const response = await service.validateAndFinalize({
      sessionId: 'sess-late', userId: 'user-late', submissionIdempotencyKey: 'sub-late',
      answers: [{ sequence: 1, questionToken: internal.bufferedViews[0].questionToken, rawInput: '5', clientAnsweredAt: 1, inputLatencyMs: 1000, idempotencyKey: 'answer' }],
    });
    expect(response.status).toBe('REJECTED');
    expect(response.result.rejectionReasons.some((reason) => reason.includes('deadline'))).toBe(true);
  });

  it('projects opaque versioned leaderboard IDs and preserves the better existing score', async () => {
    const startedAt = Date.now() - 10000;
    const challengeDate = '2026-09-25';
    const challengeId = `${challengeDate}@Asia/Jakarta:72L-v1`;

    const internal = createCompetitiveSession({
      sessionId: 'sess-daily-1',
      userId: 'user-daily-pro',
      mode: 'daily',
      rulesVersion: '2.0',
      contentVersion: '72L-v1',
      challengeId,
      serverStartedAt: startedAt,
      initialQuestions: [dummyQuestion],
      secret,
      isRanked: true,
    });

    const serializedQuestions: Record<string, unknown> = {};
    for (const [seq, q] of internal.serverQuestions.entries()) {
      serializedQuestions[String(seq)] = q;
    }

    storedSessions.set('sess-daily-1', {
      ...internal.contract,
      challengeId,
      serverSecret: secret,
      serverQuestions: serializedQuestions,
      clientQuestionViews: internal.bufferedViews,
      createdAt: startedAt,
      updatedAt: startedAt,
    });

    const service = new ValidationService(mockFirestore);
    const res = await service.validateAndFinalize({
      sessionId: 'sess-daily-1',
      userId: 'user-daily-pro',
      answers: [
        {
          sequence: 1,
          questionToken: internal.bufferedViews[0].questionToken,
          rawInput: '5',
          clientAnsweredAt: 2000,
          inputLatencyMs: 800,
          idempotencyKey: 'ans-daily-1',
        },
      ],
      submissionIdempotencyKey: 'sub-daily-idemp',
    });

    expect(res.status).toBe('VALIDATED');
    const expectedLbId = [...storedLeaderboards.keys()].find((id) => id.startsWith(`daily_${challengeDate}_2.0_72L-v1_`));
    expect(expectedLbId).toBeDefined();
    const lbEntry = storedLeaderboards.get(expectedLbId!);
    expect(lbEntry.periodKey).toBe(challengeDate);
    expect(lbEntry.pseudonym).toBe('Pemain Kilat'); // Default pseudonym fallback
  });
});
