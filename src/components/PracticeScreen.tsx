import React, { useState } from 'react';
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
import { randomInt } from '../utils/mathGenerator';

export interface PracticeScreenProps {
  onExit: () => void;
  initialTab?: 'adaptive' | 'remediation' | 'custom';
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
    let primarySkillId = 'addition.single_digit';
    let difficulty = 1;
    let templateFamily = 'addition_basic';

    if (op === '+') {
      const a = randomInt(2, range);
      const b = randomInt(2, range);
      answer = a + b;
      prompt = `${a} + ${b}`;
      primarySkillId = range <= 10 ? 'addition.single_digit' : 'addition.within_20';
      difficulty = range <= 10 ? 1 : range <= 20 ? 2 : 3;
      templateFamily = 'addition_basic';
    } else if (op === '-') {
      const b = randomInt(2, range);
      const a = b + randomInt(1, range);
      answer = a - b;
      prompt = `${a} - ${b}`;
      primarySkillId = range <= 10 ? 'subtraction.single_digit' : 'subtraction.within_20';
      difficulty = range <= 10 ? 1 : range <= 20 ? 2 : 3;
      templateFamily = 'subtraction_basic';
    } else if (op === '*') {
      const a = randomInt(2, Math.min(range, 12));
      const b = randomInt(2, Math.min(range, 12));
      answer = a * b;
      prompt = `${a} × ${b}`;
      primarySkillId = 'multiplication.x2';
      difficulty = 2;
      templateFamily = 'multiplication_basic';
    } else {
      // op === '/'
      const divisor = randomInt(2, Math.min(range, 12));
      const quotient = randomInt(2, Math.min(range, 12));
      const dividend = divisor * quotient;
      answer = quotient;
      prompt = `${dividend} ÷ ${divisor}`;
      primarySkillId = 'division.basic_235';
      difficulty = 2;
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
      templateFamily,
      skillTags: [primarySkillId, op],
      ...({ subSkillId: primarySkillId } as any),
    };
    questions.push(q);
  }

  return questions;
}

export const PracticeScreen: React.FC<PracticeScreenProps> = ({
  onExit,
  initialTab = 'adaptive',
  onOpenStats,
  userId = 'default_user',
}) => {
  const [viewMode, setViewMode] = useState<'hub' | 'playing' | 'summary'>('hub');
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [completedAnswers, setCompletedAnswers] = useState<Question[]>([]);
  const [totalDurationMs, setTotalDurationMs] = useState<number>(0);
  const [lastMode, setLastMode] = useState<'adaptive' | 'remediation' | 'custom' | null>(null);
  const [lastCustomConfig, setLastCustomConfig] = useState<CustomPracticeConfig | null>(null);

  const enrichQuestions = (questions: Question[]): Question[] => {
    return questions.map((q) => ({
      ...q,
      id: q.id || q.questionDefinitionId || q.questionInstanceId || `q_${Math.random()}`,
      subSkillId: (q as any).subSkillId || q.primarySkillId,
    } as Question));
  };

  const handleStartAdaptive = (plan: AdaptiveSessionPlan) => {
    setLastMode('adaptive');
    setCurrentQuestions(enrichQuestions(plan.questions));
    setViewMode('playing');
  };

  const handleStartRemediation = (plan: RemediationSessionPlan) => {
    setLastMode('remediation');
    setCurrentQuestions(enrichQuestions(plan.questions));
    setViewMode('playing');
  };

  const handleStartCustom = (config: CustomPracticeConfig) => {
    setLastMode('custom');
    setLastCustomConfig(config);
    const qs = generateCustomQuestions(config);
    setCurrentQuestions(qs);
    setViewMode('playing');
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
        onExit={() => setViewMode('hub')}
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
        onExit={onExit}
      />
    );
  }

  return (
    <PracticeHubView
      initialTab={initialTab || 'adaptive'}
      onOpenStats={onOpenStats}
      onExit={onExit}
      onStartAdaptive={handleStartAdaptive}
      onStartRemediation={handleStartRemediation}
      onStartCustom={handleStartCustom}
    />
  );
};
