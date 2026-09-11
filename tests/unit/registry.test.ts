import { describe, it, expect } from 'vitest';
import { QuestionGeneratorRegistry, generatorRegistry } from '../../src/engine/registry';
import {
  AdditionGenerator,
  SubtractionGenerator,
  MultiplicationGenerator,
  DivisionGenerator,
  MissingOperandGenerator,
} from '../../src/engine/generators';
import { LevelConfigV2 } from '../../src/engine/types';
import { createMulberry32 } from '../../src/engine/utils/prng';

describe('QuestionGeneratorRegistry', () => {
  it('registers and retrieves generators', () => {
    const registry = new QuestionGeneratorRegistry();
    const addGen = new AdditionGenerator();
    registry.register(addGen);

    expect(registry.get('addition')).toBe(addGen);
    expect(registry.has('addition')).toBe(true);
    expect(registry.has('non_existent')).toBe(false);
  });

  it('throws when requesting unregistered generator key', () => {
    const registry = new QuestionGeneratorRegistry();
    expect(() => registry.get('non_existent')).toThrowError(/not registered/);
  });

  it('generates a single question using generateQuestion', () => {
    const registry = new QuestionGeneratorRegistry();
    registry.register(new AdditionGenerator());

    const level: LevelConfigV2 = {
      id: 'T1-ADD-01',
      order: 1,
      tier: 1,
      title: 'Penjumlahan 1–10',
      description: 'Tambah satuan',
      generatorKey: 'addition',
      rules: { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
      answerKind: 'integer',
      difficulty: 1,
      questionCount: 1,
      targetTimeSec: 30,
      timeLimitSec: 45,
      boss: false,
      passingAccuracy: 70,
      prerequisiteIds: [],
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      contentVersion: '2.0.0',
    };

    const prng = createMulberry32(12345);
    const question = registry.generateQuestion(level, prng, {
      levelId: level.id,
      sequenceIndex: 1,
    });

    expect(question).toBeDefined();
    expect(question.generatorKey).toBe('addition');
    expect(question.displayPrompt).toMatch(/^\d+ \+ \d+$/);
  });

  it('throws when generateQuestion uses an unregistered generatorKey', () => {
    const registry = new QuestionGeneratorRegistry();
    const level: LevelConfigV2 = {
      id: 'T1-UNKNOWN-01',
      order: 1,
      tier: 1,
      title: 'Unknown',
      description: 'Unknown generator',
      generatorKey: 'unregistered_key',
      rules: { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
      answerKind: 'integer',
      difficulty: 1,
      questionCount: 1,
      targetTimeSec: 30,
      timeLimitSec: 45,
      boss: false,
      passingAccuracy: 70,
      prerequisiteIds: [],
      primarySkillId: 'unknown',
      skillTags: [],
      contentVersion: '2.0.0',
    };

    const prng = createMulberry32(12345);
    expect(() =>
      registry.generateQuestion(level, prng, {
        levelId: level.id,
        sequenceIndex: 1,
      })
    ).toThrowError(/not registered/);
  });

  it('generates unique session questions without duplicates', () => {
    const registry = new QuestionGeneratorRegistry();
    registry.register(new AdditionGenerator());

    const level: LevelConfigV2 = {
      id: 'T1-ADD-01',
      order: 1,
      tier: 1,
      title: 'Penjumlahan 1–10',
      description: 'Tambah satuan',
      generatorKey: 'addition',
      rules: { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
      answerKind: 'integer',
      difficulty: 1,
      questionCount: 10,
      targetTimeSec: 30,
      timeLimitSec: 45,
      boss: false,
      passingAccuracy: 70,
      prerequisiteIds: [],
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      contentVersion: '2.0.0',
    };

    const questions = registry.generateSessionQuestions(level, 'test-seed-42');
    expect(questions.length).toBe(10);

    const prompts = questions.map((q) => q.displayPrompt);
    const uniquePrompts = new Set(prompts);
    expect(uniquePrompts.size).toBe(10);
  });

  it('falls back gracefully when the combinatorial space is smaller than questionCount', () => {
    const registry = new QuestionGeneratorRegistry();
    registry.register(new AdditionGenerator());

    // Only 1 possible question: 1 + 1 = ?
    const restrictedLevel: LevelConfigV2 = {
      id: 'T1-ADD-TINY',
      order: 1,
      tier: 1,
      title: 'Penjumlahan 1+1',
      description: 'Hanya ada satu kombinasi',
      generatorKey: 'addition',
      rules: { kind: 'addition', minA: 1, maxA: 1, minB: 1, maxB: 1 },
      answerKind: 'integer',
      difficulty: 1,
      questionCount: 3,
      targetTimeSec: 10,
      timeLimitSec: 15,
      boss: false,
      passingAccuracy: 70,
      prerequisiteIds: [],
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      contentVersion: '2.0.0',
    };

    // Attempts will exhaust (25 attempts per question) and fall back to duplicate candidate
    const questions = registry.generateSessionQuestions(restrictedLevel, 'tiny-seed');
    expect(questions.length).toBe(3);
    for (const q of questions) {
      expect(q.displayPrompt).toBe('1 + 1');
    }
  });

  it('produces deterministic output with same seed and divergent output with different seeds', () => {
    const registry = new QuestionGeneratorRegistry();
    registry.register(new AdditionGenerator());

    const level: LevelConfigV2 = {
      id: 'T1-ADD-01',
      order: 1,
      tier: 1,
      title: 'Penjumlahan 1–10',
      description: 'Tambah satuan',
      generatorKey: 'addition',
      rules: { kind: 'addition', minA: 1, maxA: 10, minB: 1, maxB: 10 },
      answerKind: 'integer',
      difficulty: 1,
      questionCount: 5,
      targetTimeSec: 30,
      timeLimitSec: 45,
      boss: false,
      passingAccuracy: 70,
      prerequisiteIds: [],
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      contentVersion: '2.0.0',
    };

    const sessionA = registry.generateSessionQuestions(level, 'fixed-seed');
    const sessionB = registry.generateSessionQuestions(level, 'fixed-seed');
    const sessionC = registry.generateSessionQuestions(level, 'different-seed');
    const sessionD = registry.generateSessionQuestions(level, 99999);

    expect(sessionA).toEqual(sessionB);
    expect(sessionA.map((q) => q.displayPrompt)).not.toEqual(sessionC.map((q) => q.displayPrompt));
    expect(sessionD.length).toBe(5);
  });

  describe('generatorRegistry singleton', () => {
    it('is pre-populated with all 5 core arithmetic generators', () => {
      expect(generatorRegistry.has('addition')).toBe(true);
      expect(generatorRegistry.has('subtraction')).toBe(true);
      expect(generatorRegistry.has('multiplication')).toBe(true);
      expect(generatorRegistry.has('division')).toBe(true);
      expect(generatorRegistry.has('missing_operand')).toBe(true);

      expect(generatorRegistry.get('addition')).toBeInstanceOf(AdditionGenerator);
      expect(generatorRegistry.get('subtraction')).toBeInstanceOf(SubtractionGenerator);
      expect(generatorRegistry.get('multiplication')).toBeInstanceOf(MultiplicationGenerator);
      expect(generatorRegistry.get('division')).toBeInstanceOf(DivisionGenerator);
      expect(generatorRegistry.get('missing_operand')).toBeInstanceOf(MissingOperandGenerator);
    });
  });
});
