import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionService } from '../../src/services/sessionService.js';

describe('SessionService', () => {
  let mockFirestore: any;
  let mockDoc: any;
  let mockCollection: any;
  let sessionsMap: Map<string, any>;
  let resultsMap: Map<string, any>;

  beforeEach(() => {
    sessionsMap = new Map();
    resultsMap = new Map();

    mockDoc = {
      get: vi.fn(),
      set: vi.fn().mockImplementation((data: any) => {
        return Promise.resolve(undefined);
      }),
      update: vi.fn().mockResolvedValue(undefined),
    };

    mockCollection = (colName: string) => {
      return {
        doc: vi.fn().mockImplementation((docId?: string) => {
          return {
            get: vi.fn().mockImplementation(() => {
              const data = colName === 'competitiveSessions' ? sessionsMap.get(docId!) : resultsMap.get(docId!);
              return Promise.resolve({
                exists: !!data,
                data: () => data,
              });
            }),
            set: vi.fn().mockImplementation((data: any) => {
              if (colName === 'competitiveSessions') sessionsMap.set(docId!, data);
              else resultsMap.set(docId!, data);
              return Promise.resolve(undefined);
            }),
            update: vi.fn().mockImplementation((data: any) => {
              if (colName === 'competitiveSessions') {
                const prev = sessionsMap.get(docId!) || {};
                sessionsMap.set(docId!, { ...prev, ...data });
              }
              return Promise.resolve(undefined);
            }),
          };
        }),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      };
    };

    const sessionsColInstance = {
      doc: vi.fn().mockReturnValue(mockDoc),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    };

    const resultsColInstance = {
      doc: vi.fn().mockReturnValue(mockDoc),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    };

    mockFirestore = {
      collection: vi.fn().mockImplementation((name: string) => {
        if (name === 'competitiveSessions') return sessionsColInstance;
        if (name === 'competitiveResults') return resultsColInstance;
        return mockCollection(name);
      }),
      runTransaction: vi.fn(async (cb: any) => cb({
        get: vi.fn(async (ref: any) => {
          const id = String(ref.path || '').split('/')[1];
          const data = sessionsMap.get(id);
          return { exists: !!data, data: () => data };
        }),
        set: vi.fn(async (ref: any, data: any) => {
          sessionsMap.set(String(ref.path || '').split('/')[1], data);
        }),
        create: vi.fn(async (ref: any, data: any) => {
          sessionsMap.set(String(ref.path || '').split('/')[1], data);
        }),
      })),
    };
  });

  it('creates sprint session with 60s deadline and HMAC question tokens', async () => {
    const service = new SessionService(mockFirestore);
    const result = await service.createSession({
      userId: 'user-test-1',
      mode: 'sprint',
      idempotencyKey: 'idemp-123',
    });

    expect(result.session.sessionId).toMatch(/^sess_[a-f0-9]{32}$/);
    expect(result.session.mode).toBe('sprint');
    expect(result.session.isRanked).toBe(true);
    expect(result.session.serverDeadlineAt - result.session.serverStartedAt).toBe(60000);
    expect(result.questions.length).toBe(30);
    expect(result.questions[0].questionToken).toMatch(/^tok_/);
    expect(mockFirestore.runTransaction).toHaveBeenCalled();
  });

  it('creates survival session with 600s deadline', async () => {
    const service = new SessionService(mockFirestore);
    const result = await service.createSession({
      userId: 'user-test-2',
      mode: 'survival',
      idempotencyKey: 'idemp-survival',
    });

    expect(result.session.sessionId).toBeDefined();
    expect(result.session.mode).toBe('survival');
    expect(result.session.isRanked).toBe(true);
    expect(result.session.serverDeadlineAt - result.session.serverStartedAt).toBe(600000);
    expect(result.questions.length).toBe(30);
  });

  it('creates daily session with 10 questions and daily challengeId', async () => {
    const service = new SessionService(mockFirestore);
    const result = await service.createSession({
      userId: 'user-test-3',
      mode: 'daily',
      idempotencyKey: 'idemp-daily-1',
    });

    expect(result.session.sessionId).toBeDefined();
    expect(result.session.mode).toBe('daily');
    expect(result.session.isRanked).toBe(true);
    expect(result.session.serverDeadlineAt - result.session.serverStartedAt).toBe(90000);
    expect(result.questions.length).toBe(10);
    expect(result.questions[0].questionToken).toMatch(/^tok_/);
  });

  it('marks daily session as unranked when user has already completed a ranked daily today', async () => {
    const sessionsCol = {
      doc: vi.fn().mockReturnValue(mockDoc),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    };

    const resultsCol = {
      doc: vi.fn().mockReturnValue(mockDoc),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: [{ data: () => ({ status: 'VALIDATED', isRanked: true }) }],
      }),
    };

    mockFirestore.collection.mockImplementation((name: string) => {
      if (name === 'competitiveSessions') return sessionsCol;
      if (name === 'competitiveResults') return resultsCol;
      return mockCollection(name);
    });

    const service = new SessionService(mockFirestore);
    const result = await service.createSession({
      userId: 'user-test-4',
      mode: 'daily',
      idempotencyKey: 'idemp-daily-2',
    });

    expect(result.session.isRanked).toBe(false);
  });

  it('returns existing session when idempotencyKey matches', async () => {
    const cachedSessionDoc = {
      sessionId: 'cached-session-123',
      userId: 'user-test-1',
      mode: 'sprint',
      rulesVersion: '2.0',
      contentVersion: '72L-v1',
      serverStartedAt: 1000000,
      serverDeadlineAt: 1060000,
      isRanked: true,
      clientQuestionViews: [
        {
          questionInstanceId: 'q1',
          sequence: 1,
          renderedPrompt: '2 + 2',
          answerInputKind: 'numeric',
          questionToken: 'tok_cached',
        },
      ],
    };

    const sessionsCol = {
      doc: vi.fn().mockReturnValue(mockDoc),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: [{ data: () => cachedSessionDoc }],
      }),
    };

    mockFirestore.collection.mockImplementation((name: string) => {
      if (name === 'competitiveSessions') return sessionsCol;
      return mockCollection(name);
    });

    const service = new SessionService(mockFirestore);
    const result = await service.createSession({
      userId: 'user-test-1',
      mode: 'sprint',
      idempotencyKey: 'idemp-123',
    });

    expect(result.session.sessionId).toBe('cached-session-123');
    expect(result.questions).toEqual(cachedSessionDoc.clientQuestionViews);
    expect(mockDoc.set).not.toHaveBeenCalled();
  });
});
