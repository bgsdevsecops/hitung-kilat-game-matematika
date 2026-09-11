# Milestone V2.1 Learning Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Milestone V2.1 Learning Intelligence subsystem covering the 14-category Skill Taxonomy, Mastery Algorithm V2.0 (exponential decay, speed, consistency), dedicated MasteryStore with 90-day pruning, and Mistake Training ("Latih Kesalahan Saya") session builder.

**Architecture:** A pure functional core (`MasteryCalculator`, `RemediationBuilder`) decoupled from browser storage, paired with an isolated `MasteryStore` handling event persistence, 90-day pruning, and sub-skill caps. The taxonomy provides canonical machine keys and metadata referenced across all generators and analytics.

**Tech Stack:** TypeScript (strict mode), Vitest for unit & property-based invariant testing, localStorage API.

**Spec:** `docs/superpowers/specs/2026-09-11-learning-intelligence-v2-design.md`

## Global Constraints

- No numeric level ID branching anywhere in taxonomy or mastery evaluation.
- All taxonomy IDs must be lowercase canonical machine keys matching `<skillId>.<subSkillKey>`.
- Mastery status must report `INSUFFICIENT_DATA` ("Belum Cukup Data") when total answers < 10 or distinct sessions < 2.
- Remediation sessions must contain between 5 and 15 questions, target 100% failed skills/tags, allow at most 1 exact prompt repeat, and enforce difficulty $\le \max(\text{failedDifficulty})$.
- All git commits must be local-only (no remote push) on branch `feature/12.9.11.34-learning-intelligence` with trailer `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

---

### Task 1: Skill Taxonomy Registry & Hierarchy

**Files:**
- Create: `src/engine/taxonomy/types.ts`
- Create: `src/engine/taxonomy/index.ts`
- Create: `tests/unit/taxonomy.test.ts`

**Interfaces:**
- Produces: `SKILL_TAXONOMY: Record<string, SkillCategoryDefinition>`, `getSubSkill(id: string): SubSkillDefinition | undefined`, `getAllSubSkills(): SubSkillDefinition[]`, `isValidSubSkillId(id: string): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/taxonomy.test.ts
import { describe, it, expect } from 'vitest';
import { SKILL_TAXONOMY, getSubSkill, getAllSubSkills, isValidSubSkillId } from '../../src/engine/taxonomy';

describe('Skill Taxonomy Registry', () => {
  it('defines all 14 mandatory skill categories from PRD §8.4', () => {
    const expectedCategories = [
      'addition', 'subtraction', 'multiplication', 'division',
      'missing_operand', 'multi_operation', 'bodmas', 'signed_number',
      'algebra', 'square', 'root', 'percentage', 'fraction', 'ratio'
    ];
    for (const cat of expectedCategories) {
      expect(SKILL_TAXONOMY[cat]).toBeDefined();
      expect(SKILL_TAXONOMY[cat].id).toBe(cat);
      expect(SKILL_TAXONOMY[cat].name).toBeTruthy();
      expect(SKILL_TAXONOMY[cat].subSkills.length).toBeGreaterThan(0);
    }
  });

  it('formats every sub-skill ID as lowercase <skillId>.<subSkillKey>', () => {
    const all = getAllSubSkills();
    expect(all.length).toBeGreaterThanOrEqual(40);
    for (const sub of all) {
      expect(sub.id).toMatch(/^[a-z_]+\.[a-z0-9_]+$/);
      expect(sub.id.startsWith(`${sub.skillId}.`)).toBe(true);
      expect(isValidSubSkillId(sub.id)).toBe(true);
    }
  });

  it('retrieves sub-skills correctly via getSubSkill', () => {
    const x7 = getSubSkill('multiplication.x7');
    expect(x7).toBeDefined();
    expect(x7?.name).toContain('×7');
    expect(x7?.skillId).toBe('multiplication');

    expect(getSubSkill('nonexistent.skill')).toBeUndefined();
    expect(isValidSubSkillId('nonexistent.skill')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/taxonomy.test.ts`
Expected: FAIL with module not found `../../src/engine/taxonomy`.

- [ ] **Step 3: Implement taxonomy types and registry**

Create `src/engine/taxonomy/types.ts`:
```typescript
export interface SubSkillDefinition {
  id: string; // e.g., 'multiplication.x7'
  skillId: string; // e.g., 'multiplication'
  name: string; // e.g., 'Perkalian ×7'
  description: string;
  difficultyBase: 1 | 2 | 3 | 4 | 5 | 6;
  prerequisiteSubSkillIds?: string[];
}

export interface SkillCategoryDefinition {
  id: string;
  name: string;
  icon: string;
  subSkills: SubSkillDefinition[];
}
```

Create `src/engine/taxonomy/index.ts`:
Implement `SKILL_TAXONOMY` containing all 14 categories (`addition`, `subtraction`, `multiplication`, `division`, `missing_operand`, `multi_operation`, `bodmas`, `signed_number`, `algebra`, `square`, `root`, `percentage`, `fraction`, `ratio`), along with `getSubSkill`, `getAllSubSkills`, and `isValidSubSkillId`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/taxonomy.test.ts`
Expected: PASS (all 3 tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/engine/taxonomy/ tests/unit/taxonomy.test.ts
git commit -m "feat(taxonomy): implement 14-category Skill Taxonomy registry and lookup API

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Mastery Calculator V2.0

**Files:**
- Create: `src/engine/mastery/types.ts`
- Create: `src/engine/mastery/calculator.ts`
- Create: `tests/unit/masteryCalculator.test.ts`

**Interfaces:**
- Produces: `computeSubSkillMastery(events: StoredAnswerEvent[], options?: MasteryComputeOptions): MasteryRecord`, `TARGET_RESPONSE_TIMES_MS: Record<number, number>`, `MasteryStatus`, `MasteryRecord`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/masteryCalculator.test.ts
import { describe, it, expect } from 'vitest';
import { computeSubSkillMastery, TARGET_RESPONSE_TIMES_MS } from '../../src/engine/mastery/calculator';
import { StoredAnswerEvent } from '../../src/engine/mastery/types';

describe('Mastery Calculator V2.0', () => {
  const now = 1773360000000; // fixed eval timestamp

  const createEvent = (
    index: number,
    isCorrect: boolean,
    responseTimeMs = 2500,
    sessionId = 'session-1',
    daysAgo = 0
  ): StoredAnswerEvent => ({
    eventId: `evt-${index}`,
    sessionId,
    questionDefinitionId: `q-${index}`,
    primarySkillId: 'multiplication',
    subSkillId: 'multiplication.x7',
    skillTags: ['arithmetic'],
    templateFamily: 'mult_table',
    difficulty: 2,
    targetResponseTimeMs: 3000,
    responseTimeMs,
    isCorrect,
    timestamp: now - daysAgo * 86400000
  });

  it('returns INSUFFICIENT_DATA when total answers < 10', () => {
    const events = Array.from({ length: 9 }, (_, i) => createEvent(i, true, 2000, `sess-${i % 3}`));
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.status).toBe('INSUFFICIENT_DATA');
    expect(record.statusLabel).toBe('Belum Cukup Data');
    expect(record.totalAnswers).toBe(9);
  });

  it('returns INSUFFICIENT_DATA when distinct sessions < 2', () => {
    const events = Array.from({ length: 15 }, (_, i) => createEvent(i, true, 2000, 'session-only-one'));
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.status).toBe('INSUFFICIENT_DATA');
    expect(record.distinctSessions).toBe(1);
  });

  it('computes MASTERED (score >= 95) with fast, consistent 100% correct answers', () => {
    const events = [
      ...Array.from({ length: 10 }, (_, i) => createEvent(i, true, 1500, 'sess-1', 1)),
      ...Array.from({ length: 10 }, (_, i) => createEvent(i + 10, true, 1500, 'sess-2', 0))
    ];
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.status).toBe('MASTERED');
    expect(record.masteryScore).toBeGreaterThanOrEqual(95);
    expect(record.isStrongSkill).toBe(true);
    expect(record.isWeakSkill).toBe(false);
  });

  it('detects WEAK_SKILL when accuracy is low or score < 60', () => {
    const events = [
      ...Array.from({ length: 6 }, (_, i) => createEvent(i, false, 4000, 'sess-1', 2)),
      ...Array.from({ length: 6 }, (_, i) => createEvent(i + 6, true, 3500, 'sess-2', 0))
    ];
    const record = computeSubSkillMastery(events, { evaluationTimeMs: now });
    expect(record.isWeakSkill).toBe(true);
    expect(record.isStrongSkill).toBe(false);
    expect(['NEEDS_PRACTICE', 'DEVELOPING']).toContain(record.status);
  });

  it('applies untimed accessibility profile omitting speed component', () => {
    const events = [
      ...Array.from({ length: 6 }, (_, i) => createEvent(i, true, 12000, 'sess-1', 1)),
      ...Array.from({ length: 6 }, (_, i) => createEvent(i + 6, true, 15000, 'sess-2', 0))
    ];
    const standard = computeSubSkillMastery(events, { evaluationTimeMs: now, untimed: false });
    const untimed = computeSubSkillMastery(events, { evaluationTimeMs: now, untimed: true });

    // In untimed mode, slow response times do not penalize mastery score
    expect(untimed.masteryScore).toBeGreaterThan(standard.masteryScore);
    expect(untimed.speedComponent).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/masteryCalculator.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement mastery types and calculator**

Create `src/engine/mastery/types.ts`:
Define `StoredAnswerEvent`, `MasteryStatus` (`'INSUFFICIENT_DATA' | 'NEEDS_PRACTICE' | 'DEVELOPING' | 'COMPETENT' | 'PROFICIENT' | 'MASTERED'`), `MasteryRecord`, and `MasteryComputeOptions`.

Create `src/engine/mastery/calculator.ts`:
Implement:
- `TARGET_RESPONSE_TIMES_MS`: `{ 1: 2500, 2: 3000, 3: 3500, 4: 4000, 5: 5000, 6: 6000 }`
- Exponential decay weighting with half-life = 30 days ($2^{-\Delta t / 30 \text{ days}}$).
- Three components: $A$ (accuracy), $S$ (speed), $C$ (consistency $\ge 80\%$ in up to 5 sessions).
- Standard formula: $\text{round}(0.65 \times A + 0.20 \times S + 0.15 \times C)$.
- Untimed formula: $\text{round}(0.80 \times A + 0.20 \times C)$.
- Weak / Strong skill classification flags.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/masteryCalculator.test.ts`
Expected: PASS (all 5 tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/engine/mastery/ tests/unit/masteryCalculator.test.ts
git commit -m "feat(mastery): implement Mastery Algorithm V2.0 with recency decay, speed, and consistency components

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Dedicated MasteryStore & Retention Pruning

**Files:**
- Create: `src/engine/mastery/store.ts`
- Create: `tests/unit/masteryStore.test.ts`

**Interfaces:**
- Produces: `MasteryStore`, `createMasteryStore(storage?: Storage): MasteryStore`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/masteryStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createMasteryStore, MasteryStore } from '../../src/engine/mastery/store';
import { StoredAnswerEvent } from '../../src/engine/mastery/types';

describe('MasteryStore Persistence & Pruning', () => {
  let store: MasteryStore;
  let mockStorage: Storage;

  beforeEach(() => {
    const memory = new Map<string, string>();
    mockStorage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
      removeItem: (k: string) => memory.delete(k),
      clear: () => memory.clear(),
      key: (i: number) => Array.from(memory.keys())[i] ?? null,
      length: 0
    };
    store = createMasteryStore(mockStorage);
  });

  it('records events and deduplicates by eventId', () => {
    const now = Date.now();
    const event1: StoredAnswerEvent = {
      eventId: 'evt-unique-1',
      sessionId: 's-1',
      questionDefinitionId: 'q-1',
      primarySkillId: 'addition',
      subSkillId: 'addition.single_digit',
      skillTags: [],
      templateFamily: 'single_add',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1200,
      isCorrect: true,
      timestamp: now
    };

    store.recordEvents([event1, event1]); // duplicate
    const events = store.getEventsForSubSkill('addition.single_digit');
    expect(events.length).toBe(1);
    expect(events[0].eventId).toBe('evt-unique-1');
  });

  it('prunes events older than 90 days on ingestion', () => {
    const now = Date.now();
    const oldTimestamp = now - 91 * 86400000;
    const freshTimestamp = now - 5 * 86400000;

    const oldEvent: StoredAnswerEvent = {
      eventId: 'evt-old',
      sessionId: 's-1',
      questionDefinitionId: 'q-old',
      primarySkillId: 'addition',
      subSkillId: 'addition.single_digit',
      skillTags: [],
      templateFamily: 'single_add',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1200,
      isCorrect: true,
      timestamp: oldTimestamp
    };

    const freshEvent: StoredAnswerEvent = {
      ...oldEvent,
      eventId: 'evt-fresh',
      timestamp: freshTimestamp
    };

    store.recordEvents([oldEvent, freshEvent], now);
    const events = store.getEventsForSubSkill('addition.single_digit');
    expect(events.length).toBe(1);
    expect(events[0].eventId).toBe('evt-fresh');
  });

  it('enforces maximum 30 events capacity per sub-skill', () => {
    const now = Date.now();
    const batch: StoredAnswerEvent[] = Array.from({ length: 45 }, (_, i) => ({
      eventId: `evt-${i}`,
      sessionId: `s-${i % 4}`,
      questionDefinitionId: `q-${i}`,
      primarySkillId: 'addition',
      subSkillId: 'addition.single_digit',
      skillTags: [],
      templateFamily: 'single_add',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1000,
      isCorrect: true,
      timestamp: now + i * 1000
    }));

    store.recordEvents(batch, now + 50000);
    const events = store.getEventsForSubSkill('addition.single_digit');
    expect(events.length).toBe(30);
    // Should keep the 30 newest events (indexes 15 to 44)
    expect(events[0].eventId).toBe('evt-15');
    expect(events[29].eventId).toBe('evt-44');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/masteryStore.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement MasteryStore with pruning & caching**

Create `src/engine/mastery/store.ts`:
Implement:
- `createMasteryStore(storage?: Storage)`
- Keys: `hk_mastery_events_v2`, `hk_mastery_snapshots_v2`
- `recordEvents(events: StoredAnswerEvent[], currentTimestamp?: number)`
- 90-day retention prune ($> 90 \times 86400000$ ms removed).
- Sub-skill rolling window cap (max 30 newest events per `subSkillId`).
- `getMasteryRecord(subSkillId: string, currentTimestamp?: number): MasteryRecord`
- `getAllMasteryRecords(currentTimestamp?: number): Record<string, MasteryRecord>`
- `getWeakSkills(currentTimestamp?: number): MasteryRecord[]`
- `getStrongSkills(currentTimestamp?: number): MasteryRecord[]`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/masteryStore.test.ts`
Expected: PASS (all 3 tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/engine/mastery/store.ts tests/unit/masteryStore.test.ts
git commit -m "feat(mastery): implement MasteryStore with local persistence, deduplication, and 90-day pruning

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Mistake Training Engine ("Latih Kesalahan Saya")

**Files:**
- Create: `src/engine/remediation/types.ts`
- Create: `src/engine/remediation/builder.ts`
- Create: `tests/unit/remediationBuilder.test.ts`

**Interfaces:**
- Consumes: `QuestionGeneratorRegistry` from `src/engine/registry/generatorRegistry.ts`, `Question` from `src/engine/types/question.ts`
- Produces: `buildRemediationSession(options: RemediationBuilderOptions): RemediationSessionPlan`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/remediationBuilder.test.ts
import { describe, it, expect } from 'vitest';
import { buildRemediationSession } from '../../src/engine/remediation/builder';
import { createGeneratorRegistry } from '../../src/engine/registry/generatorRegistry';
import { Question } from '../../src/engine/types/question';

describe('Remediation Session Builder ("Latih Kesalahan Saya")', () => {
  const registry = createGeneratorRegistry();

  const mockFailedQuestion = (
    defId: string,
    prompt: string,
    skillId: string,
    templateFamily: string,
    difficulty: 1 | 2 | 3 | 4 | 5 | 6 = 2
  ): Question => ({
    questionDefinitionId: defId,
    questionInstanceId: `inst-${defId}`,
    displayPrompt: prompt,
    answerSpec: { kind: 'integer', value: 42 },
    primarySkillId: skillId,
    skillTags: [skillId],
    difficulty,
    generatorKey: 'multiplication',
    targetResponseTimeMs: 3000,
    templateFamily,
    explanation: 'Test'
  });

  it('determines session size based on distinct failed families: min(15, max(5, 3 * families))', () => {
    const oneFamily = [mockFailedQuestion('q1', '7 × 8', 'multiplication', 'mult_table_7')];
    const plan1 = buildRemediationSession({ failedQuestions: oneFamily, registry, seed: 1234 });
    expect(plan1.questions.length).toBe(5); // min size 5

    const threeFamilies = [
      mockFailedQuestion('q1', '7 × 8', 'multiplication', 'family_1'),
      mockFailedQuestion('q2', '6 × 9', 'multiplication', 'family_2'),
      mockFailedQuestion('q3', '4 × 8', 'multiplication', 'family_3')
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
      mockFailedQuestion('q2', '12 + 15', 'addition', 'family_b')
    ];
    const plan = buildRemediationSession({ failedQuestions: failed, registry, seed: 555 });
    for (const q of plan.questions) {
      const matchesSkill = q.primarySkillId === 'multiplication' || q.primarySkillId === 'addition';
      const matchesTag = q.skillTags.some(t => t === 'multiplication' || t === 'addition');
      expect(matchesSkill || matchesTag).toBe(true);
    }
  });

  it('enforces difficulty ceiling: no question exceeds max difficulty of failed questions', () => {
    const failed = [
      mockFailedQuestion('q1', '2 + 3', 'addition', 'single_add', 1),
      mockFailedQuestion('q2', '4 + 5', 'addition', 'single_add', 2)
    ];
    const plan = buildRemediationSession({ failedQuestions: failed, registry, seed: 777 });
    for (const q of plan.questions) {
      expect(q.difficulty).toBeLessThanOrEqual(2);
    }
  });

  it('limits exact prompt repeats to at most 1, with >= 80% new variants', () => {
    const failed = [mockFailedQuestion('q1', '7 × 8', 'multiplication', 'mult_table_7', 2)];
    const plan = buildRemediationSession({ failedQuestions: failed, registry, seed: 999 });

    const exactRepeats = plan.questions.filter(q => q.displayPrompt === '7 × 8').length;
    expect(exactRepeats).toBeLessThanOrEqual(1);

    const distinctPrompts = new Set(plan.questions.map(q => q.displayPrompt));
    expect(distinctPrompts.size).toBeGreaterThanOrEqual(Math.floor(plan.questions.length * 0.8));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/remediationBuilder.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement remediation types and builder**

Create `src/engine/remediation/types.ts`:
Define `FailedQuestionEvidence`, `RemediationBuilderOptions`, `RemediationSessionPlan`.

Create `src/engine/remediation/builder.ts`:
Implement:
- `buildRemediationSession(options)`:
  - Calculate session size: $N = \min(15, \max(5, 3 \times \text{distinctFamilies}))$.
  - Collect target skills and max difficulty ceiling.
  - Filter and select eligible generators from `QuestionGeneratorRegistry`.
  - Distribute generation across target skills, capping exact prompt repeats $\le 1$ and enforcing $\ge 80\%$ variants.
  - Return `RemediationSessionPlan` with questions, targetSkillIds, and session metadata.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/remediationBuilder.test.ts`
Expected: PASS (all 4 tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/engine/remediation/ tests/unit/remediationBuilder.test.ts
git commit -m "feat(remediation): implement Mistake Training session builder with difficulty cap and repetition invariants

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Property-Based Invariant Suite for Learning Intelligence

**Files:**
- Create: `tests/unit/masteryInvariants.test.ts`

- [ ] **Step 1: Write property-based invariant test suite (5,000 cases)**

```typescript
// tests/unit/masteryInvariants.test.ts
import { describe, it, expect } from 'vitest';
import { computeSubSkillMastery } from '../../src/engine/mastery/calculator';
import { StoredAnswerEvent } from '../../src/engine/mastery/types';

describe('Learning Intelligence Invariant Suite (5,000 cases)', () => {
  const seedRandom = (seed: number) => {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  };

  it('preserves mathematical bounds [0, 100] across 5,000 randomized configurations', () => {
    const rng = seedRandom(42);
    const now = 1773360000000;

    for (let run = 0; run < 5000; run++) {
      const eventCount = Math.floor(rng() * 35) + 1; // 1 to 35 events
      const sessionCount = Math.floor(rng() * 5) + 1;

      const events: StoredAnswerEvent[] = Array.from({ length: eventCount }, (_, i) => {
        const isCorrect = rng() > 0.3;
        const responseTime = Math.floor(rng() * 8000) + 500; // 500ms - 8500ms
        const difficulty = (Math.floor(rng() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
        const daysAgo = rng() * 90;

        return {
          eventId: `run-${run}-evt-${i}`,
          sessionId: `sess-${i % sessionCount}`,
          questionDefinitionId: `q-${i}`,
          primarySkillId: 'multiplication',
          subSkillId: 'multiplication.x7',
          skillTags: ['multiplication'],
          templateFamily: 'mult_table',
          difficulty,
          targetResponseTimeMs: 3000,
          responseTimeMs: responseTime,
          isCorrect,
          timestamp: now - daysAgo * 86400000
        };
      });

      const untimed = rng() > 0.5;
      const result = computeSubSkillMastery(events, { evaluationTimeMs: now, untimed });

      if (result.status !== 'INSUFFICIENT_DATA') {
        expect(result.masteryScore).toBeGreaterThanOrEqual(0);
        expect(result.masteryScore).toBeLessThanOrEqual(100);
        expect(result.accuracyComponent).toBeGreaterThanOrEqual(0);
        expect(result.accuracyComponent).toBeLessThanOrEqual(100);
        expect(result.consistencyComponent).toBeGreaterThanOrEqual(0);
        expect(result.consistencyComponent).toBeLessThanOrEqual(100);
      }
    }
  });

  it('guarantees deterministic output for identical input events', () => {
    const now = 1773360000000;
    const events: StoredAnswerEvent[] = Array.from({ length: 15 }, (_, i) => ({
      eventId: `e-${i}`,
      sessionId: `s-${i % 2}`,
      questionDefinitionId: `q-${i}`,
      primarySkillId: 'addition',
      subSkillId: 'addition.single_digit',
      skillTags: [],
      templateFamily: 'add',
      difficulty: 1,
      targetResponseTimeMs: 2500,
      responseTimeMs: 1500,
      isCorrect: i % 3 !== 0,
      timestamp: now - i * 86400000
    }));

    const res1 = computeSubSkillMastery(events, { evaluationTimeMs: now });
    const res2 = computeSubSkillMastery(events, { evaluationTimeMs: now });

    expect(res1).toEqual(res2);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/unit/masteryInvariants.test.ts`
Expected: PASS (5,000 cases evaluated with zero invariant failures).

- [ ] **Step 3: Run entire project test suite**

Run: `npm test`
Expected: PASS (all 27+ test files pass).

- [ ] **Step 4: Commit**

```bash
git add tests/unit/masteryInvariants.test.ts
git commit -m "test(mastery): add 5,000-case property-based invariant test suite for Learning Intelligence

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
