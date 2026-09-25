import { Firestore } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import {
  CompetitiveMode,
  CompetitiveQuestionView,
} from '@engine/competitive/types.js';
import { createCompetitiveSession, generateQuestionToken } from '@engine/competitive/stateMachine.js';
import { generateCompetitiveQuestions } from '@engine/competitive/questionGenerator.js';
import { generateDailyChallengeId, hashDailySeed } from '@engine/competitive/modes/daily.js';
import { getSprintDifficulty } from '@engine/competitive/modes/sprint.js';
import {
  getSurvivalDifficulty,
  applySurvivalTimerStep,
  SURVIVAL_INITIAL_TIMER_MS,
  SURVIVAL_HARD_CAP_MS,
} from '@engine/competitive/modes/survival.js';
import { isAnswerCorrect } from '@engine/competitive/validator.js';
import { sha256 } from '@engine/competitive/crypto.js';
import { Question } from '@engine/types/question.js';
import { logger } from '../utils/logger.js';

export interface CreateSessionParams {
  userId: string;
  mode: CompetitiveMode;
  idempotencyKey: string;
}

export interface CreateSessionResult {
  session: {
    sessionId: string;
    mode: CompetitiveMode;
    rulesVersion: string;
    contentVersion: string;
    serverStartedAt: number;
    serverDeadlineAt: number;
    isRanked: boolean;
  };
  questions: CompetitiveQuestionView[];
}

export interface RecordAnswerParams {
  sessionId: string;
  userId: string;
  sequence: number;
  questionToken: string;
  rawInput: string;
  clientAnsweredAt: number;
  inputLatencyMs: number;
  idempotencyKey: string;
}

export interface AnswerReceiptResult {
  status: 'ACCEPTED';
  sequence: number;
  isCorrect: boolean;
  serverReceivedAt: number;
  timeRemainingMs: number;
  nextQuestion: CompetitiveQuestionView | null;
}

function domainError(message: string, statusCode: number, errorCode: string): Error & { statusCode: number; errorCode: string } {
  const err = new Error(message) as Error & { statusCode: number; errorCode: string };
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
}

function createMulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function resultFromDoc(doc: any): CreateSessionResult {
  return {
    session: {
      sessionId: doc.sessionId,
      mode: doc.mode,
      rulesVersion: doc.rulesVersion,
      contentVersion: doc.contentVersion,
      serverStartedAt: doc.serverStartedAt,
      serverDeadlineAt: doc.serverDeadlineAt,
      isRanked: doc.isRanked,
    },
    questions: doc.clientQuestionViews,
  };
}

export class SessionService {
  constructor(private firestore: Firestore) {}

  async createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
    const sessionsCol = this.firestore.collection('competitiveSessions');

    // Read legacy/randomly-created sessions for backwards-compatible idempotency.
    const existing = await sessionsCol
      .where('userId', '==', params.userId)
      .where('idempotencyKey', '==', params.idempotencyKey)
      .limit(1)
      .get();
    if (!existing.empty) {
      const doc = existing.docs[0].data();
      logger.info('session_idempotency_hit', { sessionId: doc.sessionId, userId: params.userId });
      return resultFromDoc(doc);
    }

    // Deterministic reservation key plus a transaction closes the check-then-write race.
    const sessionId = `sess_${sha256(`session:${params.userId}:${params.idempotencyKey}`).slice(0, 32)}`;
    const sessionRef = sessionsCol.doc(sessionId);
    const rulesVersion = '2.0';
    const contentVersion = '72L-v1';
    const serverStartedAt = Date.now();
    let isRanked = true;
    let challengeId: string | undefined;

    if (params.mode === 'daily') {
      const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      challengeId = generateDailyChallengeId(todayWib, contentVersion);
      const dailyCompleted = await this.firestore.collection('competitiveResults')
        .where('userId', '==', params.userId)
        .where('challengeId', '==', challengeId)
        .where('status', '==', 'VALIDATED')
        .where('isRanked', '==', true)
        .limit(1)
        .get();
      isRanked = dailyCompleted.empty;
    }

    const initialQuestions: Question[] = params.mode === 'daily'
      ? generateCompetitiveQuestions(1, 10, createMulberry32(hashDailySeed(challengeId!)))
      : generateCompetitiveQuestions(1, 30);
    const serverSecret = randomBytes(32).toString('hex');
    const internalState = createCompetitiveSession({
      sessionId,
      userId: params.userId,
      mode: params.mode,
      rulesVersion,
      contentVersion,
      challengeId,
      serverStartedAt,
      initialQuestions,
      secret: serverSecret,
      isRanked,
    });

    const serializedQuestions: Record<string, unknown> = {};
    for (const [seq, q] of internalState.serverQuestions.entries()) {
      serializedQuestions[String(seq)] = q;
    }
    const sessionDoc = {
      ...internalState.contract,
      idempotencyKey: params.idempotencyKey,
      serverSecret,
      serverQuestions: serializedQuestions,
      clientQuestionViews: internalState.bufferedViews,
      createdAt: serverStartedAt,
      updatedAt: serverStartedAt,
    };

    return this.firestore.runTransaction(async (tx: any) => {
      const reservation = await tx.get(sessionRef);
      if (reservation.exists) {
        const doc = reservation.data();
        logger.info('session_idempotency_hit', { sessionId, userId: params.userId });
        return resultFromDoc(doc);
      }
      if (typeof tx.create === 'function') {
        tx.create(sessionRef, sessionDoc);
      } else {
        tx.set(sessionRef, sessionDoc);
      }
      logger.info('session_created', { sessionId, userId: params.userId, mode: params.mode, isRanked });
      return {
        session: {
          sessionId,
          mode: params.mode,
          rulesVersion,
          contentVersion,
          serverStartedAt,
          serverDeadlineAt: internalState.contract.serverDeadlineAt,
          isRanked,
        },
        questions: internalState.bufferedViews,
      };
    });
  }

  async recordAnswerReceipt(params: RecordAnswerParams): Promise<AnswerReceiptResult> {
    const sessionRef = this.firestore.collection('competitiveSessions').doc(params.sessionId);

    return this.firestore.runTransaction(async (tx: any) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) {
        throw domainError('Competitive session not found.', 404, 'SESSION_NOT_FOUND');
      }

      const data = snap.data();
      if (data.userId !== params.userId) {
        throw domainError('You are not authorized to submit to this session.', 403, 'SESSION_FORBIDDEN');
      }

      if (data.status !== 'ACTIVE') {
        throw domainError('Session is not active.', 409, 'SESSION_NOT_ACTIVE');
      }

      const now = Date.now();
      if (now > data.serverDeadlineAt) {
        throw domainError('Session deadline has expired.', 409, 'SESSION_EXPIRED');
      }

      const receipts: Record<string, any> = data.answerReceipts || {};
      const existingReceipt = receipts[String(params.sequence)];
      if (existingReceipt) {
        if (existingReceipt.idempotencyKey === params.idempotencyKey) {
          logger.info('answer_receipt_idempotency_hit', { sessionId: params.sessionId, sequence: params.sequence });
          return {
            status: 'ACCEPTED',
            sequence: params.sequence,
            isCorrect: existingReceipt.isCorrect,
            serverReceivedAt: existingReceipt.serverReceivedAt,
            timeRemainingMs: existingReceipt.timeRemainingMs,
            nextQuestion: existingReceipt.nextQuestion || null,
          };
        }
        throw domainError(
          `Sequence ${params.sequence} already acknowledged with different idempotency key.`,
          409,
          'SEQUENCE_ALREADY_ACKNOWLEDGED'
        );
      }

      const acknowledgedSequences: number[] = data.acknowledgedSequences || [];
      const expectedSeq = acknowledgedSequences.length + 1;
      if (params.sequence !== expectedSeq) {
        throw domainError(
          `Invalid sequence ${params.sequence}. Expected ${expectedSeq}.`,
          409,
          'OUT_OF_ORDER_SEQUENCE'
        );
      }

      const qObj = data.serverQuestions?.[String(params.sequence)] as Question | undefined;
      if (!qObj) {
        throw domainError('Question not found for sequence.', 400, 'QUESTION_NOT_FOUND');
      }

      const expectedToken = generateQuestionToken(data.sessionId, params.sequence, qObj.id, data.serverSecret);
      if (params.questionToken !== expectedToken) {
        throw domainError('Invalid question token.', 403, 'INVALID_QUESTION_TOKEN');
      }

      const isCorrect = isAnswerCorrect(params.rawInput, qObj.answerSpec);
      const previousCorrectCount = data.correctCount || 0;
      const newCorrectCount = isCorrect ? previousCorrectCount + 1 : previousCorrectCount;

      let timeRemainingMs: number;
      if (data.mode === 'survival') {
        const currentTimer = typeof data.survivalTimerMs === 'number' ? data.survivalTimerMs : SURVIVAL_INITIAL_TIMER_MS;
        timeRemainingMs = applySurvivalTimerStep(currentTimer, isCorrect);
      } else {
        timeRemainingMs = Math.max(0, data.serverDeadlineAt - now);
      }

      const nextSeq = params.sequence + 1;
      let nextQuestionView: CompetitiveQuestionView | null = null;
      let freshQuestionsGenerated = false;

      if (data.mode === 'daily') {
        if (nextSeq <= 10) {
          const nextQ = data.serverQuestions?.[String(nextSeq)] as Question | undefined;
          if (nextQ) {
            const nextToken = generateQuestionToken(data.sessionId, nextSeq, nextQ.id, data.serverSecret);
            nextQuestionView = {
              questionInstanceId: nextQ.id,
              sequence: nextSeq,
              renderedPrompt: nextQ.prompt,
              answerInputKind: nextQ.answerSpec.kind as any,
              questionToken: nextToken,
            };
          }
        }
      } else {
        let nextQ = data.serverQuestions?.[String(nextSeq)] as Question | undefined;
        if (!nextQ) {
          const tier = data.mode === 'sprint' ? getSprintDifficulty(newCorrectCount) : getSurvivalDifficulty(newCorrectCount);
          const [freshQ] = generateCompetitiveQuestions(tier, 1);
          freshQ.id = freshQ.id || `q_${nextSeq}`;
          data.serverQuestions = data.serverQuestions || {};
          data.serverQuestions[String(nextSeq)] = freshQ;
          nextQ = freshQ;
          freshQuestionsGenerated = true;
        }

        if (nextQ && (data.mode !== 'survival' || timeRemainingMs > 0)) {
          const nextToken = generateQuestionToken(data.sessionId, nextSeq, nextQ.id, data.serverSecret);
          nextQuestionView = {
            questionInstanceId: nextQ.id,
            sequence: nextSeq,
            renderedPrompt: nextQ.prompt,
            answerInputKind: nextQ.answerSpec.kind as any,
            questionToken: nextToken,
          };
        }
      }

      const receiptRecord = {
        sequence: params.sequence,
        idempotencyKey: params.idempotencyKey,
        isCorrect,
        serverReceivedAt: now,
        timeRemainingMs,
        nextQuestion: nextQuestionView,
      };

      receipts[String(params.sequence)] = receiptRecord;
      const updatedAck = [...acknowledgedSequences, params.sequence];
      const updates: any = {
        answerReceipts: receipts,
        acknowledgedSequences: updatedAck,
        correctCount: newCorrectCount,
        updatedAt: now,
      };

      if (data.mode === 'survival') {
        updates.survivalTimerMs = timeRemainingMs;
        updates.lastAnswerReceivedAt = now;
      }
      if (freshQuestionsGenerated) {
        updates.serverQuestions = data.serverQuestions;
      }

      tx.update(sessionRef, updates);

      logger.info('answer_receipt_recorded', {
        sessionId: params.sessionId,
        sequence: params.sequence,
        isCorrect,
        timeRemainingMs,
      });

      return {
        status: 'ACCEPTED',
        sequence: params.sequence,
        isCorrect,
        serverReceivedAt: now,
        timeRemainingMs,
        nextQuestion: nextQuestionView,
      };
    });
  }
}
