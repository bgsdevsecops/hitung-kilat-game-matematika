import { LevelConfig, Question as QuestionV1 } from '../../types';
import { LevelConfigV2 } from '../types/level';
import { Question as QuestionV2 } from '../types/question';
import { V1_TO_V2_LEVEL_MAPPING } from '../migration/mapping';

export function adaptV1LevelToV2(v1Level: LevelConfig): LevelConfigV2 {
  const mapping = V1_TO_V2_LEVEL_MAPPING[v1Level.id] || {
    v1Id: v1Level.id,
    primaryLevelId: `LEGACY-${v1Level.id}`,
    order: v1Level.id,
    title: v1Level.title,
  };

  const op = v1Level.operations[0] || '+';
  let generatorKey = 'addition';

  const minA = v1Level.numberRange?.min ?? 1;
  const maxA = v1Level.numberRange?.max ?? v1Level.maxNum1 ?? 10;
  const minB = v1Level.numberRange?.min ?? 1;
  const maxB = v1Level.numberRange?.max ?? v1Level.maxNum2 ?? 10;

  let rules: any = {
    kind: 'addition',
    minA,
    maxA,
    minB,
    maxB,
  };

  if (op === '-') {
    generatorKey = 'subtraction';
    rules = {
      kind: 'subtraction',
      minA,
      maxA,
      minB,
      maxB,
      allowNegative: false,
    };
  } else if (op === '×' || op === '*') {
    generatorKey = 'multiplication';
    rules = {
      kind: 'multiplication',
      minA,
      maxA,
      minB,
      maxB,
    };
  } else if (op === '÷' || op === '/') {
    generatorKey = 'division';
    rules = {
      kind: 'division',
      minDivisor: Math.max(2, minA),
      maxDivisor: maxA,
      minQuotient: 1,
      maxQuotient: 10,
      requireInteger: true,
    };
  }

  let tierVal: 1 | 2 | 3 | 4 | 5 | 6 = 1;
  if (typeof v1Level.tier === 'number') {
    tierVal = (v1Level.tier >= 1 && v1Level.tier <= 6 ? v1Level.tier : 1) as 1 | 2 | 3 | 4 | 5 | 6;
  } else {
    const t = v1Level.tier || v1Level.tierName || '';
    if (t === 'Pemula') tierVal = 1;
    else if (t === 'Menengah') tierVal = 2;
    else if (t === 'Terampil') tierVal = 3;
    else if (t === 'Mahir') tierVal = 4;
    else if (t === 'Master') tierVal = 5;
    else if (t === 'Grandmaster') tierVal = 6;
    else tierVal = 1;
  }

  const questionCount = v1Level.questionCount ?? v1Level.questionsCount ?? 10;
  const timeLimit = v1Level.timeLimit ?? v1Level.timeLimitSec ?? 30;
  const targetTimeSec = Math.round(timeLimit * 0.75);

  const prerequisiteIds: string[] = [];
  if (v1Level.id > 1) {
    const prevMapping = V1_TO_V2_LEVEL_MAPPING[v1Level.id - 1];
    if (prevMapping?.primaryLevelId) {
      prerequisiteIds.push(prevMapping.primaryLevelId);
    }
  }

  return {
    id: mapping.primaryLevelId,
    order: mapping.order,
    tier: tierVal,
    title: v1Level.title,
    description: v1Level.description,
    generatorKey,
    rules,
    answerKind: 'integer',
    difficulty: 1,
    questionCount,
    targetTimeSec,
    timeLimitSec: timeLimit,
    boss: false,
    passingAccuracy: 70,
    prerequisiteIds,
    primarySkillId: `${generatorKey}.basic`,
    skillTags: [generatorKey],
    contentVersion: '2.0.0',
  };
}

export function adaptV2QuestionToV1(qV2: QuestionV2): QuestionV1 {
  let numericAnswer = 0;
  if (qV2.answerSpec.kind === 'integer') {
    numericAnswer = qV2.answerSpec.value;
  } else if (qV2.answerSpec.kind === 'decimal') {
    numericAnswer = qV2.answerSpec.scaledValue / Math.pow(10, qV2.answerSpec.scale);
  } else if (qV2.answerSpec.kind === 'rational') {
    numericAnswer = qV2.answerSpec.denominator !== 0
      ? qV2.answerSpec.numerator / qV2.answerSpec.denominator
      : 0;
  }

  const promptText = qV2.displayPrompt.includes('?')
    ? qV2.displayPrompt
    : `${qV2.displayPrompt} = ?`;

  return {
    id: qV2.questionInstanceId,
    text: promptText,
    prompt: promptText,
    correctAnswer: numericAnswer,
    options: [],
    explanation: qV2.explanation,
  };
}
