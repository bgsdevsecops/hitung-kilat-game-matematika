# Cloud Sync V2 Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an authoritative, backward-compatible Cloud Synchronization V2 subsystem that deterministically synchronizes and merges the full 72-level `V2CampaignState`, 16 V2 achievements, aggregated user statistics, daily challenge streaks, and 7-day activity records across multiple devices using Firebase Firestore, with strict zero-progress-loss guarantees.

**Architecture:** Extend Firestore data contracts with `schemaVersion: 2`, build a pure functional deterministic merge engine (`mergeGameProgress`) supporting both V2-to-V2 superset reconciliation and V1-to-V2 legacy cloud auto-migration with DAG prerequisite re-evaluation, wire debounced background auto-sync into `src/App.tsx`, and enhance `src/components/SyncAccountModal.tsx` with V2 sync indicators.

**Tech Stack:** TypeScript 5.8+, React 19, Firebase Auth & Firestore 10+, Vitest 3+, Testing Library React.

**Spec:** `docs/superpowers/specs/2026-09-17-cloud-sync-v2-persistence-design.md`

## Global Constraints

- **Git Safety Policy**: Strictly local commits on branch `feature/12.9.16.8-cloud-sync-v2-persistence`. Zero push to remote.
- **Commit Trailer**: Mandatory trailer on all commits: `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
- **Zero Progress Loss**: Stars (0..3★) use `Math.max`. Valid fastest elapsed times ($>0$) use `Math.min`. Unlocked achievements use set union. DAG prerequisites are re-evaluated across all 72 levels after merge.
- **Backward Compatibility**: Dual-write 24-level legacy mapping via `projectV2ToLegacyV1` so existing clients never break. Auto-migrate legacy V1 cloud snapshots on the fly.
- **Verification Gates**: 100% test pass rate across all existing (67 suites) and new test suites, 0 TypeScript errors (`npm run typecheck`), clean Vite build (`npm run build`).

---

### Task 1: V2-to-Legacy-V1 Projection & Campaign Helpers

**Files:**
- Modify: `src/utils/campaignState.ts`
- Test: `tests/unit/cloudSyncV2.test.ts`

**Interfaces:**
- Consumes: `LEVEL_MANIFEST_72` from `src/engine/manifest/levels.ts`, `V1_TO_V2_LEVEL_MAPPING` from `src/engine/migration/mapping.ts`, `V2CampaignState` and `UserLevelProgress` from `src/types.ts`
- Produces: `projectV2ToLegacyV1(campaignState: V2CampaignState): Record<number, UserLevelProgress>` exported from `src/utils/campaignState.ts`

- [ ] **Step 1: Write failing unit test for `projectV2ToLegacyV1`**

Create `tests/unit/cloudSyncV2.test.ts` testing that `projectV2ToLegacyV1` correctly maps the 24 legacy levels from a `V2CampaignState` with accurate stars, unlock status, scores, and best times:

```typescript
import { describe, it, expect } from 'vitest';
import { projectV2ToLegacyV1, createDefaultCampaignState } from '../../src/utils/campaignState';

describe('projectV2ToLegacyV1', () => {
  it('projects default campaign state with level 1 unlocked and 2-24 locked', () => {
    const defaultState = createDefaultCampaignState();
    const legacy = projectV2ToLegacyV1(defaultState);

    expect(Object.keys(legacy)).toHaveLength(24);
    expect(legacy[1]).toEqual({
      levelId: 1,
      unlocked: true,
      stars: 0,
      bestScore: 0,
      accuracy: 0,
      bestTimeSec: 0,
    });
    expect(legacy[2].unlocked).toBe(false);
    expect(legacy[24].unlocked).toBe(false);
  });

  it('projects completed V2 levels back to their corresponding V1 IDs', () => {
    const state = createDefaultCampaignState();
    // T1-ADD-01 maps to V1 level 1
    state.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 3,
      bestScore: 1500,
      accuracy: 100,
      bestTimeSec: 18.5,
    };
    // T6-GRANDMASTER maps to V1 level 24
    state.levels['T6-GRANDMASTER'] = {
      levelId: 'T6-GRANDMASTER',
      unlocked: true,
      stars: 2,
      bestScore: 3200,
      accuracy: 90,
      bestTimeSec: 54.2,
    };

    const legacy = projectV2ToLegacyV1(state);
    expect(legacy[1].stars).toBe(3);
    expect(legacy[1].bestTimeSec).toBe(18.5);
    expect(legacy[24].stars).toBe(2);
    expect(legacy[24].bestScore).toBe(3200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cloudSyncV2.test.ts`
Expected: FAIL with `projectV2ToLegacyV1 is not a function` or export missing.

- [ ] **Step 3: Implement `projectV2ToLegacyV1` in `src/utils/campaignState.ts`**

Import `V1_TO_V2_LEVEL_MAPPING` and add the projection function:

```typescript
import { V1_TO_V2_LEVEL_MAPPING } from '../engine/migration/mapping';

/**
 * Projects the full 72-level V2 campaign state back to the 24 legacy levels
 * for backward compatibility with older clients and legacy cloud sync readers.
 */
export function projectV2ToLegacyV1(
  campaignState: V2CampaignState
): Record<number, UserLevelProgress> {
  const legacy: Record<number, UserLevelProgress> = {};
  for (let v1Id = 1; v1Id <= 24; v1Id++) {
    const mapping = V1_TO_V2_LEVEL_MAPPING[v1Id];
    if (!mapping) continue;
    const v2Level = campaignState.levels[mapping.primaryLevelId];
    legacy[v1Id] = {
      levelId: v1Id,
      unlocked: v2Level ? v2Level.unlocked : v1Id === 1,
      stars: v2Level ? v2Level.stars : 0,
      bestScore: v2Level ? v2Level.bestScore : 0,
      accuracy: v2Level ? v2Level.accuracy : 0,
      bestTimeSec: v2Level ? v2Level.bestTimeSec : 0,
    };
  }
  return legacy;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/cloudSyncV2.test.ts`
Expected: PASS (2/2 tests passing).

- [ ] **Step 5: Commit**

```bash
git add src/utils/campaignState.ts tests/unit/cloudSyncV2.test.ts
git commit -m "feat(campaign): implement projectV2ToLegacyV1 projection helper

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Cloud Sync V2 Contracts & Pure Functional Merge Engine

**Files:**
- Modify: `src/lib/firebase.ts`
- Test: `tests/unit/cloudSyncV2.test.ts`

**Interfaces:**
- Consumes: `V2CampaignState`, `createDefaultCampaignState`, `isLevelUnlocked`, `projectV2ToLegacyV1` from `src/utils/campaignState.ts`, `migrateV1ToV2` from `src/engine/migration/migrator.ts`, `LEVEL_MANIFEST_72` from `src/engine/manifest/levels.ts`
- Produces: `SyncedGameDataV2`, `SyncedGameDataLegacy`, `SyncedGameData`, `mergeGameProgress`, `saveGameDataToCloud`, `loadGameDataFromCloud` exported from `src/lib/firebase.ts`

- [ ] **Step 1: Write failing unit tests for `mergeGameProgress` V2**

Add comprehensive test cases in `tests/unit/cloudSyncV2.test.ts`:
1. V2-to-V2 two-way merge across different levels with DAG prerequisite cascade.
2. V1 legacy cloud auto-migration to V2 with `schemaVersion: 2` upgrade.
3. 16 achievements union with earliest `unlockedAt` timestamp.
4. Fastest valid `bestTimeSec` preservation (never clobbered by 0 or failed attempts).
5. Stats, Daily State, and 7-day activity merge.
6. Dual-write `progress` 24-level projection.

```typescript
import {
  mergeGameProgress,
  SyncedGameDataV2,
  SyncedGameDataLegacy,
} from '../../src/lib/firebase';

describe('mergeGameProgress V2', () => {
  it('merges two V2 states keeping max stars, fastest times, and DAG unlocks', () => {
    const localState = createDefaultCampaignState();
    localState.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 3,
      bestScore: 1000,
      accuracy: 100,
      bestTimeSec: 20,
    };

    const cloudState = createDefaultCampaignState();
    cloudState.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 2,
      bestScore: 1200,
      accuracy: 95,
      bestTimeSec: 15,
    };
    cloudState.levels['T1-ADD-02'] = {
      levelId: 'T1-ADD-02',
      unlocked: true,
      stars: 3,
      bestScore: 1100,
      accuracy: 100,
      bestTimeSec: 22,
    };

    const local: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: localState,
      achievementsV2: { stars_15: '2026-09-17T10:00:00Z' },
      stats: { totalSolved: 50, totalCorrect: 48, bestStreak: 12, totalTimePlayedSec: 600, highestTimeAttackScore: 0, highestSPM: 0, starsTotal: 3 },
      dailyState: { currentStreak: 3, bestStreak: 5, lastCompletedDate: '2026-09-16', playerName: 'Local', playerCountry: 'ID', playerFlag: '🇮🇩', history: {} },
      dailyActivity: {},
    };

    const cloud: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: cloudState,
      achievementsV2: { stars_15: '2026-09-17T09:00:00Z', boss_t1: '2026-09-17T09:30:00Z' },
      stats: { totalSolved: 80, totalCorrect: 75, bestStreak: 15, totalTimePlayedSec: 900, highestTimeAttackScore: 100, highestSPM: 20, starsTotal: 5 },
      dailyState: { currentStreak: 4, bestStreak: 5, lastCompletedDate: '2026-09-17', playerName: 'Cloud', playerCountry: 'ID', playerFlag: '🇮🇩', history: {} },
      dailyActivity: {},
    };

    const merged = mergeGameProgress(local, cloud);

    expect(merged.schemaVersion).toBe(2);
    // T1-ADD-01: max stars 3, max score 1200, min time 15
    expect(merged.campaignV2.levels['T1-ADD-01'].stars).toBe(3);
    expect(merged.campaignV2.levels['T1-ADD-01'].bestScore).toBe(1200);
    expect(merged.campaignV2.levels['T1-ADD-01'].bestTimeSec).toBe(15);
    // T1-ADD-02 unlocked and kept from cloud
    expect(merged.campaignV2.levels['T1-ADD-02'].stars).toBe(3);
    // Achievements union with earliest timestamp
    expect(merged.achievementsV2['boss_t1']).toBe('2026-09-17T09:30:00Z');
    expect(merged.achievementsV2['stars_15']).toBe('2026-09-17T09:00:00Z');
    // Stats maxed
    expect(merged.stats.totalSolved).toBe(80);
    expect(merged.stats.bestStreak).toBe(15);
    // Backward compatibility projection
    expect(merged.progress).toBeDefined();
    expect(merged.progress![1].stars).toBe(3);
  });

  it('auto-migrates legacy V1 cloud data into V2 seamlessly', () => {
    const local: SyncedGameDataV2 = {
      schemaVersion: 2,
      campaignV2: createDefaultCampaignState(),
      achievementsV2: {},
      stats: { totalSolved: 10, totalCorrect: 10, bestStreak: 10, totalTimePlayedSec: 100, highestTimeAttackScore: 0, highestSPM: 0, starsTotal: 0 },
      dailyState: { currentStreak: 1, bestStreak: 1, lastCompletedDate: '', playerName: 'Player', playerCountry: 'ID', playerFlag: '🇮🇩', history: {} },
      dailyActivity: {},
    };

    const legacyCloud: SyncedGameDataLegacy = {
      progress: {
        1: { levelId: 1, unlocked: true, stars: 3, bestScore: 2000, accuracy: 100, bestTimeSec: 19 },
        2: { levelId: 2, unlocked: true, stars: 2, bestScore: 1800, accuracy: 90, bestTimeSec: 25 },
      },
      stats: { totalSolved: 40, totalCorrect: 38, bestStreak: 20, totalTimePlayedSec: 400, highestTimeAttackScore: 0, highestSPM: 0, starsTotal: 5 },
      dailyState: { currentStreak: 2, bestStreak: 3, lastCompletedDate: '2026-09-15', playerName: 'LegacyUser', playerCountry: 'ID', playerFlag: '🇮🇩', history: {} },
      dailyActivity: {},
    };

    const merged = mergeGameProgress(local, legacyCloud);
    expect(merged.schemaVersion).toBe(2);
    expect(merged.campaignV2.levels['T1-ADD-01'].stars).toBe(3);
    expect(merged.campaignV2.levels['T1-SUB-01'].stars).toBe(2);
    expect(merged.campaignV2.totalStars).toBeGreaterThanOrEqual(5);
    expect(merged.progress![1].stars).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cloudSyncV2.test.ts`
Expected: FAIL due to lack of V2 fields in `mergeGameProgress`.

- [ ] **Step 3: Update `src/lib/firebase.ts` with V2 contracts and deterministic merge engine**

Update `SyncedGameDataV2`, `SyncedGameDataLegacy`, `SyncedGameData`, and reimplement `mergeGameProgress`:
- Handle legacy cloud auto-migration using `migrateV1ToV2`.
- Merge 72 levels preserving max stars, best scores, max accuracy, and fastest valid times.
- Recompute DAG unlocks across all 72 levels using `isLevelUnlocked`.
- Reconcile achievements map via union and earliest timestamp.
- Merge stats, daily challenge state, and daily activity.
- Project merged campaign back to 24-level `progress` for dual-write compatibility.
- Ensure `saveGameDataToCloud` and `loadGameDataFromCloud` handle both V1 and V2 safely.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/cloudSyncV2.test.ts`
Expected: PASS (all tests in suite green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/firebase.ts tests/unit/cloudSyncV2.test.ts
git commit -m "feat(sync): implement SyncedGameDataV2 schema and deterministic merge engine

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Account Modal UI V2 Sync Indicators

**Files:**
- Modify: `src/components/SyncAccountModal.tsx`
- Test: `tests/unit/syncAccountModal.test.tsx`

**Interfaces:**
- Consumes: `SyncAccountModalProps` from `src/components/SyncAccountModal.tsx`
- Produces: Enhanced `SyncAccountModal` displaying V2 sync indicators ("72 Level Kampanye & 16 Pencapaian Tersinkronisasi") and spinner feedback on active sync.

- [ ] **Step 1: Write failing test for `SyncAccountModal` V2 indicators**

Create `tests/unit/syncAccountModal.test.tsx`:
- Verifies display of V2 sync description: "72 Level Kampanye & 16 Pencapaian Tersinkronisasi".
- Verifies manual sync button disabled state and "Menyimpan..." label when `isSyncing = true`.
- Verifies calls to `onManualSync` when clicking "Sinkronkan".

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SyncAccountModal } from '../../src/components/SyncAccountModal';

describe('SyncAccountModal V2', () => {
  it('renders V2 sync indicator and displays sync timestamp', () => {
    const onManualSync = vi.fn();
    render(
      <SyncAccountModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={{ uid: 'user-123', displayName: 'Budi' } as any}
        isSyncing={false}
        lastSyncedAt={new Date('2026-09-17T12:30:00Z')}
        onLoginGoogle={vi.fn()}
        onLoginGuest={vi.fn()}
        onLogout={vi.fn()}
        onManualSync={onManualSync}
      />
    );

    expect(screen.getByText(/72 Level Kampanye & 16 Pencapaian/i)).toBeInTheDocument();
    const syncButton = screen.getByRole('button', { name: /sinkronkan/i });
    fireEvent.click(syncButton);
    expect(onManualSync).toHaveBeenCalledTimes(1);
  });

  it('shows saving spinner when isSyncing is true', () => {
    render(
      <SyncAccountModal
        isOpen={true}
        onClose={vi.fn()}
        currentUser={{ uid: 'user-123', displayName: 'Budi' } as any}
        isSyncing={true}
        lastSyncedAt={null}
        onLoginGoogle={vi.fn()}
        onLoginGuest={vi.fn()}
        onLogout={vi.fn()}
        onManualSync={vi.fn()}
      />
    );

    expect(screen.getByText('Menyimpan...')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/syncAccountModal.test.tsx`
Expected: FAIL due to missing V2 indicator text.

- [ ] **Step 3: Update `src/components/SyncAccountModal.tsx`**

Update the modal to display the V2 sync indicator badge:
```tsx
<div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-300">
  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
  <span>72 Level Kampanye & 16 Pencapaian Tersinkronisasi</span>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/syncAccountModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SyncAccountModal.tsx tests/unit/syncAccountModal.test.tsx
git commit -m "feat(sync): add V2 campaign and achievements sync indicators in SyncAccountModal

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: App Lifecycle Orchestration & Debounced Auto-Sync

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/unit/appCloudSyncIntegration.test.tsx`

**Interfaces:**
- Consumes: `SyncedGameDataV2`, `saveGameDataToCloud`, `loadGameDataFromCloud`, `mergeGameProgress` from `src/lib/firebase.ts`, `loadCampaignState`, `saveCampaignState`, `projectV2ToLegacyV1` from `src/utils/campaignState.ts`, `loadUnlockedAchievementsMap`, `saveUnlockedAchievementsMap` from `src/utils/achievements.ts`
- Produces: Complete auth change handler with V2 two-way merge, debounced background auto-sync across game modes, and clean cloud overwrite on progress reset.

- [ ] **Step 1: Write integration test for `App.tsx` cloud synchronization**

Create `tests/unit/appCloudSyncIntegration.test.tsx`:
- Tests that on login (`onAuthStateChanged` callback), `loadGameDataFromCloud`, `mergeGameProgress`, and `saveGameDataToCloud` are called with `SyncedGameDataV2` containing `campaignV2` and `achievementsV2`.
- Tests that local states and localStorage are updated with merged results.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/appCloudSyncIntegration.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `src/App.tsx` sync logic**

1. Update `onAuthStateChanged` handler in `src/App.tsx`:
   - Construct `currentLocal: SyncedGameDataV2` with `campaignV2`, `achievementsV2`, `stats`, `dailyState`, `dailyActivity`, `progress`.
   - On cloud data received, call `mergeGameProgress(currentLocal, cloudData)`.
   - Update `localStorage` via `saveCampaignState`, `saveUnlockedAchievementsMap`, `saveUserStats`, etc.
   - Update React states: `setCampaignState(merged.campaignV2)`, `setStats(merged.stats)`, etc.
   - Save merged result back to Firestore via `saveGameDataToCloud(user.uid, merged)`.
2. Update `syncCurrentStateToCloud`:
   - Include `campaignV2: loadCampaignState() ?? createDefaultCampaignState()`, `achievementsV2: loadUnlockedAchievementsMap()`, and `progress: projectV2ToLegacyV1(campState)`.
3. Add debounced sync ref (`debouncedSyncTimeoutRef`) to prevent redundant writes on rapid game events.
4. Ensure `handleResetProgress` synchronizes default state to Firestore to overwrite cloud progress.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/appCloudSyncIntegration.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/unit/appCloudSyncIntegration.test.tsx
git commit -m "feat(app): orchestrate V2 cloud sync lifecycle, debounced auto-sync, and reset handling

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Full Regression Testing & Production Build Verification

**Files:**
- Test: All test suites (`tests/unit/*`)

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All 68+ test suites pass with 100% success rate.

- [ ] **Step 2: Run TypeScript compiler check**

Run: `npm run typecheck`
Expected: Exit code 0, 0 compiler errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Vite build succeeds and generates `dist/` bundle cleanly.

- [ ] **Step 4: Commit any final polish or test fixtures**

```bash
git commit --allow-empty -m "chore(sync): complete full regression verification for Cloud Sync V2

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## Self-Review Checklist
1. **Spec coverage**:
   - `SyncedGameDataV2` contract (Spec §2.2) $\to$ Task 2
   - `projectV2ToLegacyV1` projection helper (Spec §3.5) $\to$ Task 1
   - Deterministic 72-level merge + DAG cascade (Spec §3.2) $\to$ Task 2
   - Legacy V1 cloud auto-migration (Spec §3.1) $\to$ Task 2
   - 16 achievements union with earliest timestamp (Spec §3.3) $\to$ Task 2
   - App lifecycle & debounced auto-sync (Spec §4.1, §4.2) $\to$ Task 4
   - Progress reset cloud overwrite (Spec §4.3) $\to$ Task 4
   - Account modal sync indicators (Spec §4.4) $\to$ Task 3
2. **Placeholder scan**: Zero TBDs, TODOs, or vague placeholders.
3. **Type consistency**: All interfaces match across `src/types.ts`, `src/utils/campaignState.ts`, `src/lib/firebase.ts`, and `src/App.tsx`.
