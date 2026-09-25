import { Firestore } from 'firebase-admin/firestore';
import { randomBytes, randomUUID } from 'crypto';
import {
  CompetitiveMode,
  CompetitiveQuestionView,
  CompetitiveSessionContract,
} from '@engine/competitive/types.js';
import { createCompetitiveSession } from '@engine/competitive/stateMachine.js';
import { generateCompetitiveQuestions } from '@engine/competitive/questionGenerator.js';
import { generateDailyChallengeId } from '@engine/competitive/modes/daily.js';
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

export class SessionService {
  constructor(private firestore: Firestore) {}

  async createSession(params: CreateSessionParams): Promise<CreateSessionResult> {
    const sessionsCol = this.firestore.collection('competitiveSessions');

    // 1. Idempotency check
    const existing = await sessionsCol
      .where('userId', '==', params.userId)
      .where('idempotencyKey', '==', params.idempotencyKey)
      .limit(1)
      .get();

    if (!existing.empty) {
      const doc = existing.docs[0].data();
      logger.info('session_idempotency_hit', { sessionId: doc.sessionId, userId: params.userId });
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

    const sessionId = randomUUID();
    const serverSecret = randomBytes(32).toString('hex');
    const serverStartedAt = Date.now();
    const rulesVersion = '2.0';
    const contentVersion = '72L-v1';

    let isRanked = true;
    let challengeId: string | undefined;

    if (params.mode === 'daily') {
      const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      challengeId = generateDailyChallengeId(todayWib, contentVersion);

      // Check if user already completed a ranked daily challenge today
      const resultsCol = this.firestore.collection('competitiveResults');
      const dailyCompleted = await resultsCol
        .where('userId', '==', params.userId)
        .where('challengeId', '==', challengeId)
        .where('status', '==', 'VALIDATED')
        .where('isRanked', '==', true)
        .limit(1)
        .get();

      if (!dailyCompleted.empty) {
        isRanked = false; // Archive practice mode
      }
    }

    const initialQuestions = generateCompetitiveQuestions(1, params.mode === 'daily' ? 10 : 30);
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

    // Serialize server questions map for storage
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

    await sessionsCol.doc(sessionId).set(sessionDoc);

    logger.info('session_created', {
      sessionId,
      userId: params.userId,
      mode: params.mode,
      isRanked,
    });

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
  }
}
