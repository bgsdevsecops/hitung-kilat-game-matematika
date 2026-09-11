import { QuestionGenerator } from './base';
import { AlgebraRule, AlgebraTemplate, Question, GenerationContext } from '../types';
import { randomInt } from '../utils/prng';

export class AlgebraGenerator implements QuestionGenerator<AlgebraRule> {
  readonly key = 'algebra';
  readonly version = 1;

  validateRule(rule: unknown): AlgebraRule {
    const r = rule as AlgebraRule;
    if (!r || r.kind !== 'algebra') {
      throw new Error('Invalid rule: expected algebra');
    }
    const validTemplates: AlgebraTemplate[] = [
      'one_step_add',
      'one_step_sub',
      'two_step_linear',
      'nested_linear',
    ];
    if (!r.template || !validTemplates.includes(r.template)) {
      throw new Error(
        `Invalid AlgebraRule template: expected one of ${validTemplates.join(', ')}`
      );
    }
    if (
      typeof r.minSolution !== 'number' ||
      typeof r.maxSolution !== 'number' ||
      typeof r.minCoefficient !== 'number' ||
      typeof r.maxCoefficient !== 'number' ||
      Number.isNaN(r.minSolution) ||
      Number.isNaN(r.maxSolution) ||
      Number.isNaN(r.minCoefficient) ||
      Number.isNaN(r.maxCoefficient) ||
      r.minSolution > r.maxSolution ||
      r.minCoefficient > r.maxCoefficient
    ) {
      throw new Error(
        'Invalid AlgebraRule bounds: minSolution <= maxSolution and minCoefficient <= maxCoefficient required'
      );
    }
    if (r.variableName !== undefined && !['x', 'y', 'n'].includes(r.variableName)) {
      throw new Error("Invalid AlgebraRule variableName: must be 'x', 'y', or 'n'");
    }
    return r;
  }

  generate(rule: AlgebraRule, prng: () => number, context: GenerationContext): Question {
    const varName = rule.variableName || 'x';
    const x = randomInt(prng, rule.minSolution, rule.maxSolution);

    let displayPrompt: string;
    let explanation: string;

    switch (rule.template) {
      case 'one_step_add': {
        const c = randomInt(prng, 1, 15);
        const d = x + c;
        displayPrompt = `${varName} + ${c} = ${d}`;
        explanation = `${varName} = ${d} - ${c} = ${x}`;
        break;
      }
      case 'one_step_sub': {
        const maxC = x > 1 ? Math.min(15, x - 1) : 15;
        const c = randomInt(prng, 1, maxC);
        const d = x - c;
        displayPrompt = `${varName} - ${c} = ${d}`;
        explanation = `${varName} = ${d} + ${c} = ${x}`;
        break;
      }
      case 'two_step_linear': {
        const minM = Math.max(1, rule.minCoefficient);
        const maxM = Math.max(minM, rule.maxCoefficient);
        const m = randomInt(prng, minM, maxM);
        const isPlus = prng() > 0.5 || m * x <= 1;
        if (isPlus) {
          const c = randomInt(prng, 1, 15);
          const rightHand = m * x + c;
          displayPrompt = `${m}${varName} + ${c} = ${rightHand}`;
          explanation = `${m}${varName} = ${rightHand} - ${c} = ${m * x}. ${varName} = ${m * x} ÷ ${m} = ${x}`;
        } else {
          const maxC = Math.min(15, Math.max(1, m * x - 1));
          const c = randomInt(prng, 1, maxC);
          const rightHand = m * x - c;
          displayPrompt = `${m}${varName} - ${c} = ${rightHand}`;
          explanation = `${m}${varName} = ${rightHand} + ${c} = ${m * x}. ${varName} = ${m * x} ÷ ${m} = ${x}`;
        }
        break;
      }
      case 'nested_linear': {
        const minM = Math.max(2, rule.minCoefficient);
        const maxM = Math.max(minM, rule.maxCoefficient);
        const m = randomInt(prng, minM, maxM);
        const a = randomInt(prng, 1, 3);
        const aStr = a === 1 ? '' : `${a}`;
        const canMinus = a * x > 1;
        const isPlus = canMinus ? prng() > 0.5 : true;

        let b: number;
        let inner: number;
        let op: string;

        if (isPlus) {
          op = '+';
          b = randomInt(prng, 1, 10);
          inner = a * x + b;
        } else {
          op = '-';
          const maxB = Math.min(10, a * x - 1);
          b = randomInt(prng, 1, Math.max(1, maxB));
          inner = a * x - b;
        }

        const total = m * inner;
        displayPrompt = `${m}(${aStr}${varName} ${op} ${b}) = ${total}`;
        explanation = `${aStr}${varName} ${op} ${b} = ${total} ÷ ${m} = ${inner}. Maka ${varName} = ${x}`;
        break;
      }
    }

    const promptToken = displayPrompt.replace(/[\s()]/g, '');

    return {
      questionDefinitionId: `alg-${rule.template}-${promptToken}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt,
      answerSpec: { kind: 'integer', value: x },
      primarySkillId: 'algebra.linear',
      skillTags: ['algebra', 'linear_equation'],
      difficulty: 4,
      generatorKey: this.key,
      targetResponseTimeMs: 4500,
      templateFamily: rule.template,
      explanation,
    };
  }
}
