import { Firestore } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import {
  CompetitiveMode,
  CompetitiveQuestionView,
} from '@engine/competitive/types.js';
import { createCompetitiveSession } from '@engine/competitive/stateMachine.js';
import { generateCompetitiveQuestions } from '@engine/competitive/questionGenerator.js';
import { generateDailyChallengeId, hashDailySeed } from '@engine/competitive/modes/daily.js';
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
}
