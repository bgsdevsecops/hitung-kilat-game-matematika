# Cloud Sync V2 Persistence & Firestore Schema Extension Design

**Date:** 2026-09-17  
**Status:** Approved  
**Author:** Claude Code & cachak  
**Branch:** `feature/12.9.16.8-cloud-sync-v2-persistence`  
**Milestone:** V2.4 Polish & GA Readiness  
**References:** PRD §8.2, §8.3, §16.2.4, §17, §28, §31  

---

## 1. Overview & Objective

Hitung Kilat V2 expanded the campaign structure from 24 legacy levels to a data-driven 72-level DAG progression architecture (`LEVEL_MANIFEST_72`), introduced 16 standardized V2 achievements (`achievements.ts`), and developed a real-time learning intelligence system.

However, the existing cloud synchronization module (`src/lib/firebase.ts`) and application lifecycle integration in `src/App.tsx` were designed around the legacy V1 format (`Record<number, UserLevelProgress>` storing 24 levels, legacy stats, and daily challenge records). Players playing across devices risk losing progress on levels 25–72 and unlocked V2 achievements when logging in on a secondary device.

**Primary Goal:**
Deliver an authoritative, backward-compatible Cloud Synchronization V2 subsystem that deterministically synchronizes and merges the full 72-level `V2CampaignState`, 16 V2 achievements, aggregated user statistics, daily challenge streaks, and 7-day activity records across multiple devices using Firebase Firestore, with strict zero-progress-loss guarantees.

---

## 2. Core Architecture & Firestore Schema Extension

### 2.1 Firestore Document Path
User progress is persisted in Firestore under:
```
/users/{userId}
```
Access control is governed by `firestore.rules`:
```
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

### 2.2 Data Contract Definition (`SyncedGameDataV2`)
In `src/lib/firebase.ts`, the synchronization contract is updated with a discriminator `schemaVersion: 2`:

```typescript
export interface SyncedGameDataV2 {
  schemaVersion: 2;
  // Full 72-level campaign state
  campaignV2: V2CampaignState;
  // Standardized 16 achievements (id -> ISO timestamp string)
  achievementsV2: Record<string, string>;
  // Global aggregated stats
  stats: UserStats;
  // Daily challenge progress & streak state
  dailyState: DailyChallengeUserState;
  // 7-day rolling accuracy tracker
  dailyActivity: Record<string, DayAccuracyRecord>;
  // 24-level legacy progress projected for backward compatibility
  progress?: Record<number, UserLevelProgress>;
  // Server-managed timestamp
  updatedAt?: any;
}

export interface SyncedGameDataLegacy {
  schemaVersion?: 1;
  progress: Record<number, UserLevelProgress>;
  stats: UserStats;
  dailyState: DailyChallengeUserState;
  dailyActivity: Record<string, DayAccuracyRecord>;
  updatedAt?: any;
}

export type SyncedGameData = SyncedGameDataV2 | SyncedGameDataLegacy;
```

---

## 3. Deterministic Conflict Resolution & Merge Engine (`mergeGameProgress`)

When reconciling data between local device state and cloud state upon authentication, the merge engine executes a pure functional, deterministic superset reconciliation.

### 3.1 Legacy Cloud Auto-Migration
If the snapshot fetched from Firestore is legacy V1 (`!cloudData.campaignV2` or `cloudData.schemaVersion !== 2`):
1. The engine automatically runs `migrateV1ToV2(cloudData.progress)`.
2. The migrated levels and banked stars are converted into a valid `V2CampaignState` structure before proceeding to level reconciliation.
3. The legacy achievements map from V1 (`hitung_kilat_unlocked_achievements_v1`) is ported into `achievementsV2`.

### 3.2 72-Level Campaign State Merge
For each level in `LEVEL_MANIFEST_72`:
1. **Unlock Status (`unlocked`)**:
   `mergedLevel.unlocked = localLevel.unlocked || cloudLevel.unlocked`
2. **Stars Earned (`stars`)**:
   `mergedLevel.stars = Math.max(localLevel.stars || 0, cloudLevel.stars || 0)` (capped between 0 and 3★).
3. **Best Score (`bestScore`)**:
   `mergedLevel.bestScore = Math.max(localLevel.bestScore || 0, cloudLevel.bestScore || 0)`
4. **Accuracy (`accuracy`)**:
   `mergedLevel.accuracy = Math.max(localLevel.accuracy || 0, cloudLevel.accuracy || 0)`
5. **Fastest Completion Time (`bestTimeSec`)**:
   - If both have completed time $> 0$, `min(local.bestTimeSec, cloud.bestTimeSec)`.
   - If only one is $> 0$, retain that positive value.
   - 0 or unrecorded values do not overwrite valid elapsed times.
6. **Completion Timestamp (`completedAt`)**:
   - If both exist, keep the earlier ISO date string.

**DAG Integrity Pass:**
After the 72-level array is reconciled, `isLevelUnlocked(mergedCampaignState, level)` is re-evaluated across all levels to guarantee that if a prerequisite level was unlocked from the cloud, all dependent successor levels are consistently unlocked in local state.

**Credits & Totals:**
- `legacyStarCredits`: `Math.max(local.legacyStarCredits || 0, cloud.legacyStarCredits || 0)`.
- `totalStars`: Recalculated as the direct sum of `stars` across all 72 levels.

### 3.3 16 Standardized V2 Achievements Merge
Achievements are reconciled via set union:
- If an achievement ID is present in `local.achievementsV2` or `cloud.achievementsV2`, it is marked unlocked.
- The `unlockedAt` timestamp preserves the earliest ISO date string if present in both.

### 3.4 Aggregated Stats & Daily Activity Merge
- `stats.totalSolved`: `Math.max(local.stats.totalSolved, cloud.stats.totalSolved)`
- `stats.totalCorrect`: `Math.max(local.stats.totalCorrect, cloud.stats.totalCorrect)`
- `stats.bestStreak`: `Math.max(local.stats.bestStreak, cloud.stats.bestStreak)`
- `stats.highestTimeAttackScore`: `Math.max(local.stats.highestTimeAttackScore, cloud.stats.highestTimeAttackScore)`
- `stats.totalTimePlayedSec`: `Math.max(local.stats.totalTimePlayedSec, cloud.stats.totalTimePlayedSec)`
- `dailyState`: Preserves the latest `lastCompletedDate`, highest `currentStreak`, highest `bestStreak`, and merged historical challenge map.
- `dailyActivity`: Merges daily accuracy records by date key, combining maximum question totals and correct counts.

### 3.5 Backward-Compatible Dual-Write Projection
The merged result projects the first 24 campaign levels back into `Record<number, UserLevelProgress>` under the `progress` field, ensuring legacy clients continue to function without schema errors.

---

## 4. Application Lifecycle & UI Integration

### 4.1 Login Lifecycle (`onAuthStateChanged` in `src/App.tsx`)
1. On auth state transition to an authenticated user (Google or Guest):
   - Set `isSyncing = true`.
   - Load cloud document via `loadGameDataFromCloud(user.uid)`.
   - Read full local state:
     - `campaignV2`: `loadCampaignState() ?? createDefaultCampaignState()`
     - `achievementsV2`: `loadUnlockedAchievementsMap()`
     - `stats`: `loadUserStats()`
     - `dailyState`: `loadDailyChallengeState()`
     - `dailyActivity`: `loadDailyActivityMap()`
   - Execute `merged = mergeGameProgress(localData, cloudData)`.
   - Persist merged state into local storage:
     - `saveCampaignState(merged.campaignV2)`
     - `saveUnlockedAchievementsMap(merged.achievementsV2)`
     - `saveUserStats(merged.stats)`
     - `saveDailyChallengeState(merged.dailyState)`
     - `saveDailyActivityMap(merged.dailyActivity)`
     - `saveUserProgress(merged.progress)`
   - Update React states: `setCampaignState`, `setStats`, `setDailyState`, etc.
   - Write merged document back to Firestore: `await saveGameDataToCloud(user.uid, merged)`.
   - Update `lastSyncedAt = new Date()`.
   - Set `isSyncing = false`.

### 4.2 Debounced Background Auto-Sync (`syncCurrentStateToCloud`)
- After completing a game session (Campaign, Sprint, Survival, Daily) or updating settings:
  - Invokes `syncCurrentStateToCloud()` with a 300ms debounce.
  - Constructs `SyncedGameDataV2` from current state and dispatches `saveGameDataToCloud`.
  - Non-blocking: Network latency or temporary disconnections do not interrupt gameplay. Firestore offline persistence automatically queues updates.

### 4.3 Full Progress Reset Handling
- When the user confirms "Reset Seluruh Progres Permainan" in `StatsModal`:
  - Reset local storage keys: `hitung_kilat_campaign_v2`, `hitung_kilat_unlocked_achievements_v2`, `hitung_kilat_progress_v1`, `hitung_kilat_stats_v1`, `hitung_kilat_migration_ack_v2`.
  - Reinitialize local campaign state to default (`createDefaultCampaignState()`).
  - Immediately synchronize the fresh default state to Firestore, overwriting the cloud document so old progress is not resurrected on next login.

### 4.4 Account Modal UI Updates (`SyncAccountModal.tsx`)
- Display V2 synchronization indicators:
  - "Semua 72 Level & Pencapaian Tersinkronisasi".
  - Status timestamp formatted in Indonesian locale (`HH:mm:ss`).
  - Animated spinner on the manual "Sinkronkan Sekarang" button during active sync.
  - Clear error toast with retry button if offline or auth error occurs.

---

## 5. Security & Rule Conformance

- Adheres to PRD §16.2.4: Direct client writes to `/competitiveResults/*` and `/leaderboardEntries/*` remain strictly forbidden.
- Cloud progress writes remain strictly isolated to the authenticated user's own document:
  ```
  match /users/{userId} {
    allow read, write: if request.auth != null && request.auth.uid == userId;
  }
  ```
- No PII (passwords, auth tokens) is persisted in the Firestore document payload.

---

## 6. Testing & Quality Gates

### 6.1 Unit Tests (`tests/unit/cloudSyncV2.test.ts`)
1. **Pure V2 Two-Way Merge**:
   - Validates multi-device merge when both devices have V2 data with distinct levels completed.
   - Validates DAG cascade unlock after prerequisite level merged from cloud.
2. **Legacy Cloud Auto-Migration**:
   - Tests cloud document with V1 schema being ingested, auto-migrated via `migrateV1ToV2`, and upgraded to `schemaVersion: 2`.
3. **Achievements Union & Earliest Timestamp**:
   - Validates achievements set union and date selection.
4. **Best Time & Accuracy Preservation**:
   - Validates that only valid $>0$ times win the minimum comparator.
5. **Dual-Write Backward Compatibility**:
   - Validates presence of 24-level `progress` mapping in output payload.

### 6.2 App Lifecycle & Component Integration Tests
- Integration tests in `tests/unit/appCloudSyncIntegration.test.tsx` verifying `onAuthStateChanged` flow, localStorage updates, and background auto-sync calls.

### 6.3 Quality Checklist
- [x] All 67 existing test suites pass without regression.
- [x] New unit tests for Cloud Sync V2 pass with 100% success rate.
- [x] TypeScript compiler (`tsc --noEmit`) passes with 0 errors.
- [x] Production build (`npm run build`) builds cleanly.
- [x] Mandatory trailer included: `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
