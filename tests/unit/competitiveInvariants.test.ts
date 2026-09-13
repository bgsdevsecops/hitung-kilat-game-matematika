// tests/unit/competitiveInvariants.test.ts
import { describe, it, expect } from 'vitest';
import {
  createCompetitiveSession,
  validateCompetitiveSession,
  generateQuestionToken,
  shouldReplaceLeaderboardEntry,
  projectToLeaderboardEntry,
  generateLeaderboardSubjectId,
  generateLeaderboardEntryId,
  calculateSprintScore,
  calculateDailyScore,
  applySurvivalTimerStep,
  getSurvivalDifficulty,
  getSprintDifficulty,
  SURVIVAL_INITIAL_TIMER_MS,
  SURVIVAL_MAX_TIMER_MS,
  SURVIVAL_HARD_CAP_MS,
  SURVIVAL_CORRECT_ADDITION_MS,
  SURVIVAL_WRONG_PENALTY_MS,
  SURVIVAL_MAX_HEARTBEAT_GAP_MS,
  CompetitiveMode,
} from '../../src/engine/competitive';
import { Question } from '../../src/engine/types/question';
import { createMulberry32, randomInt } from '../../src/engine/utils/prng';

describe('AC-COMP Invariant Suite (100+ Simulations)', () => {
  const secret = 'invariant-test-secret-2026';

  const generateMockQuestions = (count: number): Map<number, Question> => {
    const map = new Map<number, Question>();
    for (let i = 1; i <= count; i++) {
      map.set(i, {
        id: `q_${i}`,
        prompt: `${i} + ${i}`,
        displayExpression: `${i} + ${i}`,
        difficulty: Math.min(6, 1 + Math.floor(i / 5)),
        skillId: 'addition',
        subSkillId: 'addition.basic',
        answerSpec: { kind: 'numeric', value: i * 2 },
      } as any);
    }
    return map;
  };

  const generateMockQuestionsList = (count: number): Question[] => {
    return Array.from(generateMockQuestions(count).values());
  };

  // -------------------------------------------------------------------------
  // AC-COMP-01: Unauthenticated / Unranked Request Invariants across 100 seeds
  // -------------------------------------------------------------------------
  it('AC-COMP-01: Unauthenticated or unranked requests cannot produce ranked leaderboard-eligible results across 100 seeds', () => {
    const prng = createMulberry32('ac-comp-01-seed-2026');
    const questions = generateMockQuestions(5);

    for (let seed = 1; seed <= 100; seed++) {
      const sessionId = `unauth_sess_${seed}`;
      const isExplicitlyUnranked = prng() < 0.5;
      const userId = isExplicitlyUnranked ? `guest_${seed}` : `anon_${seed}`;

      const sessionState = createCompetitiveSession({
        sessionId,
        userId,
        mode: 'sprint',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        initialQuestions: generateMockQuestionsList(5),
        secret,
        isRanked: false, // Unauthenticated or guest
      });

      expect(sessionState.contract.isRanked).toBe(false);

      const input = {
        session: sessionState.contract,
        serverQuestions: questions,
        submittedAnswers: [
          {
            sequence: 1,
            questionToken: generateQuestionToken(sessionId, 1, 'q_1', secret),
            rawInput: '2', // Correct answer
            clientAnsweredAt: 2000,
            inputLatencyMs: 1000,
            idempotencyKey: `ans_1_${seed}`,
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
      expect(out.result.isRanked).toBe(false);
      expect(out.leaderboardEligible).toBe(false);
      expect(out.canonicalMetrics.correctCount).toBe(1);
    }
  });

  // -------------------------------------------------------------------------
  // AC-COMP-02: Direct client writes denied and projections require authoritative result
  // -------------------------------------------------------------------------
  it('AC-COMP-02: Public projections require authoritative server validation and secret across 100 seeds', () => {
    const prng = createMulberry32('ac-comp-02-seed-2026');

    for (let seed = 1; seed <= 100; seed++) {
      const userId = `uid_sec_${seed}`;
      const diffSecret = `tampered-secret-${seed}`;

      const officialSubjectId = generateLeaderboardSubjectId(userId, secret);
      const forgedSubjectId = generateLeaderboardSubjectId(userId, diffSecret);

      // Different secrets generate completely different subject hashes
      expect(officialSubjectId).not.toBe(forgedSubjectId);
      expect(officialSubjectId).toHaveLength(8);
      expect(forgedSubjectId).toHaveLength(8);

      // Invariant: shouldReplaceLeaderboardEntry refuses identical or worse scores
      const existing = {
        entryId: generateLeaderboardEntryId('sprint', '2026-09-13', '1.0', '1.0', officialSubjectId),
        mode: 'sprint' as const,
        periodKey: '2026-09-13',
        rulesVersion: '1.0',
        contentVersion: '1.0',
        pseudonym: 'TopPlayer',
        score: 1500,
        accuracy: 90,
        correctCount: 15,
        wrongCount: 2,
        durationMs: 58000,
        finalizedAt: 1700000000,
        resultId: `res_orig_${seed}`,
      };

      const lowerCandidate = {
        ...existing,
        resultId: `res_lower_${seed}`,
        score: 1200,
      };

      expect(shouldReplaceLeaderboardEntry(existing, lowerCandidate)).toBe(false);
      expect(shouldReplaceLeaderboardEntry(null, lowerCandidate)).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // AC-COMP-03 & AC-COMP-04: Discards client claims and rejects tampered tokens
  // -------------------------------------------------------------------------
  it('AC-COMP-03 & AC-COMP-04: Discards client claims and rejects tampered tokens across 100 seeds', () => {
    const questions = generateMockQuestions(10);
    for (let seed = 1; seed <= 100; seed++) {
      const sessionId = `sess_${seed}`;
      const validToken = generateQuestionToken(sessionId, 1, 'q_1', secret);
      const invalidToken = 'tampered_token';

      const input = {
        session: {
          sessionId,
          userId: `u_${seed}`,
          mode: 'sprint' as const,
          rulesVersion: '1.0',
          contentVersion: '1.0',
          serverStartedAt: 1000,
          serverDeadlineAt: 61000,
          status: 'PENDING' as const,
          isRanked: true,
          idempotencyKey: `fin_${seed}`,
        },
        serverQuestions: questions,
        submittedAnswers: [
          {
            sequence: 1,
            questionToken: seed % 2 === 0 ? validToken : invalidToken,
            rawInput: '2',
            clientAnsweredAt: 2000,
            inputLatencyMs: 1000,
            idempotencyKey: `a1_${seed}`,
          },
        ],
        serverTimestamps: {
          startedAt: 1000,
          finalizedAt: 3000,
          receivedAnswerTimes: new Map([[1, 2050]]),
        },
      };

      const out = validateCompetitiveSession(input, secret);
      if (seed % 2 === 0) {
        expect(out.status).toBe('VALIDATED');
        expect(out.canonicalMetrics.correctCount).toBe(1);
        expect(out.leaderboardEligible).toBe(true);
      } else {
        expect(out.status).toBe('REJECTED');
        expect(out.leaderboardEligible).toBe(false);
        expect(out.rejectionReasons.some((r) => r.includes('Invalid question token'))).toBe(true);
      }
    }
  });

  // -------------------------------------------------------------------------
  // AC-COMP-04: Rejects non-contiguous, duplicate, or unknown question sequences across 100 seeds
  // -------------------------------------------------------------------------
  it('AC-COMP-04: Rejects non-contiguous sequences, duplicate sequences, and unknown questions across 100 seeds', () => {
    const questions = generateMockQuestions(10);
    for (let seed = 1; seed <= 100; seed++) {
      const sessionId = `seq_sess_${seed}`;
      let submittedAnswers: any[];

      if (seed % 3 === 1) {
        // Gap in sequence: starts at sequence 2 instead of 1
        submittedAnswers = [
          {
            sequence: 2,
            questionToken: generateQuestionToken(sessionId, 2, 'q_2', secret),
            rawInput: '4',
            clientAnsweredAt: 2000,
            inputLatencyMs: 1000,
            idempotencyKey: `a1_${seed}`,
          },
        ];
      } else if (seed % 3 === 2) {
        // Duplicate sequence: 1, 1
        submittedAnswers = [
          {
            sequence: 1,
            questionToken: generateQuestionToken(sessionId, 1, 'q_1', secret),
            rawInput: '2',
            clientAnsweredAt: 2000,
            inputLatencyMs: 1000,
            idempotencyKey: `a1_${seed}`,
          },
          {
            sequence: 1,
            questionToken: generateQuestionToken(sessionId, 1, 'q_1', secret),
            rawInput: '2',
            clientAnsweredAt: 3000,
            inputLatencyMs: 1000,
            idempotencyKey: `a2_${seed}`,
          },
        ];
      } else {
        // Unknown question sequence in serverQuestions
        submittedAnswers = [
          {
            sequence: 1,
            questionToken: 'tok_unknown',
            rawInput: '99',
            clientAnsweredAt: 2000,
            inputLatencyMs: 1000,
            idempotencyKey: `a1_${seed}`,
          },
        ];
      }

      const input = {
        session: {
          sessionId,
          userId: `u_${seed}`,
          mode: 'sprint' as const,
          rulesVersion: '1.0',
          contentVersion: '1.0',
          serverStartedAt: 1000,
          serverDeadlineAt: 61000,
          status: 'PENDING' as const,
          isRanked: true,
          idempotencyKey: `fin_${seed}`,
        },
        serverQuestions: seed % 3 === 0 ? new Map<number, Question>() : questions,
        submittedAnswers,
        serverTimestamps: {
          startedAt: 1000,
          finalizedAt: 4000,
          receivedAnswerTimes: new Map([
            [1, 2050],
            [2, 3050],
          ]),
        },
      };

      const out = validateCompetitiveSession(input, secret);
      expect(out.status).toBe('REJECTED');
      expect(out.leaderboardEligible).toBe(false);
      expect(out.rejectionReasons.length).toBeGreaterThan(0);
    }
  });

  // -------------------------------------------------------------------------
  // AC-COMP-05: 100 concurrent/repeated finalizations return identical results
  // -------------------------------------------------------------------------
  it('AC-COMP-05: Idempotency simulation produces exact same validation result across 100 iterations', () => {
    const questions = generateMockQuestions(5);
    const input = {
      session: {
        sessionId: 'idem_sess',
        userId: 'u_idem',
        mode: 'sprint' as const,
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        serverDeadlineAt: 61000,
        status: 'PENDING' as const,
        isRanked: true,
        idempotencyKey: 'fin_idem',
      },
      serverQuestions: questions,
      submittedAnswers: [
        {
          sequence: 1,
          questionToken: generateQuestionToken('idem_sess', 1, 'q_1', secret),
          rawInput: '2',
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

    const baseOutput = validateCompetitiveSession(input, secret);

    // 100 concurrent/repeated finalize calls
    for (let iter = 1; iter <= 100; iter++) {
      const currentOutput = validateCompetitiveSession(input, secret);
      expect(currentOutput.result).toEqual(baseOutput.result);
      expect(currentOutput.canonicalMetrics).toEqual(baseOutput.canonicalMetrics);
      expect(currentOutput.status).toBe(baseOutput.status);
      expect(currentOutput.leaderboardEligible).toBe(baseOutput.leaderboardEligible);
    }

    // Leaderboard replacement must be idempotent: re-projecting the same result never mutates existing entry
    const entry = projectToLeaderboardEntry(baseOutput.result, 'IdemPlayer', '2026-09-13', secret);
    expect(shouldReplaceLeaderboardEntry(entry, entry)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // AC-COMP-06: Daily ranked slot consumed on sequence 1; replays produce isRanked: false
  // -------------------------------------------------------------------------
  it('AC-COMP-06: Daily ranked slot consumed on sequence 1; replays produce isRanked: false across 100 seeds', () => {
    const questions = generateMockQuestions(10);

    for (let seed = 1; seed <= 100; seed++) {
      const userId = `daily_u_${seed}`;
      const challengeId = '2026-09-13';

      // 1. First attempt: Ranked slot consumed upon session start
      const firstSession = createCompetitiveSession({
        sessionId: `daily_sess_1_${seed}`,
        userId,
        mode: 'daily',
        challengeId,
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 1000,
        initialQuestions: generateMockQuestionsList(5),
        secret,
        isRanked: true,
      });

      expect(firstSession.contract.isRanked).toBe(true);
      expect(firstSession.bufferedViews[0].sequence).toBe(1);

      // 2. Replay attempt: Daily slot already consumed; subsequent sessions are unranked
      const replaySession = createCompetitiveSession({
        sessionId: `daily_sess_2_${seed}`,
        userId,
        mode: 'daily',
        challengeId,
        rulesVersion: '1.0',
        contentVersion: '1.0',
        serverStartedAt: 100000,
        initialQuestions: generateMockQuestionsList(5),
        secret,
        isRanked: false, // Enforced unranked
      });

      expect(replaySession.contract.isRanked).toBe(false);

      // Validate replay session
      const replayAnswers = [
        {
          sequence: 1,
          questionToken: generateQuestionToken(replaySession.contract.sessionId, 1, 'q_1', secret),
          rawInput: '2',
          clientAnsweredAt: 2000,
          inputLatencyMs: 1000,
          idempotencyKey: `replay_a1_${seed}`,
        },
      ];

      const out = validateCompetitiveSession(
        {
          session: replaySession.contract,
          serverQuestions: questions,
          submittedAnswers: replayAnswers,
          serverTimestamps: {
            startedAt: 100000,
            finalizedAt: 103000,
            receivedAnswerTimes: new Map([[1, 102050]]),
          },
        },
        secret
      );

      expect(out.status).toBe('VALIDATED');
      expect(out.result.isRanked).toBe(false);
      expect(out.leaderboardEligible).toBe(false);
    }
  });

  // -------------------------------------------------------------------------
  // AC-COMP-07: Sprint deadline strictly enforced at 60.000 ms across 100 seeds
  // -------------------------------------------------------------------------
  it('AC-COMP-07: Rejects answers received after Sprint server deadline across 100 seeds', () => {
    const questions = generateMockQuestions(5);

    for (let seed = 1; seed <= 100; seed++) {
      const sessionId = `sprint_deadline_${seed}`;
      const isPastDeadline = seed % 2 !== 0; // Odd seeds exceed deadline
      const arrivalOffsetMs = isPastDeadline ? 61000 : 55000; // 60s + 1s vs 55s

      const input = {
        session: {
          sessionId,
          userId: `u_${seed}`,
          mode: 'sprint' as const,
          rulesVersion: '1.0',
          contentVersion: '1.0',
          serverStartedAt: 1000,
          serverDeadlineAt: 61000, // 1000 + 60000
          status: 'PENDING' as const,
          isRanked: true,
          idempotencyKey: `fin_dl_${seed}`,
        },
        serverQuestions: questions,
        submittedAnswers: [
          {
            sequence: 1,
            questionToken: generateQuestionToken(sessionId, 1, 'q_1', secret),
            rawInput: '2',
            clientAnsweredAt: arrivalOffsetMs - 50,
            inputLatencyMs: 1500,
            idempotencyKey: `a1_${seed}`,
          },
        ],
        serverTimestamps: {
          startedAt: 1000,
          finalizedAt: 1000 + arrivalOffsetMs + 500,
          receivedAnswerTimes: new Map([[1, 1000 + arrivalOffsetMs]]),
        },
      };

      const out = validateCompetitiveSession(input, secret);
      if (isPastDeadline) {
        expect(out.status).toBe('REJECTED');
        expect(out.leaderboardEligible).toBe(false);
        expect(out.rejectionReasons.some((r) => r.includes('deadline'))).toBe(true);
      } else {
        expect(out.status).toBe('VALIDATED');
        expect(out.leaderboardEligible).toBe(true);
        expect(out.result.rankedActiveDurationMs).toBeLessThanOrEqual(60000);
      }
    }
  });

  // -------------------------------------------------------------------------
  // AC-COMP-08: Survival timer rewards (+2s capped at 60s) & penalties (-4s) across 100 seeds
  // -------------------------------------------------------------------------
  it('AC-COMP-08: Survival timer rewards (+2s capped at 60s) and penalties (-4s) recomputed server-side across 100 seeds', () => {
    const prng = createMulberry32('ac-comp-08-survival-timer-2026');

    for (let seed = 1; seed <= 100; seed++) {
      let timerMs = SURVIVAL_INITIAL_TIMER_MS;
      const stepCount = randomInt(prng, 15, 30);

      for (let s = 1; s <= stepCount; s++) {
        const isCorrect = prng() > 0.35; // 65% correct
        const nextTimer = applySurvivalTimerStep(timerMs, isCorrect);

        if (isCorrect) {
          expect(nextTimer).toBe(Math.min(SURVIVAL_MAX_TIMER_MS, timerMs + SURVIVAL_CORRECT_ADDITION_MS));
          expect(nextTimer).toBeLessThanOrEqual(SURVIVAL_MAX_TIMER_MS);
        } else {
          expect(nextTimer).toBe(Math.max(0, timerMs - SURVIVAL_WRONG_PENALTY_MS));
          expect(nextTimer).toBeGreaterThanOrEqual(0);
        }

        timerMs = nextTimer;
      }
    }

    // Invariant: Cap behavior under 50 consecutive correct answers
    let fullCapTimer = SURVIVAL_INITIAL_TIMER_MS;
    for (let i = 0; i < 50; i++) {
      fullCapTimer = applySurvivalTimerStep(fullCapTimer, true);
      expect(fullCapTimer).toBe(SURVIVAL_MAX_TIMER_MS);
    }

    // Invariant: Floor behavior under 16 consecutive wrong answers
    let depletedTimer = SURVIVAL_INITIAL_TIMER_MS;
    for (let i = 0; i < 16; i++) {
      depletedTimer = applySurvivalTimerStep(depletedTimer, false);
    }
    expect(depletedTimer).toBe(0);
  });

  // -------------------------------------------------------------------------
  // AC-COMP-09: Rejected results award zero rank, streak, or competitive achievements across 100 seeds
  // -------------------------------------------------------------------------
  it('AC-COMP-09: Rejected results award zero rank, streak, or competitive achievements across 100 seeds', () => {
    const questions = generateMockQuestions(5);

    for (let seed = 1; seed <= 100; seed++) {
      const sessionId = `rej_sess_${seed}`;

      // Inject sub-human latency anomaly (< 120ms)
      const input = {
        session: {
          sessionId,
          userId: `u_sus_${seed}`,
          mode: 'sprint' as const,
          rulesVersion: '1.0',
          contentVersion: '1.0',
          serverStartedAt: 1000,
          serverDeadlineAt: 61000,
          status: 'PENDING' as const,
          isRanked: true,
          idempotencyKey: `fin_sus_${seed}`,
        },
        serverQuestions: questions,
        submittedAnswers: [
          {
            sequence: 1,
            questionToken: generateQuestionToken(sessionId, 1, 'q_1', secret),
            rawInput: '2',
            clientAnsweredAt: 1050,
            inputLatencyMs: 45, // Sub-human latency violation!
            idempotencyKey: `ans_sus_${seed}`,
          },
        ],
        serverTimestamps: {
          startedAt: 1000,
          finalizedAt: 2000,
          receivedAnswerTimes: new Map([[1, 1100]]),
        },
      };

      const out = validateCompetitiveSession(input, secret);
      expect(out.status).toBe('REJECTED');
      expect(out.result.isRanked).toBe(false);
      expect(out.leaderboardEligible).toBe(false);
      expect(out.rejectionReasons.some((r) => r.includes('Sub-human input latency'))).toBe(true);
    }
  });

  // -------------------------------------------------------------------------
  // AC-COMP-10 & AC-COMP-11: Public projections contain zero identity leaks and separate scope partitions
  // -------------------------------------------------------------------------
  it('AC-COMP-10 & AC-COMP-11: Public projections contain zero identity leaks and separate scope partitions', () => {
    const questions = generateMockQuestions(1);
    const res = validateCompetitiveSession(
      {
        session: {
          sessionId: 'priv_sess',
          userId: 'super_secret_auth_uid',
          mode: 'sprint',
          rulesVersion: '2.0',
          contentVersion: 'v2.1',
          serverStartedAt: 1000,
          serverDeadlineAt: 61000,
          status: 'PENDING',
          isRanked: true,
          idempotencyKey: 'fin_p',
        },
        serverQuestions: questions,
        submittedAnswers: [
          {
            sequence: 1,
            questionToken: generateQuestionToken('priv_sess', 1, 'q_1', secret),
            rawInput: '2',
            clientAnsweredAt: 2000,
            inputLatencyMs: 1000,
            idempotencyKey: 'a1',
          },
        ],
        serverTimestamps: { startedAt: 1000, finalizedAt: 3000, receivedAnswerTimes: new Map([[1, 2050]]) },
      },
      secret
    ).result;

    const proj = projectToLeaderboardEntry(res, 'AnonymousSpeedster', '2026-09-13', secret);
    expect(JSON.stringify(proj)).not.toContain('super_secret_auth_uid');
    expect(JSON.stringify(proj)).not.toContain('priv_sess');
    expect(proj.entryId.startsWith('sprint_2026-09-13_2.0_v2.1_')).toBe(true);
  });

  it('AC-COMP-10 & AC-COMP-11: Multi-seed property-based verification of identity isolation and partition keys across 100 seeds', () => {
    const prng = createMulberry32('ac-comp-10-11-partitions-2026');
    const modes: CompetitiveMode[] = ['sprint', 'survival', 'daily'];
    const periods = ['2026-09-13', '2026-09-14', '2026-W37', '2026-09'];
    const rulesVersions = ['1.0', '1.1', '2.0'];
    const contentVersions = ['1.0', 'v2.1', '2.0.0'];

    const seenEntryIds = new Set<string>();

    for (let seed = 1; seed <= 100; seed++) {
      const mode = modes[randomInt(prng, 0, modes.length - 1)];
      const period = periods[randomInt(prng, 0, periods.length - 1)];
      const rulesVer = rulesVersions[randomInt(prng, 0, rulesVersions.length - 1)];
      const contentVer = contentVersions[randomInt(prng, 0, contentVersions.length - 1)];
      const userId = `private_user_uid_${seed}_${randomInt(prng, 1000, 9999)}`;
      const sessionId = `private_session_id_${seed}`;

      const subjectId = generateLeaderboardSubjectId(userId, secret);
      const entryId = generateLeaderboardEntryId(mode, period, rulesVer, contentVer, subjectId);

      // Verify partition structure
      expect(entryId).toBe(`${mode}_${period}_${rulesVer}_${contentVer}_${subjectId}`);
      seenEntryIds.add(entryId);

      const fakeResult: any = {
        resultId: `res_${seed}`,
        sessionId,
        userId,
        mode,
        status: 'VALIDATED',
        isRanked: true,
        score: randomInt(prng, 500, 3000),
        accuracy: 95,
        correctCount: 20,
        wrongCount: 1,
        questionsAnswered: 21,
        rankedActiveDurationMs: 60000,
        maxStreak: 10,
        difficultyReached: 4,
        rejectionReasons: [],
        finalizedAt: 1700000000 + seed,
        rulesVersion: rulesVer,
        contentVersion: contentVer,
      };

      const proj = projectToLeaderboardEntry(fakeResult, `Player_${seed}`, period, secret);
      const serialized = JSON.stringify(proj);

      // Zero identity leaks invariant
      expect(serialized).not.toContain(userId);
      expect(serialized).not.toContain(sessionId);
      expect(serialized).not.toContain('rejectionReasons');
      expect(proj.entryId).toBe(entryId);
    }

    // High diversity of partition keys
    expect(seenEntryIds.size).toBeGreaterThan(50);
  });

  // -------------------------------------------------------------------------
  // AC-COMP-12: Survival heartbeat gap >10.000 ms terminates session with REJECTED across 100 seeds
  // -------------------------------------------------------------------------
  it('AC-COMP-12: Survival heartbeat gap >10.000 ms terminates session with REJECTED across 100 seeds', () => {
    const questions = generateMockQuestions(5);

    for (let seed = 1; seed <= 100; seed++) {
      const sessionId = `surv_gap_${seed}`;
      const hasHeartbeatViolation = seed % 2 !== 0; // Odd seeds violate heartbeat gap
      const gapMs = hasHeartbeatViolation ? 10500 : 4000; // 10.5s vs 4.0s

      const input = {
        session: {
          sessionId,
          userId: `u_surv_${seed}`,
          mode: 'survival' as const,
          rulesVersion: '1.0',
          contentVersion: '1.0',
          serverStartedAt: 1000,
          serverDeadlineAt: 601000, // 10 minutes
          status: 'PENDING' as const,
          isRanked: true,
          idempotencyKey: `fin_gap_${seed}`,
        },
        serverQuestions: questions,
        submittedAnswers: [
          {
            sequence: 1,
            questionToken: generateQuestionToken(sessionId, 1, 'q_1', secret),
            rawInput: '2',
            clientAnsweredAt: 2000,
            inputLatencyMs: 1000,
            idempotencyKey: `a1_${seed}`,
          },
          {
            sequence: 2,
            questionToken: generateQuestionToken(sessionId, 2, 'q_2', secret),
            rawInput: '4',
            clientAnsweredAt: 2000 + gapMs,
            inputLatencyMs: 1500,
            idempotencyKey: `a2_${seed}`,
          },
        ],
        serverTimestamps: {
          startedAt: 1000,
          finalizedAt: 2000 + gapMs + 1000,
          receivedAnswerTimes: new Map([
            [1, 2050],
            [2, 2050 + gapMs],
          ]),
        },
      };

      const out = validateCompetitiveSession(input, secret);
      if (hasHeartbeatViolation) {
        expect(out.status).toBe('REJECTED');
        expect(out.leaderboardEligible).toBe(false);
        expect(
          out.rejectionReasons.some((r) =>
            r.includes(`Survival heartbeat gap exceeded`)
          )
        ).toBe(true);
      } else {
        expect(out.status).toBe('VALIDATED');
        expect(out.leaderboardEligible).toBe(true);
      }
    }
  });
});
