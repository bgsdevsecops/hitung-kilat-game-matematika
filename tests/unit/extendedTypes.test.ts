import { describe, it, expect } from 'vitest';
import {
  GeneratorRule,
  ChainRule,
  BodmasRule,
  SignedRule,
  AlgebraRule,
  PowerRootRule,
  FractionPercentageRule,
  MixedBlitzRule,
} from '../../src/engine/types';

describe('Extended Domain Rules Types', () => {
  it('instantiates valid ChainRule', () => {
    const rule: ChainRule = {
      kind: 'chain',
      operators: ['+', '-'],
      termsCount: 3,
      minOperand: 1,
      maxOperand: 20,
      allowIntermediateNegative: false,
    };
    expect(rule.kind).toBe('chain');
    expect(rule.termsCount).toBe(3);
  });

  it('instantiates valid BodmasRule', () => {
    const rule: BodmasRule = {
      kind: 'bodmas',
      template: 'a_plus_b_times_c',
      minOperand: 1,
      maxOperand: 10,
      requireCleanDivision: true,
    };
    expect(rule.kind).toBe('bodmas');
  });

  it('instantiates valid SignedRule', () => {
    const rule: SignedRule = {
      kind: 'signed',
      operation: '+',
      minOperand: -20,
      maxOperand: 20,
    };
    expect(rule.kind).toBe('signed');
  });

  it('instantiates valid AlgebraRule', () => {
    const rule: AlgebraRule = {
      kind: 'algebra',
      template: 'two_step_linear',
      variableName: 'x',
      minSolution: 1,
      maxSolution: 10,
      minCoefficient: 1,
      maxCoefficient: 5,
    };
    expect(rule.kind).toBe('algebra');
  });

  it('instantiates valid PowerRootRule', () => {
    const rule: PowerRootRule = {
      kind: 'power_root',
      mode: 'square',
      minBase: 1,
      maxBase: 25,
    };
    expect(rule.kind).toBe('power_root');
  });

  it('instantiates valid FractionPercentageRule', () => {
    const rule: FractionPercentageRule = {
      kind: 'fraction_percentage',
      variant: 'mental_percentage',
    };
    expect(rule.kind).toBe('fraction_percentage');
  });

  it('instantiates valid MixedBlitzRule as a discriminated union member', () => {
    const rule: GeneratorRule = {
      kind: 'mixed_blitz',
      subRules: [
        { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
        { kind: 'power_root', mode: 'square', minBase: 1, maxBase: 10 },
      ],
    };
    expect(rule.kind).toBe('mixed_blitz');
  });
});
