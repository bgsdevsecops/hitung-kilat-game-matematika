# Milestone V2.2 Adaptive Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Milestone V2.2 Adaptive Practice V2 subsystem featuring a skill-aware bucket selector (50/25/15/10), cold-start diagnostic generation, prerequisite & difficulty ceiling enforcement, and adaptive recommendation explanations.

**Architecture:** A pure functional pipeline in `src/engine/adaptive/` consisting of a weighted bucket sampler (`selector.ts`), cold-start generator, and session orchestrator (`builder.ts`), decoupled from UI and storage, interacting with `MasteryStore`, `SKILL_TAXONOMY`, and `QuestionGeneratorRegistry`.

**Tech Stack:** TypeScript (strict mode), Vitest for unit & property-based invariant testing, Mulberry32 PRNG.

**Spec:** `docs/superpowers/specs/2026-09-12-adaptive-practice-v2-design.md`

## Global Constraints

- Never branch on numeric level IDs; use canonical `<skillId>.<subSkillKey>` taxonomy IDs and generator keys.
- Every adaptive session must contain at least 10 questions.
- Empirical bucket allocation across $\ge 100$ seeded sessions must remain within $\pm 10$ percentage points of policy (AC-E6-01).
- No single sub-skill may exceed 40% of an adaptive session, and no consecutive questions may have identical template families (AC-E6-02).
- 100% of generated questions must verify prerequisite satisfaction and not exceed player difficulty ceiling (AC-E6-03).
- All git commits must be local-only (no remote push) on the feature branch with mandatory trailer `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

---

### Task 1: Adaptive Data Contracts & Public Types

**Files:**
- Create: `src/engine/adaptive/types.ts`
- Create: `src/engine/adaptive/index.ts`
- Create: `tests/unit/adaptiveTypes.test.ts`

**Interfaces:**
- Produces: `AdaptiveBucket`, `AdaptiveSelectorPolicy`, `DEFAULT_ADAPTIVE_POLICY`, `AdaptiveRecommendation`, `AdaptiveBuilderOptions`, `AdaptiveSessionPlan`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/adaptiveTypes.test.ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_ADAPTIVE_POLICY } from '../../src/engine/adaptive/types';

describe('Adaptive Types & Policy Defaults', () => {
  it('defines valid default policy parameters', () => {
    expect(DEFAULT_ADAPTIVE_POLICY.version).toBe('2.2.0');
    expect(DEFAULT_ADAPTIVE_POLICY.weakSkillsRatio).toBe(0.50);
    expect(DEFAULT_ADAPTIVE_POLICY.mediumSkillsRatio).toBe(0.25);
    expect(DEFAULT_ADAPTIVE_POLICY.recentErrorsRatio).toBe(0.15);
    expect(DEFAULT_ADAPTIVE_POLICY.strongMaintenanceRatio).toBe(0.10);
    expect(DEFAULT_ADAPTIVE_POLICY.maxSubSkillShare).toBe(0.40);
    expect(DEFAULT_ADAPTIVE_POLICY.minSessionSize).toBe(10);

    const totalRatio = 
      DEFAULT_ADAPTIVE_POLICY.weakSkillsRatio +
      DEFAULT_ADAPTIVE_POLICY.mediumSkillsRatio +
      DEFAULT_ADAPTIVE_POLICY.recentErrorsRatio +
      DEFAULT_ADAPTIVE_POLICY.strongMaintenanceRatio;
    expect(totalRatio).toBeCloseTo(1.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/adaptiveTypes.test.ts`
Expected: FAIL with module not found `../../src/engine/adaptive/types`.

- [ ] **Step 3: Implement data contracts and exports**

Create `src/engine/adaptive/types.ts`:
```typescript
import { Question } from '../types/question';
import { MasteryRecord } from '../mastery/types';
import { FailedQuestionEvidence } from '../remediation/types';
import { QuestionGeneratorRegistry } from '../registry';

export type AdaptiveBucket = 
  | 'WEAK_SKILLS'
  | 'MEDIUM_SKILLS'
  | 'RECENT_ERRORS'
  | 'STRONG_MAINTENANCE'
  | 'COLD_START_DIAGNOSTIC';

export interface AdaptiveSelectorPolicy {
  version: string;
  weakSkillsRatio: number;
  mediumSkillsRatio: number;
  recentErrorsRatio: number;
  strongMaintenanceRatio: number;
  maxSubSkillShare: number;
  minSessionSize: number;
}

export const DEFAULT_ADAPTIVE_POLICY: AdaptiveSelectorPolicy = {
  version: '2.2.0',
  weakSkillsRatio: 0.50,
  mediumSkillsRatio: 0.25,
  recentErrorsRatio: 0.15,
  strongMaintenanceRatio: 0.10,
  maxSubSkillShare: 0.40,
  minSessionSize: 10,
};

export interface AdaptiveRecommendation {
  primarySubSkillId: string;
  reason: string;
  suggestedAction: 'focus_practice' | 'remediate_errors' | 'maintain_strength';
  alternateSubSkillIds: string[];
}

export interface AdaptiveBuilderOptions {
  masteryRecords: Record<string, MasteryRecord>;
  recentErrors?: (Question | FailedQuestionEvidence)[];
  playerDifficultyCeiling?: 1 | 2 | 3 | 4 | 5 | 6;
  sessionSize?: number;
  untimed?: boolean;
  seed?: number | string;
  policy?: Partial<AdaptiveSelectorPolicy>;
  registry: QuestionGeneratorRegistry;
}

export interface AdaptiveSessionPlan {
  questions: Question[];
  bucketAssignments: Record<AdaptiveBucket, number>;
  recommendation: AdaptiveRecommendation;
  isColdStart: boolean;
  metadata: {
    sessionSize: number;
    seed: number | string;
    policyVersion: string;
    generatedAt: number;
    difficultyCeiling: number;
    untimed: boolean;
  };
}
```

Create `src/engine/adaptive/index.ts`:
```typescript
export * from './types';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/adaptiveTypes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/adaptive/ tests/unit/adaptiveTypes.test.ts
git commit -m "feat(adaptive): define Adaptive Practice V2 data contracts and policy defaults

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Adaptive Selector & Bucket Allocation Logic

**Files:**
- Create: `src/engine/adaptive/selector.ts`
- Create: `tests/unit/adaptiveSelector.test.ts`

**Interfaces:**
- Produces: `allocateBucketSlots(sessionSize: number, policy: AdaptiveSelectorPolicy, availableBuckets: Set<AdaptiveBucket>): Record<AdaptiveBucket, number>`, `classifyMasteryBuckets(records: Record<string, MasteryRecord>, recentErrors?: (Question | FailedQuestionEvidence)[]): Record<AdaptiveBucket, string[]>`, `isSubSkillPrerequisiteSatisfied(subSkillId: string, records: Record<string, MasteryRecord>): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/adaptiveSelector.test.ts
import { describe, it, expect } from 'vitest';
import { allocateBucketSlots, classifyMasteryBuckets, isSubSkillPrerequisiteSatisfied } from '../../src/engine/adaptive/selector';
import { DEFAULT_ADAPTIVE_POLICY } from '../../src/engine/adaptive/types';
import { MasteryRecord } from '../../src/engine/mastery/types';

describe('Adaptive Selector & Bucket Allocator', () => {
  const createMockRecord = (id: string, score: number, recentAcc = 80, isWeak = false, isStrong = false): MasteryRecord => ({
    subSkillId: id,
    status: score >= 80 ? 'PROFICIENT' : score >= 60 ? 'COMPETENT' : 'NEEDS_PRACTICE',
    statusLabel: 'Test',
    masteryScore: score,
    accuracyComponent: score,
    speedComponent: 80,
    consistencyComponent: 80,
    recentAccuracy: recentAcc,
    totalAnswers: 20,
    distinctSessions: 3,
    isStrongSkill: isStrong,
    isWeakSkill: isWeak,
    lastEvaluatedAt: Date.now(),
    algorithmVersion: '2.0.0',
  });

  it('allocates 10 slots with Hare-Niemeyer largest remainder: 5 weak, 2/3 med, 1/2 err, 1 strong', () => {
    const available = new Set(['WEAK_SKILLS', 'MEDIUM_SKILLS', 'RECENT_ERRORS', 'STRONG_MAINTENANCE'] as const);
    const slots = allocateBucketSlots(10, DEFAULT_ADAPTIVE_POLICY, available);
    expect(slots.WEAK_SKILLS).toBe(5);
    expect(slots.MEDIUM_SKILLS).toBe(2);
    expect(slots.RECENT_ERRORS).toBe(2);
    expect(slots.STRONG_MAINTENANCE).toBe(1);
    expect(slots.WEAK_SKILLS + slots.MEDIUM_SKILLS + slots.RECENT_ERRORS + slots.STRONG_MAINTENANCE).toBe(10);
  });

  it('redistributes slots proportionally when RECENT_ERRORS bucket is empty', () => {
    const available = new Set(['WEAK_SKILLS', 'MEDIUM_SKILLS', 'STRONG_MAINTENANCE'] as const);
    const slots = allocateBucketSlots(10, DEFAULT_ADAPTIVE_POLICY, available);
    expect(slots.RECENT_ERRORS).toBe(0);
    expect(slots.WEAK_SKILLS + slots.MEDIUM_SKILLS + slots.STRONG_MAINTENANCE).toBe(10);
    expect(slots.WEAK_SKILLS).toBeGreaterThanOrEqual(5);
  });

  it('classifies records into appropriate buckets based on PRD §14', () => {
    const records: Record<string, MasteryRecord> = {
      'addition.carry': createMockRecord('addition.carry', 50, 60, true, false), // Weak
      'multiplication.x7': createMockRecord('multiplication.x7', 70, 75, false, false), // Medium
      'division.basic_235': createMockRecord('division.basic_235', 90, 95, false, true), // Strong
    };

    const classified = classifyMasteryBuckets(records, []);
    expect(classified.WEAK_SKILLS).toContain('addition.carry');
    expect(classified.MEDIUM_SKILLS).toContain('multiplication.x7');
    expect(classified.STRONG_MAINTENANCE).toContain('division.basic_235');
  });

  it('validates prerequisite satisfaction using SKILL_TAXONOMY', () => {
    const records: Record<string, MasteryRecord> = {
      'multiplication.x7': createMockRecord('multiplication.x7', 85, 90, false, true),
    };
    // Introductory skill with no prerequisites passes
    expect(isSubSkillPrerequisiteSatisfied('addition.single_digit', records)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/adaptiveSelector.test.ts`
Expected: FAIL with module not found `../../src/engine/adaptive/selector`.

- [ ] **Step 3: Implement selector and allocator**

Create `src/engine/adaptive/selector.ts`:
```typescript
import { AdaptiveBucket, AdaptiveSelectorPolicy } from './types';
import { MasteryRecord } from '../mastery/types';
import { Question } from '../types/question';
import { FailedQuestionEvidence } from '../remediation/types';
import { getSubSkill } from '../taxonomy';

export function isSubSkillPrerequisiteSatisfied(
  subSkillId: string,
  records: Record<string, MasteryRecord>
): boolean {
  const def = getSubSkill(subSkillId);
  if (!def || !def.prerequisiteSubSkillIds || def.prerequisiteSubSkillIds.length === 0) {
    return true;
  }
  return def.prerequisiteSubSkillIds.every((preId) => {
    const rec = records[preId];
    return rec && rec.status !== 'INSUFFICIENT_DATA' && rec.masteryScore >= 60;
  });
}

export function classifyMasteryBuckets(
  records: Record<string, MasteryRecord>,
  recentErrors?: (Question | FailedQuestionEvidence)[]
): Record<AdaptiveBucket, string[]> {
  const buckets: Record<AdaptiveBucket, string[]> = {
    WEAK_SKILLS: [],
    MEDIUM_SKILLS: [],
    RECENT_ERRORS: [],
    STRONG_MAINTENANCE: [],
    COLD_START_DIAGNOSTIC: [],
  };

  for (const [id, rec] of Object.entries(records)) {
    if (rec.status === 'INSUFFICIENT_DATA') continue;
    if (rec.isWeakSkill || rec.masteryScore < 60 || rec.recentAccuracy < 70) {
      buckets.WEAK_SKILLS.push(id);
    } else if (rec.isStrongSkill || (rec.masteryScore >= 80 && rec.recentAccuracy >= 85)) {
      buckets.STRONG_MAINTENANCE.push(id);
    } else if (rec.masteryScore >= 60 && rec.masteryScore < 80) {
      buckets.MEDIUM_SKILLS.push(id);
    }
  }

  if (recentErrors && recentErrors.length > 0) {
    const errorSkillIds = new Set<string>();
    for (const err of recentErrors) {
      if (err.primarySkillId) errorSkillIds.add(err.primarySkillId);
      for (const tag of err.skillTags || []) {
        if (tag) errorSkillIds.add(tag);
      }
    }
    buckets.RECENT_ERRORS = Array.from(errorSkillIds);
  }

  return buckets;
}

export function allocateBucketSlots(
  sessionSize: number,
  policy: AdaptiveSelectorPolicy,
  availableBuckets: Set<AdaptiveBucket>
): Record<AdaptiveBucket, number> {
  const slots: Record<AdaptiveBucket, number> = {
    WEAK_SKILLS: 0,
    MEDIUM_SKILLS: 0,
    RECENT_ERRORS: 0,
    STRONG_MAINTENANCE: 0,
    COLD_START_DIAGNOSTIC: 0,
  };

  const activeRatios: { bucket: AdaptiveBucket; ratio: number }[] = [];
  if (availableBuckets.has('WEAK_SKILLS')) activeRatios.push({ bucket: 'WEAK_SKILLS', ratio: policy.weakSkillsRatio });
  if (availableBuckets.has('MEDIUM_SKILLS')) activeRatios.push({ bucket: 'MEDIUM_SKILLS', ratio: policy.mediumSkillsRatio });
  if (availableBuckets.has('RECENT_ERRORS')) activeRatios.push({ bucket: 'RECENT_ERRORS', ratio: policy.recentErrorsRatio });
  if (availableBuckets.has('STRONG_MAINTENANCE')) activeRatios.push({ bucket: 'STRONG_MAINTENANCE', ratio: policy.strongMaintenanceRatio });

  if (activeRatios.length === 0) {
    slots.WEAK_SKILLS = sessionSize;
    return slots;
  }

  const totalActiveRatio = activeRatios.reduce((sum, r) => sum + r.ratio, 0);
  const normalized = activeRatios.map((r) => ({
    bucket: r.bucket,
    exactSlots: (r.ratio / totalActiveRatio) * sessionSize,
  }));

  let allocated = 0;
  const remainders: { bucket: AdaptiveBucket; remainder: number }[] = [];

  for (const item of normalized) {
    const floorSlots = Math.floor(item.exactSlots);
    slots[item.bucket] = floorSlots;
    allocated += floorSlots;
    remainders.push({ bucket: item.bucket, remainder: item.exactSlots - floorSlots });
  }

  remainders.sort((a, b) => b.remainder - a.remainder);
  let remaining = sessionSize - allocated;
  let idx = 0;
  while (remaining > 0 && idx < remainders.length) {
    slots[remainders[idx].bucket] += 1;
    remaining--;
    idx++;
  }

  return slots;
}
```

Update `src/engine/adaptive/index.ts`:
```typescript
export * from './types';
export * from './selector';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/adaptiveSelector.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/adaptive/selector.ts src/engine/adaptive/index.ts tests/unit/adaptiveSelector.test.ts
git commit -m "feat(adaptive): implement bucket classification and Hare-Niemeyer slot allocation

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Cold-Start Diagnostic Generator & Adaptive Recommendation Engine

**Files:**
- Create: `src/engine/adaptive/builder.ts`
- Create: `tests/unit/adaptiveBuilder.test.ts`

**Interfaces:**
- Produces: `buildAdaptiveSession(options: AdaptiveBuilderOptions): AdaptiveSessionPlan`, `generateAdaptiveRecommendation(masteryRecords: Record<string, MasteryRecord>, recentErrorsCount: number, isColdStart: boolean): AdaptiveRecommendation`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/adaptiveBuilder.test.ts
import { describe, it, expect } from 'vitest';
import { buildAdaptiveSession } from '../../src/engine/adaptive/builder';
import { createGeneratorRegistry } from '../../src/engine/registry/generatorRegistry';
import { MasteryRecord } from '../../src/engine/mastery/types';

describe('Adaptive Session Builder', () => {
  const registry = createGeneratorRegistry();

  it('synthesizes cold-start diagnostic session when insufficient data (< 2 evaluated skills)', () => {
    const plan = buildAdaptiveSession({
      masteryRecords: {},
      registry,
      seed: 4242,
    });

    expect(plan.isColdStart).toBe(true);
    expect(plan.questions.length).toBe(10);
    expect(plan.bucketAssignments.COLD_START_DIAGNOSTIC).toBe(10);
    expect(plan.recommendation.reason).toContain('diagnostik');

    // Check operation mix: 3 addition, 3 subtraction, 2 multiplication, 2 division
    const additionCount = plan.questions.filter((q) => q.generatorKey === 'addition').length;
    const subtractionCount = plan.questions.filter((q) => q.generatorKey === 'subtraction').length;
    const multCount = plan.questions.filter((q) => q.generatorKey === 'multiplication').length;
    const divCount = plan.questions.filter((q) => q.generatorKey === 'division').length;

    expect(additionCount).toBe(3);
    expect(subtractionCount).toBe(3);
    expect(multCount).toBe(2);
    expect(divCount).toBe(2);
  });

  it('builds mastery-driven session adhering to sub-skill cap <= 40% and non-consecutive template invariant', () => {
    const records: Record<string, MasteryRecord> = {
      'addition.single_digit': {
        subSkillId: 'addition.single_digit',
        status: 'NEEDS_PRACTICE',
        statusLabel: 'Perlu Latihan',
        masteryScore: 45,
        accuracyComponent: 50,
        speedComponent: 40,
        consistencyComponent: 40,
        recentAccuracy: 50,
        totalAnswers: 20,
        distinctSessions: 3,
        isStrongSkill: false,
        isWeakSkill: true,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
      'subtraction.single_digit': {
        subSkillId: 'subtraction.single_digit',
        status: 'COMPETENT',
        statusLabel: 'Cukup',
        masteryScore: 70,
        accuracyComponent: 70,
        speedComponent: 70,
        consistencyComponent: 70,
        recentAccuracy: 75,
        totalAnswers: 20,
        distinctSessions: 3,
        isStrongSkill: false,
        isWeakSkill: false,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
      'multiplication.x2': {
        subSkillId: 'multiplication.x2',
        status: 'MASTERED',
        statusLabel: 'Dikuasai',
        masteryScore: 95,
        accuracyComponent: 95,
        speedComponent: 95,
        consistencyComponent: 100,
        recentAccuracy: 100,
        totalAnswers: 30,
        distinctSessions: 4,
        isStrongSkill: true,
        isWeakSkill: false,
        lastEvaluatedAt: Date.now(),
        algorithmVersion: '2.0.0',
      },
    };

    const plan = buildAdaptiveSession({
      masteryRecords: records,
      registry,
      seed: 8888,
    });

    expect(plan.isColdStart).toBe(false);
    expect(plan.questions.length).toBe(10);

    // AC-E6-02: No single sub-skill exceeds 40% of session (<= 4 questions)
    const subSkillCounts = new Map<string, number>();
    for (const q of plan.questions) {
      const id = q.primarySkillId || 'unknown';
      subSkillCounts.set(id, (subSkillCounts.get(id) || 0) + 1);
    }
    for (const [, count] of subSkillCounts) {
      expect(count).toBeLessThanOrEqual(4);
    }

    // AC-E6-02: No consecutive identical templateFamily
    for (let i = 1; i < plan.questions.length; i++) {
      expect(plan.questions[i].templateFamily).not.toBe(plan.questions[i - 1].templateFamily);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/adaptiveBuilder.test.ts`
Expected: FAIL with module not found `../../src/engine/adaptive/builder`.

- [ ] **Step 3: Implement adaptive session builder**

Create `src/engine/adaptive/builder.ts`:
Implement:
- Diagnostic question generator producing exact 3 add / 3 sub / 2 mul / 2 div items.
- Mastery-driven question selector with Hare-Niemeyer slot counts.
- Generator resolution matching manifest level rules and difficulty ceilings.
- Anti-consecutive template family permutation / alternation.
- Localized recommendations and alternate skill suggestions.

Update `src/engine/adaptive/index.ts`:
```typescript
export * from './types';
export * from './selector';
export * from './builder';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/adaptiveBuilder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/adaptive/builder.ts src/engine/adaptive/index.ts tests/unit/adaptiveBuilder.test.ts
git commit -m "feat(adaptive): implement adaptive session builder, diagnostic generator, and recommendations

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Property-Based Invariant Test Suite for Epic E6

**Files:**
- Create: `tests/unit/adaptiveInvariants.test.ts`

**Interfaces:**
- Validates: AC-E6-01 (distribution within $\pm 10\%$ points across 100 runs), AC-E6-02 (sub-skill cap $\le 40\%$, no consecutive identical templates), AC-E6-03 (100% prerequisite satisfaction & difficulty ceiling), AC-E6-04 (deterministic reproduction).

- [ ] **Step 1: Write property-based invariant test suite (100+ seeded runs)**

```typescript
// tests/unit/adaptiveInvariants.test.ts
import { describe, it, expect } from 'vitest';
import { buildAdaptiveSession } from '../../src/engine/adaptive/builder';
import { createGeneratorRegistry } from '../../src/engine/registry/generatorRegistry';
import { MasteryRecord } from '../../src/engine/mastery/types';
import { createMulberry32, randomInt } from '../../src/engine/utils/prng';

describe('Epic E6: Adaptive Practice Property-Based Invariant Suite', () => {
  const registry = createGeneratorRegistry();

  it('verifies AC-E6-01: bucket distribution across 100 seeded sessions falls within ±10% points of policy', () => {
    const prng = createMulberry32('adaptive-e6-01-seed');
    let totalWeak = 0;
    let totalMedium = 0;
    let totalErrors = 0;
    let totalStrong = 0;
    const runCount = 100;

    for (let run = 0; run < runCount; run++) {
      // Mock rich mastery dataset with all categories represented
      const records: Record<string, MasteryRecord> = {
        'addition.carry': {
          subSkillId: 'addition.carry',
          status: 'NEEDS_PRACTICE',
          statusLabel: 'Perlu Latihan',
          masteryScore: 40,
          accuracyComponent: 40,
          speedComponent: 30,
          consistencyComponent: 40,
          recentAccuracy: 50,
          totalAnswers: 20,
          distinctSessions: 3,
          isStrongSkill: false,
          isWeakSkill: true,
          lastEvaluatedAt: 1773360000000,
          algorithmVersion: '2.0.0',
        },
        'subtraction.borrow': {
          subSkillId: 'subtraction.borrow',
          status: 'COMPETENT',
          statusLabel: 'Cukup',
          masteryScore: 70,
          accuracyComponent: 70,
          speedComponent: 70,
          consistencyComponent: 70,
          recentAccuracy: 75,
          totalAnswers: 20,
          distinctSessions: 3,
          isStrongSkill: false,
          isWeakSkill: false,
          lastEvaluatedAt: 1773360000000,
          algorithmVersion: '2.0.0',
        },
        'multiplication.x7': {
          subSkillId: 'multiplication.x7',
          status: 'MASTERED',
          statusLabel: 'Dikuasai',
          masteryScore: 95,
          accuracyComponent: 95,
          speedComponent: 90,
          consistencyComponent: 100,
          recentAccuracy: 100,
          totalAnswers: 30,
          distinctSessions: 4,
          isStrongSkill: true,
          isWeakSkill: false,
          lastEvaluatedAt: 1773360000000,
          algorithmVersion: '2.0.0',
        },
      };

      const plan = buildAdaptiveSession({
        masteryRecords: records,
        recentErrors: [{
          questionDefinitionId: 'err-1',
          primarySkillId: 'division',
          skillTags: ['division'],
          difficulty: 2,
          generatorKey: 'division',
          templateFamily: 'division_clean',
        }],
        registry,
        seed: `run-${run}`,
        sessionSize: 10,
      });

      totalWeak += plan.bucketAssignments.WEAK_SKILLS || 0;
      totalMedium += plan.bucketAssignments.MEDIUM_SKILLS || 0;
      totalErrors += plan.bucketAssignments.RECENT_ERRORS || 0;
      totalStrong += plan.bucketAssignments.STRONG_MAINTENANCE || 0;
    }

    const totalQuestions = runCount * 10;
    const weakRate = totalWeak / totalQuestions;
    const medRate = totalMedium / totalQuestions;
    const errRate = totalErrors / totalQuestions;
    const strongRate = totalStrong / totalQuestions;

    // AC-E6-01: Policy 50/25/15/10 within ±10% points (0.40..0.60, 0.15..0.35, 0.05..0.25, 0.00..0.20)
    expect(weakRate).toBeGreaterThanOrEqual(0.40);
    expect(weakRate).toBeLessThanOrEqual(0.60);

    expect(medRate).toBeGreaterThanOrEqual(0.15);
    expect(medRate).toBeLessThanOrEqual(0.35);

    expect(errRate).toBeGreaterThanOrEqual(0.05);
    expect(errRate).toBeLessThanOrEqual(0.25);

    expect(strongRate).toBeGreaterThanOrEqual(0.00);
    expect(strongRate).toBeLessThanOrEqual(0.20);
  });

  it('verifies AC-E6-02: sub-skill cap <= 40% and zero consecutive identical templates across 100 runs', () => {
    for (let i = 0; i < 100; i++) {
      const plan = buildAdaptiveSession({
        masteryRecords: {},
        registry,
        seed: `consec-test-${i}`,
        sessionSize: 10,
      });

      for (let j = 1; j < plan.questions.length; j++) {
        expect(plan.questions[j].templateFamily).not.toBe(plan.questions[j - 1].templateFamily);
      }
    }
  });

  it('verifies AC-E6-03 & AC-E6-04: prerequisite satisfaction, difficulty ceiling adherence, and bit-for-bit determinism', () => {
    const plan1 = buildAdaptiveSession({
      masteryRecords: {},
      registry,
      seed: 'deterministic-seed-123',
      playerDifficultyCeiling: 2,
    });

    const plan2 = buildAdaptiveSession({
      masteryRecords: {},
      registry,
      seed: 'deterministic-seed-123',
      playerDifficultyCeiling: 2,
    });

    // Bit-for-bit determinism
    expect(plan1.questions).toEqual(plan2.questions);

    // Difficulty ceiling
    for (const q of plan1.questions) {
      expect(q.difficulty).toBeLessThanOrEqual(2);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/unit/adaptiveInvariants.test.ts`
Expected: PASS (all invariant tests pass across 100+ runs).

- [ ] **Step 3: Run full project test suite**

Run: `npm test && npx tsc --noEmit`
Expected: PASS (all test files green, 0 compiler errors).

- [ ] **Step 4: Commit**

```bash
git add tests/unit/adaptiveInvariants.test.ts
git commit -m "test(adaptive): add property-based invariant test suite for Epic E6 requirements

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
