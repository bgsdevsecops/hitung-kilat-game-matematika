import { QuestionGenerator } from './base';
import { ChainRule, Question, GenerationContext } from '../types';
import { randomInt } from '../utils/prng';

export class ChainArithmeticGenerator implements QuestionGenerator<ChainRule> {
  readonly key = 'chain';
  readonly version = 1;

  validateRule(rule: unknown): ChainRule {
    const r = rule as ChainRule;
    if (!r || r.kind !== 'chain') {
      throw new Error('Invalid rule: expected chain');
    }
    if (!Array.isArray(r.operators) || r.operators.length === 0) {
      throw new Error('ChainRule requires non-empty operators');
    }
    if (r.operators.some((op) => op !== '+' && op !== '-')) {
      throw new Error('ChainRule operators must only contain + or -');
    }
    if (r.termsCount !== 3 && r.termsCount !== 4) {
      throw new Error('ChainRule termsCount must be 3 or 4');
    }
    if (
      typeof r.minOperand !== 'number' ||
      typeof r.maxOperand !== 'number' ||
      Number.isNaN(r.minOperand) ||
      Number.isNaN(r.maxOperand) ||
      r.minOperand > r.maxOperand
    ) {
      throw new Error('Invalid ChainRule operand bounds');
    }
    return r;
  }

  generate(rule: ChainRule, prng: () => number, context: GenerationContext): Question {
    const termsCount = rule.termsCount;
    const allowNegative = rule.allowIntermediateNegative ?? false;

    let terms: number[] = [];
    let ops: Array<'+' | '-'> = [];
    let currentVal = 0;

    // Retry loop to ensure non-negative intermediates if disallowed
    let attempts = 0;
    while (attempts < 50) {
      attempts++;
      const candidateTerms = [randomInt(prng, rule.minOperand, rule.maxOperand)];
      const candidateOps: Array<'+' | '-'> = [];
      let candidateVal = candidateTerms[0];
      let valid = true;

      for (let i = 1; i < termsCount; i++) {
        const op = rule.operators[Math.floor(prng() * rule.operators.length)];
        const nextTerm = randomInt(prng, rule.minOperand, rule.maxOperand);
        const nextVal = op === '+' ? candidateVal + nextTerm : candidateVal - nextTerm;

        if (!allowNegative && nextVal < 0) {
          valid = false;
          break;
        }

        candidateOps.push(op);
        candidateTerms.push(nextTerm);
        candidateVal = nextVal;
      }

      if (valid && (!allowNegative ? candidateVal >= 0 : true)) {
        terms = candidateTerms;
        ops = candidateOps;
        currentVal = candidateVal;
        break;
      }
    }

    if (terms.length === 0) {
      // Fallback in case 50 attempts didn't yield a valid chain
      terms = [Math.max(rule.minOperand, rule.maxOperand)];
      ops = [];
      currentVal = terms[0];
      for (let i = 1; i < termsCount; i++) {
        const op = !allowNegative && rule.operators.includes('+') ? '+' : rule.operators[0];
        let nextTerm = randomInt(prng, rule.minOperand, rule.maxOperand);
        if (!allowNegative && op === '-' && nextTerm > currentVal) {
          nextTerm = Math.max(0, currentVal);
        }
        ops.push(op);
        terms.push(nextTerm);
        currentVal = op === '+' ? currentVal + nextTerm : currentVal - nextTerm;
      }
    }

    // Build prompt and explanation
    let displayPrompt = `${terms[0]}`;
    let explanationSteps = `${terms[0]}`;
    let runningVal = terms[0];

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const nextTerm = terms[i + 1];
      displayPrompt += ` ${op} ${nextTerm}`;
      const prevVal = runningVal;
      runningVal = op === '+' ? runningVal + nextTerm : runningVal - nextTerm;
      if (i === 0) {
        explanationSteps = `${prevVal} ${op} ${nextTerm} = ${runningVal}`;
      } else {
        explanationSteps += `, lalu ${prevVal} ${op} ${nextTerm} = ${runningVal}`;
      }
    }

    return {
      questionDefinitionId: `chain-${termsCount}-${terms.join('_')}-${ops.join('')}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt,
      answerSpec: { kind: 'integer', value: currentVal },
      primarySkillId: 'arithmetic.chain',
      skillTags: ['chain', 'arithmetic'],
      difficulty: termsCount === 3 ? 2 : 3,
      generatorKey: this.key,
      targetResponseTimeMs: termsCount === 3 ? 3500 : 4500,
      templateFamily: `chain_${termsCount}_terms`,
      explanation: `${displayPrompt} = ${currentVal} (${explanationSteps})`,
    };
  }
}
