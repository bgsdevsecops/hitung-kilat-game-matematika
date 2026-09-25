import { Firestore } from 'firebase-admin/firestore';
import {
  CompetitiveResultDoc,
  LeaderboardEntryDoc,
  SubmittedAnswerPayload,
} from '@engine/competitive/types.js';
import { validateCompetitiveSession, ValidationInput } from '@engine/competitive/validator.js';
import {
  generateLeaderboardSubjectId,
  projectToLeaderboardEntry,
  shouldReplaceLeaderboardEntry,
} from '@engine/competitive/projection.js';
import { Question } from '@engine/types/question.js';
import { validatePseudonym } from '../../../src/utils/privacy/pseudonymValidator.js';
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

function domainError(message: string, statusCode: number, errorCode: string): Error & { statusCode: number; errorCode: string } {
  const err = new Error(message) as Error & { statusCode: number; errorCode: string };
  err.statusCode = statusCode;
  err.errorCode = errorCode;
  return err;
}

function projectionSecret(): string {
  return process.env.LEADERBOARD_PROJECTION_SECRET || 'competitive-leaderboard-v1';
}

function isSubmittedAnswer(value: unknown): value is SubmittedAnswerPayload {
  if (!value || typeof value !== 'object') return false;
  const answer = value as Partial<SubmittedAnswerPayload>;
  return Number.isInteger(answer.sequence)
    && typeof answer.questionToken === 'string'
    && typeof answer.rawInput === 'string'
    && Number.isFinite(answer.clientAnsweredAt)
    && Number.isFinite(answer.inputLatencyMs)
    && typeof answer.idempotencyKey === 'string';
}

function rejectedForMalformedAnswers(
  session: any,
  now: number,
  reason: string,
): CompetitiveResultDoc {
  const base = validateCompetitiveSession({
    session: { ...session, status: 'ACTIVE' },
    serverQuestions: new Map<number, Question>(),
    submittedAnswers: [],
    serverTimestamps: {
      startedAt: session.serverStartedAt,
      finalizedAt: now,
      receivedAnswerTimes: new Map(),
    },
  }, session.serverSecret).result;
  return {
    ...base,
    status: 'REJECTED',
    isRanked: false,
    rejectionReasons: [reason],
  };
}

export class ValidationService {
  constructor(private firestore: Firestore) {}

  async validateAndFinalize(params: FinalizeSessionParams): Promise<FinalizeSessionResult> {
    const sessionRef = this.firestore.collection('competitiveSessions').doc(params.sessionId);

    return await this.firestore.runTransaction(async (tx) => {
      const sessionSnap = await tx.get(sessionRef);
      if (!sessionSnap.exists) throw domainError('Competitive session not found.', 404, 'SESSION_NOT_FOUND');

      const sessionData = sessionSnap.data()!;
      if (sessionData.userId !== params.userId) {
        throw domainError('You are not authorized to submit this session.', 403, 'SESSION_FORBIDDEN');
      }

      if (sessionData.submissionIdempotencyKey === params.submissionIdempotencyKey && sessionData.resultId) {
        const resSnap = await tx.get(this.firestore.collection('competitiveResults').doc(sessionData.resultId));
        if (resSnap.exists) {
          logger.info('submission_idempotency_hit', { sessionId: params.sessionId });
          return { status: sessionData.status, result: resSnap.data() as CompetitiveResultDoc };
        }
      }

      if (sessionData.status !== 'ACTIVE') {
        throw domainError(`Session is already finalized with status: ${sessionData.status}`, 409, 'SESSION_ALREADY_FINALIZED');
      }

      const now = Date.now();
      const malformed = !Array.isArray(params.answers) || params.answers.some((answer) => !isSubmittedAnswer(answer));
      const answers = malformed ? [] : params.answers;
      const serverQuestionsMap = new Map<number, Question>();
      for (const [seqStr, qObj] of Object.entries(sessionData.serverQuestions || {})) {
        serverQuestionsMap.set(Number(seqStr), qObj as Question);
      }

      // `now` is the server-observed receipt/finalization timestamp. Client answer times
      // are never used for deadline checks because they are untrusted input.
      const receivedAnswerTimes = new Map<number, number>();
      for (const answer of answers) receivedAnswerTimes.set(answer.sequence, now);

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
        submittedAnswers: answers,
        serverTimestamps: {
          startedAt: sessionData.serverStartedAt,
          finalizedAt: now,
          receivedAnswerTimes,
        },
      };

      const valOutput = malformed
        ? { status: 'REJECTED' as const, leaderboardEligible: false, rejectionReasons: ['Malformed submitted answer payload'], result: rejectedForMalformedAnswers(validationInput.session, now, 'Malformed submitted answer payload') }
        : validateCompetitiveSession(validationInput, sessionData.serverSecret);
      const resultDoc = valOutput.result;
      tx.set(this.firestore.collection('competitiveResults').doc(resultDoc.resultId), resultDoc);

      if (valOutput.leaderboardEligible) {
        const periodKey = sessionData.mode === 'daily'
          ? (sessionData.challengeId?.split('@')[0] || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()))
          : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 7);
        const pseudonymCheck = validatePseudonym(params.pseudonym || '');
        const publicPseudonym = pseudonymCheck.valid ? pseudonymCheck.sanitized : 'Pemain Kilat';
        const candidate = projectToLeaderboardEntry(resultDoc, publicPseudonym, periodKey, projectionSecret());
        const lbRef = this.firestore.collection('leaderboardEntries').doc(candidate.entryId);
        const existingSnap = await tx.get(lbRef);
        const existing = existingSnap.exists ? existingSnap.data() as LeaderboardEntryDoc : null;
        if (shouldReplaceLeaderboardEntry(existing, candidate)) tx.set(lbRef, candidate, { merge: true });
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
      return { status: valOutput.status, result: resultDoc };
    });
  }
}

export { generateLeaderboardSubjectId };
