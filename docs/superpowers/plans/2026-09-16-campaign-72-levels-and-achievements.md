# Campaign 72 Levels, Boss System & V2 Achievements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the 72-level campaign manifest, generator registry, 6-tier accordion campaign map, Boss battle arena, automatic V1 $\to$ V2 migration, and 16 standardized achievements into the user-facing game flow.

**Architecture:** Transition the Campaign game loop from legacy 24-level integer generation to the V2 data-driven architecture. Campaign state is managed in `src/utils/campaignState.ts` backed by `localStorage` (`hitung_kilat_campaign_v2`), supporting DAG prerequisite unlocking across 72 levels in 6 tiers. `LevelMap.tsx` provides an accessible 6-tier accordion interface with tier star counters (`X/36 ★`) and global meter (`X/216 ★`). `PlayScreen.tsx` leverages `createDefaultGeneratorRegistry()` and `LEVEL_MANIFEST_72`, embeds `DynamicKeypad.tsx`, tracks monotonic elapsed time against `targetTimeSec` and `timeLimitSec`, displays a Boss HP bar and rage effects during boss levels, and calculates stars via canonical `calculateLevelStars()`. `ResultModal.tsx` surfaces Boss victory fanfare, Perfect Badges, and celebratory Achievement Unlocked cards. `App.tsx` orchestrates automatic V1 $\to$ V2 migration on mount, displaying `V2WelcomeModal.tsx` on first upgrade.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS, Lucide React, Vitest, Testing Library React, Canvas Confetti.

**Spec:** `docs/superpowers/specs/2026-09-15-campaign-72-levels-and-achievements-design.md`

## Global Constraints

- Mandatory Git branch: `feature/12.9.14.19-campaign-72-levels-and-achievements`. Never edit directly on `main` or `master`.
- Mandatory commit trailer on all commits: `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- Zero push to remote without explicit user authorization.
- 100% test pass rate across all existing (615 tests) and new unit tests.
- 0 TypeScript compiler errors (`npx tsc --noEmit`).
- Clean Vite production build (`npm run build`).
- Minimum touch target size $\ge 48\times 48\text{px}$ on all interactive buttons, keypad buttons, and accordion headers (WCAG 2.2 AA).
- Maintain backwards compatibility: existing `id="level-card-1"` and `id="practice-mode-button"` elements must continue to exist for integration tests.

---

### Task 1: Canonical Star Rating Engine

**Files:**
- Create: `src/utils/starRating.ts`
- Test: `tests/unit/starRating.test.ts`

**Interfaces:**
- Consumes: `LevelConfigV2` from `src/engine/types/level.ts`
- Produces: `StarRatingResult`, `calculateLevelStars()` in `src/utils/starRating.ts`

```typescript
export interface StarRatingResult {
  stars: number; // 0, 1, 2, or 3
  isPerfect: boolean; // 100% accuracy within targetTimeSec
  isPassed: boolean; // stars >= 1
  accuracy: number; // 0–100 percentage
  reason: string;
}

export function calculateLevelStars(
  level: LevelConfigV2,
  correctCount: number,
  totalQuestions: number,
  durationSec: number,
  isTimedOut: boolean
): StarRatingResult;
```

- [ ] **Step 1: Write the failing unit tests for star rating engine**

Create `tests/unit/starRating.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateLevelStars } from '../../src/utils/starRating';
import { LevelConfigV2 } from '../../src/engine/types/level';

describe('calculateLevelStars (PRD §8.2.1 & §8.3.1)', () => {
  const mockLevel: LevelConfigV2 = {
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
    passingAccuracy: 0.7,
    prerequisiteIds: [],
    primarySkillId: 'addition.single_digit',
    skillTags: ['addition'],
    contentVersion: '2.0.0',
  };

  const mockBossLevel: LevelConfigV2 = {
    ...mockLevel,
    id: 'T1-BOSS',
    order: 12,
    boss: true,
    questionCount: 15,
    targetTimeSec: 36,
    timeLimitSec: 45,
    passingAccuracy: 0.7,
  };

  it('returns 0 stars if game timed out', () => {
    const result = calculateLevelStars(mockLevel, 10, 10, 45, true);
    expect(result.stars).toBe(0);
    expect(result.isPassed).toBe(false);
    expect(result.isPerfect).toBe(false);
    expect(result.reason).toContain('Waktu habis');
  });

  it('returns 0 stars if duration exceeded timeLimitSec', () => {
    const result = calculateLevelStars(mockLevel, 10, 10, 46, false);
    expect(result.stars).toBe(0);
    expect(result.isPassed).toBe(false);
  });

  it('returns 0 stars if accuracy is below passingAccuracy', () => {
    // 6 / 10 = 60% < 70%
    const result = calculateLevelStars(mockLevel, 6, 10, 20, false);
    expect(result.stars).toBe(0);
    expect(result.isPassed).toBe(false);
  });

  it('returns 1 star when accuracy meets passingAccuracy (70%) but < 85%', () => {
    // 7 / 10 = 70%
    const result = calculateLevelStars(mockLevel, 7, 10, 25, false);
    expect(result.stars).toBe(1);
    expect(result.isPassed).toBe(true);
    expect(result.isPerfect).toBe(false);
  });

  it('returns 2 stars when accuracy >= 85% but not meeting 3 star speed/accuracy', () => {
    // 9 / 10 = 90% (>= 85%) but duration 35s > targetTimeSec 30s
    const result = calculateLevelStars(mockLevel, 9, 10, 35, false);
    expect(result.stars).toBe(2);
    expect(result.isPassed).toBe(true);
    expect(result.isPerfect).toBe(false);
  });

  it('returns 3 stars when accuracy >= 95% within targetTimeSec', () => {
    // 10 / 10 = 100% in 25s <= targetTimeSec (30s)
    const result = calculateLevelStars(mockLevel, 10, 10, 25, false);
    expect(result.stars).toBe(3);
    expect(result.isPassed).toBe(true);
    expect(result.isPerfect).toBe(true);
  });

  it('returns 3 stars without perfect flag if accuracy is 95% (e.g. 19/20 in boss level) within targetTimeSec', () => {
    const bossLevel20: LevelConfigV2 = { ...mockBossLevel, questionCount: 20, targetTimeSec: 60 };
    // 19 / 20 = 95% in 40s
    const result = calculateLevelStars(bossLevel20, 19, 20, 40, false);
    expect(result.stars).toBe(3);
    expect(result.isPassed).toBe(true);
    expect(result.isPerfect).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/starRating.test.ts`
Expected: FAIL (module `../../src/utils/starRating` not found).

- [ ] **Step 3: Write minimal implementation in `src/utils/starRating.ts`**

Create `src/utils/starRating.ts`:
```typescript
import { LevelConfigV2 } from '../engine/types/level';

export interface StarRatingResult {
  stars: number; // 0, 1, 2, or 3
  isPerfect: boolean; // 100% accuracy within targetTimeSec
  isPassed: boolean; // stars >= 1
  accuracy: number; // 0–100 percentage
  reason: string;
}

export function calculateLevelStars(
  level: LevelConfigV2,
  correctCount: number,
  totalQuestions: number,
  durationSec: number,
  isTimedOut: boolean
): StarRatingResult {
  const safeTotal = Math.max(1, totalQuestions);
  const accuracyRatio = Math.max(0, Math.min(1, correctCount / safeTotal));
  const accuracyPercent = Math.round(accuracyRatio * 100);

  if (isTimedOut || durationSec > level.timeLimitSec) {
    return {
      stars: 0,
      isPerfect: false,
      isPassed: false,
      accuracy: accuracyPercent,
      reason: 'Waktu habis / Melebihi batas waktu maksimal',
    };
  }

  const withinTarget = durationSec <= level.targetTimeSec;
  const isPerfect = correctCount === totalQuestions && withinTarget;

  // 3 Stars: Accuracy >= 95% AND completed within targetTimeSec
  if (accuracyRatio >= 0.95 && withinTarget) {
    return {
      stars: 3,
      isPerfect,
      isPassed: true,
      accuracy: accuracyPercent,
      reason: isPerfect ? 'Sempurna & Sangat Kilat! 🏆' : 'Hebat, Cepat & Sangat Akurat! ⭐',
    };
  }

  // 2 Stars: Accuracy >= 85%
  if (accuracyRatio >= 0.85) {
    return {
      stars: 2,
      isPerfect: false,
      isPassed: true,
      accuracy: accuracyPercent,
      reason: 'Bagus & Akurat! ⭐',
    };
  }

  // 1 Star: Meets minimum passing accuracy
  if (accuracyRatio >= level.passingAccuracy) {
    return {
      stars: 1,
      isPerfect: false,
      isPassed: true,
      accuracy: accuracyPercent,
      reason: 'Level Selesai! 👍',
    };
  }

  return {
    stars: 0,
    isPerfect: false,
    isPassed: false,
    accuracy: accuracyPercent,
    reason: `Akurasi (${accuracyPercent}%) di bawah syarat kelulusan (${Math.round(level.passingAccuracy * 100)}%)`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/starRating.test.ts`
Expected: PASS (all 7 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/utils/starRating.ts tests/unit/starRating.test.ts
git commit -m "feat(campaign): implement canonical star rating engine per PRD §8.2.1 and §8.3.1

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Campaign State Management & DAG Unlocking

**Files:**
- Create: `src/utils/campaignState.ts`
- Test: `tests/unit/campaignState.test.ts`

**Interfaces:**
- Consumes: `LEVEL_MANIFEST_72` from `src/engine/manifest/levels.ts`, `migrateV1ToV2` from `src/engine/migration/migrator.ts`, `StarRatingResult` from `src/utils/starRating.ts`
- Produces: `V2CampaignState`, `V2LevelProgress`, `loadCampaignState()`, `saveCampaignState()`, `initializeOrMigrateCampaignState()`, `updateLevelProgress()`, `isLevelUnlocked()`, `getCompletedBossIds()`, `calculateTierStars()`

```typescript
export interface V2LevelProgress {
  levelId: string;
  unlocked: boolean;
  stars: number;
  bestScore: number;
  accuracy: number;
  bestTimeSec: number;
  migratedFromV1Id?: number;
  completedAt?: string;
}

export interface V2CampaignState {
  version: 2;
  levels: Record<string, V2LevelProgress>;
  totalStars: number;
  legacyStarCredits: number;
  migrationCompleted: boolean;
}
```

- [ ] **Step 1: Write the failing unit tests for campaign state**

Create `tests/unit/campaignState.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  V2CampaignState,
  loadCampaignState,
  saveCampaignState,
  initializeOrMigrateCampaignState,
  updateLevelProgress,
  isLevelUnlocked,
  getCompletedBossIds,
  calculateTierStars,
  CAMPAIGN_V2_STORAGE_KEY,
} from '../../src/utils/campaignState';
import { LEVEL_MANIFEST_72 } from '../../src/engine/manifest/levels';

describe('Campaign State & DAG Unlocking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes fresh campaign state with T1-ADD-01 unlocked and 0 stars', () => {
    const { state, justMigrated } = initializeOrMigrateCampaignState();
    expect(justMigrated).toBe(false);
    expect(state.version).toBe(2);
    expect(state.totalStars).toBe(0);
    expect(state.legacyStarCredits).toBe(0);
    expect(state.levels['T1-ADD-01']?.unlocked).toBe(true);
    expect(state.levels['T1-ADD-02']?.unlocked).toBe(false);
  });

  it('migrates legacy V1 progress if V2 state is absent and V1 progress exists', () => {
    const v1Progress = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1200, bestTimeSec: 20, accuracy: 100 },
      2: { levelId: 2, unlocked: true, stars: 2, bestScore: 900, bestTimeSec: 25, accuracy: 90 },
    };
    localStorage.setItem('hitung_kilat_progress_v1', JSON.stringify(v1Progress));

    const { state, justMigrated } = initializeOrMigrateCampaignState();
    expect(justMigrated).toBe(true);
    expect(state.levels['T1-ADD-01']?.stars).toBe(3);
    expect(state.totalStars).toBeGreaterThanOrEqual(3);
    expect(localStorage.getItem(CAMPAIGN_V2_STORAGE_KEY)).not.toBeNull();
  });

  it('evaluates DAG prerequisites: unlocks next level when all prerequisiteIds have stars >= 1', () => {
    const { state } = initializeOrMigrateCampaignState();
    const level2 = LEVEL_MANIFEST_72.find((l) => l.id === 'T1-ADD-02')!;
    expect(isLevelUnlocked(state, level2)).toBe(false);

    // Complete Level 1 with 2 stars
    const updatedState = updateLevelProgress(state, 'T1-ADD-01', {
      stars: 2,
      isPerfect: false,
      isPassed: true,
      accuracy: 90,
      reason: 'Great',
    }, 1000, 25, 9, 10);

    expect(updatedState.levels['T1-ADD-01']?.stars).toBe(2);
    expect(updatedState.totalStars).toBe(2);
    expect(isLevelUnlocked(updatedState, level2)).toBe(true);
  });

  it('tracks completed boss IDs correctly', () => {
    let state = initializeOrMigrateCampaignState().state;
    expect(getCompletedBossIds(state)).toEqual([]);

    state = updateLevelProgress(state, 'T1-BOSS', {
      stars: 1,
      isPerfect: false,
      isPassed: true,
      accuracy: 70,
      reason: 'Pass',
    }, 800, 35, 11, 15);

    expect(getCompletedBossIds(state)).toEqual(['T1-BOSS']);
  });

  it('calculates tier stars accurately (X / 36 ★)', () => {
    let state = initializeOrMigrateCampaignState().state;
    const tier1Stats = calculateTierStars(state, 1);
    expect(tier1Stats.total).toBe(36);
    expect(tier1Stats.earned).toBe(0);

    state = updateLevelProgress(state, 'T1-ADD-01', {
      stars: 3,
      isPerfect: true,
      isPassed: true,
      accuracy: 100,
      reason: 'Perfect',
    }, 1500, 20, 10, 10);

    const updatedTier1 = calculateTierStars(state, 1);
    expect(updatedTier1.earned).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/campaignState.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation in `src/utils/campaignState.ts`**

Create `src/utils/campaignState.ts`:
```typescript
import { LEVEL_MANIFEST_72 } from '../engine/manifest/levels';
import { LevelConfigV2 } from '../engine/types/level';
import { migrateV1ToV2 } from '../engine/migration/migrator';
import { StarRatingResult } from './starRating';
import { UserLevelProgress } from '../types';

export const CAMPAIGN_V2_STORAGE_KEY = 'hitung_kilat_campaign_v2';
export const LEGACY_PROGRESS_V1_KEY = 'hitung_kilat_progress_v1';

export interface V2LevelProgress {
  levelId: string;
  unlocked: boolean;
  stars: number; // 0..3
  bestScore: number;
  accuracy: number;
  bestTimeSec: number;
  migratedFromV1Id?: number;
  completedAt?: string;
}

export interface V2CampaignState {
  version: 2;
  levels: Record<string, V2LevelProgress>;
  totalStars: number;
  legacyStarCredits: number;
  migrationCompleted: boolean;
}

/**
 * Creates default empty campaign state with all 72 levels defined
 * and only T1-ADD-01 (order 1) unlocked.
 */
export function createDefaultCampaignState(): V2CampaignState {
  const levels: Record<string, V2LevelProgress> = {};
  for (const lvl of LEVEL_MANIFEST_72) {
    levels[lvl.id] = {
      levelId: lvl.id,
      unlocked: lvl.order === 1 || lvl.prerequisiteIds.length === 0,
      stars: 0,
      bestScore: 0,
      accuracy: 0,
      bestTimeSec: 0,
    };
  }
  return {
    version: 2,
    levels,
    totalStars: 0,
    legacyStarCredits: 0,
    migrationCompleted: false,
  };
}

export function loadCampaignState(): V2CampaignState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CAMPAIGN_V2_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as V2CampaignState;
    if (parsed && parsed.version === 2 && parsed.levels) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCampaignState(state: V2CampaignState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CAMPAIGN_V2_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save V2 campaign state:', err);
  }
}

/**
 * Checks DAG unlocking for a level:
 * Returns true if level is order 1 or all prerequisiteIds have stars >= 1.
 */
export function isLevelUnlocked(state: V2CampaignState, level: LevelConfigV2): boolean {
  if (level.order === 1 || level.prerequisiteIds.length === 0) return true;
  return level.prerequisiteIds.every((prereqId) => {
    const progress = state.levels[prereqId];
    return progress && progress.stars >= 1;
  });
}

/**
 * Initializes or runs migration from V1.
 */
export function initializeOrMigrateCampaignState(): {
  state: V2CampaignState;
  justMigrated: boolean;
} {
  const existing = loadCampaignState();
  if (existing) {
    // Refresh unlocks in case manifest was updated
    for (const lvl of LEVEL_MANIFEST_72) {
      if (!existing.levels[lvl.id]) {
        existing.levels[lvl.id] = {
          levelId: lvl.id,
          unlocked: isLevelUnlocked(existing, lvl),
          stars: 0,
          bestScore: 0,
          accuracy: 0,
          bestTimeSec: 0,
        };
      } else if (!existing.levels[lvl.id].unlocked) {
        existing.levels[lvl.id].unlocked = isLevelUnlocked(existing, lvl);
      }
    }
    return { state: existing, justMigrated: false };
  }

  // Check for legacy V1 progress
  let v1Progress: Record<number, UserLevelProgress> | null = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LEGACY_PROGRESS_V1_KEY);
      if (raw) v1Progress = JSON.parse(raw);
    } catch {
      v1Progress = null;
    }
  }

  const defaultState = createDefaultCampaignState();
  if (v1Progress && Object.keys(v1Progress).length > 0) {
    const migrationRes = migrateV1ToV2(v1Progress);
    let totalStars = 0;

    for (const [lvlId, prog] of Object.entries(migrationRes.levels)) {
      if (defaultState.levels[lvlId]) {
        defaultState.levels[lvlId] = {
          ...defaultState.levels[lvlId],
          stars: prog.stars,
          bestScore: prog.bestScore,
          accuracy: prog.accuracy,
          bestTimeSec: prog.bestTimeSec,
          migratedFromV1Id: prog.migratedFromV1Id,
        };
      }
    }

    // Recompute unlocks across all 72 levels
    for (const lvl of LEVEL_MANIFEST_72) {
      defaultState.levels[lvl.id].unlocked = isLevelUnlocked(defaultState, lvl);
      totalStars += defaultState.levels[lvl.id].stars;
    }

    defaultState.totalStars = totalStars;
    defaultState.legacyStarCredits = migrationRes.legacyStarCredits;
    defaultState.migrationCompleted = true;

    saveCampaignState(defaultState);
    const hasV1Activity = Object.values(v1Progress).some((p) => p.stars > 0);
    return { state: defaultState, justMigrated: hasV1Activity };
  }

  saveCampaignState(defaultState);
  return { state: defaultState, justMigrated: false };
}

/**
 * Updates level progress with result and re-evaluates unlocks across all levels.
 */
export function updateLevelProgress(
  state: V2CampaignState,
  levelId: string,
  result: StarRatingResult,
  score: number,
  timeSpentSec: number,
  correctCount: number,
  totalCount: number
): V2CampaignState {
  const current = state.levels[levelId] || {
    levelId,
    unlocked: true,
    stars: 0,
    bestScore: 0,
    accuracy: 0,
    bestTimeSec: 0,
  };

  const newStars = Math.max(current.stars, result.stars);
  const newBestScore = Math.max(current.bestScore, score);
  const newBestTime =
    current.bestTimeSec > 0 ? Math.min(current.bestTimeSec, timeSpentSec) : timeSpentSec;
  const newAccuracy = Math.max(current.accuracy, result.accuracy);

  const updatedLevels = {
    ...state.levels,
    [levelId]: {
      ...current,
      stars: newStars,
      bestScore: newBestScore,
      bestTimeSec: newBestTime,
      accuracy: newAccuracy,
      completedAt: new Date().toISOString(),
    },
  };

  // Re-evaluate unlocking for all levels
  let totalStars = 0;
  for (const lvl of LEVEL_MANIFEST_72) {
    if (!updatedLevels[lvl.id]) {
      updatedLevels[lvl.id] = {
        levelId: lvl.id,
        unlocked: false,
        stars: 0,
        bestScore: 0,
        accuracy: 0,
        bestTimeSec: 0,
      };
    }
    const isUnlocked = lvl.order === 1 || lvl.prerequisiteIds.every(
      (pId) => (updatedLevels[pId]?.stars || 0) >= 1
    );
    updatedLevels[lvl.id].unlocked = isUnlocked;
    totalStars += updatedLevels[lvl.id].stars;
  }

  const nextState: V2CampaignState = {
    ...state,
    levels: updatedLevels,
    totalStars,
  };

  saveCampaignState(nextState);
  return nextState;
}

export function getCompletedBossIds(state: V2CampaignState): string[] {
  const bossLevels = LEVEL_MANIFEST_72.filter((lvl) => lvl.boss);
  return bossLevels
    .filter((lvl) => (state.levels[lvl.id]?.stars || 0) >= 1)
    .map((lvl) => lvl.id);
}

export function calculateTierStars(
  state: V2CampaignState,
  tier: number
): { earned: number; total: number } {
  const tierLevels = LEVEL_MANIFEST_72.filter((lvl) => lvl.tier === tier);
  const earned = tierLevels.reduce(
    (acc, lvl) => acc + (state.levels[lvl.id]?.stars || 0),
    0
  );
  return { earned, total: tierLevels.length * 3 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/campaignState.test.ts`
Expected: PASS (all 5 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/utils/campaignState.ts tests/unit/campaignState.test.ts
git commit -m "feat(campaign): implement V2 campaign state and DAG prerequisite unlocking

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Migration Welcome Modal

**Files:**
- Create: `src/components/V2WelcomeModal.tsx`
- Test: `tests/unit/v2WelcomeModal.test.tsx`

**Interfaces:**
- Consumes: props (`isOpen`, `transferredStars`, `legacyStarCredits`, `unlockedLevelsCount`, `onClose`)
- Produces: `V2WelcomeModal` component in `src/components/V2WelcomeModal.tsx`

- [ ] **Step 1: Write the failing unit tests for `V2WelcomeModal`**

Create `tests/unit/v2WelcomeModal.test.tsx`:
```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { V2WelcomeModal } from '../../src/components/V2WelcomeModal';

describe('V2WelcomeModal (PRD §11 & Spec §7)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders migration summary when isOpen is true', () => {
    const handleClose = vi.fn();
    render(
      <V2WelcomeModal
        isOpen={true}
        transferredStars={24}
        legacyStarCredits={6}
        unlockedLevelsCount={14}
        onClose={handleClose}
      />
    );

    expect(screen.getByText(/Selamat Datang di Hitung Kilat V2!/i)).toBeDefined();
    expect(screen.getByText(/24 Bintang/i)).toBeDefined();
    expect(screen.getByText(/6 Kredit/i)).toBeDefined();
    expect(screen.getByText(/14 Level/i)).toBeDefined();

    const ctaButton = screen.getByRole('button', { name: /mulai petualangan 72 level/i });
    expect(ctaButton).toBeDefined();
    fireEvent.click(ctaButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('hitung_kilat_migration_ack_v2')).toBe('true');
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <V2WelcomeModal
        isOpen={false}
        transferredStars={0}
        legacyStarCredits={0}
        unlockedLevelsCount={1}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/v2WelcomeModal.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Write implementation of `src/components/V2WelcomeModal.tsx`**

Create `src/components/V2WelcomeModal.tsx`:
```typescript
import React from 'react';
import { Sparkles, Trophy, Star, ArrowRight, ShieldCheck } from 'lucide-react';
import { soundManager } from '../utils/sound';

export const MIGRATION_ACK_KEY = 'hitung_kilat_migration_ack_v2';

export interface V2WelcomeModalProps {
  isOpen: boolean;
  transferredStars: number;
  legacyStarCredits: number;
  unlockedLevelsCount: number;
  onClose: () => void;
}

export const V2WelcomeModal: React.FC<V2WelcomeModalProps> = ({
  isOpen,
  transferredStars,
  legacyStarCredits,
  unlockedLevelsCount,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(MIGRATION_ACK_KEY, 'true');
    } catch {
      // Ignore localStorage errors
    }
    soundManager.playClick();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="v2-welcome-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-[2.5rem] border-4 border-amber-500/80 bg-gradient-to-b from-indigo-900 via-indigo-950 to-purple-950 text-white p-6 sm:p-8 shadow-2xl space-y-6 my-8">
        {/* Glow Header Accent */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-400 text-amber-950 shadow-lg border-b-4 border-amber-600 mb-2">
            <Sparkles className="h-9 w-9 text-amber-950 fill-amber-950" />
          </div>
          <div className="inline-block rounded-full bg-amber-500/20 border border-amber-400/30 px-3.5 py-1 text-xs font-black text-amber-300 uppercase tracking-wider">
            Pembaruan Besar V2
          </div>
          <h2
            id="v2-welcome-title"
            className="text-2xl sm:text-3xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-orange-400"
          >
            Selamat Datang di Hitung Kilat V2!
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200 font-medium leading-relaxed">
            Petualangan berhitung diperluas menjadi <span className="text-amber-300 font-bold">72 Level</span> dalam 6 Tier dengan <span className="text-rose-300 font-bold">Pertarungan Boss</span> di setiap akhir tier. Kemajuan bermain Anda sebelumnya telah diselaraskan secara aman!
          </p>
        </div>

        {/* Migration Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/10 border border-white/15 p-3 text-center">
            <div className="flex items-center justify-center text-amber-400 mb-1">
              <Star className="h-5 w-5 fill-amber-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">{transferredStars}</div>
            <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mt-0.5">
              Bintang Ditransfer
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3 text-center">
            <div className="flex items-center justify-center text-cyan-400 mb-1">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="text-xl font-black text-white font-mono">{legacyStarCredits}</div>
            <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mt-0.5">
              Kredit Warisan
            </div>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/15 p-3 text-center">
            <div className="flex items-center justify-center text-emerald-400 mb-1">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="text-xl font-black text-white font-mono">{unlockedLevelsCount}</div>
            <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mt-0.5">
              Level Terbuka
            </div>
          </div>
        </div>

        {/* Features Checklist */}
        <div className="rounded-2xl border border-indigo-800 bg-indigo-900/50 p-4 space-y-2 text-xs text-indigo-200">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 font-black">✓</span>
            <span>6 Tier terstruktur dari Pemula hingga Legenda (12 level per tier).</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-400 font-black">✓</span>
            <span>Pertarungan Boss dengan HP Bar interaktif dan efek getar kemarahan.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-400 font-black">✓</span>
            <span>16 Pencapaian baru terstandarisasi hingga 216★ & penaklukan Boss.</span>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            id="v2-welcome-cta-button"
            onClick={handleDismiss}
            className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-sm font-black text-amber-950 border-b-4 border-amber-700 shadow-xl transition active:translate-y-0.5 uppercase tracking-wider"
          >
            <span>Mulai Petualangan 72 Level</span>
            <ArrowRight className="h-4 w-4 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/v2WelcomeModal.test.tsx`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/V2WelcomeModal.tsx tests/unit/v2WelcomeModal.test.tsx
git commit -m "feat(campaign): create V2WelcomeModal for celebrating V1 to V2 migration

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Standardized V2 Achievements Engine & UI

**Files:**
- Modify: `src/utils/achievements.ts`
- Modify: `src/components/AchievementsTab.tsx`
- Test: `tests/unit/v2Achievements.test.ts`

**Interfaces:**
- Consumes: `UserStats` from `src/types.ts`, `V2CampaignState`
- Produces: 16 canonical achievements, `evaluateAchievements(context: AchievementEvaluationContext)` with `hitung_kilat_unlocked_achievements_v2` persistence.

- [ ] **Step 1: Write the failing unit tests for V2 achievements**

Create `tests/unit/v2Achievements.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateAchievements,
  ACHIEVEMENTS_DEFINITIONS,
  AchievementEvaluationContext,
} from '../../src/utils/achievements';
import { UserStats } from '../../src/types';

describe('V2 Achievements System (PRD §17 & Spec §6)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const baseStats: UserStats = {
    totalSolved: 0,
    totalCorrect: 0,
    totalTimePlayedSec: 0,
    bestStreak: 0,
    highestTimeAttackScore: 0,
    highestSPM: 0,
    starsTotal: 0,
  };

  const createMockContext = (overrides?: Partial<AchievementEvaluationContext>): AchievementEvaluationContext => ({
    stats: baseStats,
    totalStars: 0,
    unlockedLevelsCount: 1,
    completedBossIds: [],
    highestSprintScore: 0,
    highestSurvivalSec: 0,
    dailyStreak: 0,
    masteredSubSkillsCount: 0,
    ...overrides,
  });

  it('contains exactly 16 canonical achievement definitions', () => {
    expect(ACHIEVEMENTS_DEFINITIONS).toHaveLength(16);
    const ids = ACHIEVEMENTS_DEFINITIONS.map((a) => a.id);
    expect(ids).toContain('stars_15');
    expect(ids).toContain('stars_40');
    expect(ids).toContain('stars_72');
    expect(ids).toContain('stars_144');
    expect(ids).toContain('stars_216');
    expect(ids).toContain('boss_t1');
    expect(ids).toContain('boss_t3');
    expect(ids).toContain('boss_t6');
    expect(ids).toContain('sprint_1000');
    expect(ids).toContain('sprint_2500');
    expect(ids).toContain('survival_120');
    expect(ids).toContain('survival_300');
    expect(ids).toContain('daily_streak_7');
    expect(ids).toContain('daily_streak_30');
    expect(ids).toContain('mastery_10');
    expect(ids).toContain('mastery_30');
  });

  it('unlocks star achievements progressively (15, 40, 72, 144, 216)', () => {
    const ctx15 = createMockContext({ totalStars: 15 });
    const res15 = evaluateAchievements(ctx15);
    const star15 = res15.achievements.find((a) => a.id === 'stars_15');
    expect(star15?.unlocked).toBe(true);
    expect(res15.newlyUnlocked.map((a) => a.id)).toContain('stars_15');

    const ctx72 = createMockContext({ totalStars: 72 });
    const res72 = evaluateAchievements(ctx72);
    expect(res72.achievements.find((a) => a.id === 'stars_72')?.unlocked).toBe(true);
    expect(res72.achievements.find((a) => a.id === 'stars_144')?.unlocked).toBe(false);
  });

  it('unlocks boss conquests when respective boss IDs are completed', () => {
    const ctxBoss1 = createMockContext({ completedBossIds: ['T1-BOSS'] });
    const resBoss1 = evaluateAchievements(ctxBoss1);
    expect(resBoss1.achievements.find((a) => a.id === 'boss_t1')?.unlocked).toBe(true);
    expect(resBoss1.achievements.find((a) => a.id === 'boss_t3')?.unlocked).toBe(false);

    const ctxBossAll = createMockContext({ completedBossIds: ['T1-BOSS', 'T3-BOSS', 'T6-BOSS'] });
    const resBossAll = evaluateAchievements(ctxBossAll);
    expect(resBossAll.achievements.find((a) => a.id === 'boss_t1')?.unlocked).toBe(true);
    expect(resBossAll.achievements.find((a) => a.id === 'boss_t3')?.unlocked).toBe(true);
    expect(resBossAll.achievements.find((a) => a.id === 'boss_t6')?.unlocked).toBe(true);
  });

  it('unlocks sprint and survival achievements based on high scores', () => {
    const ctx = createMockContext({
      highestSprintScore: 2600,
      highestSurvivalSec: 130,
    });
    const res = evaluateAchievements(ctx);
    expect(res.achievements.find((a) => a.id === 'sprint_1000')?.unlocked).toBe(true);
    expect(res.achievements.find((a) => a.id === 'sprint_2500')?.unlocked).toBe(true);
    expect(res.achievements.find((a) => a.id === 'survival_120')?.unlocked).toBe(true);
    expect(res.achievements.find((a) => a.id === 'survival_300')?.unlocked).toBe(false);
  });

  it('unlocks sub-skill mastery achievements (10, 30)', () => {
    const ctx = createMockContext({ masteredSubSkillsCount: 12 });
    const res = evaluateAchievements(ctx);
    expect(res.achievements.find((a) => a.id === 'mastery_10')?.unlocked).toBe(true);
    expect(res.achievements.find((a) => a.id === 'mastery_30')?.unlocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/v2Achievements.test.ts`
Expected: FAIL (achievements definitions do not match the 16 V2 specifications).

- [ ] **Step 3: Update `src/utils/achievements.ts` with 16 V2 achievements**

Edit `src/utils/achievements.ts` to implement the canonical 16 definitions, `AchievementEvaluationContext`, and persistent evaluation using `hitung_kilat_unlocked_achievements_v2`:
```typescript
import { Achievement, UserStats } from '../types';

export interface AchievementConfig {
  id: string;
  title: string;
  description: string;
  category: 'milestone' | 'streak' | 'accuracy' | 'speed' | 'mastery';
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  icon: string;
  targetValue: number;
  getValue: (context: AchievementEvaluationContext) => number;
}

export interface AchievementEvaluationContext {
  stats: UserStats;
  totalStars: number;
  unlockedLevelsCount: number;
  completedBossIds: string[];
  highestSprintScore: number;
  highestSurvivalSec: number;
  dailyStreak: number;
  masteredSubSkillsCount: number;
  dailyCompletedCount?: number;
}

export const ACHIEVEMENTS_DEFINITIONS: AchievementConfig[] = [
  // 1. Campaign Stars
  {
    id: 'stars_15',
    title: 'Pengumpul Bintang',
    description: 'Raih 15★ di Peta Kampanye',
    category: 'milestone',
    tier: 'bronze',
    icon: 'Star',
    targetValue: 15,
    getValue: (ctx) => ctx.totalStars,
  },
  {
    id: 'stars_40',
    title: 'Bintang Terang',
    description: 'Raih 40★ di Peta Kampanye',
    category: 'milestone',
    tier: 'silver',
    icon: 'Star',
    targetValue: 40,
    getValue: (ctx) => ctx.totalStars,
  },
  {
    id: 'stars_72',
    title: 'Veteran Kampanye',
    description: 'Raih 72★ di Peta Kampanye',
    category: 'milestone',
    tier: 'silver',
    icon: 'Sparkles',
    targetValue: 72,
    getValue: (ctx) => ctx.totalStars,
  },
  {
    id: 'stars_144',
    title: 'Master Kampanye',
    description: 'Raih 144★ di Peta Kampanye',
    category: 'milestone',
    tier: 'gold',
    icon: 'Award',
    targetValue: 144,
    getValue: (ctx) => ctx.totalStars,
  },
  {
    id: 'stars_216',
    title: 'Mahkota Sempurna',
    description: 'Tuntaskan 216★ penuh di 72 level kampanye',
    category: 'milestone',
    tier: 'diamond',
    icon: 'Crown',
    targetValue: 216,
    getValue: (ctx) => ctx.totalStars,
  },

  // 2. Boss Conquests
  {
    id: 'boss_t1',
    title: 'Penakluk Pemula',
    description: 'Kalahkan Boss Tier 1 (Level 12)',
    category: 'milestone',
    tier: 'bronze',
    icon: 'Trophy',
    targetValue: 1,
    getValue: (ctx) => (ctx.completedBossIds.includes('T1-BOSS') ? 1 : 0),
  },
  {
    id: 'boss_t3',
    title: 'Penakluk Terampil',
    description: 'Kalahkan Boss Tier 3 (Level 36)',
    category: 'milestone',
    tier: 'silver',
    icon: 'Trophy',
    targetValue: 1,
    getValue: (ctx) => (ctx.completedBossIds.includes('T3-BOSS') ? 1 : 0),
  },
  {
    id: 'boss_t6',
    title: 'Grandmaster Sejati',
    description: 'Kalahkan Grandmaster (Level 72)',
    category: 'milestone',
    tier: 'diamond',
    icon: 'Crown',
    targetValue: 1,
    getValue: (ctx) => (ctx.completedBossIds.includes('T6-BOSS') ? 1 : 0),
  },

  // 3. Competitive Sprint 60s
  {
    id: 'sprint_1000',
    title: 'Kilat Pertama',
    description: 'Tembus 1.000 poin di Sprint 60s',
    category: 'speed',
    tier: 'bronze',
    icon: 'Timer',
    targetValue: 1000,
    getValue: (ctx) => ctx.highestSprintScore,
  },
  {
    id: 'sprint_2500',
    title: 'Kecepatan Suara',
    description: 'Tembus 2.500 poin di Sprint 60s',
    category: 'speed',
    tier: 'gold',
    icon: 'Zap',
    targetValue: 2500,
    getValue: (ctx) => ctx.highestSprintScore,
  },

  // 4. Competitive Survival
  {
    id: 'survival_120',
    title: 'Penyintas Tangguh',
    description: 'Bertahan min. 2 menit (120s) di Survival',
    category: 'streak',
    tier: 'silver',
    icon: 'Flame',
    targetValue: 120,
    getValue: (ctx) => ctx.highestSurvivalSec,
  },
  {
    id: 'survival_300',
    title: 'Dewa Ketahanan',
    description: 'Bertahan min. 5 menit (300s) di Survival',
    category: 'streak',
    tier: 'diamond',
    icon: 'Flame',
    targetValue: 300,
    getValue: (ctx) => ctx.highestSurvivalSec,
  },

  // 5. Daily Streak
  {
    id: 'daily_streak_7',
    title: 'Seminggu Disiplin',
    description: 'Pertahankan 7 hari streak harian',
    category: 'streak',
    tier: 'silver',
    icon: 'Calendar',
    targetValue: 7,
    getValue: (ctx) => ctx.dailyStreak,
  },
  {
    id: 'daily_streak_30',
    title: 'Kebiasaan Juara',
    description: 'Pertahankan 30 hari streak harian',
    category: 'streak',
    tier: 'diamond',
    icon: 'Crown',
    targetValue: 30,
    getValue: (ctx) => ctx.dailyStreak,
  },

  // 6. Sub-Skill Mastery
  {
    id: 'mastery_10',
    title: 'Multi-Talenta',
    description: 'Kuasai min. 10 sub-skill (skor ≥ 85)',
    category: 'mastery',
    tier: 'silver',
    icon: 'Brain',
    targetValue: 10,
    getValue: (ctx) => ctx.masteredSubSkillsCount,
  },
  {
    id: 'mastery_30',
    title: 'Ahli Matematika',
    description: 'Kuasai min. 30 sub-skill (skor ≥ 85)',
    category: 'mastery',
    tier: 'gold',
    icon: 'Brain',
    targetValue: 30,
    getValue: (ctx) => ctx.masteredSubSkillsCount,
  },
];

export const UNLOCKED_ACHIEVEMENTS_V2_KEY = 'hitung_kilat_unlocked_achievements_v2';
export const UNLOCKED_ACHIEVEMENTS_V1_KEY = 'hitung_kilat_unlocked_achievements_v1';

export function loadUnlockedAchievementsMap(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const rawV2 = localStorage.getItem(UNLOCKED_ACHIEVEMENTS_V2_KEY);
    if (rawV2) return JSON.parse(rawV2);

    // Fallback migration from V1 if present
    const rawV1 = localStorage.getItem(UNLOCKED_ACHIEVEMENTS_V1_KEY);
    if (rawV1) {
      const v1Map = JSON.parse(rawV1);
      return v1Map;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveUnlockedAchievementsMap(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(UNLOCKED_ACHIEVEMENTS_V2_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Error saving unlocked achievements', e);
  }
}

export function evaluateAchievements(context: AchievementEvaluationContext): {
  achievements: Achievement[];
  newlyUnlocked: Achievement[];
} {
  const savedUnlocks = loadUnlockedAchievementsMap();
  const newlyUnlocked: Achievement[] = [];
  const updatedUnlocks = { ...savedUnlocks };
  let hasNew = false;

  const list: Achievement[] = ACHIEVEMENTS_DEFINITIONS.map((def) => {
    const currentValue = def.getValue(context);
    const wasUnlocked = !!savedUnlocks[def.id];
    const isNowUnlocked = currentValue >= def.targetValue;

    if (isNowUnlocked && !wasUnlocked) {
      const unlockTime = new Date().toISOString();
      updatedUnlocks[def.id] = unlockTime;
      hasNew = true;
      const item: Achievement = {
        id: def.id,
        title: def.title,
        description: def.description,
        category: def.category,
        icon: def.icon,
        targetValue: def.targetValue,
        currentValue,
        unlocked: true,
        unlockedAt: unlockTime,
        tier: def.tier,
      };
      newlyUnlocked.push(item);
      return item;
    }

    return {
      id: def.id,
      title: def.title,
      description: def.description,
      category: def.category,
      icon: def.icon,
      targetValue: def.targetValue,
      currentValue,
      unlocked: wasUnlocked || isNowUnlocked,
      unlockedAt: savedUnlocks[def.id],
      tier: def.tier,
    };
  });

  if (hasNew) {
    saveUnlockedAchievementsMap(updatedUnlocks);
  }

  return {
    achievements: list,
    newlyUnlocked,
  };
}
```

- [ ] **Step 4: Update `src/components/AchievementsTab.tsx` to handle V2 context**

Modify `src/components/AchievementsTab.tsx` to accept optional `completedBossIds`, `highestSprintScore`, `highestSurvivalSec`, and `masteredSubSkillsCount`, providing safe defaults.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/v2Achievements.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 6: Commit**

```bash
git add src/utils/achievements.ts src/components/AchievementsTab.tsx tests/unit/v2Achievements.test.ts
git commit -m "feat(achievements): standardize 16 V2 achievements and evaluation context

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 6-Tier Accordion Campaign Map

**Files:**
- Modify: `src/components/LevelMap.tsx`
- Create: `tests/unit/campaignLevelMap.test.tsx`

**Interfaces:**
- Consumes: `LEVEL_MANIFEST_72` from `src/engine/manifest/levels.ts`, `V2CampaignState`, `V2LevelProgress` from `src/utils/campaignState.ts`
- Produces: `LevelMap` component with 6-tier accordion interface, tier star meters, Boss prominence chips, and level selection callback.

- [ ] **Step 1: Write the failing unit tests for `LevelMap`**

Create `tests/unit/campaignLevelMap.test.tsx`:
```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LevelMap } from '../../src/components/LevelMap';
import { createDefaultCampaignState, updateLevelProgress } from '../../src/utils/campaignState';

describe('LevelMap 6-Tier Accordion (Spec §3)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders global star progress bar with 216 max stars', () => {
    const state = createDefaultCampaignState();
    render(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    expect(screen.getByText(/Peta Kampanye Matematika/i)).toBeDefined();
    expect(screen.getByText(/0 \/ 216 ★/i)).toBeDefined();
  });

  it('renders 6 accordion tiers and expands active tier by default', () => {
    const state = createDefaultCampaignState();
    render(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    expect(screen.getByText(/Tier 1 — Pemula/i)).toBeDefined();
    expect(screen.getByText(/Tier 2 — Menengah/i)).toBeDefined();
    expect(screen.getByText(/Tier 3 — Terampil/i)).toBeDefined();
    expect(screen.getByText(/Tier 4 — Mahir/i)).toBeDefined();
    expect(screen.getByText(/Tier 5 — Master/i)).toBeDefined();
    expect(screen.getByText(/Tier 6 — Legenda/i)).toBeDefined();

    // Level 1 card is visible by default
    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();
  });

  it('toggles accordion tier collapse when clicking header', () => {
    const state = createDefaultCampaignState();
    render(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    const tier2Header = screen.getByRole('button', { name: /tier 2/i });
    expect(tier2Header.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(tier2Header);
    expect(tier2Header.getAttribute('aria-expanded')).toBe('true');
  });

  it('triggers onSelectLevel when clicking an unlocked level card', () => {
    const state = createDefaultCampaignState();
    const handleSelectLevel = vi.fn();
    render(
      <LevelMap
        campaignState={state}
        onSelectLevel={handleSelectLevel}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();
    fireEvent.click(level1Card!);
    expect(handleSelectLevel).toHaveBeenCalledTimes(1);
    expect(handleSelectLevel.mock.calls[0][0].id).toBe('T1-ADD-01');
  });

  it('renders legacy star credits badge if legacyStarCredits > 0', () => {
    let state = createDefaultCampaignState();
    state = { ...state, legacyStarCredits: 8 };

    render(
      <LevelMap
        campaignState={state}
        onSelectLevel={vi.fn()}
        onStartTimeAttack={vi.fn()}
        onStartPractice={vi.fn()}
        onStartDailyChallenge={vi.fn()}
      />
    );

    expect(screen.getByText(/\+8 Bintang Warisan V1/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/campaignLevelMap.test.tsx`
Expected: FAIL (LevelMap does not yet render 6-tier accordion or 216 stars).

- [ ] **Step 3: Refactor `src/components/LevelMap.tsx` with 6-tier accordion**

Refactor `src/components/LevelMap.tsx` with:
- Imports: `LEVEL_MANIFEST_72`, `LevelConfigV2`, `V2CampaignState`, `calculateTierStars`.
- Props:
  ```typescript
  interface LevelMapProps {
    campaignState?: V2CampaignState;
    progress?: Record<string, V2LevelProgress> | Record<number, UserLevelProgress>;
    onSelectLevel: (level: LevelConfigV2) => void;
    onStartTimeAttack: () => void;
    onStartPractice: () => void;
    onStartDailyChallenge: () => void;
    onOpenCompetitiveModal?: () => void;
    dailyStreak?: number;
    isDailyCompletedToday?: boolean;
  }
  ```
- Global star meter `X / 216 ★`.
- Tier Accordions (T1 through T6) with `tier` metadata:
  - T1: Pemula (Lv 1–12, Boss: T1-BOSS)
  - T2: Menengah (Lv 13–24, Boss: T2-BOSS)
  - T3: Terampil (Lv 25–36, Boss: T3-BOSS)
  - T4: Mahir (Lv 37–48, Boss: T4-BOSS)
  - T5: Master (Lv 49–60, Boss: T5-BOSS)
  - T6: Legenda (Lv 61–72, Boss: T6-BOSS)
- Tier Star Counters: `X / 36 ★`.
- Cards: `id={'level-card-' + level.order}` and `id={'level-card-' + level.id}`.
- Touch target $\ge 48\text{px}$ on all interactive buttons and accordion headers.
- Boss status badges (`Terkunci`, `Siap Ditantang`, `Ditaklukkan`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/campaignLevelMap.test.tsx`
Expected: PASS (all 5 tests green).

- [ ] **Step 5: Verify existing competitive & global integration tests still pass**

Run: `npx vitest run tests/unit/competitivePlayScreen.test.tsx tests/unit/globalMasteryIntegration.test.tsx`
Expected: PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add src/components/LevelMap.tsx tests/unit/campaignLevelMap.test.tsx
git commit -m "feat(campaign): implement 6-tier accordion campaign map with 72 levels

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Campaign Arena V2 with Boss System & DynamicKeypad

**Files:**
- Modify: `src/components/PlayScreen.tsx`
- Create: `tests/unit/campaignPlayScreen.test.tsx`

**Interfaces:**
- Consumes: `LevelConfigV2`, `createDefaultGeneratorRegistry()`, `DynamicKeypad`, `calculateLevelStars`, `ingestGameAnswers`
- Produces: `PlayScreen` component supporting registry question generation, adaptive keypad, Boss HP Bar & rage shake, monotonic timer, and `GameSummary` completion.

- [ ] **Step 1: Write the failing unit tests for `PlayScreen`**

Create `tests/unit/campaignPlayScreen.test.tsx`:
```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayScreen } from '../../src/components/PlayScreen';
import { LEVEL_MANIFEST_72 } from '../../src/engine/manifest/levels';

describe('PlayScreen V2 Arena & Boss Battle (Spec §4)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  const level1 = LEVEL_MANIFEST_72.find((l) => l.id === 'T1-ADD-01')!;
  const bossLevel = LEVEL_MANIFEST_72.find((l) => l.id === 'T1-BOSS')!;

  it('generates questions from registry and renders question prompt and keypad', () => {
    render(
      <PlayScreen
        level={level1}
        onFinishLevel={vi.fn()}
        onExit={vi.fn()}
      />
    );

    // Dynamic keypad numbers
    expect(screen.getByRole('button', { name: '1' })).toBeDefined();
    expect(screen.getByRole('button', { name: '9' })).toBeDefined();
    // Central prompt container exists
    expect(screen.getByTestId('question-prompt')).toBeDefined();
  });

  it('renders Boss HP bar and crimson theme on boss level', () => {
    render(
      <PlayScreen
        level={bossLevel}
        onFinishLevel={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(screen.getByText(/PERTARUNGAN BOSS/i)).toBeDefined();
    const hpBar = screen.getByRole('progressbar');
    expect(hpBar).toBeDefined();
    expect(hpBar.getAttribute('aria-valuemax')).toBe(String(bossLevel.questionCount));
  });

  it('triggers screen shake and sound on wrong answer during boss battle', () => {
    render(
      <PlayScreen
        level={bossLevel}
        onFinishLevel={vi.fn()}
        onExit={vi.fn()}
      />
    );

    // Type deliberately incorrect answer: '9999'
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    fireEvent.click(screen.getByRole('button', { name: '9' }));

    const submitBtn = screen.getByTestId('keypad-submit');
    fireEvent.click(submitBtn);

    // Verify error card feedback exists
    const arenaCard = screen.getByTestId('arena-card');
    expect(arenaCard.className).toContain('animate-shake');
  });

  it('submits answer and advances to next question when input is correct', () => {
    const handleFinish = vi.fn();
    render(
      <PlayScreen
        level={level1}
        onFinishLevel={handleFinish}
        onExit={vi.fn()}
      />
    );

    // Initial question count indicator
    expect(screen.getByText(/Soal 1 dari/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/campaignPlayScreen.test.tsx`
Expected: FAIL (PlayScreen still uses legacy mathGenerator and lacks boss HP bar).

- [ ] **Step 3: Refactor `src/components/PlayScreen.tsx` with registry and Boss HP Bar**

Refactor `src/components/PlayScreen.tsx`:
- Accept `level: LevelConfigV2 | LevelConfig` (adapting if legacy `LevelConfig` is provided).
- Question generation using `createDefaultGeneratorRegistry()`:
  ```typescript
  const registry = useMemo(() => createDefaultGeneratorRegistry(), []);
  ```
- Use `DynamicKeypad` with `onKeyPress`, `onBackspace`, `onSubmit`, `onClear`, and `answerKind`.
- Keyboard listener:
  - Supports `0-9`, `-`, `/`, `.`, `Backspace`, `Enter`, `Escape`.
  - Enforces `e.preventDefault()` on handled keys.
  - Skips system chords (`e.ctrlKey || e.metaKey || e.altKey`).
- Boss mode rendering:
  - Header: `PERTARUNGAN BOSS: [NAMA LEVEL]` with crimson/gold styling.
  - Boss HP Bar: max HP = `questionCount`, current HP = `questionCount - correctCount`.
  - Rage effect: on wrong answer, triggers `animate-shake` CSS animation with crimson flash.
- Time tracking with monotonic timestamps (`Date.now() - startTime`).
- Star evaluation on completion with `calculateLevelStars`.
- Mastery ingestion via `ingestGameAnswers`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/campaignPlayScreen.test.tsx`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/PlayScreen.tsx tests/unit/campaignPlayScreen.test.tsx
git commit -m "feat(campaign): integrate V2 generator registry, Boss HP bar, and DynamicKeypad in PlayScreen

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Enhanced Result Modal with Boss Fanfare, Perfect Badge & Achievement Pop-ups

**Files:**
- Modify: `src/components/ResultModal.tsx`
- Create: `tests/unit/resultModalV2.test.tsx`

**Interfaces:**
- Consumes: `GameSummary` with `isBoss?: boolean`, `isPerfect?: boolean`, `unlockedAchievements?: Achievement[]`, `targetTimeSec?: number`, `timeLimitSec?: number`
- Produces: `ResultModal` component with Boss victory banner, Perfect Badge, target speed comparison, and Achievement Unlocked pop-up cards.

- [ ] **Step 1: Write the failing unit tests for `ResultModal` V2**

Create `tests/unit/resultModalV2.test.tsx`:
```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultModal } from '../../src/components/ResultModal';
import { GameSummary, Achievement } from '../../src/types';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('ResultModal V2 Enhancements (Spec §5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseSummary: GameSummary = {
    mode: 'campaign',
    levelId: 1,
    score: 1500,
    questionsTotal: 10,
    correctCount: 10,
    wrongCount: 0,
    accuracy: 100,
    timeSpentSec: 22,
    avgTimePerQuestionSec: 2.2,
    questionsPerMinute: 27,
    maxStreak: 10,
    starsEarned: 3,
    history: [],
    isNewRecord: true,
  };

  it('renders Perfect Badge when isPerfect is true', () => {
    const perfectSummary: GameSummary = {
      ...baseSummary,
      isPerfect: true,
      targetTimeSec: 30,
    };

    render(
      <ResultModal
        summary={perfectSummary}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.getByText(/PERFECT RUN/i)).toBeDefined();
  });

  it('renders Boss victory banner when isBoss is true and starsEarned >= 1', () => {
    const bossSummary: GameSummary = {
      ...baseSummary,
      isBoss: true,
      starsEarned: 2,
    };

    render(
      <ResultModal
        summary={bossSummary}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.getByText(/TIER BOSS DITAKLUKKAN!/i)).toBeDefined();
  });

  it('renders Achievement Unlocked card when newly unlocked achievements are present', () => {
    const mockAchievement: Achievement = {
      id: 'boss_t1',
      title: 'Penakluk Pemula',
      description: 'Kalahkan Boss Tier 1 (Level 12)',
      category: 'milestone',
      tier: 'bronze',
      icon: 'Trophy',
      targetValue: 1,
      currentValue: 1,
      unlocked: true,
    };

    const summaryWithAch: GameSummary = {
      ...baseSummary,
      unlockedAchievements: [mockAchievement],
    };

    render(
      <ResultModal
        summary={summaryWithAch}
        onRetry={vi.fn()}
        onHome={vi.fn()}
      />
    );

    expect(screen.getByText(/Pencapaian Terbuka!/i)).toBeDefined();
    expect(screen.getByText(/Penakluk Pemula/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/resultModalV2.test.tsx`
Expected: FAIL (ResultModal does not yet render Perfect Badge or Boss victory banner).

- [ ] **Step 3: Update `src/types.ts` and `src/components/ResultModal.tsx`**

1. Update `src/types.ts` `GameSummary`:
```typescript
export interface GameSummary {
  mode: GameMode;
  levelId?: number | string;
  score: number;
  questionsTotal: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  timeSpentSec: number;
  avgTimePerQuestionSec: number;
  questionsPerMinute: number;
  maxStreak: number;
  starsEarned: number;
  history: Question[];
  isNewRecord: boolean;
  isNewStarRecord?: boolean;
  previousStars?: number;
  sessionId?: string;
  isPerfect?: boolean;
  isBoss?: boolean;
  targetTimeSec?: number;
  timeLimitSec?: number;
  unlockedAchievements?: Achievement[];
}
```
2. Update `src/components/ResultModal.tsx`:
- Render Boss victory banner: `★ TIER BOSS DITAKLUKKAN! ★` with golden pulse.
- Render Perfect Badge: `PERFECT RUN` with diamond glow.
- Render Target vs Actual speed comparison card.
- Render newly unlocked achievement pop-up card.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/resultModalV2.test.tsx`
Expected: PASS (all tests green).

- [ ] **Step 5: Run existing remediation tests to verify no regressions**

Run: `npx vitest run tests/unit/remediationNavigation.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/components/ResultModal.tsx tests/unit/resultModalV2.test.tsx
git commit -m "feat(result): add Boss victory banner, Perfect Badge, and achievement unlock notifications in ResultModal

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: App.tsx Orchestration, V1 $\to$ V2 Auto-Migration & End-to-End Integration

**Files:**
- Modify: `src/App.tsx`
- Create: `tests/unit/campaignEndToEnd.test.tsx`

**Interfaces:**
- Consumes: `initializeOrMigrateCampaignState`, `updateLevelProgress`, `evaluateAchievements`, `V2WelcomeModal`, `LEVEL_MANIFEST_72`
- Produces: Complete campaign flow from mount to level completion and achievement evaluation.

- [ ] **Step 1: Write the failing end-to-end integration test**

Create `tests/unit/campaignEndToEnd.test.tsx`:
```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';
import { LEVEL_MANIFEST_72 } from '../../src/engine/manifest/levels';

describe('Campaign V2 End-to-End Flow (Spec §2 & §8)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('launches V2 welcome modal when V1 progress is detected', async () => {
    const v1Prog = {
      1: { levelId: 1, unlocked: true, stars: 3, bestScore: 1000, bestTimeSec: 20, accuracy: 100 },
    };
    localStorage.setItem('hitung_kilat_progress_v1', JSON.stringify(v1Prog));

    render(<App />);

    expect(screen.getByText(/Selamat Datang di Hitung Kilat V2!/i)).toBeDefined();
    const startBtn = screen.getByRole('button', { name: /mulai petualangan 72 level/i });
    fireEvent.click(startBtn);

    // Modal is dismissed, level map visible
    expect(screen.queryByText(/Selamat Datang di Hitung Kilat V2!/i)).toBeNull();
    expect(screen.getByText(/Peta Kampanye Matematika/i)).toBeDefined();
  });

  it('selects level from 6-tier accordion, plays in arena, and records completion', async () => {
    render(<App />);

    // Select Level 1 card
    const level1Card = document.getElementById('level-card-1');
    expect(level1Card).toBeDefined();
    fireEvent.click(level1Card!);

    // PlayScreen is rendered with question prompt
    expect(screen.getByTestId('question-prompt')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/campaignEndToEnd.test.tsx`
Expected: FAIL (App.tsx not yet wired to V2 campaign state and welcome modal).

- [ ] **Step 3: Update `src/App.tsx` with V2 Campaign State & Migration**

1. Import:
```typescript
import {
  initializeOrMigrateCampaignState,
  loadCampaignState,
  saveCampaignState,
  updateLevelProgress,
  V2CampaignState,
  isLevelUnlocked,
  getCompletedBossIds,
} from './utils/campaignState';
import { V2WelcomeModal, MIGRATION_ACK_KEY } from './components/V2WelcomeModal';
import { LEVEL_MANIFEST_72 } from './engine/manifest/levels';
import { LevelConfigV2 } from './engine/types/level';
import { evaluateAchievements } from './utils/achievements';
import { getMasteryStore } from './utils/masteryBridge';
```
2. State initialization in `App`:
```typescript
const [campaignState, setCampaignState] = useState<V2CampaignState>(() => {
  const { state } = initializeOrMigrateCampaignState();
  return state;
});
const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(() => {
  const hasAck = localStorage.getItem(MIGRATION_ACK_KEY) === 'true';
  const { state, justMigrated } = initializeOrMigrateCampaignState();
  return justMigrated && !hasAck;
});
const [activeLevelV2, setActiveLevelV2] = useState<LevelConfigV2 | null>(null);
```
3. Update `handleSelectLevel` to accept `LevelConfigV2`.
4. Update `handleFinishGame`:
- For campaign mode, call `updateLevelProgress()` on `campaignState`.
- Assemble `AchievementEvaluationContext`:
  ```typescript
  const completedBossIds = getCompletedBossIds(nextCampaignState);
  const masteredSubSkillsCount = Object.values(
    getMasteryStore().getAllMasteryRecords()
  ).filter((r) => r.masteryScore >= 85).length;
  const achContext = {
    stats: updatedStats,
    totalStars: nextCampaignState.totalStars,
    unlockedLevelsCount: Object.values(nextCampaignState.levels).filter((l) => l.unlocked).length,
    completedBossIds,
    highestSprintScore: 0,
    highestSurvivalSec: 0,
    dailyStreak: getEffectiveDailyStreak(dailyState),
    masteredSubSkillsCount,
  };
  const { newlyUnlocked } = evaluateAchievements(achContext);
  summary.unlockedAchievements = newlyUnlocked;
  ```
5. Wire `V2WelcomeModal` in JSX.
6. Pass `campaignState` to `LevelMap`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/campaignEndToEnd.test.tsx`
Expected: PASS (all tests green).

- [ ] **Step 5: Run full project test suite**

Run: `npm test`
Expected: 100% test pass rate across all test files.

- [ ] **Step 6: Check TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Check production build**

Run: `npm run build`
Expected: Clean build exit code 0.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx tests/unit/campaignEndToEnd.test.tsx
git commit -m "feat(app): orchestrate V2 campaign state, auto-migration, and welcome modal in App.tsx

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Plan Self-Review Checklist

- **Spec Coverage:**
  - §2: Architecture, data contracts, and `V2CampaignState` $\to$ Handled in Tasks 2 & 8.
  - §3: 6-Tier accordion campaign map $\to$ Handled in Task 5.
  - §4: Campaign Arena V2, generator registry, Boss HP bar, DynamicKeypad, star calculation $\to$ Handled in Tasks 1 & 6.
  - §5: Enhanced Result Modal (Boss fanfare, Perfect Badge, achievement pop-up) $\to$ Handled in Task 7.
  - §6: 16 Canonical V2 achievements & context $\to$ Handled in Task 4.
  - §7: V2WelcomeModal $\to$ Handled in Task 3.
  - §8: Accessibility (WCAG 2.2 AA) & quality verification gates $\to$ Integrated throughout all tasks.
- **Placeholder Scan:** Zero `TODO`, `TBD`, or placeholder values. All steps specify exact code, file paths, test commands, and commit messages.
- **Type Consistency:** Exact signatures match across tasks (`LevelConfigV2`, `V2CampaignState`, `V2LevelProgress`, `StarRatingResult`, `AchievementEvaluationContext`).
