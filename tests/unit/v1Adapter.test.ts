import { describe, it, expect } from 'vitest';
import { adaptV1LevelToV2, adaptV2QuestionToV1 } from '../../src/engine/adapter/v1Adapter';
import { LevelConfig } from '../../src/types';
import { Question } from '../../src/engine/types';
import { LEVELS } from '../../src/utils/mathGenerator';

describe('V1 Compatibility Adapter', () => {
  it('adapts LevelConfig V1 to LevelConfigV2', () => {
    const v1Level: LevelConfig = {
      id: 1,
      tier: 'Pemula',
      tierLevel: 1,
      title: 'Penjumlahan 1–10',
      description: 'Tambah satuan',
      questionCount: 10,
      timeLimit: 30,
      operations: ['+'],
      numberRange: { min: 1, max: 10 },
    };

    const v2Level = adaptV1LevelToV2(v1Level);
    expect(v2Level.id).toBe('T1-ADD-01');
    expect(v2Level.generatorKey).toBe('addition');
    expect(v2Level.rules.kind).toBe('addition');
    expect(v2Level.tier).toBe(1);
    expect(v2Level.questionCount).toBe(10);
    expect(v2Level.timeLimitSec).toBe(30);
    expect(v2Level.targetTimeSec).toBe(23); // Math.round(30 * 0.75)
    expect(v2Level.prerequisiteIds).toEqual([]);
    expect(v2Level.contentVersion).toBe('2.0.0');
  });

  it('adapts Question V2 back to Question V1 interface', () => {
    const qV2: Question = {
      questionDefinitionId: 'def-1',
      questionInstanceId: 'inst-1',
      displayPrompt: '6 + 7',
      answerSpec: { kind: 'integer', value: 13 },
      primarySkillId: 'addition.basic',
      skillTags: ['addition'],
      difficulty: 1,
      generatorKey: 'addition',
      targetResponseTimeMs: 2500,
      templateFamily: 'addition_basic',
      explanation: '6 + 7 = 13',
    };

    const qV1 = adaptV2QuestionToV1(qV2);
    expect(qV1.id).toBe('inst-1');
    expect(qV1.text).toBe('6 + 7 = ?');
    expect(qV1.prompt).toBe('6 + 7 = ?');
    expect(qV1.correctAnswer).toBe(13);
    expect(qV1.explanation).toBe('6 + 7 = 13');
  });

  it('adapts subtraction level correctly', () => {
    const v1Level: LevelConfig = {
      id: 2,
      tier: 'Pemula',
      title: 'Pengurangan 1–15',
      description: 'Kurang dasar',
      questionCount: 10,
      timeLimit: 30,
      operations: ['-'],
      numberRange: { min: 1, max: 15 },
    };

    const v2Level = adaptV1LevelToV2(v1Level);
    expect(v2Level.id).toBe('T1-SUB-01');
    expect(v2Level.generatorKey).toBe('subtraction');
    expect(v2Level.rules.kind).toBe('subtraction');
    expect(v2Level.prerequisiteIds).toEqual(['T1-ADD-01']); // V1 level 1 mapped to T1-ADD-01
  });

  it('adapts multiplication level correctly with × or *', () => {
    const v1LevelCross: LevelConfig = {
      id: 5,
      tier: 'Menengah',
      title: 'Perkalian Dasar',
      description: 'Kali dasar',
      questionCount: 12,
      timeLimit: 35,
      operations: ['×'],
      numberRange: { min: 2, max: 5 },
    };

    const v2LevelCross = adaptV1LevelToV2(v1LevelCross);
    expect(v2LevelCross.id).toBe('T2-MUL-05');
    expect(v2LevelCross.generatorKey).toBe('multiplication');
    expect(v2LevelCross.rules.kind).toBe('multiplication');
    expect(v2LevelCross.tier).toBe(2);

    const v1LevelStar: LevelConfig = {
      id: 5,
      tier: 2,
      title: 'Perkalian Dasar',
      description: 'Kali dasar',
      questionsCount: 12,
      timeLimitSec: 35,
      operations: ['*'],
      maxNum1: 5,
      maxNum2: 5,
    };

    const v2LevelStar = adaptV1LevelToV2(v1LevelStar);
    expect(v2LevelStar.id).toBe('T2-MUL-05');
    expect(v2LevelStar.generatorKey).toBe('multiplication');
    expect(v2LevelStar.rules.kind).toBe('multiplication');
  });

  it('adapts division level correctly with ÷ or /', () => {
    const v1LevelDiv: LevelConfig = {
      id: 7,
      tier: 'Menengah',
      title: 'Pembagian Dasar',
      description: 'Bagi dasar',
      questionCount: 12,
      timeLimit: 35,
      operations: ['÷'],
      numberRange: { min: 2, max: 10 },
    };

    const v2LevelDiv = adaptV1LevelToV2(v1LevelDiv);
    expect(v2LevelDiv.id).toBe('T2-DIV-02');
    expect(v2LevelDiv.generatorKey).toBe('division');
    expect(v2LevelDiv.rules.kind).toBe('division');
    expect(v2LevelDiv.rules).toEqual({
      kind: 'division',
      minDivisor: 2,
      maxDivisor: 10,
      minQuotient: 1,
      maxQuotient: 10,
      requireInteger: true,
    });
  });

  it('handles unknown level ID by falling back to LEGACY prefix', () => {
    const unknownLevel: LevelConfig = {
      id: 99,
      tier: 'Master',
      title: 'Level 99',
      description: 'Unknown',
      questionCount: 10,
      timeLimit: 40,
      operations: ['+'],
      numberRange: { min: 1, max: 100 },
    };

    const v2Level = adaptV1LevelToV2(unknownLevel);
    expect(v2Level.id).toBe('LEGACY-99');
    expect(v2Level.order).toBe(99);
    expect(v2Level.tier).toBe(5);
  });

  it('adapts decimal and rational question answer specs', () => {
    const qDecimal: Question = {
      questionDefinitionId: 'def-dec',
      questionInstanceId: 'inst-dec',
      displayPrompt: '2.5 + 3.5 = ?',
      answerSpec: { kind: 'decimal', scaledValue: 60, scale: 1 },
      primarySkillId: 'decimal.add',
      skillTags: ['decimal'],
      difficulty: 2,
      generatorKey: 'decimal',
      targetResponseTimeMs: 3000,
      templateFamily: 'decimal_add',
      explanation: '2.5 + 3.5 = 6.0',
    };

    const qV1Dec = adaptV2QuestionToV1(qDecimal);
    expect(qV1Dec.correctAnswer).toBe(6);
    expect(qV1Dec.text).toBe('2.5 + 3.5 = ?'); // not appending extra = ?

    const qRational: Question = {
      questionDefinitionId: 'def-rat',
      questionInstanceId: 'inst-rat',
      displayPrompt: '3/4 + 1/4',
      answerSpec: { kind: 'rational', numerator: 4, denominator: 4 },
      primarySkillId: 'fraction.add',
      skillTags: ['fraction'],
      difficulty: 2,
      generatorKey: 'fraction',
      targetResponseTimeMs: 3000,
      templateFamily: 'fraction_add',
      explanation: '4/4 = 1',
    };

    const qV1Rat = adaptV2QuestionToV1(qRational);
    expect(qV1Rat.correctAnswer).toBe(1);
    expect(qV1Rat.text).toBe('3/4 + 1/4 = ?');
  });

  it('handles existing V1 level objects without numberRange', () => {
    const v1RealLevel: LevelConfig = {
      id: 2,
      title: 'Pengurangan 1-15',
      tier: 1,
      tierName: 'Pemula',
      description: 'Pengurangan angka dasar tanpa nilai minus.',
      questionsCount: 10,
      timeLimitSec: 35,
      operations: ['-'],
      maxNum1: 15,
      maxNum2: 10,
    };

    const v2Level = adaptV1LevelToV2(v1RealLevel);
    expect(v2Level.id).toBe('T1-SUB-01');
    expect(v2Level.generatorKey).toBe('subtraction');
    expect(v2Level.rules).toEqual({
      kind: 'subtraction',
      minA: 1,
      maxA: 15,
      minB: 1,
      maxB: 10,
      allowNegative: false,
    });
    expect(v2Level.questionCount).toBe(10);
    expect(v2Level.timeLimitSec).toBe(35);
  });

  it('successfully adapts all 24 canonical V1 levels from mathGenerator', () => {
    for (const lvl of LEVELS) {
      const v2 = adaptV1LevelToV2(lvl);
      expect(v2.id).toBeDefined();
      expect(v2.order).toBeGreaterThan(0);
      expect(v2.tier).toBeGreaterThanOrEqual(1);
      expect(v2.tier).toBeLessThanOrEqual(6);
      expect(v2.questionCount).toBe(lvl.questionsCount);
      expect(v2.timeLimitSec).toBe(lvl.timeLimitSec);
      expect(v2.contentVersion).toBe('2.0.0');
    }
  });
});
