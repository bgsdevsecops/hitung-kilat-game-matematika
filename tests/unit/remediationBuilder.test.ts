import { describe, it, expect } from 'vitest';
import { buildRemediationSession, resolveGeneratorKey } from '../../src/engine/remediation/builder';
import { createGeneratorRegistry } from '../../src/engine/registry/generatorRegistry';
import { Question } from '../../src/engine/types/question';
import { FailedQuestionEvidence } from '../../src/engine/remediation/types';

describe('Remediation Session Builder ("Latih Kesalahan Saya")', () => {
  const registry = createGeneratorRegistry();

  const mockFailedQuestion = (
    defId: string,
    prompt: string,
    skillId: string,
    templateFamily: string,
    difficulty: 1 | 2 | 3 | 4 | 5 | 6 = 2,
    generatorKey = 'multiplication'
  ): Question => ({
    questionDefinitionId: defId,
    questionInstanceId: `inst-${defId}`,
    displayPrompt: prompt,
    answerSpec: { kind: 'integer', value: 42 },
    primarySkillId: skillId,
    skillTags: [skillId],
    difficulty,
    generatorKey,
    targetResponseTimeMs: 3000,
    templateFamily,
    explanation: 'Test',
  });

  it('determines session size based on distinct failed families: min(15, max(5, 3 * families))', () => {
    const oneFamily = [mockFailedQuestion('q1', '7 × 8', 'multiplication', 'mult_table_7')];
    const plan1 = buildRemediationSession({ failedQuestions: oneFamily, registry, seed: 1234 });
    expect(plan1.questions.length).toBe(5); // min size 5

    const threeFamilies = [
      mockFailedQuestion('q1', '7 × 8', 'multiplication', 'family_1'),
      mockFailedQuestion('q2', '6 × 9', 'multiplication', 'family_2'),
      mockFailedQuestion('q3', '4 × 8', 'multiplication', 'family_3'),
    ];
    const plan3 = buildRemediationSession({ failedQuestions: threeFamilies, registry, seed: 1234 });
    expect(plan3.questions.length).toBe(9); // 3 * 3 = 9

    const sixFamilies = Array.from({ length: 6 }, (_, i) =>
      mockFailedQuestion(`q${i}`, `${i} × 7`, 'multiplication', `family_${i}`)
    );
    const plan6 = buildRemediationSession({ failedQuestions: sixFamilies, registry, seed: 1234 });
    expect(plan6.questions.length).toBe(15); // capped at 15
  });

  it('ensures 100% of generated questions carry failed skills or tags', () => {
    const failed = [
      mockFailedQuestion('q1', '7 × 8', 'multiplication', 'family_a'),
      mockFailedQuestion('q2', '12 + 15', 'addition', 'family_b'),
    ];
    const plan = buildRemediationSession({ failedQuestions: failed, registry, seed: 555 });
    for (const q of plan.questions) {
      const matchesSkill = q.primarySkillId === 'multiplication' || q.primarySkillId === 'addition';
      const matchesTag = q.skillTags.some((t) => t === 'multiplication' || t === 'addition');
      expect(matchesSkill || matchesTag).toBe(true);
    }
  });

  it('enforces difficulty ceiling: no question exceeds max difficulty of failed questions', () => {
    const failed = [
      mockFailedQuestion('q1', '2 + 3', 'addition', 'single_add', 1),
      mockFailedQuestion('q2', '4 + 5', 'addition', 'single_add', 2),
    ];
    const plan = buildRemediationSession({ failedQuestions: failed, registry, seed: 777 });
    for (const q of plan.questions) {
      expect(q.difficulty).toBeLessThanOrEqual(2);
    }
  });

  it('limits exact prompt repeats to at most 1, with >= 80% new variants', () => {
    const failed = [mockFailedQuestion('q1', '7 × 8', 'multiplication', 'mult_table_7', 2)];
    const plan = buildRemediationSession({ failedQuestions: failed, registry, seed: 999 });

    const exactRepeats = plan.questions.filter((q) => q.displayPrompt === '7 × 8').length;
    expect(exactRepeats).toBeLessThanOrEqual(1);

    const distinctPrompts = new Set(plan.questions.map((q) => q.displayPrompt));
    expect(distinctPrompts.size).toBeGreaterThanOrEqual(Math.floor(plan.questions.length * 0.8));
  });

  it('enforces template family cap <= 30% when >= 3 distinct families exist', () => {
    // 3 distinct families -> session size 9 (expanded to 5 families via manifest, cap <= 30% per family)
    const threeFamilies = [
      mockFailedQuestion('q1', '5 + 3', 'addition', 'addition_basic', 2, 'addition'),
      mockFailedQuestion('q2', '9 - 4', 'subtraction', 'subtraction_basic', 2, 'subtraction'),
      mockFailedQuestion('q3', '7 × 8', 'multiplication', 'multiplication_basic', 2, 'multiplication'),
    ];
    const plan3 = buildRemediationSession({ failedQuestions: threeFamilies, registry, seed: 1234 });
    expect(plan3.questions.length).toBe(9);

    const familyCounts3 = new Map<string, number>();
    for (const q of plan3.questions) {
      familyCounts3.set(q.templateFamily, (familyCounts3.get(q.templateFamily) || 0) + 1);
    }
    for (const [fam, count] of familyCounts3.entries()) {
      const share = count / plan3.questions.length;
      expect(share).toBeLessThanOrEqual(0.3); // max 2/9 = 22.2% <= 30%
    }

    // 4 distinct families -> session size 12
    const fourFamilies = [
      mockFailedQuestion('q1', '5 + 3', 'addition', 'addition_basic', 2, 'addition'),
      mockFailedQuestion('q2', '9 - 4', 'subtraction', 'subtraction_basic', 2, 'subtraction'),
      mockFailedQuestion('q3', '7 × 8', 'multiplication', 'multiplication_basic', 2, 'multiplication'),
      mockFailedQuestion('q4', '12 ÷ 3', 'division', 'division_clean', 2, 'division'),
    ];
    const plan4 = buildRemediationSession({ failedQuestions: fourFamilies, registry, seed: 444 });
    expect(plan4.questions.length).toBe(12);

    const familyCounts4 = new Map<string, number>();
    for (const q of plan4.questions) {
      familyCounts4.set(q.templateFamily, (familyCounts4.get(q.templateFamily) || 0) + 1);
    }
    for (const [fam, count] of familyCounts4.entries()) {
      const share = count / plan4.questions.length;
      expect(share).toBeLessThanOrEqual(0.3); // 3/12 = 25% <= 30%
    }

    // 6 distinct families -> session size 15
    const sixFamilies = [
      mockFailedQuestion('q1', '5 + 3', 'addition', 'addition_basic', 2, 'addition'),
      mockFailedQuestion('q2', '9 - 4', 'subtraction', 'subtraction_basic', 2, 'subtraction'),
      mockFailedQuestion('q3', '7 × 8', 'multiplication', 'multiplication_basic', 2, 'multiplication'),
      mockFailedQuestion('q4', '12 ÷ 3', 'division', 'division_clean', 2, 'division'),
      mockFailedQuestion('q5', '-4 + 9', 'signed', 'signed_arithmetic', 2, 'signed'),
      mockFailedQuestion('q6', '? + 3 = 10', 'missing_operand', 'missing_operand_basic', 2, 'missing_operand'),
    ];
    const plan6 = buildRemediationSession({ failedQuestions: sixFamilies, registry, seed: 666 });
    expect(plan6.questions.length).toBe(15);

    const familyCounts6 = new Map<string, number>();
    for (const q of plan6.questions) {
      familyCounts6.set(q.templateFamily, (familyCounts6.get(q.templateFamily) || 0) + 1);
    }
    for (const [fam, count] of familyCounts6.entries()) {
      const share = count / plan6.questions.length;
      expect(share).toBeLessThanOrEqual(0.3); // 3/15 = 20% <= 30%
    }
  });

  it('throws descriptive error when failedQuestions is empty or missing', () => {
    expect(() =>
      buildRemediationSession({ failedQuestions: [], registry, seed: 123 })
    ).toThrow('At least one failed question is required to build a remediation session');
  });

  it('produces deterministic sessions with identical seeds and varied sessions with different seeds', () => {
    const failed = [
      mockFailedQuestion('q1', '7 × 8', 'multiplication', 'mult_table_7', 2),
      mockFailedQuestion('q2', '5 + 9', 'addition', 'addition_basic', 1, 'addition'),
    ];

    const planA = buildRemediationSession({ failedQuestions: failed, registry, seed: 42 });
    const planB = buildRemediationSession({ failedQuestions: failed, registry, seed: 42 });
    const planC = buildRemediationSession({ failedQuestions: failed, registry, seed: 999999 });

    // Same seed -> exactly identical questions and prompts
    expect(planA.questions.map((q) => q.displayPrompt)).toEqual(
      planB.questions.map((q) => q.displayPrompt)
    );
    expect(planA.questions.map((q) => q.questionDefinitionId)).toEqual(
      planB.questions.map((q) => q.questionDefinitionId)
    );

    // Different seed -> different prompts
    expect(planA.questions.map((q) => q.displayPrompt)).not.toEqual(
      planC.questions.map((q) => q.displayPrompt)
    );
  });

  it('returns accurate metadata and targetSkillIds matching failed questions', () => {
    const failed = [
      mockFailedQuestion('q1', '7 × 8', 'multiplication.x7', 'family_mul', 2),
      mockFailedQuestion('q2', '12 + 15', 'addition.within_20', 'family_add', 1, 'addition'),
    ];

    const plan = buildRemediationSession({ failedQuestions: failed, registry, seed: 1010 });

    expect(plan.metadata.sessionSize).toBe(plan.questions.length);
    expect(plan.metadata.distinctFailedFamiliesCount).toBe(2);
    expect(plan.metadata.maxDifficultyCeiling).toBe(2);
    expect(plan.metadata.seed).toBe(1010);
    expect(plan.metadata.generatedAt).toBeGreaterThan(0);

    expect(plan.targetSkillIds).toContain('multiplication.x7');
    expect(plan.targetSkillIds).toContain('addition.within_20');
  });

  it('supports diverse math skills including division, algebra, and signed arithmetic', () => {
    const failed = [
      mockFailedQuestion('q1', '56 ÷ 7', 'division', 'division_clean', 2, 'division'),
      mockFailedQuestion('q2', '-4 + 9', 'signed', 'signed_arithmetic', 3, 'signed'),
      mockFailedQuestion('q3', 'x + 3 = 7', 'algebra', 'one_step_add', 4, 'algebra'),
    ];

    const plan = buildRemediationSession({ failedQuestions: failed, registry, seed: 888 });

    expect(plan.questions.length).toBe(9); // 3 * 3 = 9
    for (const q of plan.questions) {
      expect(q.difficulty).toBeLessThanOrEqual(4);
      const carriesTargetSkill =
        q.skillTags.includes('division') ||
        q.skillTags.includes('signed') ||
        q.skillTags.includes('algebra');
      expect(carriesTargetSkill).toBe(true);
    }
  });

  it('resolves multi-tag questions matching manifest levels to dedicated generators', () => {
    // 1. bodmas.mul_add (tags: bodmas, multiplication, addition) -> generator must be bodmas, NOT addition
    const bodmasEvidence: FailedQuestionEvidence = {
      primarySkillId: 'bodmas.mul_add',
      skillTags: ['bodmas', 'multiplication', 'addition'],
      difficulty: 4,
      templateFamily: 'a_plus_b_times_c',
      displayPrompt: '2 + 3 × 4',
    };
    expect(resolveGeneratorKey(bodmasEvidence, registry)).toBe('bodmas');
    const bodmasPlan = buildRemediationSession({
      failedQuestions: [bodmasEvidence],
      registry,
      seed: 101,
    });
    for (const q of bodmasPlan.questions) {
      expect(q.generatorKey).toBe('bodmas');
    }

    // 2. arithmetic.signed (tags: addition, subtraction, signed, negative) -> generator must be signed, NOT addition
    const signedEvidence: FailedQuestionEvidence = {
      primarySkillId: 'arithmetic.signed',
      skillTags: ['addition', 'subtraction', 'signed', 'negative'],
      difficulty: 3,
      templateFamily: 'signed_arithmetic',
      displayPrompt: '-3 + 7',
    };
    expect(resolveGeneratorKey(signedEvidence, registry)).toBe('signed');
    const signedPlan = buildRemediationSession({
      failedQuestions: [signedEvidence],
      registry,
      seed: 202,
    });
    for (const q of signedPlan.questions) {
      expect(q.generatorKey).toBe('signed');
    }

    // 3. missing_operand.complement_10 (tags: missing_operand, addition) -> generator must be missing_operand, NOT addition
    const missingEvidence: FailedQuestionEvidence = {
      primarySkillId: 'missing_operand.complement_10',
      skillTags: ['missing_operand', 'addition'],
      difficulty: 1,
      templateFamily: 'missing_operand_basic',
      displayPrompt: '? + 4 = 10',
    };
    expect(resolveGeneratorKey(missingEvidence, registry)).toBe('missing_operand');
    const missingPlan = buildRemediationSession({
      failedQuestions: [missingEvidence],
      registry,
      seed: 303,
    });
    for (const q of missingPlan.questions) {
      expect(q.generatorKey).toBe('missing_operand');
    }
  });

  it('honors direct generatorKey when registered in registry (Priority 1)', () => {
    const explicitGenEvidence: FailedQuestionEvidence = {
      primarySkillId: 'addition.single_digit',
      skillTags: ['addition'],
      generatorKey: 'algebra',
      difficulty: 2,
      templateFamily: 'one_step_add',
      displayPrompt: 'x + 3 = 7',
    };
    expect(resolveGeneratorKey(explicitGenEvidence, registry)).toBe('algebra');
    const plan = buildRemediationSession({
      failedQuestions: [explicitGenEvidence],
      registry,
      seed: 404,
    });
    for (const q of plan.questions) {
      expect(q.generatorKey).toBe('algebra');
    }
  });
});
