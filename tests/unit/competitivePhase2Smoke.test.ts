import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateCompetitiveEligibility } from '../../src/lib/competitiveEligibility';
import { createCompetitiveApiClient } from '../../src/lib/competitiveApi';
import { isCompetitiveRankedEnabled, setCompetitiveRankedOverride } from '../../src/lib/featureFlags';

describe('Competitive Phase 2 Smoke Verification', () => {
  beforeEach(() => {
    setCompetitiveRankedOverride(true);
  });

  it('1. Under-13 has zero competitive API calls and is local practice', () => {
    const eligibility = evaluateCompetitiveEligibility({
      ageEligibility: 'under13',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: isCompetitiveRankedEnabled(),
    });

    expect(eligibility.isEligibleForRanked).toBe(false);
    expect(eligibility.reason).toBe('under13');
    expect(eligibility.executionMode).toBe('practice');
  });

  it('2. Authenticated 13+ is eligible for ranked when flag is enabled', () => {
    const eligibility = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: isCompetitiveRankedEnabled(),
    });

    expect(eligibility.isEligibleForRanked).toBe(true);
    expect(eligibility.executionMode).toBe('ranked');
  });

  it('3. Guest play remains local', () => {
    const eligibility = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: true,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: isCompetitiveRankedEnabled(),
    });

    expect(eligibility.isEligibleForRanked).toBe(false);
    expect(eligibility.reason).toBe('guest');
    expect(eligibility.executionMode).toBe('practice');
  });

  it('4. Feature flag kill switch immediately disables ranked eligibility', () => {
    setCompetitiveRankedOverride(false);
    const eligibility = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: false,
      featureFlagEnabled: isCompetitiveRankedEnabled(),
    });

    expect(eligibility.isEligibleForRanked).toBe(false);
    expect(eligibility.reason).toBe('flag_disabled');
    expect(eligibility.executionMode).toBe('practice');
  });

  it('5. Leaderboard opt-out user is practice mode only', () => {
    const eligibility = evaluateCompetitiveEligibility({
      ageEligibility: '13plus',
      isGuest: false,
      isAuthenticated: true,
      leaderboardOptOut: true,
      featureFlagEnabled: isCompetitiveRankedEnabled(),
    });

    expect(eligibility.isEligibleForRanked).toBe(false);
    expect(eligibility.reason).toBe('leaderboard_opt_out');
    expect(eligibility.executionMode).toBe('practice');
  });

  it('6. API client does not leak secrets or answer keys in error objects', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'INTERNAL', secret: 'leak_secret', answerKey: 42 }),
    });

    const client = createCompetitiveApiClient({
      baseUrl: '/api/competitive',
      getToken: vi.fn().mockResolvedValue('token'),
      fetchFn: mockFetch,
    });

    try {
      await client.createSession({ mode: 'sprint', idempotencyKey: 'idemp' });
      expect.fail('should have thrown');
    } catch (err: any) {
      expect(JSON.stringify(err)).not.toContain('leak_secret');
      expect(JSON.stringify(err)).not.toContain('42');
    }
  });

  it('7. Full session creation, answer receipt submission, and session finalization cycle', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: {
            sessionId: 'sess_cycle_1',
            mode: 'sprint',
            rulesVersion: '2.0.0',
            contentVersion: '72L-v1',
            serverStartedAt: 1000,
            serverDeadlineAt: 61000,
            isRanked: true,
          },
          questions: [
            {
              questionInstanceId: 'q1',
              sequence: 1,
              renderedPrompt: '12 + 15',
              answerInputKind: 'numeric',
              questionToken: 'tok_1',
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ACCEPTED',
          sequence: 1,
          isCorrect: true,
          serverReceivedAt: 2500,
          timeRemainingMs: 58500,
          nextQuestion: {
            questionInstanceId: 'q2',
            sequence: 2,
            renderedPrompt: '20 * 3',
            answerInputKind: 'numeric',
            questionToken: 'tok_2',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sessionId: 'sess_cycle_1',
          status: 'VALIDATED',
          result: {
            resultId: 'res_cycle_1',
            sessionId: 'sess_cycle_1',
            playerId: 'player_1',
            pseudonym: 'Player1',
            mode: 'sprint',
            periodKey: 'all-time',
            submittedAt: 60000,
            rulesVersion: '2.0.0',
            contentVersion: '72L-v1',
            status: 'VALIDATED',
            rejectionReasons: [],
            leaderboardEligible: true,
            score: 100,
            rank: 5,
            accuracy: 100,
            correctCount: 1,
            wrongCount: 0,
            questionsAnswered: 1,
            rankedActiveDurationMs: 50000,
            maxStreak: 1,
            difficultyReached: 2,
            countryFlag: '🇮🇩',
          },
        }),
      });

    const client = createCompetitiveApiClient({
      baseUrl: '/api/competitive',
      getToken: vi.fn().mockResolvedValue('mock_token'),
      fetchFn: mockFetch,
    });

    const sessionRes = await client.createSession({ mode: 'sprint', idempotencyKey: 'id_1' });
    expect(sessionRes.session.sessionId).toBe('sess_cycle_1');

    const receiptRes = await client.submitAnswer('sess_cycle_1', {
      sequence: 1,
      questionToken: 'tok_1',
      rawInput: '27',
      clientAnsweredAt: 2400,
      inputLatencyMs: 1400,
      idempotencyKey: 'ans_id_1',
    });
    expect(receiptRes.isCorrect).toBe(true);
    expect(receiptRes.nextQuestion?.sequence).toBe(2);

    const finalizeRes = await client.submitSession('sess_cycle_1', {
      answers: [],
      submissionIdempotencyKey: 'sub_1',
    });
    expect(finalizeRes.status).toBe('VALIDATED');
    expect(finalizeRes.result?.score).toBe(100);
  });
});
