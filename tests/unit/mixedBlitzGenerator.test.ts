import { describe, it, expect } from 'vitest';
import {
  QuestionGeneratorRegistry,
  createDefaultGeneratorRegistry,
  generatorRegistry,
} from '../../src/engine/registry';
import {
  MixedBlitzGenerator,
  AdditionGenerator,
  SubtractionGenerator,
  MultiplicationGenerator,
  DivisionGenerator,
  MissingOperandGenerator,
  ChainArithmeticGenerator,
  BodmasGenerator,
  SignedArithmeticGenerator,
  AlgebraGenerator,
  PowersAndRootsGenerator,
  FractionAndPercentageGenerator,
} from '../../src/engine/generators';
import { MixedBlitzRule, LevelConfigV2 } from '../../src/engine/types';
import { createMulberry32 } from '../../src/engine/utils/prng';

const EXPECTED_12_KEYS = [
  'addition',
  'subtraction',
  'multiplication',
  'division',
  'missing_operand',
  'chain',
  'bodmas',
  'signed',
  'algebra',
  'power_root',
  'fraction_percentage',
  'mixed_blitz',
] as const;

describe('QuestionGeneratorRegistry Integration & Key Registration', () => {
  it('has getRegisteredKeys() returning all registered keys', () => {
    const registry = new QuestionGeneratorRegistry();
    expect(registry.getRegisteredKeys()).toEqual([]);

    registry.register(new AdditionGenerator());
    expect(registry.getRegisteredKeys()).toEqual(['addition']);

    registry.register(new SubtractionGenerator());
    expect(registry.getRegisteredKeys()).toEqual(['addition', 'subtraction']);
  });

  it('createDefaultGeneratorRegistry() registers all 12 generator keys', () => {
    const registry = createDefaultGeneratorRegistry();
    const registeredKeys = registry.getRegisteredKeys();

    expect(registeredKeys).toHaveLength(12);
    for (const key of EXPECTED_12_KEYS) {
      expect(registry.has(key)).toBe(true);
      expect(registeredKeys).toContain(key);
    }
  });

  it('generatorRegistry singleton contains all 12 generators with correct instances', () => {
    expect(generatorRegistry.getRegisteredKeys()).toHaveLength(12);

    expect(generatorRegistry.get('addition')).toBeInstanceOf(AdditionGenerator);
    expect(generatorRegistry.get('subtraction')).toBeInstanceOf(SubtractionGenerator);
    expect(generatorRegistry.get('multiplication')).toBeInstanceOf(MultiplicationGenerator);
    expect(generatorRegistry.get('division')).toBeInstanceOf(DivisionGenerator);
    expect(generatorRegistry.get('missing_operand')).toBeInstanceOf(MissingOperandGenerator);
    expect(generatorRegistry.get('chain')).toBeInstanceOf(ChainArithmeticGenerator);
    expect(generatorRegistry.get('bodmas')).toBeInstanceOf(BodmasGenerator);
    expect(generatorRegistry.get('signed')).toBeInstanceOf(SignedArithmeticGenerator);
    expect(generatorRegistry.get('algebra')).toBeInstanceOf(AlgebraGenerator);
    expect(generatorRegistry.get('power_root')).toBeInstanceOf(PowersAndRootsGenerator);
    expect(generatorRegistry.get('fraction_percentage')).toBeInstanceOf(
      FractionAndPercentageGenerator
    );
    expect(generatorRegistry.get('mixed_blitz')).toBeInstanceOf(MixedBlitzGenerator);
  });
});

describe('MixedBlitzGenerator', () => {
  it('has key "mixed_blitz" and version 1', () => {
    const registry = createDefaultGeneratorRegistry();
    const generator = new MixedBlitzGenerator(registry);

    expect(generator.key).toBe('mixed_blitz');
    expect(generator.version).toBe(1);
  });

  describe('validateRule', () => {
    it('accepts valid MixedBlitzRule with multiple subRules', () => {
      const registry = createDefaultGeneratorRegistry();
      const generator = new MixedBlitzGenerator(registry);

      const validRule: MixedBlitzRule = {
        kind: 'mixed_blitz',
        subRules: [
          { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
          { kind: 'subtraction', minA: 10, maxA: 20, minB: 1, maxB: 10 },
          { kind: 'multiplication', minA: 2, maxA: 9, minB: 2, maxB: 9 },
          {
            kind: 'algebra',
            template: 'one_step_add',
            minSolution: 1,
            maxSolution: 10,
            minCoefficient: 1,
            maxCoefficient: 1,
          },
        ],
      };

      const validated = generator.validateRule(validRule);
      expect(validated).toBeDefined();
      expect(validated.kind).toBe('mixed_blitz');
      expect(validated.subRules).toHaveLength(4);
    });

    it('rejects null, undefined, and non-object inputs', () => {
      const registry = createDefaultGeneratorRegistry();
      const generator = new MixedBlitzGenerator(registry);

      expect(() => generator.validateRule(null)).toThrow(/Invalid rule.*mixed_blitz/);
      expect(() => generator.validateRule(undefined)).toThrow(/Invalid rule.*mixed_blitz/);
      expect(() => generator.validateRule('string')).toThrow(/Invalid rule.*mixed_blitz/);
      expect(() => generator.validateRule(123)).toThrow(/Invalid rule.*mixed_blitz/);
      expect(() => generator.validateRule({})).toThrow(/Invalid rule.*mixed_blitz/);
      expect(() => generator.validateRule({ kind: 'addition' })).toThrow(
        /Invalid rule.*mixed_blitz/
      );
    });

    it('rejects empty or non-array subRules', () => {
      const registry = createDefaultGeneratorRegistry();
      const generator = new MixedBlitzGenerator(registry);

      expect(() =>
        generator.validateRule({
          kind: 'mixed_blitz',
          subRules: [],
        })
      ).toThrow(/non-empty subRules/);

      expect(() =>
        generator.validateRule({
          kind: 'mixed_blitz',
          subRules: null,
        })
      ).toThrow(/non-empty subRules/);

      expect(() =>
        generator.validateRule({
          kind: 'mixed_blitz',
          subRules: 'not-an-array',
        })
      ).toThrow(/non-empty subRules/);
    });

    it('rejects malformed subRule or subRule with missing kind', () => {
      const registry = createDefaultGeneratorRegistry();
      const generator = new MixedBlitzGenerator(registry);

      expect(() =>
        generator.validateRule({
          kind: 'mixed_blitz',
          subRules: [null as any],
        })
      ).toThrow();

      expect(() =>
        generator.validateRule({
          kind: 'mixed_blitz',
          subRules: [{ minA: 1 } as any],
        })
      ).toThrow();
    });

    it('rejects unregistered subRule kinds', () => {
      const registry = createDefaultGeneratorRegistry();
      const generator = new MixedBlitzGenerator(registry);

      expect(() =>
        generator.validateRule({
          kind: 'mixed_blitz',
          subRules: [{ kind: 'quantum_calculus' } as any],
        })
      ).toThrow(/Unregistered subRule kind/);
    });

    it('rejects subRules that fail their own generator validation', () => {
      const registry = createDefaultGeneratorRegistry();
      const generator = new MixedBlitzGenerator(registry);

      // Invalid addition rule: minA > maxA
      expect(() =>
        generator.validateRule({
          kind: 'mixed_blitz',
          subRules: [{ kind: 'addition', minA: 50, maxA: 10, minB: 1, maxB: 10 }],
        })
      ).toThrow(/Invalid AdditionRule bounds/);

      // Invalid bodmas rule: invalid template
      expect(() =>
        generator.validateRule({
          kind: 'mixed_blitz',
          subRules: [{ kind: 'bodmas', template: 'invalid_template' as any, minOperand: 1, maxOperand: 10 }],
        })
      ).toThrow();
    });
  });

  describe('generate', () => {
    it('correctly delegates generation across subRules using PRNG', () => {
      const registry = createDefaultGeneratorRegistry();
      const generator = new MixedBlitzGenerator(registry);

      const rule: MixedBlitzRule = {
        kind: 'mixed_blitz',
        subRules: [
          { kind: 'addition', minA: 5, maxA: 5, minB: 5, maxB: 5 }, // index 0
          { kind: 'subtraction', minA: 20, maxA: 20, minB: 10, maxB: 10 }, // index 1
        ],
      };

      // Mock PRNG to return 0.0 (index 0: addition)
      let prngCalled = 0;
      const prngAddition = () => {
        prngCalled++;
        return 0.1; // Math.floor(0.1 * 2) = 0
      };

      const context1 = { levelId: 'T-BLITZ-01', sequenceIndex: 1 };
      const qAdd = generator.generate(rule, prngAddition, context1);

      expect(qAdd.generatorKey).toBe('addition');
      expect(qAdd.displayPrompt).toBe('5 + 5');
      expect(qAdd.questionInstanceId).toBe('T-BLITZ-01:1');

      // Mock PRNG to return 0.9 (index 1: subtraction)
      const prngSubtraction = () => 0.9; // Math.floor(0.9 * 2) = 1
      const context2 = { levelId: 'T-BLITZ-01', sequenceIndex: 2 };
      const qSub = generator.generate(rule, prngSubtraction, context2);

      expect(qSub.generatorKey).toBe('subtraction');
      expect(qSub.displayPrompt).toBe('20 - 10');
      expect(qSub.questionInstanceId).toBe('T-BLITZ-01:2');
    });

    it('generates deterministically with Mulberry32 PRNG', () => {
      const registry = createDefaultGeneratorRegistry();
      const generator = new MixedBlitzGenerator(registry);

      const rule: MixedBlitzRule = {
        kind: 'mixed_blitz',
        subRules: [
          { kind: 'addition', minA: 1, maxA: 20, minB: 1, maxB: 20 },
          { kind: 'subtraction', minA: 10, maxA: 30, minB: 1, maxB: 10 },
          { kind: 'multiplication', minA: 2, maxA: 9, minB: 2, maxB: 9 },
          { kind: 'power_root', mode: 'square', minBase: 1, maxBase: 12 },
        ],
      };

      const seed = 424242;
      const prng1 = createMulberry32(seed);
      const prng2 = createMulberry32(seed);

      const questions1 = [];
      const questions2 = [];

      for (let i = 1; i <= 5; i++) {
        questions1.push(
          generator.generate(rule, prng1, { levelId: 'BLITZ-TEST', sequenceIndex: i })
        );
        questions2.push(
          generator.generate(rule, prng2, { levelId: 'BLITZ-TEST', sequenceIndex: i })
        );
      }

      expect(questions1).toEqual(questions2);
      expect(questions1.map((q) => q.displayPrompt)).toEqual(questions2.map((q) => q.displayPrompt));
    });

    it('integrates seamlessly with QuestionGeneratorRegistry.generateSessionQuestions', () => {
      const registry = createDefaultGeneratorRegistry();

      const blitzLevel: LevelConfigV2 = {
        id: 'T6-BLITZ-01',
        order: 72,
        tier: 6,
        title: 'Mixed Blitz Finale',
        description: 'Tantangan campuran semua materi',
        generatorKey: 'mixed_blitz',
        rules: {
          kind: 'mixed_blitz',
          subRules: [
            { kind: 'addition', minA: 10, maxA: 50, minB: 10, maxB: 50 },
            { kind: 'subtraction', minA: 20, maxA: 60, minB: 1, maxB: 20 },
            { kind: 'multiplication', minA: 2, maxA: 12, minB: 2, maxB: 12 },
            {
              kind: 'algebra',
              template: 'one_step_add',
              minSolution: 1,
              maxSolution: 20,
              minCoefficient: 1,
              maxCoefficient: 1,
            },
          ],
        },
        answerKind: 'integer',
        difficulty: 5,
        questionCount: 10,
        targetTimeSec: 60,
        timeLimitSec: 90,
        boss: true,
        passingAccuracy: 80,
        prerequisiteIds: [],
        primarySkillId: 'mixed.blitz',
        skillTags: ['mixed', 'blitz'],
        contentVersion: '2.0.0',
      };

      const sessionQuestions = registry.generateSessionQuestions(blitzLevel, 'blitz-seed-999');
      expect(sessionQuestions).toHaveLength(10);

      // Verify that multiple generator families appear in the 10 questions
      const families = new Set(sessionQuestions.map((q) => q.generatorKey));
      expect(families.size).toBeGreaterThan(1);

      // Verify deterministic reproduction with identical seed
      const sessionQuestionsRepeat = registry.generateSessionQuestions(
        blitzLevel,
        'blitz-seed-999'
      );
      expect(sessionQuestions).toEqual(sessionQuestionsRepeat);

      // Verify divergence with different seed
      const sessionQuestionsDifferent = registry.generateSessionQuestions(
        blitzLevel,
        'different-seed-111'
      );
      expect(sessionQuestions.map((q) => q.displayPrompt)).not.toEqual(
        sessionQuestionsDifferent.map((q) => q.displayPrompt)
      );
    });
  });
});
