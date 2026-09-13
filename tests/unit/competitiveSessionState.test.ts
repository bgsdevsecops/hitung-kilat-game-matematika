// tests/unit/competitiveSessionState.test.ts
import { describe, it, expect } from 'vitest';
import {
  createCompetitiveSession,
  advanceSessionBuffer,
  generateQuestionToken,
  verifyQuestionToken,
} from '../../src/engine/competitive/stateMachine';
import { Question } from '../../src/engine/types/question';

describe('Competitive Session State Machine & Buffer', () => {
  const secret = 'test-secret-key-12345';

  const mockQuestions: Question[] = Array.from({ length: 15 }, (_, i) => ({
    id: `q_${i + 1}`,
    questionInstanceId: `q_${i + 1}`,
    questionDefinitionId: `def_${i + 1}`,
    templateFamily: 'addition_basic',
    prompt: `${i + 1} + 1 = ?`,
    displayPrompt: `${i + 1} + 1 = ?`,
    displayExpression: `${i + 1} + 1`,
    difficulty: 1 as const,
    skillId: 'addition',
    primarySkillId: 'addition',
    skillTags: ['addition'],
    generatorKey: 'addition_basic',
    targetResponseTimeMs: 3000,
    explanation: 'Basic addition',
    subSkillId: 'addition.single_digit',
    answerSpec: { kind: 'numeric', value: i + 2 } as any,
  }));

  it('creates an active session with an initial 5-question pre-buffered window', () => {
    const session = createCompetitiveSession({
      sessionId: 'sess_1',
      userId: 'user_1',
      mode: 'sprint',
      rulesVersion: '1.0',
      contentVersion: '1.0',
      serverStartedAt: 1000,
      initialQuestions: mockQuestions.slice(0, 5),
      secret,
    });

    expect(session.contract.status).toBe('ACTIVE');
    expect(session.bufferedViews.length).toBe(5);
    expect(session.bufferedViews[0].sequence).toBe(1);
    expect(session.bufferedViews[0].questionInstanceId).toBe('q_1');
    // Ensure no secret leakage
    expect((session.bufferedViews[0] as any).answerSpec).toBeUndefined();
    expect((session.bufferedViews[0] as any).value).toBeUndefined();
    expect(verifyQuestionToken(session.bufferedViews[0], 'sess_1', secret)).toBe(true);
  });

  it('replenishes buffer as answers are acknowledged, keeping 3-5 items ahead', () => {
    const session = createCompetitiveSession({
      sessionId: 'sess_1',
      userId: 'user_1',
      mode: 'sprint',
      rulesVersion: '1.0',
      contentVersion: '1.0',
      serverStartedAt: 1000,
      initialQuestions: mockQuestions.slice(0, 5),
      secret,
    });

    // Acknowledge sequence 1 and 2, refill with questions 6 and 7
    const updated = advanceSessionBuffer(
      session,
      [1, 2],
      mockQuestions.slice(5, 7),
      secret
    );

    expect(updated.bufferedViews.map((v) => v.sequence)).toEqual([3, 4, 5, 6, 7]);
    expect(updated.acknowledgedSequences.has(1)).toBe(true);
    expect(updated.acknowledgedSequences.has(2)).toBe(true);
  });

  it('correctly sets serverDeadlineAt based on competitive mode', () => {
    const sprintSession = createCompetitiveSession({
      sessionId: 'sprint_1',
      userId: 'user_1',
      mode: 'sprint',
      rulesVersion: '1.0',
      contentVersion: '1.0',
      serverStartedAt: 10000,
      initialQuestions: mockQuestions.slice(0, 5),
      secret,
    });
    expect(sprintSession.contract.serverDeadlineAt).toBe(10000 + 60000);

    const dailySession = createCompetitiveSession({
      sessionId: 'daily_1',
      userId: 'user_1',
      mode: 'daily',
      rulesVersion: '1.0',
      contentVersion: '1.0',
      challengeId: 'daily_2026_09_13',
      serverStartedAt: 20000,
      initialQuestions: mockQuestions.slice(0, 5),
      secret,
    });
    expect(dailySession.contract.serverDeadlineAt).toBe(20000 + 90000);
    expect(dailySession.contract.challengeId).toBe('daily_2026_09_13');

    const survivalSession = createCompetitiveSession({
      sessionId: 'survival_1',
      userId: 'user_1',
      mode: 'survival',
      rulesVersion: '1.0',
      contentVersion: '1.0',
      serverStartedAt: 5000,
      initialQuestions: mockQuestions.slice(0, 5),
      secret,
      isRanked: false,
    });
    expect(survivalSession.contract.serverDeadlineAt).toBe(5000 + 600000);
    expect(survivalSession.contract.isRanked).toBe(false);
  });

  it('generates deterministic question tokens and verifies tampering resistance', () => {
    const token = generateQuestionToken('sess_abc', 3, 'q_target', secret);
    expect(typeof token).toBe('string');
    expect(token).toMatch(/^tok_[0-9a-f]+_3$/);

    // Exact match verification via view
    const view = {
      questionInstanceId: 'q_target',
      sequence: 3,
      renderedPrompt: '3 + 1 = ?',
      answerInputKind: 'numeric' as const,
      questionToken: token,
    };
    expect(verifyQuestionToken(view, 'sess_abc', secret)).toBe(true);

    // Tampered sessionId
    expect(verifyQuestionToken(view, 'tampered_sess', secret)).toBe(false);

    // Tampered secret
    expect(verifyQuestionToken(view, 'sess_abc', 'wrong-secret')).toBe(false);

    // Tampered sequence inside view
    expect(verifyQuestionToken({ ...view, sequence: 4 }, 'sess_abc', secret)).toBe(false);

    // Tampered questionInstanceId inside view
    expect(verifyQuestionToken({ ...view, questionInstanceId: 'q_other' }, 'sess_abc', secret)).toBe(false);

    // Also support string overload verifyQuestionToken(token, sessionId, sequence, instanceId, secret)
    expect(verifyQuestionToken(token, 'sess_abc', 3, 'q_target', secret)).toBe(true);
    expect(verifyQuestionToken(token, 'sess_abc', 4, 'q_target', secret)).toBe(false);
  });

  it('preserves full questions in serverQuestions map while providing sanitized views to client', () => {
    const session = createCompetitiveSession({
      sessionId: 'sess_sec',
      userId: 'user_sec',
      mode: 'sprint',
      rulesVersion: '1.0',
      contentVersion: '1.0',
      serverStartedAt: 1000,
      initialQuestions: mockQuestions.slice(0, 5),
      secret,
    });

    // Server-side map retains full questions
    expect(session.serverQuestions.size).toBe(5);
    expect(session.serverQuestions.get(1)?.answerSpec).toEqual({ kind: 'numeric', value: 2 });
    expect(session.serverQuestions.get(5)?.answerSpec).toEqual({ kind: 'numeric', value: 6 });

    // Client views are fully sanitized
    for (const view of session.bufferedViews) {
      expect((view as any).answerSpec).toBeUndefined();
      expect((view as any).generatorKey).toBeUndefined();
      expect((view as any).explanation).toBeUndefined();
      expect(view.renderedPrompt).toBeDefined();
      expect(view.questionToken).toBeDefined();
    }
  });

  it('correctly maps various answer kinds (rational -> fraction, decimal -> decimal, integer -> numeric)', () => {
    const diverseQuestions: Question[] = [
      {
        id: 'q_frac',
        prompt: '1/2 + 1/4 = ?',
        answerSpec: { kind: 'rational', numerator: 3, denominator: 4 } as any,
      } as any,
      {
        id: 'q_dec',
        prompt: '0.5 + 0.25 = ?',
        answerSpec: { kind: 'decimal', scaledValue: 75, scale: 2, constraints: { precision: 2 } } as any,
      } as any,
      {
        id: 'q_int',
        prompt: '10 - 3 = ?',
        answerSpec: { kind: 'integer', value: 7, constraints: { min: 0, max: 100 } } as any,
      } as any,
    ];

    const session = createCompetitiveSession({
      sessionId: 'sess_div',
      userId: 'u1',
      mode: 'sprint',
      rulesVersion: '1.0',
      contentVersion: '1.0',
      serverStartedAt: 1000,
      initialQuestions: diverseQuestions,
      secret,
    });

    expect(session.bufferedViews[0].answerInputKind).toBe('fraction');
    expect(session.bufferedViews[1].answerInputKind).toBe('decimal');
    expect(session.bufferedViews[1].constraints).toEqual({ precision: 2 });
    expect(session.bufferedViews[2].answerInputKind).toBe('numeric');
    expect(session.bufferedViews[2].constraints).toEqual({ min: 0, max: 100 });
  });

  it('maintains continuous sequence numbers across multiple sequential advanceSessionBuffer calls', () => {
    let session = createCompetitiveSession({
      sessionId: 'sess_cont',
      userId: 'user_cont',
      mode: 'sprint',
      rulesVersion: '1.0',
      contentVersion: '1.0',
      serverStartedAt: 1000,
      initialQuestions: mockQuestions.slice(0, 5),
      secret,
    });

    expect(session.bufferedViews.map((v) => v.sequence)).toEqual([1, 2, 3, 4, 5]);

    // Advance 1: ack 1, 2; add 6, 7
    session = advanceSessionBuffer(session, [1, 2], mockQuestions.slice(5, 7), secret);
    expect(session.bufferedViews.map((v) => v.sequence)).toEqual([3, 4, 5, 6, 7]);
    expect(session.serverQuestions.size).toBe(7);

    // Advance 2: ack 3, 4, 5; add 8, 9, 10
    session = advanceSessionBuffer(session, [3, 4, 5], mockQuestions.slice(7, 10), secret);
    expect(session.bufferedViews.map((v) => v.sequence)).toEqual([6, 7, 8, 9, 10]);
    expect(session.serverQuestions.size).toBe(10);

    // Advance 3: ack 6, 7, 8, 9, 10; add 11
    session = advanceSessionBuffer(session, [6, 7, 8, 9, 10], mockQuestions.slice(10, 11), secret);
    expect(session.bufferedViews.map((v) => v.sequence)).toEqual([11]);
    expect(session.serverQuestions.size).toBe(11);
  });
});
