import React, { useState, useEffect } from 'react';
import { Question } from '../engine/types/question';
import {
  PracticeHubView,
  CustomPracticeConfig,
} from './practice/PracticeHubView';
import { AdaptivePlayArena } from './practice/AdaptivePlayArena';
import { AdaptiveSummaryView } from './practice/AdaptiveSummaryView';
import { ingestGameAnswers, getMasteryStore, GameAnswerLog } from '../utils/masteryBridge';
import { buildAdaptiveSession, AdaptiveSessionPlan } from '../engine/adaptive';
import { RemediationSessionPlan } from '../engine/remediation';
import { createGeneratorRegistry } from '../engine/registry';
import { LEVEL_MANIFEST_72 } from '../engine/manifest/levels';
import { randomInt } from '../utils/mathGenerator';

export interface PracticeScreenProps {
  onExit: () => void;
  initialTab?: 'adaptive' | 'remediation' | 'custom';
  targetSubSkillId?: string;
  onClearTargetSubSkill?: () => void;
  onOpenStats?: () => void;
  userId?: string;
}

export function generateCustomQuestions(config: CustomPracticeConfig): Question[] {
  const questions: Question[] = [];
  const count = config.questionCount || 10;
  const range = config.numberRange || 20;
  const opChoice = config.operation;

  for (let i = 0; i < count; i++) {
    let op = opChoice;
    if (op === 'mix') {
      const ops: ('+' | '-' | '*' | '/')[] = ['+', '-', '*', '/'];
      op = ops[Math.floor(Math.random() * ops.length)];
    }

    const id = `practice_custom_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
    let prompt = '';
    let answer = 0;
    let primarySkillId = 'addition';
    let subSkillId = 'addition.single_digit';
    let difficulty = 1;
    let templateFamily = 'addition_basic';

    if (op === '+') {
      const a = randomInt(2, range);
      const b = randomInt(2, range);
      answer = a + b;
      prompt = `${a} + ${b}`;
      primarySkillId = 'addition';
      subSkillId = range <= 10 ? 'addition.single_digit' : a + b <= 20 ? 'addition.within_20' : 'addition.carry';
      difficulty = range <= 10 ? 1 : range <= 20 ? 2 : 3;
      templateFamily = 'addition_basic';
    } else if (op === '-') {
      const b = randomInt(2, range);
      const a = b + randomInt(1, range);
      answer = a - b;
      prompt = `${a} - ${b}`;
      primarySkillId = 'subtraction';
      subSkillId = range <= 10 ? 'subtraction.single_digit' : a <= 20 ? 'subtraction.within_20' : 'subtraction.borrow';
      difficulty = range <= 10 ? 1 : range <= 20 ? 2 : 3;
      templateFamily = 'subtraction_basic';
    } else if (op === '*') {
      const a = randomInt(2, Math.min(range, 12));
      const b = randomInt(2, Math.min(range, 12));
      answer = a * b;
      prompt = `${a} × ${b}`;
      primarySkillId = 'multiplication';
      const factor = Math.min(10, Math.max(2, Math.min(a, b)));
      subSkillId = `multiplication.x${factor}`;
      difficulty = factor <= 3 ? 1 : factor <= 5 ? 2 : 3;
      templateFamily = 'multiplication_basic';
    } else {
      // op === '/'
      const divisor = randomInt(2, Math.min(range, 12));
      const quotient = randomInt(2, Math.min(range, 12));
      const dividend = divisor * quotient;
      answer = quotient;
      prompt = `${dividend} ÷ ${divisor}`;
      primarySkillId = 'division';
      subSkillId = (divisor === 2 || divisor === 3 || divisor === 5)
        ? 'division.basic_235'
        : 'division.x4_9_inverse';
      difficulty = subSkillId === 'division.basic_235' ? 2 : 3;
      templateFamily = 'division_clean';
    }

    const q: Question = {
      id,
      questionDefinitionId: id,
      questionInstanceId: id,
      prompt,
      displayPrompt: prompt,
      answerSpec: { kind: 'integer', value: answer },
      correctAnswer: answer,
      difficulty,
      primarySkillId,
      subSkillId,
      templateFamily,
      skillTags: [primarySkillId, subSkillId, op],
    };
    questions.push(q);
  }

  return questions;
}

export function generateQuestionsForSubSkill(subSkillId: string, count: number = 10): Question[] {
  const registry = createGeneratorRegistry();
  const prng = () => Math.random();

  // Try exact match in LEVEL_MANIFEST_72
  let candidates = LEVEL_MANIFEST_72.filter(
    (l) => l.primarySkillId === subSkillId && registry.has(l.generatorKey) && !l.boss
  );

  // Fallback to prefix match
  if (candidates.length === 0) {
    const prefix = subSkillId.split('.')[0];
    candidates = LEVEL_MANIFEST_72.filter(
      (l) => (l.primarySkillId.startsWith(prefix) || l.generatorKey === prefix) && registry.has(l.generatorKey) && !l.boss
    );
  }

  if (candidates.length > 0) {
    const level = candidates[0];
    const generator = registry.get(level.generatorKey)!;
    const questions: Question[] = [];
    const signatures = new Set<string>();

    for (let i = 0; i < count; i++) {
      const ctx = {
        levelId: level.id,
        sequenceIndex: i,
        existingSignatures: signatures,
      };
      const q = generator.generate(level.rules, prng, ctx);
      questions.push({
        ...q,
        id: q.id || `targeted_${subSkillId}_${i}_${Date.now()}`,
        questionDefinitionId: q.id || `targeted_${subSkillId}_${i}`,
        questionInstanceId: q.id || `targeted_${subSkillId}_${i}_${Date.now()}`,
        primarySkillId: subSkillId.includes('.') ? subSkillId.split('.')[0] : subSkillId,
        subSkillId,
        difficulty: level.difficulty || 2,
        skillTags: Array.from(new Set([...(q.skillTags || []), subSkillId, level.generatorKey])),
      });
    }
    return questions;
  }

  // Fallback to custom generator
  const op: '+' | '-' | '*' | '/' = subSkillId.startsWith('multiplication')
    ? '*'
    : subSkillId.startsWith('division')
    ? '/'
    : subSkillId.startsWith('subtraction')
    ? '-'
    : '+';

  const custom = generateCustomQuestions({
    operation: op,
    questionCount: count,
    numberRange: 20,
  });

  return custom.map((q) => ({
    ...q,
    primarySkillId: subSkillId.includes('.') ? subSkillId.split('.')[0] : subSkillId,
    subSkillId,
  }));
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({
  onExit,
  initialTab = 'adaptive',
  targetSubSkillId,
  onClearTargetSubSkill,
  onOpenStats,
  userId = 'default_user',
}) => {
  const [viewMode, setViewMode] = useState<'hub' | 'playing' | 'summary'>('hub');
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [completedAnswers, setCompletedAnswers] = useState<Question[]>([]);
  const [totalDurationMs, setTotalDurationMs] = useState<number>(0);
  const [lastMode, setLastMode] = useState<'adaptive' | 'remediation' | 'custom' | null>(null);
  const [lastCustomConfig, setLastCustomConfig] = useState<CustomPracticeConfig | null>(null);
  const [lastTargetSubSkill, setLastTargetSubSkill] = useState<string | undefined>(targetSubSkillId);

  const enrichQuestions = (questions: Question[]): Question[] => {
    return questions.map((q) => ({
      ...q,
      id: q.id || q.questionDefinitionId || q.questionInstanceId || `q_${Math.random()}`,
      subSkillId: q.subSkillId || q.primarySkillId,
    } as Question));
  };

  useEffect(() => {
    if (targetSubSkillId && initialTab === 'adaptive') {
      setLastMode('adaptive');
      setLastTargetSubSkill(targetSubSkillId);
      const qs = generateQuestionsForSubSkill(targetSubSkillId);
      setCurrentQuestions(enrichQuestions(qs));
      setViewMode('playing');
    }
  }, [targetSubSkillId, initialTab]);

  const handleStartAdaptive = (plan: AdaptiveSessionPlan) => {
    setLastMode('adaptive');
    setLastTargetSubSkill(undefined);
    setCurrentQuestions(enrichQuestions(plan.questions));
    setViewMode('playing');
  };

  const handleStartRemediation = (plan: RemediationSessionPlan) => {
    setLastMode('remediation');
    setLastTargetSubSkill(undefined);
    setCurrentQuestions(enrichQuestions(plan.questions));
    setViewMode('playing');
  };

  const handleStartCustom = (config: CustomPracticeConfig) => {
    setLastMode('custom');
    setLastCustomConfig(config);
    setLastTargetSubSkill(undefined);
    const qs = generateCustomQuestions(config);
    setCurrentQuestions(qs);
    setViewMode('playing');
  };

  const handleExitArena = () => {
    setLastTargetSubSkill(undefined);
    if (onClearTargetSubSkill) onClearTargetSubSkill();
    setViewMode('hub');
  };

  const handleExitScreen = () => {
    setLastTargetSubSkill(undefined);
    if (onClearTargetSubSkill) onClearTargetSubSkill();
    onExit();
  };

  const handleTabChange = (_tab: 'adaptive' | 'remediation' | 'custom') => {
    setLastTargetSubSkill(undefined);
    if (onClearTargetSubSkill) onClearTargetSubSkill();
  };

  const handleFinishArena = (answers: Question[], durationMs: number) => {
    const answerLogs: GameAnswerLog[] = answers.map((q) => {
      const subSkill = (q as any).subSkillId || q.primarySkillId || 'addition.single_digit';
      return {
        questionId: q.id || q.questionDefinitionId || q.questionInstanceId || `practice_${Date.now()}`,
        subSkillId: subSkill,
        primarySkillId: q.primarySkillId || (subSkill.includes('.') ? subSkill.split('.')[0] : subSkill),
        skillTags: q.skillTags,
        templateFamily: q.templateFamily,
        isCorrect: Boolean(q.isCorrect),
        responseTimeMs: q.timeSpentMs ?? 1000,
        difficulty: typeof q.difficulty === 'number' ? q.difficulty : 1,
      };
    });

    ingestGameAnswers(`practice_${Date.now()}`, userId || 'default_user', answerLogs);
    setCompletedAnswers(answers);
    setTotalDurationMs(durationMs);
    setViewMode('summary');
  };

  const handlePlayAgain = () => {
    if (lastMode === 'custom' && lastCustomConfig) {
      const qs = generateCustomQuestions(lastCustomConfig);
      setCurrentQuestions(qs);
      setViewMode('playing');
      return;
    }

    if (lastTargetSubSkill) {
      const qs = generateQuestionsForSubSkill(lastTargetSubSkill);
      setCurrentQuestions(enrichQuestions(qs));
      setViewMode('playing');
      return;
    }

    if (lastMode === 'adaptive') {
      try {
        const store = getMasteryStore();
        const records = store.getAllMasteryRecords();
        const allEvents = store.getAllEvents();
        const failedEvents = allEvents.filter((e) => !e.isCorrect);
        const plan = buildAdaptiveSession({
          registry: createGeneratorRegistry(),
          masteryRecords: records,
          recentErrors: failedEvents.map((evt) => ({
            questionDefinitionId: evt.questionDefinitionId,
            primarySkillId: evt.primarySkillId,
            subSkillId: evt.subSkillId,
            skillTags: evt.skillTags,
            difficulty: evt.difficulty,
            templateFamily: evt.templateFamily,
            targetResponseTimeMs: evt.targetResponseTimeMs,
            responseTimeMs: evt.responseTimeMs,
          })),
        });
        setCurrentQuestions(enrichQuestions(plan.questions));
        setViewMode('playing');
        return;
      } catch (err) {
        setViewMode('hub');
        return;
      }
    }

    setViewMode('hub');
  };

  const handleOpenMasteryMap = () => {
    if (onOpenStats) {
      onOpenStats();
    } else {
      setViewMode('hub');
    }
  };

  if (viewMode === 'playing') {
    return (
      <AdaptivePlayArena
        questions={currentQuestions}
        onExit={handleExitArena}
        onFinish={handleFinishArena}
      />
    );
  }

  if (viewMode === 'summary') {
    return (
      <AdaptiveSummaryView
        answers={completedAnswers}
        durationMs={totalDurationMs}
        onPlayAgain={handlePlayAgain}
        onOpenMasteryMap={handleOpenMasteryMap}
        onExit={handleExitScreen}
      />
    );
  }

  return (
    <PracticeHubView
      initialTab={initialTab || 'adaptive'}
      onTabChange={handleTabChange}
      onOpenStats={onOpenStats}
      onExit={handleExitScreen}
      onStartAdaptive={handleStartAdaptive}
      onStartRemediation={handleStartRemediation}
      onStartCustom={handleStartCustom}
    />
  );
};
