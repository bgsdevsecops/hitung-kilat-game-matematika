import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CompetitiveMode,
  CompetitiveQuestionView,
  SubmittedAnswerPayload,
} from '../engine/competitive/types';
import {
  createCompetitiveSession,
  advanceSessionBuffer,
  InternalSessionState,
} from '../engine/competitive/stateMachine';
import {
  validateCompetitiveSession,
  isAnswerCorrect,
  ValidationInput,
  ValidationOutput,
} from '../engine/competitive/validator';
import { getSprintDifficulty } from '../engine/competitive/modes/sprint';
import {
  getSurvivalDifficulty,
  applySurvivalTimerStep,
  SURVIVAL_INITIAL_TIMER_MS,
  SURVIVAL_HARD_CAP_MS,
} from '../engine/competitive/modes/survival';
import { DAILY_HARD_DEADLINE_MS } from '../engine/competitive/modes/daily';
import { generateCompetitiveQuestions } from '../engine/competitive/questionGenerator';
import { Question } from '../types';
import { CompetitiveApiClient } from '../lib/competitiveApi';

export type CompetitiveIntegrationStatus =
  | 'checking'
  | 'ranked_active'
  | 'practice_active'
  | 'submitting'
  | 'validated'
  | 'rejected'
  | 'unavailable';

export interface UseCompetitiveSessionOptions {
  mode: CompetitiveMode;
  secret: string;
  userId?: string;
  isRanked?: boolean;
  challengeId?: string;
  dailyQuestions?: Question[];
  onFinish?: (output: ValidationOutput) => void;
  // Phase 2
  executionMode?: 'ranked' | 'practice';
  apiClient?: CompetitiveApiClient;
  serverSessionId?: string;
  initialServerQuestions?: CompetitiveQuestionView[];
  pseudonym?: string;
}

export interface UseCompetitiveSessionReturn {
  status: 'ACTIVE' | 'PENDING' | 'VALIDATED' | 'REJECTED';
  currentQuestion: CompetitiveQuestionView | null;
  bufferedCount: number;
  comboStreak: number;
  difficultyReached: number;
  timeRemainingMs: number;
  totalElapsedMs: number;
  isGameOver: boolean;
  submitAnswer: (rawInput: string) => boolean;
  abandonSession: () => void;
  resultOutput: ValidationOutput | null;
  integrationStatus: CompetitiveIntegrationStatus;
  isRankedSession: boolean;
}

export function useCompetitiveSession(options: UseCompetitiveSessionOptions): UseCompetitiveSessionReturn {
  const {
    mode,
    secret,
    userId = 'guest_user',
    isRanked = true,
    challengeId,
    dailyQuestions,
    onFinish,
    executionMode = 'practice',
    apiClient,
    serverSessionId,
    initialServerQuestions,
    pseudonym,
  } = options;

  const isRankedSession = executionMode === 'ranked';

  const [status, setStatus] = useState<'ACTIVE' | 'PENDING' | 'VALIDATED' | 'REJECTED'>('ACTIVE');
  const [integrationStatus, setIntegrationStatus] = useState<CompetitiveIntegrationStatus>(
    isRankedSession ? 'ranked_active' : 'practice_active'
  );

  const [sessionState, setSessionState] = useState<InternalSessionState>(() => {
    const startedAt = Date.now();
    const effectiveSessionId = serverSessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (isRankedSession && initialServerQuestions && initialServerQuestions.length > 0) {
      return {
        contract: {
          sessionId: effectiveSessionId,
          userId,
          mode,
          rulesVersion: '2.0.0',
          contentVersion: '72L-v1',
          challengeId,
          serverStartedAt: startedAt,
          serverDeadlineAt:
            mode === 'daily'
              ? startedAt + DAILY_HARD_DEADLINE_MS
              : mode === 'sprint'
              ? startedAt + 60000
              : startedAt + SURVIVAL_INITIAL_TIMER_MS,
          status: 'ACTIVE',
          isRanked: true,
          idempotencyKey: `idemp_${effectiveSessionId}`,
        },
        bufferedViews: [...initialServerQuestions],
        acknowledgedSequences: new Set(),
        serverQuestions: new Map(),
      };
    }

    const initialQuestions =
      mode === 'daily' && dailyQuestions && dailyQuestions.length >= 5
        ? (dailyQuestions.slice(0, 5) as any)
        : generateCompetitiveQuestions(1, 5);
    return createCompetitiveSession({
      sessionId: effectiveSessionId,
      userId,
      mode,
      rulesVersion: '2.0.0',
      contentVersion: '2.0.0',
      challengeId,
      serverStartedAt: startedAt,
      initialQuestions,
      secret,
      isRanked: isRankedSession ? true : isRanked,
    });
  });

  const [comboStreak, setComboStreak] = useState<number>(0);
  const [difficultyReached, setDifficultyReached] = useState<number>(1);
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(() => {
    if (mode === 'daily') return DAILY_HARD_DEADLINE_MS;
    return mode === 'sprint' ? 60000 : SURVIVAL_INITIAL_TIMER_MS;
  });
  const [totalElapsedMs, setTotalElapsedMs] = useState<number>(0);
  const [resultOutput, setResultOutput] = useState<ValidationOutput | null>(null);

  const sessionStateRef = useRef<InternalSessionState>(sessionState);
  sessionStateRef.current = sessionState;

  const submittedAnswersRef = useRef<SubmittedAnswerPayload[]>([]);
  const receivedAnswerTimesRef = useRef<Map<number, number>>(new Map());
  const questionPresentedAtRef = useRef<number>(Date.now());
  const startTimeRef = useRef<number>(Date.now());
  const lastTickRef = useRef<number>(Date.now());
  const finalizedRef = useRef<boolean>(false);
  const survivalTimerMsRef = useRef<number>(timeRemainingMs);
  const correctCountRef = useRef<number>(0);
  const receiptQueueRef = useRef<Promise<void>>(Promise.resolve());

  const currentQuestion = sessionState.bufferedViews[0] || null;

  const finalizeSession = useCallback(async () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setStatus('PENDING');

    if (isRankedSession && apiClient && (serverSessionId || sessionStateRef.current.contract.sessionId)) {
      setIntegrationStatus('submitting');
      const sid = serverSessionId || sessionStateRef.current.contract.sessionId;

      try {
        await receiptQueueRef.current;
        const res = await apiClient.submitSession(sid, {
          answers: submittedAnswersRef.current,
          submissionIdempotencyKey: `sub_${sid}`,
          pseudonym,
        });

        setStatus(res.status);
        setIntegrationStatus(res.status === 'VALIDATED' ? 'validated' : 'rejected');
        const output: ValidationOutput = {
          status: res.status,
          leaderboardEligible: Boolean(res.result?.isRanked && res.status === 'VALIDATED'),
          rejectionReasons: res.result?.rejectionReasons || [],
          result: res.result,
        };
        setResultOutput(output);
        if (onFinish) {
          onFinish(output);
        }
        return;
      } catch (err: any) {
        setStatus('REJECTED');
        setIntegrationStatus('rejected');
        const fallbackResult = {
          resultId: `err_${Date.now()}`,
          sessionId: sid,
          userId,
          mode,
          rulesVersion: '2.0.0',
          contentVersion: '72L-v1',
          score: 0,
          correctCount: correctCountRef.current,
          incorrectCount: 0,
          accuracy: 0,
          durationMs: 0,
          status: 'REJECTED' as const,
          isRanked: false,
          rejectionReasons: [err?.message || 'Server submission failed'],
          finalizedAt: Date.now(),
        };
        const output: ValidationOutput = {
          status: 'REJECTED',
          leaderboardEligible: false,
          rejectionReasons: [err?.message || 'Server submission failed'],
          result: fallbackResult,
        };
        setResultOutput(output);
        if (onFinish) {
          onFinish(output);
        }
        return;
      }
    }

    const now = Date.now();
    const currentSession = sessionStateRef.current;

    let finalizedAt = now;
    if (mode === 'survival' && submittedAnswersRef.current.length > 0) {
      const lastSeq = submittedAnswersRef.current[submittedAnswersRef.current.length - 1].sequence;
      const lastAnswerTime =
        receivedAnswerTimesRef.current.get(lastSeq) ??
        (currentSession.contract.serverStartedAt + submittedAnswersRef.current[submittedAnswersRef.current.length - 1].clientAnsweredAt);

      if (finalizedAt - lastAnswerTime > 10000) {
        finalizedAt = lastAnswerTime + 10000;
      }
    }

    const validationInput: ValidationInput = {
      session: {
        ...currentSession.contract,
        serverDeadlineAt:
          mode === 'daily'
            ? currentSession.contract.serverStartedAt + DAILY_HARD_DEADLINE_MS
            : mode === 'sprint'
            ? currentSession.contract.serverStartedAt + 60000
            : finalizedAt,
      },
      serverQuestions: currentSession.serverQuestions,
      submittedAnswers: submittedAnswersRef.current,
      serverTimestamps: {
        startedAt: currentSession.contract.serverStartedAt,
        finalizedAt,
        hasAuthoritativeAnswerReceipts: false,
        receivedAnswerTimes: receivedAnswerTimesRef.current,
      },
    };

    const output = validateCompetitiveSession(validationInput, secret);
    setResultOutput(output);
    setStatus(output.status);
    setIntegrationStatus(output.status === 'VALIDATED' ? 'validated' : 'rejected');
    if (onFinish) {
      onFinish(output);
    }
  }, [isRankedSession, apiClient, serverSessionId, pseudonym, userId, mode, secret, onFinish]);

  // Main countdown loop (with wall-clock delta)
  useEffect(() => {
    if (status !== 'ACTIVE') return;

    lastTickRef.current = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      const tickDelta = Math.max(0, now - lastTickRef.current);
      lastTickRef.current = now;

      setTotalElapsedMs(elapsed);

      if (mode === 'daily') {
        const remaining = Math.max(0, DAILY_HARD_DEADLINE_MS - elapsed);
        setTimeRemainingMs(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          finalizeSession();
        }
      } else if (mode === 'sprint') {
        const remaining = Math.max(0, 60000 - elapsed);
        setTimeRemainingMs(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          finalizeSession();
        }
      } else if (mode === 'survival') {
        const nextTime = Math.max(0, survivalTimerMsRef.current - tickDelta);
        survivalTimerMsRef.current = nextTime;
        setTimeRemainingMs(nextTime);
        if (nextTime <= 0 || elapsed >= SURVIVAL_HARD_CAP_MS) {
          clearInterval(interval);
          finalizeSession();
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [status, mode, finalizeSession]);

  // Survival anti-cheat heartbeat (every 4000ms)
  useEffect(() => {
    if (status !== 'ACTIVE' || mode !== 'survival') return;

    const heartbeat = setInterval(() => {
      const now = Date.now();
      if (!receivedAnswerTimesRef.current.has(0)) {
        receivedAnswerTimesRef.current.set(0, now);
      }
    }, 4000);

    return () => clearInterval(heartbeat);
  }, [status, mode]);

  const submitAnswer = useCallback(
    (rawInput: string): boolean => {
      if (status !== 'ACTIVE' || !currentQuestion) return false;

      const now = Date.now();
      const latency = Math.max(0, now - questionPresentedAtRef.current);
      const seq = currentQuestion.sequence;

      const payload: SubmittedAnswerPayload = {
        sequence: seq,
        questionToken: currentQuestion.questionToken,
        rawInput,
        clientAnsweredAt: Math.max(0, now - sessionStateRef.current.contract.serverStartedAt),
        inputLatencyMs: latency,
        idempotencyKey: `ans_${sessionStateRef.current.contract.sessionId}_${seq}`,
      };

      submittedAnswersRef.current.push(payload);
      receivedAnswerTimesRef.current.set(seq, now);
      questionPresentedAtRef.current = now;

      if (isRankedSession) {
        // Optimistically advance buffer
        setSessionState((prev) => ({
          ...prev,
          bufferedViews: prev.bufferedViews.filter((v) => v.sequence !== seq),
        }));

        if (apiClient && (serverSessionId || sessionStateRef.current.contract.sessionId)) {
          const sid = serverSessionId || sessionStateRef.current.contract.sessionId;
          receiptQueueRef.current = receiptQueueRef.current
            .then(async () => {
              try {
                const receipt = await apiClient.submitAnswer(sid, {
                  sequence: seq,
                  questionToken: payload.questionToken,
                  rawInput: payload.rawInput,
                  clientAnsweredAt: payload.clientAnsweredAt,
                  inputLatencyMs: payload.inputLatencyMs,
                  idempotencyKey: payload.idempotencyKey,
                });

                if (receipt) {
                  if (receipt.isCorrect) {
                    correctCountRef.current += 1;
                    setComboStreak((prev) => prev + 1);
                  } else {
                    setComboStreak(0);
                  }

                  const totalCorrect = correctCountRef.current;
                  const nextTier =
                    mode === 'sprint'
                      ? getSprintDifficulty(totalCorrect)
                      : getSurvivalDifficulty(totalCorrect);
                  setDifficultyReached(nextTier);

                  if (mode === 'survival') {
                    survivalTimerMsRef.current = receipt.timeRemainingMs;
                    setTimeRemainingMs(receipt.timeRemainingMs);
                    if (receipt.timeRemainingMs <= 0) {
                      finalizeSession();
                    }
                  }

                  if (receipt.nextQuestion) {
                    const nextQ = receipt.nextQuestion;
                    setSessionState((prev) => {
                      if (prev.bufferedViews.some((v) => v.sequence === nextQ.sequence)) {
                        return prev;
                      }
                      return {
                        ...prev,
                        bufferedViews: [...prev.bufferedViews, nextQ],
                      };
                    });
                  }
                }
              } catch (err) {
                // Receipt errors are captured during queue execution
              }
            })
            .catch(() => {});
        }

        if (mode === 'daily' && seq >= 10) {
          finalizeSession();
        }

        return true;
      }

      // Local practice mode
      const q = sessionStateRef.current.serverQuestions.get(seq);
      const isCorrect = q ? isAnswerCorrect(rawInput, q.answerSpec) : false;

      if (isCorrect) {
        correctCountRef.current += 1;
        setComboStreak((prev) => prev + 1);
      } else {
        setComboStreak(0);
      }

      const totalCorrect = correctCountRef.current;
      const nextTier =
        mode === 'sprint'
          ? getSprintDifficulty(totalCorrect)
          : getSurvivalDifficulty(totalCorrect);

      setDifficultyReached(nextTier);

      if (mode === 'survival') {
        const deltaSinceTick = Math.max(0, now - lastTickRef.current);
        lastTickRef.current = now;
        const currentTimer = Math.max(0, survivalTimerMsRef.current - deltaSinceTick);
        const updatedTimer = applySurvivalTimerStep(currentTimer, isCorrect);
        survivalTimerMsRef.current = updatedTimer;
        setTimeRemainingMs(updatedTimer);
        if (updatedTimer <= 0) {
          finalizeSession();
          return isCorrect;
        }
      }

      if (mode === 'daily') {
        if (seq >= 10) {
          finalizeSession();
          return isCorrect;
        }
        const nextQIndex = seq + 4;
        const nextQ = dailyQuestions?.[nextQIndex];
        if (nextQ) {
          setSessionState((prev) =>
            advanceSessionBuffer(prev, [seq], [nextQ as any], secret)
          );
        } else {
          setSessionState((prev) =>
            advanceSessionBuffer(prev, [seq], [], secret)
          );
        }
        return isCorrect;
      }

      const [nextQuestion] = generateCompetitiveQuestions(nextTier, 1);
      setSessionState((prev) =>
        advanceSessionBuffer(prev, [seq], [nextQuestion], secret)
      );

      return isCorrect;
    },
    [status, currentQuestion, isRankedSession, apiClient, serverSessionId, mode, secret, finalizeSession, dailyQuestions]
  );

  const abandonSession = useCallback(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setStatus('REJECTED');
    setIntegrationStatus('rejected');
    const finalizedAt = Date.now();
    const currentSession = sessionStateRef.current;
    const validationInput: ValidationInput = {
      session: {
        ...currentSession.contract,
        serverDeadlineAt: finalizedAt,
      },
      serverQuestions: currentSession.serverQuestions,
      submittedAnswers: submittedAnswersRef.current,
      serverTimestamps: {
        startedAt: currentSession.contract.serverStartedAt,
        finalizedAt,
        hasAuthoritativeAnswerReceipts: false,
        receivedAnswerTimes: receivedAnswerTimesRef.current,
      },
    };
    const output = validateCompetitiveSession(validationInput, secret);
    setResultOutput(output);
    if (onFinish) {
      onFinish(output);
    }
  }, [secret, onFinish]);

  return {
    status,
    currentQuestion,
    bufferedCount: sessionState.bufferedViews.length,
    comboStreak,
    difficultyReached,
    timeRemainingMs,
    totalElapsedMs,
    isGameOver: status === 'VALIDATED' || status === 'REJECTED',
    submitAnswer,
    abandonSession,
    resultOutput,
    integrationStatus,
    isRankedSession,
  };
}
