import {
  CompetitiveMode,
  CompetitiveQuestionView,
  CompetitiveSessionContract,
} from './types';
import { Question } from '../types/question';

export interface InternalSessionState {
  contract: CompetitiveSessionContract;
  bufferedViews: CompetitiveQuestionView[];
  acknowledgedSequences: Set<number>;
  serverQuestions: Map<number, Question>;
}

export function generateQuestionToken(
  sessionId: string,
  sequence: number,
  instanceId: string,
  secret: string
): string {
  let hash = 0;
  const raw = `${sessionId}:${sequence}:${instanceId}:${secret}`;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `tok_${Math.abs(hash).toString(16)}_${sequence}`;
}

export function verifyQuestionToken(
  view: CompetitiveQuestionView,
  sessionId: string,
  secret: string
): boolean;
export function verifyQuestionToken(
  token: string,
  sessionId: string,
  sequence: number,
  instanceId: string,
  secret: string
): boolean;
export function verifyQuestionToken(
  viewOrToken: CompetitiveQuestionView | string,
  sessionId: string,
  secretOrSequence: string | number,
  instanceId?: string,
  secret?: string
): boolean {
  if (typeof viewOrToken === 'object' && viewOrToken !== null) {
    const view = viewOrToken;
    const secretKey = secretOrSequence as string;
    const expected = generateQuestionToken(sessionId, view.sequence, view.questionInstanceId, secretKey);
    return view.questionToken === expected;
  }
  const token = viewOrToken;
  const sequence = secretOrSequence as number;
  const expected = generateQuestionToken(sessionId, sequence, instanceId!, secret!);
  return token === expected;
}

function resolveAnswerInputKind(q: Question): 'numeric' | 'fraction' | 'decimal' {
  const kind = (q.answerSpec as any)?.kind;
  if (kind === 'rational' || kind === 'fraction') return 'fraction';
  if (kind === 'decimal') return 'decimal';
  return 'numeric';
}

function extractQuestionDetails(q: Question) {
  const instanceId = ((q as any).id || (q as any).questionInstanceId || '') as string;
  const prompt = ((q as any).prompt || (q as any).displayPrompt || (q as any).renderedPrompt || '') as string;
  const answerInputKind = resolveAnswerInputKind(q);
  const constraints = (q.answerSpec as any)?.constraints;
  return { instanceId, prompt, answerInputKind, constraints };
}

export function createCompetitiveSession(params: {
  sessionId: string;
  userId: string;
  mode: CompetitiveMode;
  rulesVersion: string;
  contentVersion: string;
  challengeId?: string;
  serverStartedAt: number;
  initialQuestions: Question[];
  secret: string;
  isRanked?: boolean;
}): InternalSessionState {
  const deadlineDelta = params.mode === 'sprint' ? 60000 : params.mode === 'daily' ? 90000 : 600000;
  const contract: CompetitiveSessionContract = {
    sessionId: params.sessionId,
    userId: params.userId,
    mode: params.mode,
    rulesVersion: params.rulesVersion,
    contentVersion: params.contentVersion,
    challengeId: params.challengeId,
    serverStartedAt: params.serverStartedAt,
    serverDeadlineAt: params.serverStartedAt + deadlineDelta,
    status: 'ACTIVE',
    isRanked: params.isRanked ?? true,
    idempotencyKey: `start_${params.sessionId}`,
  };

  const serverQuestions = new Map<number, Question>();
  const bufferedViews: CompetitiveQuestionView[] = params.initialQuestions.map((q, idx) => {
    const seq = idx + 1;
    serverQuestions.set(seq, q);
    const { instanceId, prompt, answerInputKind, constraints } = extractQuestionDetails(q);
    return {
      questionInstanceId: instanceId,
      sequence: seq,
      renderedPrompt: prompt,
      answerInputKind,
      ...(constraints ? { constraints } : {}),
      questionToken: generateQuestionToken(params.sessionId, seq, instanceId, params.secret),
    };
  });

  return {
    contract,
    bufferedViews,
    acknowledgedSequences: new Set<number>(),
    serverQuestions,
  };
}

export function advanceSessionBuffer(
  state: InternalSessionState,
  ackSequences: number[],
  newQuestions: Question[],
  secret: string
): InternalSessionState {
  for (const seq of ackSequences) {
    state.acknowledgedSequences.add(seq);
  }

  const remaining = state.bufferedViews.filter((v) => !state.acknowledgedSequences.has(v.sequence));
  let lastSeq = Math.max(
    0,
    ...Array.from(state.serverQuestions.keys()),
    ...state.bufferedViews.map((v) => v.sequence)
  );

  const newViews: CompetitiveQuestionView[] = [];
  for (const q of newQuestions) {
    lastSeq += 1;
    state.serverQuestions.set(lastSeq, q);
    const { instanceId, prompt, answerInputKind, constraints } = extractQuestionDetails(q);
    newViews.push({
      questionInstanceId: instanceId,
      sequence: lastSeq,
      renderedPrompt: prompt,
      answerInputKind,
      ...(constraints ? { constraints } : {}),
      questionToken: generateQuestionToken(state.contract.sessionId, lastSeq, instanceId, secret),
    });
  }

  return {
    ...state,
    bufferedViews: [...remaining, ...newViews],
  };
}
