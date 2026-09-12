# Milestone V2.2 Adaptive Practice Design Specification

**Status:** APPROVED  
**Date:** 2026-09-12  
**Milestone:** V2.2 — Adaptive Practice (Epic E6)  
**Target Branch:** `feature/$(git-buildnumber)-adaptive-practice`  

---

## 1. Executive Summary & Objectives

Milestone V2.2 delivers the **Adaptive Practice V2** subsystem for Hitung Kilat. Building directly upon Milestone V2.1's Skill Taxonomy and Mastery Engine V2.0, this subsystem provides personalized, data-driven practice sessions that target player weaknesses while maintaining acquired mathematical fluency.

Key deliverables:
1. **Skill-Aware Question Selector (§14 & Epic E6)**: Seeded, weighted bucket sampler selecting questions across Weak (50%), Medium (25%), Recent Errors (15%), and Strong Maintenance (10%).
2. **Cold-Start Diagnostic Mix (§14 & AC-E6-04)**: Deterministic 10-question baseline across foundational operations (addition, subtraction, multiplication, division) for players with insufficient data.
3. **Strict Invariant Enforcement (AC-E6-01 to AC-E6-03)**:
   - Distribution within $\pm 10$ percentage points across $\ge 100$ seeded sessions.
   - Max 40% session allocation per sub-skill.
   - Zero consecutive identical template families.
   - 100% prerequisite satisfaction and difficulty ceiling adherence.
4. **Adaptive Recommendations (§14.1)**: Actionable, user-friendly explanations (e.g., *"Perkalian ×7 perlu latihan"*) and alternate focus choices.
5. **Accessibility / Untimed Profile (§14.1)**: Untimed mode integration omitting speed stress.

---

## 2. Architecture & Data Contracts

### 2.1 File Organization

```text
src/engine/adaptive/
├── types.ts           # Data contracts, bucket definitions, policy schemas
├── selector.ts        # Seeded weighted sampler, prerequisite validation, bucket allocator
├── builder.ts         # Pure functional session builder, cold-start logic, recommendation engine
└── index.ts           # Public engine API exports
```

### 2.2 Data Interfaces (`src/engine/adaptive/types.ts`)

```typescript
import { Question } from '../types/question';
import { MasteryRecord } from '../mastery/types';
import { FailedQuestionEvidence } from '../remediation/types';
import { QuestionGeneratorRegistry } from '../registry';

export type AdaptiveBucket = 
  | 'WEAK_SKILLS'          // Target: 50%
  | 'MEDIUM_SKILLS'        // Target: 25%
  | 'RECENT_ERRORS'        // Target: 15%
  | 'STRONG_MAINTENANCE'   // Target: 10%
  | 'COLD_START_DIAGNOSTIC';

export interface AdaptiveSelectorPolicy {
  version: string;
  weakSkillsRatio: number;        // 0.50 (default)
  mediumSkillsRatio: number;      // 0.25 (default)
  recentErrorsRatio: number;      // 0.15 (default)
  strongMaintenanceRatio: number; // 0.10 (default)
  maxSubSkillShare: number;       // 0.40
  minSessionSize: number;         // 10
}

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
  sessionSize?: number;           // Defaults to 10, min 10
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

---

## 3. Bucket Classification & Cold-Start Logic

### 3.1 Cold-Start Diagnostic Trigger
- **Condition**: If fewer than 2 sub-skills have evaluated mastery records beyond `INSUFFICIENT_DATA` in `options.masteryRecords`.
- **Diagnostic Composition (10 questions at Difficulty 1–2)**:
  - 3 questions Addition (`addition.single_digit` / `addition.within_20`)
  - 3 questions Subtraction (`subtraction.single_digit` / `subtraction.within_20`)
  - 2 questions Multiplication (`multiplication.x2` / `multiplication.x5`)
  - 2 questions Division (`division.basic_235`)
- All diagnostic questions strictly satisfy prerequisite requirements.

### 3.2 Mastery Bucket Classification
When cold-start is inactive, sub-skills are partitioned:
1. **`WEAK_SKILLS` (50% target)**: Sub-skills where `masteryRecord.isWeakSkill === true` (`masteryScore < 60` or `recentAccuracy < 70%`), or status `NEEDS_PRACTICE` / `DEVELOPING`.
2. **`MEDIUM_SKILLS` (25% target)**: Sub-skills where `masteryScore >= 60` and `< 80` (status `COMPETENT`).
3. **`RECENT_ERRORS` (15% target)**: Drawn from `options.recentErrors` to test retention on recently missed items.
4. **`STRONG_MAINTENANCE` (10% target)**: Sub-skills where `masteryRecord.isStrongSkill === true` (`masteryScore >= 80` and `recentAccuracy >= 85%`, status `PROFICIENT` or `MASTERED`).

### 3.3 Dynamic Fallback Allocation
When any bucket is empty (e.g. 0 recent errors):
- Unused ratio is proportionally distributed to available adjacent buckets.
- If no weak skills exist, weight moves to medium and strong maintenance.
- Slot count strictly sums to session size $N$ using the Largest Remainder Method (Hare-Niemeyer).

---

## 4. Sampling & Invariant Enforcement

### 4.1 Invariant Rules
1. **AC-E6-01**: Across $\ge 100$ seeded runs, the empirical distribution of each bucket is within $\pm 10$ percentage points of the policy:
   - Weak: $40\% - 60\%$
   - Medium: $15\% - 35\%$
   - Recent Errors: $5\% - 25\%$
   - Strong Maintenance: $0\% - 20\%$
2. **AC-E6-02**: Sub-skill cap $\le 40\%$ of session (max 4 per 10 questions). No consecutive questions share an identical `templateFamily`.
3. **AC-E6-03**: 100% of questions verify prerequisite satisfaction from `SKILL_TAXONOMY` and adhere to `difficulty <= playerDifficultyCeiling`.
4. **AC-E6-04**: Cold-start diagnostic and fallback configurations are 100% deterministic given the same seed.

---

## 5. Testing & Verification Strategy

- **Unit Suite (`tests/unit/adaptiveBuilder.test.ts`)**:
  - Cold-start diagnostic synthesis and 3/3/2/2 ratio.
  - Bucket slot assignment matching Largest Remainder method.
  - Sub-skill 40% cap and consecutive template deduplication.
  - Prerequisite verification and difficulty ceiling clamp.
  - Recommendation messaging and alternate focus skills.
- **Invariant Suite (`tests/unit/adaptiveInvariants.test.ts`)**:
  - 100 seeded sessions testing AC-E6-01 ($\pm 10\%$ bucket bounds).
  - AC-E6-02 sub-skill cap and non-consecutive template invariants.
  - AC-E6-03 prerequisite integrity across random player mastery profiles.
  - Bit-for-bit determinism across identical seeds.
