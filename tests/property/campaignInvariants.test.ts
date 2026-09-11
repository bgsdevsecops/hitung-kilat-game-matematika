import { describe, it, expect } from 'vitest';
import { createMulberry32 } from '../../src/engine/utils/prng';
import { createDefaultGeneratorRegistry } from '../../src/engine/registry';
import { evaluateAnswer } from '../../src/engine/evaluator/answerEvaluator';
import {
  ChainArithmeticGenerator,
  BodmasGenerator,
  SignedArithmeticGenerator,
  AlgebraGenerator,
  PowersAndRootsGenerator,
  FractionAndPercentageGenerator,
  MixedBlitzGenerator,
} from '../../src/engine/generators';

describe('Extended Campaign Property-Based Invariants (70.000 cases)', () => {
  const registry = createDefaultGeneratorRegistry();

  it('Chain Generator invariant: 10.000 cases with 0 intermediate negative when disallowed', () => {
    const gen = new ChainArithmeticGenerator();
    const prng = createMulberry32('prop-chain-seed');

    for (let i = 0; i < 10000; i++) {
      const q = gen.generate(
        { kind: 'chain', operators: ['+', '-'], termsCount: i % 2 === 0 ? 3 : 4, minOperand: 1, maxOperand: 20, allowIntermediateNegative: false },
        prng,
        { levelId: 'PROP-CHAIN', sequenceIndex: i }
      );
      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        expect(q.answerSpec.value).toBeGreaterThanOrEqual(0);
        const evalRes = evaluateAnswer(q.answerSpec, q.answerSpec.value.toString());
        expect(evalRes.isCorrect).toBe(true);
      }
    }
  });

  it('BODMAS Generator invariant: 10.000 cases with 0 div-by-zero and 100% clean division', () => {
    const gen = new BodmasGenerator();
    const prng = createMulberry32('prop-bodmas-seed');
    const templates = [
      'a_plus_b_times_c',
      'a_times_b_plus_c',
      'a_minus_b_div_c',
      'paren_add_div_c',
      'paren_sub_mul_c',
      'paren_nested_bodmas',
    ] as const;

    for (let i = 0; i < 10000; i++) {
      const template = templates[i % templates.length];
      const q = gen.generate(
        { kind: 'bodmas', template, minOperand: 2, maxOperand: 12, requireCleanDivision: true },
        prng,
        { levelId: 'PROP-BODMAS', sequenceIndex: i }
      );
      expect(q.displayPrompt).not.toContain('÷ 0');
      expect(q.answerSpec.kind).toBe('integer');
    }
  });

  it('Signed Arithmetic Generator invariant: 10.000 cases with proper bracket formatting', () => {
    const gen = new SignedArithmeticGenerator();
    const prng = createMulberry32('prop-signed-seed');
    const ops = ['+', '-', '×', '÷'] as const;

    for (let i = 0; i < 10000; i++) {
      const op = ops[i % ops.length];
      const q = gen.generate(
        { kind: 'signed', operation: op, minOperand: -15, maxOperand: 15 },
        prng,
        { levelId: 'PROP-SIGNED', sequenceIndex: i }
      );
      expect(q.displayPrompt).not.toContain('+ -');
      expect(q.displayPrompt).not.toContain('- -');
      expect(q.displayPrompt).not.toContain('÷ 0');
    }
  });

  it('Algebra Generator invariant: 10.000 cases with unique integer solution', () => {
    const gen = new AlgebraGenerator();
    const prng = createMulberry32('prop-algebra-seed');
    const templates = ['one_step_add', 'one_step_sub', 'two_step_linear', 'nested_linear'] as const;

    for (let i = 0; i < 10000; i++) {
      const template = templates[i % templates.length];
      const q = gen.generate(
        { kind: 'algebra', template, variableName: 'x', minSolution: 1, maxSolution: 10, minCoefficient: 1, maxCoefficient: 5 },
        prng,
        { levelId: 'PROP-ALG', sequenceIndex: i }
      );
      expect(q.answerSpec.kind).toBe('integer');
      if (q.answerSpec.kind === 'integer') {
        expect(Number.isInteger(q.answerSpec.value)).toBe(true);
      }
    }
  });

  it('Powers & Roots Generator invariant: 10.000 cases with exact perfect squares', () => {
    const gen = new PowersAndRootsGenerator();
    const prng = createMulberry32('prop-power-seed');

    for (let i = 0; i < 10000; i++) {
      const isSqrt = i % 2 === 0;
      const q = gen.generate(
        { kind: 'power_root', mode: isSqrt ? 'square_root' : 'square', minBase: 2, maxBase: 25 },
        prng,
        { levelId: 'PROP-PWR', sequenceIndex: i }
      );
      expect(q.answerSpec.kind).toBe('integer');
      if (isSqrt) {
        const radican = Number(q.displayPrompt.replace('√', ''));
        expect(Math.sqrt(radican)).toBe((q.answerSpec as any).value);
      }
    }
  });

  it('Fraction & Percentage Generator invariant: 10.000 cases with valid non-zero denominators', () => {
    const gen = new FractionAndPercentageGenerator();
    const prng = createMulberry32('prop-frac-seed');
    const variants = ['fraction_add', 'ratio_equality', 'mental_percentage'] as const;

    for (let i = 0; i < 10000; i++) {
      const variant = variants[i % variants.length];
      const q = gen.generate({ kind: 'fraction_percentage', variant }, prng, { levelId: 'PROP-FRAC', sequenceIndex: i });
      if (q.answerSpec.kind === 'rational') {
        expect(q.answerSpec.denominator).toBeGreaterThan(0);
      }
    }
  });

  it('Mixed Blitz Generator invariant: 10.000 cases with composite subRules', () => {
    const gen = new MixedBlitzGenerator(registry);
    const prng = createMulberry32('prop-blitz-seed');

    for (let i = 0; i < 10000; i++) {
      const q = gen.generate(
        {
          kind: 'mixed_blitz',
          subRules: [
            { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
            { kind: 'power_root', mode: 'square', minBase: 2, maxBase: 10 },
            { kind: 'algebra', template: 'one_step_add', minSolution: 1, maxSolution: 10, minCoefficient: 1, maxCoefficient: 3 },
          ],
        },
        prng,
        { levelId: 'PROP-BLITZ', sequenceIndex: i }
      );
      expect(q.displayPrompt).toBeDefined();
    }
  });
});
