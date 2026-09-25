import { Firestore } from 'firebase-admin/firestore';
import {
  CompetitiveResultDoc,
  LeaderboardEntryDoc,
  SubmittedAnswerPayload,
} from '@engine/competitive/types.js';
import { validateCompetitiveSession, ValidationInput } from '@engine/competitive/validator.js';
import { Question } from '@engine/types/question.js';
import { logger } from '../utils/logger.js';

export interface FinalizeSessionParams {
  sessionId: string;
  userId: string;
  answers: SubmittedAnswerPayload[];
  submissionIdempotencyKey: string;
  pseudonym?: string;
}

export interface FinalizeSessionResult {
  status: 'VALIDATED' | 'REJECTED';
  result: CompetitiveResultDoc;
  leaderboardPosition?: number;
}

export class ValidationService {
  constructor(private firestore: Firestore) {}

  async validateAndFinalize(params: FinalizeSessionParams): Promise<FinalizeSessionResult> {
    const sessionRef = this.firestore.collection('competitiveSessions').doc(params.sessionId);

    return await this.firestore.runTransaction(async (tx) => {
      const sessionSnap = await tx.get(sessionRef);
      if (!sessionSnap.exists) {
        const err: any = new Error('Competitive session not found.');
        err.statusCode = 404;
        err.errorCode = 'SESSION_NOT_FOUND';
        throw err;
      }

      const sessionData = sessionSnap.data()!;
      if (sessionData.userId !== params.userId) {
        const err: any = new Error('You are not authorized to submit this session.');
        err.statusCode = 403;
        err.errorCode = 'SESSION_FORBIDDEN';
        throw err;
      }

      // Check submission idempotency
      if (sessionData.submissionIdempotencyKey === params.submissionIdempotencyKey) {
        const existingResultId = sessionData.resultId;
        if (existingResultId) {
          const resSnap = await tx.get(this.firestore.collection('competitiveResults').doc(existingResultId));
          if (resSnap.exists) {
            logger.info('submission_idempotency_hit', { sessionId: params.sessionId });
            return {
              status: sessionData.status,
              result: resSnap.data() as CompetitiveResultDoc,
            };
          }
        }
      }

      if (sessionData.status !== 'ACTIVE') {
        const err: any = new Error(`Session is already finalized with status: ${sessionData.status}`);
        err.statusCode = 409;
        err.errorCode = 'SESSION_ALREADY_FINALIZED';
        throw err;
      }

      const now = Date.now();
      const serverQuestionsMap = new Map<number, Question>();
      const rawStoredQ = sessionData.serverQuestions || {};
      for (const [seqStr, qObj] of Object.entries(rawStoredQ)) {
        serverQuestionsMap.set(Number(seqStr), qObj as Question);
      }

      const receivedAnswerTimes = new Map<number, number>();
      for (const ans of params.answers) {
        receivedAnswerTimes.set(ans.sequence, sessionData.serverStartedAt + ans.clientAnsweredAt);
      }

      const validationInput: ValidationInput = {
        session: {
          sessionId: sessionData.sessionId,
          userId: sessionData.userId,
          mode: sessionData.mode,
          rulesVersion: sessionData.rulesVersion,
          contentVersion: sessionData.contentVersion,
          challengeId: sessionData.challengeId,
          serverStartedAt: sessionData.serverStartedAt,
          serverDeadlineAt: sessionData.serverDeadlineAt,
          status: 'ACTIVE',
          isRanked: sessionData.isRanked,
          idempotencyKey: sessionData.idempotencyKey,
        },
        serverQuestions: serverQuestionsMap,
        submittedAnswers: params.answers,
        serverTimestamps: {
          startedAt: sessionData.serverStartedAt,
          finalizedAt: now,
          receivedAnswerTimes,
        },
      };

      const valOutput = validateCompetitiveSession(validationInput, sessionData.serverSecret);
      const resultDoc = valOutput.result;

      const resultRef = this.firestore.collection('competitiveResults').doc(resultDoc.resultId);
      tx.set(resultRef, resultDoc);

      let leaderboardPosition: number | undefined;

      if (valOutput.leaderboardEligible) {
        const periodKey = sessionData.mode === 'daily'
          ? (sessionData.challengeId?.split('@')[0] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()))
          : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 7); // monthly for sprint/survival

        const entryId = `lb_${sessionData.mode}_${periodKey}_${params.userId}`;
        const lbRef = this.firestore.collection('leaderboardEntries').doc(entryId);

        const lbEntry: LeaderboardEntryDoc = {
          entryId,
          mode: sessionData.mode,
          periodKey,
          rulesVersion: sessionData.rulesVersion,
          contentVersion: sessionData.contentVersion,
          pseudonym: params.pseudonym || 'Pemain Kilat',
          score: resultDoc.score,
          accuracy: resultDoc.accuracy,
          correctCount: resultDoc.correctCount,
          wrongCount: resultDoc.wrongCount,
          durationMs: resultDoc.rankedActiveDurationMs,
          finalizedAt: now,
          resultId: resultDoc.resultId,
        };

        tx.set(lbRef, lbEntry, { merge: true });
      }

      tx.update(sessionRef, {
        status: valOutput.status,
        resultId: resultDoc.resultId,
        submissionIdempotencyKey: params.submissionIdempotencyKey,
        updatedAt: now,
      });

      logger.info('session_finalized', {
        sessionId: params.sessionId,
        status: valOutput.status,
        score: resultDoc.score,
        rejectionReasons: valOutput.rejectionReasons,
      });

      return {
        status: valOutput.status,
        result: resultDoc,
        leaderboardPosition,
      };
    });
  }
}
