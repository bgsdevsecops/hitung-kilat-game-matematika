import { QuestionGenerator } from './base';
import { BodmasRule, BodmasTemplate, Question, GenerationContext } from '../types';
import { randomInt } from '../utils/prng';

const VALID_BODMAS_TEMPLATES: readonly BodmasTemplate[] = [
  'a_plus_b_times_c',
  'a_times_b_plus_c',
  'a_times_b_minus_c',
  'a_minus_b_div_c',
  'a_div_b_plus_c',
  'paren_add_div_c',
  'paren_sub_mul_c',
  'paren_nested_bodmas',
] as const;

export class BodmasGenerator implements QuestionGenerator<BodmasRule> {
  readonly key = 'bodmas';
  readonly version = 1;

  validateRule(rule: unknown): BodmasRule {
    const r = rule as BodmasRule;
    if (!r || typeof r !== 'object' || r.kind !== 'bodmas') {
      throw new Error('Invalid rule: expected bodmas');
    }
    if (!r.template) {
      throw new Error('BodmasRule requires template');
    }
    if (!VALID_BODMAS_TEMPLATES.includes(r.template)) {
      throw new Error(`Invalid BodmasRule template: ${r.template}`);
    }
    if (
      typeof r.minOperand !== 'number' ||
      typeof r.maxOperand !== 'number' ||
      Number.isNaN(r.minOperand) ||
      Number.isNaN(r.maxOperand) ||
      r.minOperand > r.maxOperand
    ) {
      throw new Error('Invalid BodmasRule operand bounds');
    }
    return r;
  }

  generate(rule: BodmasRule, prng: () => number, context: GenerationContext): Question {
    let displayPrompt = '';
    let answerValue = 0;
    let explanation = '';

    switch (rule.template) {
      case 'a_plus_b_times_c': {
        const a = randomInt(prng, rule.minOperand, rule.maxOperand);
        const b = randomInt(prng, rule.minOperand, rule.maxOperand);
        const c = randomInt(prng, rule.minOperand, rule.maxOperand);
        displayPrompt = `${a} + ${b} × ${c}`;
        answerValue = a + b * c;
        explanation = `Kerjakan perkalian dulu: ${b} × ${c} = ${b * c}. Lalu ${a} + ${b * c} = ${answerValue}`;
        break;
      }
      case 'a_times_b_plus_c': {
        const a = randomInt(prng, rule.minOperand, rule.maxOperand);
        const b = randomInt(prng, rule.minOperand, rule.maxOperand);
        const c = randomInt(prng, rule.minOperand, rule.maxOperand);
        displayPrompt = `${a} × ${b} + ${c}`;
        answerValue = a * b + c;
        explanation = `Kerjakan perkalian dulu: ${a} × ${b} = ${a * b}. Lalu ${a * b} + ${c} = ${answerValue}`;
        break;
      }
      case 'a_times_b_minus_c': {
        const a = randomInt(prng, rule.minOperand, rule.maxOperand);
        const b = randomInt(prng, rule.minOperand, rule.maxOperand);
        const product = a * b;
        const c = randomInt(prng, 1, Math.min(rule.maxOperand, Math.max(1, product - 1)));
        displayPrompt = `${a} × ${b} - ${c}`;
        answerValue = product - c;
        explanation = `Kerjakan perkalian dulu: ${a} × ${b} = ${product}. Lalu ${product} - ${c} = ${answerValue}`;
        break;
      }
      case 'a_minus_b_div_c': {
        const c = randomInt(prng, Math.max(2, rule.minOperand), Math.max(2, rule.maxOperand));
        const quotient = randomInt(prng, 1, rule.maxOperand);
        const b = c * quotient;
        const a = randomInt(prng, b + 1, b + rule.maxOperand);
        displayPrompt = `${a} - ${b} ÷ ${c}`;
        answerValue = a - quotient;
        explanation = `Kerjakan pembagian dulu: ${b} ÷ ${c} = ${quotient}. Lalu ${a} - ${quotient} = ${answerValue}`;
        break;
      }
      case 'a_div_b_plus_c': {
        const b = randomInt(prng, Math.max(2, rule.minOperand), Math.max(2, rule.maxOperand));
        const quotient = randomInt(prng, 1, rule.maxOperand);
        const a = b * quotient;
        const c = randomInt(prng, rule.minOperand, rule.maxOperand);
        displayPrompt = `${a} ÷ ${b} + ${c}`;
        answerValue = quotient + c;
        explanation = `Kerjakan pembagian dulu: ${a} ÷ ${b} = ${quotient}. Lalu ${quotient} + ${c} = ${answerValue}`;
        break;
      }
      case 'paren_add_div_c': {
        const c = randomInt(prng, Math.max(2, rule.minOperand), Math.max(2, rule.maxOperand));
        const quotient = randomInt(prng, 2, Math.max(2, rule.maxOperand));
        const total = c * quotient;
        const a = randomInt(prng, 1, total - 1);
        const b = total - a;
        displayPrompt = `(${a} + ${b}) ÷ ${c}`;
        answerValue = quotient;
        explanation = `Kerjakan dalam kurung dulu: ${a} + ${b} = ${total}. Lalu ${total} ÷ ${c} = ${answerValue}`;
        break;
      }
      case 'paren_sub_mul_c': {
        const diff = randomInt(prng, 1, rule.maxOperand);
        const b = randomInt(prng, 1, rule.maxOperand);
        const a = b + diff;
        const c = randomInt(prng, 2, Math.max(2, rule.maxOperand));
        displayPrompt = `(${a} - ${b}) × ${c}`;
        answerValue = diff * c;
        explanation = `Kerjakan dalam kurung dulu: ${a} - ${b} = ${diff}. Lalu ${diff} × ${c} = ${answerValue}`;
        break;
      }
      case 'paren_nested_bodmas': {
        const a = randomInt(prng, rule.minOperand, rule.maxOperand);
        const b = randomInt(prng, 2, Math.max(2, rule.maxOperand));
        const diff = randomInt(prng, 1, 5);
        const d = randomInt(prng, 1, 10);
        const c = d + diff;
        displayPrompt = `${a} + ${b} × (${c} - ${d})`;
        answerValue = a + b * diff;
        explanation = `Kurung: ${c} - ${d} = ${diff}. Kali: ${b} × ${diff} = ${b * diff}. Tambah: ${a} + ${b * diff} = ${answerValue}`;
        break;
      }
    }

    const promptToken = displayPrompt.replace(/[\s()]/g, '');

    return {
      questionDefinitionId: `bodmas-${rule.template}-${promptToken}`,
      questionInstanceId: `${context.levelId}:${context.sequenceIndex}`,
      displayPrompt,
      answerSpec: { kind: 'integer', value: answerValue },
      primarySkillId: 'arithmetic.bodmas',
      skillTags: ['bodmas', 'precedence'],
      difficulty: 3,
      generatorKey: this.key,
      targetResponseTimeMs: 4000,
      templateFamily: rule.template,
      explanation,
    };
  }
}
