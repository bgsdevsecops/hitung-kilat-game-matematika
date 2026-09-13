import { describe, it, expect } from 'vitest';
import {
  validateCompetitiveSession,
  ValidationInput,
} from '../../src/engine/competitive/validator';
import { Question } from '../../src/engine/types/question';
import { generateQuestionToken } from '../../src/engine/competitive/stateMachine';

describe('Authoritative Server Validator', () => {
  const secret = 'server-secret-xyz';

  const mockQuestions = new Map<number, Question>([
    [
      1,
      {
        id: 'q1',
        prompt: '2+2',
        displayExpression: '2+2',
        difficulty: 1,
        skillId: 'add',
        subSkillId: 'add.1',
        answerSpec: { kind: 'numeric', value: 4 },
      } as any,
    ],
    [
      2,
      {
        id: 'q2',
        prompt: '3+3',
        displayExpression: '3+3',
        difficulty: 1,
        skillId: 'add',
        subSkillId: 'add.1',
        answerSpec: { kind: 'numeric', value: 6 },
      } as any,
    ],
    [
      3,
      {
        id: 'q3',
        prompt: '5+5',
        displayExpression: '5+5',
        difficulty: 1,
        skillId: 'add',
        subSkillId: 'add.1',
        answerSpec: { kind: 'numeric', value: 10 },
      } as any,
    ],
  ]);

  it('validates a correct Sprint session and calculates canonical score ignoring client claims', () => {
    const input: ValidationInput = {
      session: {
        sessionId: 's1',
        userId: 'u1',
        mode: 'sprint',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000,
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_1',
      },
      serverQuestions: mockQuestions,
      submittedAnswers: [
        {
          sequence: 1,
          questionToken: generateQuestionToken('s1', 1, 'q1', secret),
          rawInput: '4',
          clientAnsweredAt: 2000,
          inputLatencyMs: 1000,
          idempotencyKey: 'a1',
        },
        {
          sequence: 2,
          questionToken: generateQuestionToken('s1', 2, 'q2', secret),
          rawInput: '6',
          clientAnsweredAt: 4000,
          inputLatencyMs: 2000,
          idempotencyKey: 'a2',
        },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 5000,
        receivedAnswerTimes: new Map([
          [1, 2050],
          [2, 4050],
        ]),
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('VALIDATED');
    expect(out.canonicalMetrics.correctCount).toBe(2);
    expect(out.canonicalMetrics.wrongCount).toBe(0);
    expect(out.canonicalMetrics.questionsAnswered).toBe(2);
    expect(out.canonicalMetrics.accuracy).toBe(100);
    expect(out.canonicalMetrics.score).toBe(210); // 100 (diff 1, streak 1) + 110 (diff 1, streak 2)
    expect(out.leaderboardEligible).toBe(true);
    expect(out.result.status).toBe('VALIDATED');
    expect(out.result.isRanked).toBe(true);
    expect(out.result.score).toBe(210);
  });

  it('rejects sessions with invalid tokens or out-of-order sequence', () => {
    const input: ValidationInput = {
      session: {
        sessionId: 's1',
        userId: 'u1',
        mode: 'sprint',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000,
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_1',
      },
      serverQuestions: mockQuestions,
      submittedAnswers: [
        {
          sequence: 2,
          questionToken: 'invalid_tok',
          rawInput: '6',
          clientAnsweredAt: 2000,
          inputLatencyMs: 1000,
          idempotencyKey: 'a2',
        },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 3000,
        receivedAnswerTimes: new Map([[2, 2050]]),
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('REJECTED');
    expect(out.leaderboardEligible).toBe(false);
    expect(out.rejectionReasons.length).toBeGreaterThanOrEqual(1);
    expect(out.result.status).toBe('REJECTED');
    expect(out.result.isRanked).toBe(false);
  });

  it('rejects sessions with non-contiguous sequence gaps', () => {
    const input: ValidationInput = {
      session: {
        sessionId: 's1',
        userId: 'u1',
        mode: 'sprint',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000,
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_1',
      },
      serverQuestions: mockQuestions,
      submittedAnswers: [
        {
          sequence: 1,
          questionToken: generateQuestionToken('s1', 1, 'q1', secret),
          rawInput: '4',
          clientAnsweredAt: 2000,
          inputLatencyMs: 1000,
          idempotencyKey: 'a1',
        },
        {
          sequence: 3, // gap: sequence 2 missing
          questionToken: generateQuestionToken('s1', 3, 'q3', secret),
          rawInput: '10',
          clientAnsweredAt: 4000,
          inputLatencyMs: 2000,
          idempotencyKey: 'a3',
        },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 5000,
        receivedAnswerTimes: new Map([
          [1, 2050],
          [3, 4050],
        ]),
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('REJECTED');
    expect(out.rejectionReasons.some((r) => r.includes('Sequence non-contiguous'))).toBe(true);
  });

  it('rejects answers received after server deadline plus grace window', () => {
    const input: ValidationInput = {
      session: {
        sessionId: 's1',
        userId: 'u1',
        mode: 'sprint',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000, // deadline 61000, grace 500ms -> 61500
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_1',
      },
      serverQuestions: mockQuestions,
      submittedAnswers: [
        {
          sequence: 1,
          questionToken: generateQuestionToken('s1', 1, 'q1', secret),
          rawInput: '4',
          clientAnsweredAt: 2000,
          inputLatencyMs: 1000,
          idempotencyKey: 'a1',
        },
        {
          sequence: 2,
          questionToken: generateQuestionToken('s1', 2, 'q2', secret),
          rawInput: '6',
          clientAnsweredAt: 61000,
          inputLatencyMs: 2000,
          idempotencyKey: 'a2',
        },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 62000,
        receivedAnswerTimes: new Map([
          [1, 2050],
          [2, 61501], // 1ms past grace window
        ]),
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('REJECTED');
    expect(out.rejectionReasons.some((r) => r.includes('after server deadline'))).toBe(true);
  });

  it('accepts answers received within the 500ms grace window', () => {
    const input: ValidationInput = {
      session: {
        sessionId: 's1',
        userId: 'u1',
        mode: 'sprint',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000, // deadline 61000, max allowed 61500
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_1',
      },
      serverQuestions: mockQuestions,
      submittedAnswers: [
        {
          sequence: 1,
          questionToken: generateQuestionToken('s1', 1, 'q1', secret),
          rawInput: '4',
          clientAnsweredAt: 2000,
          inputLatencyMs: 1000,
          idempotencyKey: 'a1',
        },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 61500,
        receivedAnswerTimes: new Map([[1, 61500]]), // exactly on grace cutoff
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('VALIDATED');
  });

  it('correctly validates Survival session with timer modifications and difficulty progression', () => {
    const questions = new Map<number, Question>([
      [1, { id: 'q1', answerSpec: { kind: 'integer', value: 1 } } as any],
      [2, { id: 'q2', answerSpec: { kind: 'integer', value: 2 } } as any],
      [3, { id: 'q3', answerSpec: { kind: 'integer', value: 3 } } as any],
    ]);

    const input: ValidationInput = {
      session: {
        sessionId: 'surv_1',
        userId: 'u1',
        mode: 'survival',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 0,
        serverDeadlineAt: 600000,
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_surv_1',
      },
      serverQuestions: questions,
      submittedAnswers: [
        {
          sequence: 1,
          questionToken: generateQuestionToken('surv_1', 1, 'q1', secret),
          rawInput: '1', // correct
          clientAnsweredAt: 2000,
          inputLatencyMs: 2000,
          idempotencyKey: 'a1',
        },
        {
          sequence: 2,
          questionToken: generateQuestionToken('surv_1', 2, 'q2', secret),
          rawInput: '999', // wrong -> streak resets
          clientAnsweredAt: 5000,
          inputLatencyMs: 3000,
          idempotencyKey: 'a2',
        },
        {
          sequence: 3,
          questionToken: generateQuestionToken('surv_1', 3, 'q3', secret),
          rawInput: '3', // correct -> streak becomes 1
          clientAnsweredAt: 8000,
          inputLatencyMs: 3000,
          idempotencyKey: 'a3',
        },
      ],
      serverTimestamps: {
        startedAt: 0,
        finalizedAt: 9000,
        receivedAnswerTimes: new Map([
          [1, 2050],
          [2, 5050],
          [3, 8050],
        ]),
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('VALIDATED');
    expect(out.canonicalMetrics.correctCount).toBe(2);
    expect(out.canonicalMetrics.wrongCount).toBe(1);
    expect(out.canonicalMetrics.questionsAnswered).toBe(3);
    expect(out.canonicalMetrics.maxStreak).toBe(1);
    // Score: Q1 (diff 1, streak 1 = 100) + Q2 (wrong = 0) + Q3 (diff 1, streak 1 = 100) = 200
    expect(out.canonicalMetrics.score).toBe(200);
    expect(out.result.rankedActiveDurationMs).toBe(9000);
  });

  it('validates Daily Challenge session with 10 questions and standardized bonuses', () => {
    const dailyQuestions = new Map<number, Question>();
    const answers = [];
    const receivedTimes = new Map<number, number>();

    for (let i = 1; i <= 10; i++) {
      dailyQuestions.set(i, {
        id: `dq_${i}`,
        answerSpec: { kind: 'integer', value: i * 2 },
      } as any);
      answers.push({
        sequence: i,
        questionToken: generateQuestionToken('daily_1', i, `dq_${i}`, secret),
        rawInput: `${i * 2}`, // all 10 correct!
        clientAnsweredAt: i * 3000,
        inputLatencyMs: 3000,
        idempotencyKey: `ans_${i}`,
      });
      receivedTimes.set(i, i * 3000 + 50);
    }

    const input: ValidationInput = {
      session: {
        sessionId: 'daily_1',
        userId: 'u_daily',
        mode: 'daily',
        challengeId: '2026-09-13@Asia/Jakarta:1.0',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 0,
        serverDeadlineAt: 90000,
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_daily_1',
      },
      serverQuestions: dailyQuestions,
      submittedAnswers: answers,
      serverTimestamps: {
        startedAt: 0,
        finalizedAt: 35000,
        receivedAnswerTimes: receivedTimes,
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('VALIDATED');
    expect(out.canonicalMetrics.correctCount).toBe(10);
    expect(out.canonicalMetrics.maxStreak).toBe(10);
    expect(out.canonicalMetrics.accuracy).toBe(100);
    // Question 10 was received at 30050ms
    expect(out.canonicalMetrics.rankedActiveDurationMs).toBe(30050);
    // Daily calculation:
    // base: 10 * 120 = 1200
    // streakBonus: min(300, 10 * 30) = 300
    // speedBonus: roundHalfUp(max(0, 75000 - 30050) * 800 * 10, 750000)
    //   speedNum = 44950 * 8000 = 359,600,000
    //   roundHalfUp(359600000, 750000) = floor((719200000 + 750000) / 1500000) = floor(719950000 / 1500000) = 479
    // perfectBonus: 200
    // total: 1200 + 300 + 479 + 200 = 2179
    expect(out.canonicalMetrics.score).toBe(2179);
    expect(out.result.score).toBe(2179);
    expect(out.result.challengeId).toBe('2026-09-13@Asia/Jakarta:1.0');
  });

  it('clamps duration to 90000ms if daily challenge ends prematurely with < 10 questions', () => {
    const dailyQuestions = new Map<number, Question>([
      [1, { id: 'dq1', answerSpec: { kind: 'integer', value: 2 } } as any],
      [2, { id: 'dq2', answerSpec: { kind: 'integer', value: 4 } } as any],
    ]);

    const input: ValidationInput = {
      session: {
        sessionId: 'daily_short',
        userId: 'u_daily',
        mode: 'daily',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 0,
        serverDeadlineAt: 90000,
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_daily_short',
      },
      serverQuestions: dailyQuestions,
      submittedAnswers: [
        {
          sequence: 1,
          questionToken: generateQuestionToken('daily_short', 1, 'dq1', secret),
          rawInput: '2',
          clientAnsweredAt: 2000,
          inputLatencyMs: 2000,
          idempotencyKey: 'ans_1',
        },
      ],
      serverTimestamps: {
        startedAt: 0,
        finalizedAt: 25000,
        receivedAnswerTimes: new Map([[1, 2050]]),
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('VALIDATED');
    expect(out.canonicalMetrics.rankedActiveDurationMs).toBe(90000);
    // base = 1 * 120 = 120
    // streakBonus = 1 * 30 = 30
    // speedBonus = 0 (dur 90000 >= 75000)
    // perfectBonus = 0
    expect(out.canonicalMetrics.score).toBe(150);
  });

  it('correctly marks unranked session as not leaderboardEligible even when valid', () => {
    const input: ValidationInput = {
      session: {
        sessionId: 'unranked_s1',
        userId: 'u1',
        mode: 'sprint',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000,
        status: 'PENDING',
        isRanked: false, // unranked replay
        idempotencyKey: 'fin_unranked',
      },
      serverQuestions: mockQuestions,
      submittedAnswers: [
        {
          sequence: 1,
          questionToken: generateQuestionToken('unranked_s1', 1, 'q1', secret),
          rawInput: '4',
          clientAnsweredAt: 2000,
          inputLatencyMs: 1000,
          idempotencyKey: 'a1',
        },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 3000,
        receivedAnswerTimes: new Map([[1, 2050]]),
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('VALIDATED');
    expect(out.leaderboardEligible).toBe(false);
    expect(out.result.isRanked).toBe(false);
  });

  it('rejects answers when sequence does not exist in serverQuestions', () => {
    const input: ValidationInput = {
      session: {
        sessionId: 's_missing_q',
        userId: 'u1',
        mode: 'sprint',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000,
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_miss',
      },
      serverQuestions: new Map(), // empty map
      submittedAnswers: [
        {
          sequence: 1,
          questionToken: 'tok_1',
          rawInput: '4',
          clientAnsweredAt: 2000,
          inputLatencyMs: 1000,
          idempotencyKey: 'a1',
        },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 3000,
        receivedAnswerTimes: new Map([[1, 2050]]),
      },
    };

    const out = validateCompetitiveSession(input, secret);
    expect(out.status).toBe('REJECTED');
    expect(out.rejectionReasons.some((r) => r.includes('Unknown question sequence 1'))).toBe(true);
  });

  it('validates questions using questionInstanceId and verifies barrel export', async () => {
    const competitiveModule = await import('../../src/engine/competitive');
    expect(typeof competitiveModule.validateCompetitiveSession).toBe('function');

    const standardQuestion: Question = {
      questionInstanceId: 'inst_q99',
      questionDefinitionId: 'def_q99',
      displayPrompt: '4 * 5 = ?',
      answerSpec: { kind: 'integer', value: 20 },
      primarySkillId: 'mul',
      skillTags: ['mul'],
      difficulty: 1,
      generatorKey: 'mul_basic',
      targetResponseTimeMs: 2000,
      templateFamily: 'mul',
      explanation: 'Multiplication',
    };

    const input: ValidationInput = {
      session: {
        sessionId: 's_inst',
        userId: 'u1',
        mode: 'sprint',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000,
        status: 'PENDING',
        isRanked: true,
        idempotencyKey: 'fin_inst',
      },
      serverQuestions: new Map([[1, standardQuestion]]),
      submittedAnswers: [
        {
          sequence: 1,
          questionToken: generateQuestionToken('s_inst', 1, 'inst_q99', secret),
          rawInput: '20',
          clientAnsweredAt: 2000,
          inputLatencyMs: 1000,
          idempotencyKey: 'a1',
        },
      ],
      serverTimestamps: {
        startedAt: 1000,
        finalizedAt: 3000,
        receivedAnswerTimes: new Map([[1, 2050]]),
      },
    };

    const out = competitiveModule.validateCompetitiveSession(input, secret);
    expect(out.status).toBe('VALIDATED');
    expect(out.canonicalMetrics.score).toBe(100);
    expect(out.canonicalMetrics.correctCount).toBe(1);
  });
});
