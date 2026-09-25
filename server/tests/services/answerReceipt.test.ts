import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateQuestionToken } from '@engine/competitive/stateMachine.js';
import { SessionService } from '../../src/services/sessionService.js';

describe('SessionService.recordAnswerReceipt', () => {
  let mockFirestore: any;
  let sessionData: any;
  let sessionService: SessionService;
  let validToken: string;

  beforeEach(() => {
    validToken = generateQuestionToken('sess_test_123', 1, 'q1', 'secret_456');

    sessionData = {
      sessionId: 'sess_test_123',
      userId: 'user_abc',
      mode: 'sprint',
      status: 'ACTIVE',
      serverStartedAt: Date.now() - 5000,
      serverDeadlineAt: Date.now() + 55000,
      serverSecret: 'secret_456',
      serverQuestions: {
        '1': { id: 'q1', prompt: '2 + 3', answerSpec: { kind: 'numeric', value: 5 } },
        '2': { id: 'q2', prompt: '4 + 4', answerSpec: { kind: 'numeric', value: 8 } },
      },
      clientQuestionViews: [
        { questionInstanceId: 'q1', sequence: 1, renderedPrompt: '2 + 3', answerInputKind: 'numeric', questionToken: validToken },
      ],
      acknowledgedSequences: [],
      answerReceipts: {},
      isRanked: true,
    };

    mockFirestore = {
      collection: vi.fn().mockReturnThis(),
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: true, data: () => sessionData }),
        set: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
      }),
      runTransaction: vi.fn().mockImplementation(async (cb: any) => {
        const tx = {
          get: vi.fn().mockResolvedValue({ exists: true, data: () => sessionData }),
          set: vi.fn(),
          update: vi.fn().mockImplementation((_ref: any, data: any) => {
            Object.assign(sessionData, data);
          }),
        };
        return cb(tx);
      }),
    };

    sessionService = new SessionService(mockFirestore);
  });

  it('rejects an answer if session is not active', async () => {
    sessionData.status = 'VALIDATED';
    await expect(
      sessionService.recordAnswerReceipt({
        sessionId: 'sess_test_123',
        userId: 'user_abc',
        sequence: 1,
        questionToken: validToken,
        rawInput: '5',
        clientAnsweredAt: 2000,
        inputLatencyMs: 300,
        idempotencyKey: 'ans_1',
      })
    ).rejects.toThrow(/not active/i);
  });

  it('rejects an answer if userId does not match session owner', async () => {
    await expect(
      sessionService.recordAnswerReceipt({
        sessionId: 'sess_test_123',
        userId: 'wrong_user',
        sequence: 1,
        questionToken: validToken,
        rawInput: '5',
        clientAnsweredAt: 2000,
        inputLatencyMs: 300,
        idempotencyKey: 'ans_1',
      })
    ).rejects.toThrow(/not authorized/i);
  });

  it('evaluates correctness and returns receipt with next question without leaking answer keys', async () => {
    const res = await sessionService.recordAnswerReceipt({
      sessionId: 'sess_test_123',
      userId: 'user_abc',
      sequence: 1,
      questionToken: validToken,
      rawInput: '5',
      clientAnsweredAt: 2000,
      inputLatencyMs: 300,
      idempotencyKey: 'ans_1',
    });

    expect(res.status).toBe('ACCEPTED');
    expect(res.sequence).toBe(1);
    expect(res.isCorrect).toBe(true);
    expect(res.serverReceivedAt).toBeGreaterThan(0);
    expect(res).not.toHaveProperty('answerSpec');
    expect(res).not.toHaveProperty('serverSecret');
    expect(res).not.toHaveProperty('answerKey');
  });

  it('returns idempotent receipt on duplicate submission with same idempotencyKey', async () => {
    const first = await sessionService.recordAnswerReceipt({
      sessionId: 'sess_test_123',
      userId: 'user_abc',
      sequence: 1,
      questionToken: validToken,
      rawInput: '5',
      clientAnsweredAt: 2000,
      inputLatencyMs: 300,
      idempotencyKey: 'ans_1',
    });

    const second = await sessionService.recordAnswerReceipt({
      sessionId: 'sess_test_123',
      userId: 'user_abc',
      sequence: 1,
      questionToken: validToken,
      rawInput: '5',
      clientAnsweredAt: 2000,
      inputLatencyMs: 300,
      idempotencyKey: 'ans_1',
    });

    expect(second).toEqual(first);
  });

  it('rejects out-of-order sequence', async () => {
    await expect(
      sessionService.recordAnswerReceipt({
        sessionId: 'sess_test_123',
        userId: 'user_abc',
        sequence: 2,
        questionToken: validToken,
        rawInput: '5',
        clientAnsweredAt: 2000,
        inputLatencyMs: 300,
        idempotencyKey: 'ans_2',
      })
    ).rejects.toThrow(/Invalid sequence 2. Expected 1./i);
  });

  it('applies survival timer step on correct and wrong answers', async () => {
    sessionData.mode = 'survival';
    sessionData.survivalTimerMs = 30000;

    const resCorrect = await sessionService.recordAnswerReceipt({
      sessionId: 'sess_test_123',
      userId: 'user_abc',
      sequence: 1,
      questionToken: validToken,
      rawInput: '5',
      clientAnsweredAt: 2000,
      inputLatencyMs: 300,
      idempotencyKey: 'ans_1',
    });
    expect(resCorrect.isCorrect).toBe(true);
    expect(resCorrect.timeRemainingMs).toBe(32000);

    const token2 = generateQuestionToken('sess_test_123', 2, 'q2', 'secret_456');
    const resWrong = await sessionService.recordAnswerReceipt({
      sessionId: 'sess_test_123',
      userId: 'user_abc',
      sequence: 2,
      questionToken: token2,
      rawInput: '999',
      clientAnsweredAt: 3500,
      inputLatencyMs: 250,
      idempotencyKey: 'ans_2',
    });
    expect(resWrong.isCorrect).toBe(false);
    expect(resWrong.timeRemainingMs).toBe(28000);
  });
});
