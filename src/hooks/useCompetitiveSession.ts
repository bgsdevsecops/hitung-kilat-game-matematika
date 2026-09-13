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
import { generateCompetitiveQuestions } from '../engine/competitive/questionGenerator';

export interface UseCompetitiveSessionOptions {
  mode: CompetitiveMode;
  secret: string;
  userId?: string;
  isRanked?: boolean;
  onFinish?: (output: ValidationOutput) => void;
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
  submitAnswer: (rawInput: string) => void;
  abandonSession: () => void;
  resultOutput: ValidationOutput | null;
}

export function useCompetitiveSession(options: UseCompetitiveSessionOptions): UseCompetitiveSessionReturn {
  const { mode, secret, userId = 'guest_user', isRanked = true, onFinish } = options;

  const [status, setStatus] = useState<'ACTIVE' | 'PENDING' | 'VALIDATED' | 'REJECTED'>('ACTIVE');
  const [sessionState, setSessionState] = useState<InternalSessionState>(() => {
    const startedAt = Date.now();
    const initialQuestions = generateCompetitiveQuestions(1, 5);
    return createCompetitiveSession({
      sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      mode,
      rulesVersion: '2.0.0',
      contentVersion: '2.0.0',
      serverStartedAt: startedAt,
      initialQuestions,
      secret,
      isRanked,
    });
  });

  const [comboStreak, setComboStreak] = useState<number>(0);
  const [difficultyReached, setDifficultyReached] = useState<number>(1);
  const [timeRemainingMs, setTimeRemainingMs] = useState<number>(() =>
    mode === 'sprint' ? 60000 : SURVIVAL_INITIAL_TIMER_MS
  );
  const [totalElapsedMs, setTotalElapsedMs] = useState<number>(0);
  const [resultOutput, setResultOutput] = useState<ValidationOutput | null>(null);

  const sessionStateRef = useRef<InternalSessionState>(sessionState);
  sessionStateRef.current = sessionState;

  const submittedAnswersRef = useRef<SubmittedAnswerPayload[]>([]);
  const receivedAnswerTimesRef = useRef<Map<number, number>>(new Map());
  const questionPresentedAtRef = useRef<number>(Date.now());
  const startTimeRef = useRef<number>(Date.now());
  const finalizedRef = useRef<boolean>(false);
  const survivalTimerMsRef = useRef<number>(timeRemainingMs);

  const currentQuestion = sessionState.bufferedViews[0] || null;

  const finalizeSession = useCallback(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setStatus('PENDING');

    const finalizedAt = Date.now();
    const currentSession = sessionStateRef.current;
    const validationInput: ValidationInput = {
      session: {
        ...currentSession.contract,
        serverDeadlineAt:
          mode === 'sprint'
            ? currentSession.contract.serverStartedAt + 60000
            : finalizedAt,
      },
      serverQuestions: currentSession.serverQuestions,
      submittedAnswers: submittedAnswersRef.current,
      serverTimestamps: {
        startedAt: currentSession.contract.serverStartedAt,
        finalizedAt,
        receivedAnswerTimes: receivedAnswerTimesRef.current,
      },
    };

    const output = validateCompetitiveSession(validationInput, secret);
    setResultOutput(output);
    setStatus(output.status);
    if (onFinish) {
      onFinish(output);
    }
  }, [mode, secret, onFinish]);

  // Main countdown loop
  useEffect(() => {
    if (status !== 'ACTIVE') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      setTotalElapsedMs(elapsed);

      if (mode === 'sprint') {
        const remaining = Math.max(0, 60000 - elapsed);
        setTimeRemainingMs(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          finalizeSession();
        }
      } else if (mode === 'survival') {
        const nextTime = Math.max(0, survivalTimerMsRef.current - 200);
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
      // Keep anti-cheat timestamp warm
      const now = Date.now();
      if (!receivedAnswerTimesRef.current.has(0)) {
        receivedAnswerTimesRef.current.set(0, now);
      }
    }, 4000);

    return () => clearInterval(heartbeat);
  }, [status, mode]);

  const submitAnswer = useCallback(
    (rawInput: string) => {
      if (status !== 'ACTIVE' || !currentQuestion) return;

      const now = Date.now();
      const rawDelta = now - questionPresentedAtRef.current;
      const latency = Math.max(150, rawDelta);
      const seq = currentQuestion.sequence;

      const payload: SubmittedAnswerPayload = {
        sequence: seq,
        questionToken: currentQuestion.questionToken,
        rawInput,
        clientAnsweredAt: now,
        inputLatencyMs: latency,
        idempotencyKey: `ans_${sessionStateRef.current.contract.sessionId}_${seq}`,
      };

      submittedAnswersRef.current.push(payload);
      receivedAnswerTimesRef.current.set(seq, now);
      questionPresentedAtRef.current = now;

      // Optimistic difficulty and timer update
      const totalCorrectEstimate = submittedAnswersRef.current.length; // Progressive tier advancement
      const nextTier =
        mode === 'sprint'
          ? getSprintDifficulty(totalCorrectEstimate)
          : getSurvivalDifficulty(totalCorrectEstimate);

      setDifficultyReached(nextTier);
      setComboStreak((prev) => prev + 1);

      if (mode === 'survival') {
        // Optimistic timer step: +2s capped at 60s
        const updatedTimer = applySurvivalTimerStep(survivalTimerMsRef.current, true);
        survivalTimerMsRef.current = updatedTimer;
        setTimeRemainingMs(updatedTimer);
      }

      // Replenish buffer with fresh question matching next tier
      const [nextQuestion] = generateCompetitiveQuestions(nextTier, 1);
      setSessionState((prev) =>
        advanceSessionBuffer(prev, [seq], [nextQuestion], secret)
      );
    },
    [status, currentQuestion, mode, secret]
  );

  const abandonSession = useCallback(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setStatus('REJECTED');
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
        receivedAnswerTimes: receivedAnswerTimesRef.current,
      },
    };
    const output = validateCompetitiveSession(validationInput, secret);
    setResultOutput(output);
  }, [secret]);

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
  };
}
