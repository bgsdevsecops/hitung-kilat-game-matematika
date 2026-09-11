import { describe, it, expect } from 'vitest';
import { LEVEL_MANIFEST_72 } from '../../src/engine/manifest';
import { createDefaultGeneratorRegistry } from '../../src/engine/registry';
import { createMulberry32 } from '../../src/engine/utils/prng';

describe('Canonical 72-Level Manifest Data and Invariants', () => {
  const registry = createDefaultGeneratorRegistry();

  it('contains exactly 72 levels', () => {
    expect(LEVEL_MANIFEST_72).toHaveLength(72);
  });

  it('has continuous strictly increasing orders from 1 to 72', () => {
    LEVEL_MANIFEST_72.forEach((level, index) => {
      expect(level.order).toBe(index + 1);
    });
  });

  it('partitions into exactly 6 tiers with 12 levels each', () => {
    for (let tier = 1; tier <= 6; tier++) {
      const tierLevels = LEVEL_MANIFEST_72.filter((lvl) => lvl.tier === tier);
      expect(tierLevels).toHaveLength(12);

      const startIndex = (tier - 1) * 12;
      const expectedOrders = Array.from({ length: 12 }, (_, i) => startIndex + i + 1);
      expect(tierLevels.map((lvl) => lvl.order)).toEqual(expectedOrders);
    }
  });

  it('contains exactly 6 boss levels at orders 12, 24, 36, 48, 60, 72 with exact configuration', () => {
    const bossLevels = LEVEL_MANIFEST_72.filter((lvl) => lvl.boss);
    expect(bossLevels).toHaveLength(6);
    expect(bossLevels.map((lvl) => lvl.order)).toEqual([12, 24, 36, 48, 60, 72]);

    const expectedBosses = [
      { order: 12, id: 'T1-BOSS', questionCount: 15, targetTimeSec: 36, timeLimitSec: 45, passingAccuracy: 0.7 },
      { order: 24, id: 'T2-BOSS', questionCount: 18, targetTimeSec: 40, timeLimitSec: 50, passingAccuracy: 0.7 },
      { order: 36, id: 'T3-BOSS', questionCount: 18, targetTimeSec: 48, timeLimitSec: 60, passingAccuracy: 0.75 },
      { order: 48, id: 'T4-BOSS', questionCount: 15, targetTimeSec: 48, timeLimitSec: 60, passingAccuracy: 0.75 },
      { order: 60, id: 'T5-BOSS', questionCount: 20, targetTimeSec: 60, timeLimitSec: 75, passingAccuracy: 0.8 },
      { order: 72, id: 'T6-GRANDMASTER', questionCount: 25, targetTimeSec: 72, timeLimitSec: 90, passingAccuracy: 0.85 },
    ];

    expectedBosses.forEach((expected, i) => {
      const boss = bossLevels[i];
      expect(boss.order).toBe(expected.order);
      expect(boss.id).toBe(expected.id);
      expect(boss.questionCount).toBe(expected.questionCount);
      expect(boss.targetTimeSec).toBe(expected.targetTimeSec);
      expect(boss.timeLimitSec).toBe(expected.timeLimitSec);
      expect(boss.passingAccuracy).toBe(expected.passingAccuracy);
      expect(boss.boss).toBe(true);
    });
  });

  it('assigns correct question counts and target times per tier defaults for regular levels', () => {
    const tierDefaults = {
      1: { questionCount: 10, targetTimeSec: 30, timeLimitSec: 45, passingAccuracy: 0.7 },
      2: { questionCount: 12, targetTimeSec: 36, timeLimitSec: 50, passingAccuracy: 0.7 },
      3: { questionCount: 12, targetTimeSec: 40, timeLimitSec: 55, passingAccuracy: 0.7 },
      4: { questionCount: 12, targetTimeSec: 45, timeLimitSec: 60, passingAccuracy: 0.7 },
      5: { questionCount: 12, targetTimeSec: 50, timeLimitSec: 65, passingAccuracy: 0.7 },
      6: { questionCount: 12, targetTimeSec: 55, timeLimitSec: 70, passingAccuracy: 0.7 },
    };

    LEVEL_MANIFEST_72.filter((lvl) => !lvl.boss).forEach((lvl) => {
      const defaults = tierDefaults[lvl.tier];
      expect(lvl.questionCount).toBe(defaults.questionCount);
      expect(lvl.targetTimeSec).toBe(defaults.targetTimeSec);
      expect(lvl.timeLimitSec).toBe(defaults.timeLimitSec);
      expect(lvl.passingAccuracy).toBe(defaults.passingAccuracy);
    });
  });

  it('enforces all 72 level IDs are unique and match canonical PRD IDs', () => {
    const ids = LEVEL_MANIFEST_72.map((lvl) => lvl.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(72);

    const expectedTierIds: Record<number, string[]> = {
      1: [
        'T1-ADD-01', 'T1-ADD-02', 'T1-SUB-01', 'T1-SUB-02',
        'T1-CHAIN-01', 'T1-CHAIN-02', 'T1-MIX-01',
        'T1-COMP-01', 'T1-COMP-02', 'T1-MISS-01', 'T1-MISS-02',
        'T1-BOSS',
      ],
      2: [
        'T2-MUL-02', 'T2-MUL-03', 'T2-MUL-04', 'T2-MUL-05',
        'T2-MUL-06', 'T2-MUL-07', 'T2-MUL-08', 'T2-MUL-09',
        'T2-DIV-01', 'T2-DIV-02', 'T2-MISS-01',
        'T2-BOSS',
      ],
      3: [
        'T3-ADD-01', 'T3-ADD-02', 'T3-SUB-01', 'T3-SUB-02',
        'T3-ADD-03', 'T3-SUB-03',
        'T3-MUL-10', 'T3-DIV-10', 'T3-MUL-TENS', 'T3-DIV-TENS',
        'T3-MIX-01',
        'T3-BOSS',
      ],
      4: [
        'T4-CHAIN-03', 'T4-CHAIN-04',
        'T4-MIX-MA', 'T4-MIX-MS', 'T4-MIX-DA', 'T4-MIX-DS',
        'T4-BODMAS-01', 'T4-BODMAS-02',
        'T4-PAREN-01', 'T4-PAREN-02',
        'T4-BODMAS-03',
        'T4-BOSS',
      ],
      5: [
        'T5-NEG-01', 'T5-NEG-02', 'T5-NEG-03', 'T5-NEG-MUL', 'T5-NEG-DIV',
        'T5-MUL-11-14', 'T5-MUL-15-19', 'T5-MISS-02',
        'T5-ALG-01', 'T5-ALG-02',
        'T5-BLITZ',
        'T5-BOSS',
      ],
      6: [
        'T6-SQUARE-01', 'T6-SQUARE-02', 'T6-SQUARE-03',
        'T6-ROOT-01',
        'T6-PCT-01', 'T6-PCT-02',
        'T6-FRAC-01', 'T6-RATIO-01',
        'T6-ALG-03', 'T6-MULTI',
        'T6-BLITZ',
        'T6-GRANDMASTER',
      ],
    };

    for (let tier = 1; tier <= 6; tier++) {
      const tierIds = LEVEL_MANIFEST_72.filter((lvl) => lvl.tier === tier).map((lvl) => lvl.id);
      expect(tierIds).toEqual(expectedTierIds[tier]);
    }
  });

  it('forms a continuous DAG prerequisite chain starting at level 1', () => {
    expect(LEVEL_MANIFEST_72[0].prerequisiteIds).toEqual([]);

    for (let i = 1; i < 72; i++) {
      const current = LEVEL_MANIFEST_72[i];
      const previous = LEVEL_MANIFEST_72[i - 1];
      expect(current.prerequisiteIds).toEqual([previous.id]);
    }
  });

  it('assigns answerKind rational to T6-FRAC-01 and integer to all other 71 levels', () => {
    LEVEL_MANIFEST_72.forEach((lvl) => {
      if (lvl.id === 'T6-FRAC-01') {
        expect(lvl.answerKind).toBe('rational');
      } else {
        expect(lvl.answerKind).toBe('integer');
      }
    });
  });

  it('sets contentVersion to 2.0.0 on all 72 levels', () => {
    LEVEL_MANIFEST_72.forEach((lvl) => {
      expect(lvl.contentVersion).toBe('2.0.0');
    });
  });

  it('validates every level against the generator registry', () => {
    LEVEL_MANIFEST_72.forEach((level) => {
      expect(registry.has(level.generatorKey)).toBe(true);
      expect(level.rules.kind).toBe(level.generatorKey);

      const generator = registry.get(level.generatorKey);
      expect(() => generator.validateRule(level.rules)).not.toThrow();
    });
  });

  it('generates valid questions without errors for all 72 levels', () => {
    const prng = createMulberry32('manifest-smoke-seed');

    LEVEL_MANIFEST_72.forEach((level) => {
      const question = registry.generateQuestion(level, prng, {
        levelId: level.id,
        sequenceIndex: 1,
        contentVersion: level.contentVersion,
      });

      expect(question).toBeDefined();
      expect(question.displayPrompt).toBeDefined();
      expect(question.displayPrompt.length).toBeGreaterThan(0);
      if (level.generatorKey === 'mixed_blitz') {
        const subKinds = (level.rules as { subRules: { kind: string }[] }).subRules.map((r) => r.kind);
        expect(subKinds).toContain(question.generatorKey);
      } else {
        expect(question.generatorKey).toBe(level.generatorKey);
      }
      expect(question.answerSpec).toBeDefined();
    });
  });

  it('generates full question sessions for all 72 levels matching level.questionCount', () => {
    LEVEL_MANIFEST_72.forEach((level) => {
      const questions = registry.generateSessionQuestions(level, `session-seed-${level.id}`);
      expect(questions).toHaveLength(level.questionCount);
      questions.forEach((q) => {
        expect(q.displayPrompt.length).toBeGreaterThan(0);
        expect(q.answerSpec).toBeDefined();
      });
    });
  });

  it('verifies non-empty titles, descriptions, primarySkillId, and skillTags on every level', () => {
    LEVEL_MANIFEST_72.forEach((level) => {
      expect(level.title.trim().length).toBeGreaterThan(0);
      expect(level.description.trim().length).toBeGreaterThan(0);
      expect(level.primarySkillId.trim().length).toBeGreaterThan(0);
      expect(level.skillTags.length).toBeGreaterThan(0);
      expect(level.difficulty).toBeGreaterThanOrEqual(1);
      expect(level.difficulty).toBeLessThanOrEqual(6);
    });
  });
});

