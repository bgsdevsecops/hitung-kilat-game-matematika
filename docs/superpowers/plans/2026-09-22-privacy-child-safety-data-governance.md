# Privacy, Child Safety & Data Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement comprehensive privacy controls, interceptive child safety age gating, pseudonym sanitization/moderation, data portability (JSON export), leaderboard opt-out, and auditable account deletion (`DEL-XXXXXX`) complying with PRD §20 and AC-PRIV-01 through 07.

**Architecture:** Dedicated modular subsystem in `src/utils/privacy/` and `src/components/privacy/` exposed via a centralized `usePrivacySettings` hook, lazy-loaded modals (`SettingsModal`, `AgeGateModal`) under Suspense boundaries, strict Google identity decoupling from public leaderboards, and safe local-only defaults.

**Tech Stack:** TypeScript, React 19, Tailwind CSS v4, Lucide React, Vitest, Testing Library React, Firebase Firestore/Auth.

**Spec:** `docs/superpowers/specs/2026-09-22-privacy-child-safety-data-governance-design.md`

## Global Constraints

- **Local Play Invariance (AC-PRIV-01)**: Campaign (72 levels), Adaptive Practice, and Remediation must never prompt for age, consent, or PII.
- **Child Safety (AC-PRIV-03)**: `under13` selection strictly disables self-managed cloud sync and automatically runs competitive modes as unranked practice.
- **Identity Decoupling (AC-PRIV-02 & AC-PRIV-06)**: Never broadcast Google display name or profile picture to public leaderboards; public identity is always validated pseudonym + country flag.
- **Performance Budget (PRD §24)**: `SettingsModal` and `AgeGateModal` must be lazy-loaded with zero impact to initial entry bundle ($\le$ 350 KiB gzip budget).
- **Git Safety**: Local commits only on `feature/12.9.20.12-privacy-child-safety-data-governance`. No remote push. All commit messages must end with trailer:
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

---

### Task 1: Privacy Types & Persistence Engine

**Files:**
- Create: `src/utils/privacy/privacyState.ts`
- Modify: `src/types.ts`
- Test: `tests/unit/privacyState.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  ```typescript
  export type AgeEligibility = 'unspecified' | 'under13' | '13plus';
  export interface PrivacyState { ... }
  export interface DeletionReceipt { ... }
  export function loadPrivacyState(): PrivacyState;
  export function savePrivacyState(patch: Partial<PrivacyState>): PrivacyState;
  export function resetPrivacyState(): PrivacyState;
  ```

- [ ] **Step 1: Write the failing test for privacy state persistence**

```typescript
// tests/unit/privacyState.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadPrivacyState,
  savePrivacyState,
  resetPrivacyState,
  DEFAULT_PRIVACY_STATE,
  PRIVACY_STORAGE_KEY,
} from '../../src/utils/privacy/privacyState';

describe('privacyState persistence engine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads safe defaults when localStorage is empty', () => {
    const state = loadPrivacyState();
    expect(state).toEqual(DEFAULT_PRIVACY_STATE);
    expect(state.ageEligibility).toBe('unspecified');
    expect(state.analyticsConsent).toBe(false);
    expect(state.leaderboardOptOut).toBe(false);
    expect(state.pseudonym).toBe('Pemain Kilat');
  });

  it('saves partial updates and persists to localStorage', () => {
    const updated = savePrivacyState({
      ageEligibility: '13plus',
      analyticsConsent: true,
      pseudonym: 'BintangKilat',
    });
    expect(updated.ageEligibility).toBe('13plus');
    expect(updated.analyticsConsent).toBe(true);
    expect(updated.pseudonym).toBe('BintangKilat');

    const reloaded = loadPrivacyState();
    expect(reloaded.ageEligibility).toBe('13plus');
    expect(reloaded.analyticsConsent).toBe(true);
    expect(reloaded.pseudonym).toBe('BintangKilat');
  });

  it('recovers gracefully from corrupted JSON in localStorage', () => {
    localStorage.setItem(PRIVACY_STORAGE_KEY, 'invalid json {[');
    const state = loadPrivacyState();
    expect(state).toEqual(DEFAULT_PRIVACY_STATE);
  });

  it('resets privacy state to safe defaults', () => {
    savePrivacyState({ ageEligibility: 'under13', pseudonym: 'AnakHebat' });
    const reset = resetPrivacyState();
    expect(reset.ageEligibility).toBe('unspecified');
    expect(reset.pseudonym).toBe('Pemain Kilat');
    expect(loadPrivacyState()).toEqual(DEFAULT_PRIVACY_STATE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/privacyState.test.ts --run`
Expected: FAIL (Cannot find module `../../src/utils/privacy/privacyState`)

- [ ] **Step 3: Implement PrivacyState types and storage module**

Update `src/types.ts`:
```typescript
export type AgeEligibility = 'unspecified' | 'under13' | '13plus';

export interface PrivacyState {
  schemaVersion: number;
  policyVersion: string;
  ageEligibility: AgeEligibility;
  ageConfirmedAt?: string;
  analyticsConsent: boolean;
  analyticsConsentChangedAt?: string;
  leaderboardOptOut: boolean;
  leaderboardOptOutChangedAt?: string;
  pseudonym: string;
  playerCountry: string;
  playerFlag: string;
  lastPseudonymChangeTimestamp?: number;
  accountEpoch: number;
}

export interface DeletionReceipt {
  receiptId: string;
  timestamp: string;
  status: 'COMPLETED';
  scopesPurged: Array<'cloud_firestore' | 'auth_session' | 'local_progress'>;
  policyNotice: string;
}
```

Create `src/utils/privacy/privacyState.ts`:
```typescript
import { AgeEligibility, PrivacyState } from '../../types';

export const PRIVACY_STORAGE_KEY = 'hitung_kilat_privacy_v2';
export const CURRENT_POLICY_VERSION = '2.0.0';

export const DEFAULT_PRIVACY_STATE: PrivacyState = {
  schemaVersion: 2,
  policyVersion: CURRENT_POLICY_VERSION,
  ageEligibility: 'unspecified',
  analyticsConsent: false,
  leaderboardOptOut: false,
  pseudonym: 'Pemain Kilat',
  playerCountry: 'ID',
  playerFlag: '🇮🇩',
  accountEpoch: 1,
};

export function loadPrivacyState(): PrivacyState {
  if (typeof localStorage === 'undefined') return DEFAULT_PRIVACY_STATE;
  try {
    const raw = localStorage.getItem(PRIVACY_STORAGE_KEY);
    if (!raw) return DEFAULT_PRIVACY_STATE;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PRIVACY_STATE;
    return {
      ...DEFAULT_PRIVACY_STATE,
      ...parsed,
      schemaVersion: 2,
      policyVersion: CURRENT_POLICY_VERSION,
    };
  } catch {
    return DEFAULT_PRIVACY_STATE;
  }
}

export function savePrivacyState(patch: Partial<PrivacyState>): PrivacyState {
  const current = loadPrivacyState();
  const next: PrivacyState = {
    ...current,
    ...patch,
    schemaVersion: 2,
    policyVersion: CURRENT_POLICY_VERSION,
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to save privacy state', e);
    }
  }
  return next;
}

export function resetPrivacyState(): PrivacyState {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(PRIVACY_STORAGE_KEY);
    } catch {}
  }
  return DEFAULT_PRIVACY_STATE;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/privacyState.test.ts --run`
Expected: PASS (4/4 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/utils/privacy/privacyState.ts tests/unit/privacyState.test.ts
git commit -m "feat(privacy): add privacy state model and persistence engine

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Pseudonym Validation & Moderation Engine

**Files:**
- Create: `src/utils/privacy/pseudonymValidator.ts`
- Test: `tests/unit/pseudonymValidator.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  ```typescript
  export interface PseudonymValidationResult {
    valid: boolean;
    error?: string;
    sanitized: string;
    cooldownRemainingMs?: number;
  }
  export function validatePseudonym(
    candidate: string,
    lastChangeTimestamp?: number,
    currentName?: string,
    nowMs?: number
  ): PseudonymValidationResult;
  ```

- [ ] **Step 1: Write failing tests for pseudonym moderation**

```typescript
// tests/unit/pseudonymValidator.test.ts
import { describe, it, expect } from 'vitest';
import { validatePseudonym } from '../../src/utils/privacy/pseudonymValidator';

describe('pseudonymValidator', () => {
  it('accepts valid alphanumeric pseudonyms with hyphens, underscores and spaces', () => {
    const res = validatePseudonym('Juara_1-Kilat');
    expect(res.valid).toBe(true);
    expect(res.sanitized).toBe('Juara_1-Kilat');
  });

  it('rejects pseudonyms shorter than 3 characters or longer than 20 characters', () => {
    const shortRes = validatePseudonym('AB');
    expect(shortRes.valid).toBe(false);
    expect(shortRes.error).toContain('3 hingga 20');

    const longRes = validatePseudonym('NamaPemainYangSangatPanjangSekaliLebihDari20');
    expect(longRes.valid).toBe(false);
    expect(longRes.error).toContain('3 hingga 20');
  });

  it('rejects forbidden characters, scripts, and multiple consecutive spaces', () => {
    expect(validatePseudonym('<script>alert(1)</script>').valid).toBe(false);
    expect(validatePseudonym('Pemain #1').valid).toBe(false);
    expect(validatePseudonym('Pemain  Kilat').valid).toBe(false);
  });

  it('filters Indonesian and English profanities including leetspeak normalization', () => {
    expect(validatePseudonym('b4j1ng4n').valid).toBe(false);
    expect(validatePseudonym('anjing_liar').valid).toBe(false);
    expect(validatePseudonym('damn_player').valid).toBe(false);
  });

  it('enforces 24-hour rename cooldown when non-default name is modified', () => {
    const now = 100_000_000;
    const recent = now - 3_600_000; // 1 hour ago
    const res = validatePseudonym('NamaBaru', recent, 'NamaLama', now);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('24 jam');
    expect(res.cooldownRemainingMs).toBe(23 * 3_600_000);
  });

  it('exempts initial rename from default "Pemain Kilat" from cooldown', () => {
    const now = 100_000_000;
    const recent = now - 1000;
    const res = validatePseudonym('NamaPertama', recent, 'Pemain Kilat', now);
    expect(res.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/pseudonymValidator.test.ts --run`
Expected: FAIL (Cannot find module `../../src/utils/privacy/pseudonymValidator`)

- [ ] **Step 3: Implement Pseudonym Validation & Moderation**

Create `src/utils/privacy/pseudonymValidator.ts`:
```typescript
export interface PseudonymValidationResult {
  valid: boolean;
  error?: string;
  sanitized: string;
  cooldownRemainingMs?: number;
}

const RENAME_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const ALLOWLIST_REGEX = /^[a-zA-Z0-9_-]+( [a-zA-Z0-9_-]+)*$/;

const FORBIDDEN_WORDS = [
  'anjing', 'babi', 'bangsat', 'bajingan', 'kontol', 'memek', 'jembut',
  'pantek', 'asu', 'kampret', 'tai', 'tolol', 'goblok', 'idiot',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy',
];

function normalizeLeetspeak(input: string): string {
  return input
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't');
}

export function validatePseudonym(
  candidate: string,
  lastChangeTimestamp?: number,
  currentName?: string,
  nowMs: number = Date.now()
): PseudonymValidationResult {
  const sanitized = (candidate || '').trim();

  // 1. Length validation (3-20 chars)
  if (sanitized.length < 3 || sanitized.length > 20) {
    return {
      valid: false,
      error: 'Nama samaran harus memiliki panjang antara 3 hingga 20 karakter.',
      sanitized,
    };
  }

  // 2. Character allowlist
  if (!ALLOWLIST_REGEX.test(sanitized)) {
    return {
      valid: false,
      error: 'Nama samaran hanya boleh memuat huruf, angka, tanda hubung (-), garis bawah (_), dan spasi tunggal.',
      sanitized,
    };
  }

  // 3. Profanity filter with leetspeak
  const normalized = normalizeLeetspeak(sanitized);
  const containsProfanity = FORBIDDEN_WORDS.some((word) =>
    normalized.includes(word)
  );
  if (containsProfanity) {
    return {
      valid: false,
      error: 'Nama samaran mengandung kata yang tidak pantas. Silakan gunakan nama lain.',
      sanitized,
    };
  }

  // 4. Rate limit check (24h cooldown)
  const isDefaultName = !currentName || currentName === 'Pemain Kilat';
  if (!isDefaultName && lastChangeTimestamp && sanitized !== currentName) {
    const elapsed = nowMs - lastChangeTimestamp;
    if (elapsed < RENAME_COOLDOWN_MS) {
      const remainingMs = RENAME_COOLDOWN_MS - elapsed;
      const hours = Math.floor(remainingMs / (60 * 60 * 1000));
      const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      return {
        valid: false,
        error: `Nama samaran hanya dapat diubah 1 kali per 24 jam. Coba lagi dalam ${hours} jam ${minutes} menit.`,
        sanitized,
        cooldownRemainingMs: remainingMs,
      };
    }
  }

  return {
    valid: true,
    sanitized,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/pseudonymValidator.test.ts --run`
Expected: PASS (6/6 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/utils/privacy/pseudonymValidator.ts tests/unit/pseudonymValidator.test.ts
git commit -m "feat(privacy): add pseudonym validation, moderation, and rate limiting

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Data Export & Governance Engine

**Files:**
- Create: `src/utils/privacy/dataExporter.ts`
- Test: `tests/unit/dataExporter.test.ts`

**Interfaces:**
- Consumes:
  - `loadPrivacyState`
  - `loadCampaignState`
  - `loadUserStats`
  - `loadDailyChallengeState`
  - `loadUnlockedAchievementsMap`
  - `getMasteryStore`
- Produces:
  ```typescript
  export interface ExportedGameDataPayload {
    metadata: {
      exportedAt: string;
      schemaVersion: number;
      appVersion: string;
      policyVersion: string;
    };
    privacy: PrivacyState;
    campaign: unknown;
    mastery: unknown;
    dailyChallenge: unknown;
    achievements: unknown;
    stats: unknown;
  }
  export function exportAllGameData(): ExportedGameDataPayload;
  export function triggerJSONDownload(filename: string, jsonString: string): void;
  ```

- [ ] **Step 1: Write failing tests for data exporter**

```typescript
// tests/unit/dataExporter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { exportAllGameData } from '../../src/utils/privacy/dataExporter';

describe('dataExporter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates an export payload with standard metadata and partitions', () => {
    const data = exportAllGameData();
    expect(data.metadata).toBeDefined();
    expect(data.metadata.schemaVersion).toBe(2);
    expect(data.metadata.policyVersion).toBe('2.0.0');
    expect(data.privacy).toBeDefined();
    expect(data.campaign).toBeDefined();
    expect(data.mastery).toBeDefined();
    expect(data.dailyChallenge).toBeDefined();
    expect(data.achievements).toBeDefined();
  });

  it('does not contain any sensitive PII or authentication tokens', () => {
    const jsonStr = JSON.stringify(exportAllGameData());
    expect(jsonStr).not.toContain('authToken');
    expect(jsonStr).not.toContain('refreshToken');
    expect(jsonStr).not.toContain('password');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/dataExporter.test.ts --run`
Expected: FAIL (Cannot find module `../../src/utils/privacy/dataExporter`)

- [ ] **Step 3: Implement dataExporter module**

Create `src/utils/privacy/dataExporter.ts`:
```typescript
import { PrivacyState } from '../../types';
import { loadPrivacyState, CURRENT_POLICY_VERSION } from './privacyState';
import { loadCampaignState, createDefaultCampaignState } from '../campaignState';
import { loadUserStats } from '../storage';
import { loadDailyChallengeState } from '../dailyChallenge';
import { loadUnlockedAchievementsMap } from '../achievements';
import { getMasteryStore } from '../masteryBridge';

export interface ExportedGameDataPayload {
  metadata: {
    exportedAt: string;
    schemaVersion: number;
    appVersion: string;
    policyVersion: string;
  };
  privacy: PrivacyState;
  campaign: unknown;
  mastery: unknown;
  dailyChallenge: unknown;
  achievements: unknown;
  stats: unknown;
}

export function exportAllGameData(): ExportedGameDataPayload {
  const privacy = loadPrivacyState();
  const campaign = loadCampaignState() || createDefaultCampaignState();
  const stats = loadUserStats();
  const dailyChallenge = loadDailyChallengeState();
  const achievements = loadUnlockedAchievementsMap();
  let mastery: unknown = {};
  try {
    mastery = getMasteryStore().getAllMasteryRecords();
  } catch {}

  return {
    metadata: {
      exportedAt: new Date().toISOString(),
      schemaVersion: 2,
      appVersion: '2.0.0',
      policyVersion: CURRENT_POLICY_VERSION,
    },
    privacy,
    campaign,
    mastery,
    dailyChallenge,
    achievements,
    stats,
  };
}

export function triggerJSONDownload(filename: string, jsonString: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/dataExporter.test.ts --run`
Expected: PASS (2/2 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/utils/privacy/dataExporter.ts tests/unit/dataExporter.test.ts
git commit -m "feat(privacy): add data export and JSON portability engine

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Account Deletion & Hard Cloud Purge Engine

**Files:**
- Create: `src/utils/privacy/accountDeletion.ts`
- Test: `tests/unit/accountDeletion.test.ts`

**Interfaces:**
- Consumes: `logoutUser`, `db` (Firebase Firestore)
- Produces:
  ```typescript
  export function generateDeletionReceipt(): DeletionReceipt;
  export function purgeAllLocalData(): void;
  export async function purgeCloudUserData(userId: string): Promise<void>;
  export async function executeAccountDeletion(userId?: string): Promise<DeletionReceipt>;
  ```

- [ ] **Step 1: Write failing test for account deletion and receipt generation**

```typescript
// tests/unit/accountDeletion.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateDeletionReceipt,
  purgeAllLocalData,
  executeAccountDeletion,
} from '../../src/utils/privacy/accountDeletion';

vi.mock('../../src/lib/firebase', () => ({
  logoutUser: vi.fn().mockResolvedValue(undefined),
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, coll, id) => ({ coll, id })),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
}));

describe('accountDeletion engine', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('hitung_kilat_campaign_v2', '{"test": 1}');
    localStorage.setItem('hitung_kilat_stats_v1', '{"test": 2}');
  });

  it('generates an auditable DeletionReceipt matching DEL-XXXXXX format', () => {
    const receipt = generateDeletionReceipt();
    expect(receipt.receiptId).toMatch(/^DEL-[0-9A-Z]{6,12}$/);
    expect(receipt.status).toBe('COMPLETED');
    expect(receipt.scopesPurged).toContain('cloud_firestore');
    expect(receipt.scopesPurged).toContain('auth_session');
    expect(receipt.scopesPurged).toContain('local_progress');
  });

  it('purges all Hitung Kilat local storage partitions', () => {
    purgeAllLocalData();
    expect(localStorage.getItem('hitung_kilat_campaign_v2')).toBeNull();
    expect(localStorage.getItem('hitung_kilat_stats_v1')).toBeNull();
  });

  it('executes full account deletion workflow and returns receipt', async () => {
    const receipt = await executeAccountDeletion('mock_uid_123');
    expect(receipt.receiptId).toBeDefined();
    expect(localStorage.getItem('hitung_kilat_campaign_v2')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/accountDeletion.test.ts --run`
Expected: FAIL (Cannot find module `../../src/utils/privacy/accountDeletion`)

- [ ] **Step 3: Implement accountDeletion module**

Create `src/utils/privacy/accountDeletion.ts`:
```typescript
import { DeletionReceipt } from '../../types';
import { db, logoutUser } from '../../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export function generateDeletionReceipt(): DeletionReceipt {
  const hexTime = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const receiptId = `DEL-${hexTime}${randomSuffix}`;

  return {
    receiptId,
    timestamp: new Date().toISOString(),
    status: 'COMPLETED',
    scopesPurged: ['cloud_firestore', 'auth_session', 'local_progress'],
    policyNotice:
      'Akun cloud dan data permainan telah dihapus permanen sesuai PRD §20 dan Kebijakan Privasi 2.0.0.',
  };
}

export function purgeAllLocalData(): void {
  if (typeof localStorage === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('hitung_kilat_') || key.startsWith('mastery_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  });
}

export async function purgeCloudUserData(userId: string): Promise<void> {
  if (!userId || !db) return;
  try {
    const userDocRef = doc(db, 'users', userId);
    await deleteDoc(userDocRef);
  } catch (e) {
    console.warn('Failed to delete user document from firestore', e);
  }

  try {
    const leaderDocRef = doc(db, 'timeAttackLeaderboard', userId);
    await deleteDoc(leaderDocRef);
  } catch (e) {
    console.warn('Failed to delete user leaderboard entry from firestore', e);
  }
}

export async function executeAccountDeletion(userId?: string): Promise<DeletionReceipt> {
  // 1. Purge cloud data if logged in
  if (userId) {
    await purgeCloudUserData(userId);
    try {
      await logoutUser();
    } catch (e) {
      console.warn('Failed to logout user during deletion', e);
    }
  }

  // 2. Wipe local storage
  purgeAllLocalData();

  // 3. Generate receipt
  return generateDeletionReceipt();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/accountDeletion.test.ts --run`
Expected: PASS (3/3 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/utils/privacy/accountDeletion.ts tests/unit/accountDeletion.test.ts
git commit -m "feat(privacy): add account deletion, cloud purge, and receipt generator

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Reactive Privacy Hook & Age Gate Interceptor

**Files:**
- Create: `src/hooks/usePrivacySettings.ts`
- Test: `tests/unit/usePrivacySettings.test.ts`

**Interfaces:**
- Consumes: `loadPrivacyState`, `savePrivacyState`, `validatePseudonym`
- Produces:
  ```typescript
  export function usePrivacySettings(): {
    privacyState: PrivacyState;
    isAgeGateOpen: boolean;
    openAgeGate: () => void;
    closeAgeGate: () => void;
    confirmAge: (eligibility: 'under13' | '13plus') => void;
    updatePseudonym: (newName: string) => PseudonymValidationResult;
    updateCountryFlag: (country: string, flag: string) => void;
    toggleAnalyticsConsent: () => void;
    toggleLeaderboardOptOut: () => void;
    requestAgeProtectedAction: (action: () => void | Promise<void>, fallback?: () => void) => void;
  };
  ```

- [ ] **Step 1: Write failing test for usePrivacySettings hook**

```typescript
// tests/unit/usePrivacySettings.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrivacySettings } from '../../src/hooks/usePrivacySettings';

describe('usePrivacySettings hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides safe initial defaults and opens age gate for unspecified users', () => {
    const { result } = renderHook(() => usePrivacySettings());
    expect(result.current.privacyState.ageEligibility).toBe('unspecified');
    expect(result.current.isAgeGateOpen).toBe(false);

    const targetAction = vi.fn();
    act(() => {
      result.current.requestAgeProtectedAction(targetAction);
    });

    expect(result.current.isAgeGateOpen).toBe(true);
    expect(targetAction).not.toHaveBeenCalled();
  });

  it('permits protected action immediately if already 13plus', () => {
    const { result } = renderHook(() => usePrivacySettings());
    act(() => {
      result.current.confirmAge('13plus');
    });

    const targetAction = vi.fn();
    act(() => {
      result.current.requestAgeProtectedAction(targetAction);
    });

    expect(result.current.isAgeGateOpen).toBe(false);
    expect(targetAction).toHaveBeenCalledTimes(1);
  });

  it('triggers fallback and blocks protected action if under13', () => {
    const { result } = renderHook(() => usePrivacySettings());
    act(() => {
      result.current.confirmAge('under13');
    });

    const targetAction = vi.fn();
    const fallbackAction = vi.fn();
    act(() => {
      result.current.requestAgeProtectedAction(targetAction, fallbackAction);
    });

    expect(result.current.isAgeGateOpen).toBe(false);
    expect(targetAction).not.toHaveBeenCalled();
    expect(fallbackAction).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/usePrivacySettings.test.ts --run`
Expected: FAIL (Cannot find module `../../src/hooks/usePrivacySettings`)

- [ ] **Step 3: Implement usePrivacySettings hook**

Create `src/hooks/usePrivacySettings.ts`:
```typescript
import { useState, useCallback, useRef } from 'react';
import { AgeEligibility, PrivacyState } from '../types';
import { loadPrivacyState, savePrivacyState } from '../utils/privacy/privacyState';
import { validatePseudonym, PseudonymValidationResult } from '../utils/privacy/pseudonymValidator';

export function usePrivacySettings() {
  const [privacyState, setPrivacyState] = useState<PrivacyState>(() => loadPrivacyState());
  const [isAgeGateOpen, setIsAgeGateOpen] = useState<boolean>(false);
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const pendingFallbackRef = useRef<(() => void) | null>(null);

  const confirmAge = useCallback((eligibility: 'under13' | '13plus') => {
    const updated = savePrivacyState({
      ageEligibility: eligibility,
      ageConfirmedAt: new Date().toISOString(),
    });
    setPrivacyState(updated);
    setIsAgeGateOpen(false);

    if (eligibility === '13plus' && pendingActionRef.current) {
      pendingActionRef.current();
    } else if (eligibility === 'under13' && pendingFallbackRef.current) {
      pendingFallbackRef.current();
    }

    pendingActionRef.current = null;
    pendingFallbackRef.current = null;
  }, []);

  const openAgeGate = useCallback(() => {
    setIsAgeGateOpen(true);
  }, []);

  const closeAgeGate = useCallback(() => {
    setIsAgeGateOpen(false);
    pendingActionRef.current = null;
    pendingFallbackRef.current = null;
  }, []);

  const requestAgeProtectedAction = useCallback(
    (action: () => void | Promise<void>, fallback?: () => void) => {
      if (privacyState.ageEligibility === '13plus') {
        action();
      } else if (privacyState.ageEligibility === 'under13') {
        if (fallback) fallback();
      } else {
        pendingActionRef.current = action;
        pendingFallbackRef.current = fallback || null;
        setIsAgeGateOpen(true);
      }
    },
    [privacyState.ageEligibility]
  );

  const updatePseudonym = useCallback(
    (candidate: string): PseudonymValidationResult => {
      const result = validatePseudonym(
        candidate,
        privacyState.lastPseudonymChangeTimestamp,
        privacyState.pseudonym
      );
      if (result.valid) {
        const updated = savePrivacyState({
          pseudonym: result.sanitized,
          lastPseudonymChangeTimestamp: Date.now(),
        });
        setPrivacyState(updated);
      }
      return result;
    },
    [privacyState.lastPseudonymChangeTimestamp, privacyState.pseudonym]
  );

  const updateCountryFlag = useCallback((country: string, flag: string) => {
    const updated = savePrivacyState({
      playerCountry: country,
      playerFlag: flag,
    });
    setPrivacyState(updated);
  }, []);

  const toggleAnalyticsConsent = useCallback(() => {
    const updated = savePrivacyState({
      analyticsConsent: !privacyState.analyticsConsent,
      analyticsConsentChangedAt: new Date().toISOString(),
    });
    setPrivacyState(updated);
  }, [privacyState.analyticsConsent]);

  const toggleLeaderboardOptOut = useCallback(() => {
    const updated = savePrivacyState({
      leaderboardOptOut: !privacyState.leaderboardOptOut,
      leaderboardOptOutChangedAt: new Date().toISOString(),
    });
    setPrivacyState(updated);
  }, [privacyState.leaderboardOptOut]);

  return {
    privacyState,
    isAgeGateOpen,
    openAgeGate,
    closeAgeGate,
    confirmAge,
    updatePseudonym,
    updateCountryFlag,
    toggleAnalyticsConsent,
    toggleLeaderboardOptOut,
    requestAgeProtectedAction,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/usePrivacySettings.test.ts --run`
Expected: PASS (3/3 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePrivacySettings.ts tests/unit/usePrivacySettings.test.ts
git commit -m "feat(privacy): add centralized usePrivacySettings hook and age gate interceptor

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: AgeGateModal Component

**Files:**
- Create: `src/components/privacy/AgeGateModal.tsx`
- Test: `tests/unit/ageGateModal.test.tsx`

**Interfaces:**
- Consumes: `AgeEligibility`
- Produces:
  ```typescript
  export interface AgeGateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirmAge: (eligibility: 'under13' | '13plus') => void;
  }
  export const AgeGateModal: React.FC<AgeGateModalProps>;
  ```

- [ ] **Step 1: Write failing test for AgeGateModal**

```typescript
// tests/unit/ageGateModal.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgeGateModal } from '../../src/components/privacy/AgeGateModal';

describe('AgeGateModal component', () => {
  it('renders age confirmation options when open', () => {
    render(
      <AgeGateModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirmAge={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Verifikasi Usia/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /13 Tahun ke Atas/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /di Bawah 13 Tahun/i })).toBeDefined();
  });

  it('triggers onConfirmAge with 13plus on selecting 13+ button', () => {
    const handleConfirm = vi.fn();
    render(
      <AgeGateModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirmAge={handleConfirm}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /13 Tahun ke Atas/i }));
    expect(handleConfirm).toHaveBeenCalledWith('13plus');
  });

  it('triggers onConfirmAge with under13 on selecting < 13 button', () => {
    const handleConfirm = vi.fn();
    render(
      <AgeGateModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirmAge={handleConfirm}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /di Bawah 13 Tahun/i }));
    expect(handleConfirm).toHaveBeenCalledWith('under13');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/ageGateModal.test.tsx --run`
Expected: FAIL (Cannot find module `../../src/components/privacy/AgeGateModal`)

- [ ] **Step 3: Implement AgeGateModal**

Create `src/components/privacy/AgeGateModal.tsx`:
```tsx
import React from 'react';
import { ShieldCheck, X, UserCheck, HeartHandshake } from 'lucide-react';
import { soundManager } from '../../utils/sound';

export interface AgeGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmAge: (eligibility: 'under13' | '13plus') => void;
}

export const AgeGateModal: React.FC<AgeGateModalProps> = ({
  isOpen,
  onClose,
  onConfirmAge,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-4 border-indigo-950 bg-gradient-to-b from-indigo-900 to-indigo-950 p-6 text-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={() => {
            soundManager.playClick();
            onClose();
          }}
          className="absolute right-4 top-4 rounded-xl p-2 text-indigo-300 hover:bg-white/10 hover:text-white transition"
          aria-label="Tutup Verifikasi Usia"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-amber-950 shadow-lg border-b-4 border-amber-600 mb-3">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h2 id="age-gate-title" className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400">
            Verifikasi Usia & Privasi
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-indigo-200 leading-relaxed">
            Hitung Kilat menjamin keamanan data pemain. Pilih kelompok usia untuk menyesuaikan fitur sinkronisasi akun dan peringkat publik.
          </p>
        </div>

        {/* Action Options */}
        <div className="space-y-3">
          <button
            onClick={() => {
              soundManager.playClick();
              onConfirmAge('13plus');
            }}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-indigo-800/80 hover:bg-indigo-700/80 border-2 border-indigo-600/50 hover:border-amber-400 transition text-left group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-400/20 text-amber-300 group-hover:scale-105 transition">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm sm:text-base font-black text-white">
                  Saya Berusia 13 Tahun ke Atas
                </div>
                <div className="text-[11px] text-indigo-300">
                  Dapat mengaktifkan Cloud Sync dan Papan Peringkat Global.
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              soundManager.playClick();
              onConfirmAge('under13');
            }}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-indigo-800/80 hover:bg-indigo-700/80 border-2 border-indigo-600/50 hover:border-pink-400 transition text-left group shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-pink-400/20 text-pink-300 group-hover:scale-105 transition">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm sm:text-base font-black text-white">
                  Saya Berusia di Bawah 13 Tahun
                </div>
                <div className="text-[11px] text-indigo-300">
                  Mode Lokal Aman 100%. Tanpa pengumpulan data akun.
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Footer Note */}
        <p className="mt-5 text-center text-[10px] text-indigo-400">
          Sesuai standar perlindungan privasi anak PRD §20 & COPPA/GDPR-K. Pilihan dapat ditinjau kembali di Pengaturan.
        </p>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/ageGateModal.test.tsx --run`
Expected: PASS (3/3 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/components/privacy/AgeGateModal.tsx tests/unit/ageGateModal.test.tsx
git commit -m "feat(privacy): add AgeGateModal component for child safety interception

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: SettingsModal & Deletion Receipt Component

**Files:**
- Create: `src/components/privacy/SettingsModal.tsx`
- Test: `tests/unit/settingsModal.test.tsx`

**Interfaces:**
- Consumes: `PrivacyState`, `DeletionReceipt`, `exportAllGameData`, `triggerJSONDownload`, `executeAccountDeletion`
- Produces:
  ```typescript
  export interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    privacyState: PrivacyState;
    onUpdatePseudonym: (name: string) => PseudonymValidationResult;
    onUpdateCountryFlag: (country: string, flag: string) => void;
    onToggleAnalyticsConsent: () => void;
    onToggleLeaderboardOptOut: () => void;
    onResetLocalProgress: () => void;
    currentUser: User | null;
  }
  export const SettingsModal: React.FC<SettingsModalProps>;
  ```

- [ ] **Step 1: Write failing tests for SettingsModal**

```typescript
// tests/unit/settingsModal.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../../src/components/privacy/SettingsModal';
import { DEFAULT_PRIVACY_STATE } from '../../src/utils/privacy/privacyState';

vi.mock('../../src/utils/privacy/dataExporter', () => ({
  exportAllGameData: vi.fn(() => ({ test: true })),
  triggerJSONDownload: vi.fn(),
}));

vi.mock('../../src/utils/privacy/accountDeletion', () => ({
  executeAccountDeletion: vi.fn().mockResolvedValue({
    receiptId: 'DEL-TEST1234',
    timestamp: '2026-09-22T10:00:00.000Z',
    status: 'COMPLETED',
    scopesPurged: ['cloud_firestore', 'auth_session', 'local_progress'],
    policyNotice: 'Data dihapus.',
  }),
}));

describe('SettingsModal component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 4 sections with accessible elements', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );

    expect(screen.getByText(/Pengaturan & Privasi/i)).toBeDefined();
    expect(screen.getByText(/Profil Publik/i)).toBeDefined();
    expect(screen.getByText(/Privasi & Visibilitas/i)).toBeDefined();
    expect(screen.getByText(/Portabilitas Data/i)).toBeDefined();
    expect(screen.getByText(/Zona Bahaya/i)).toBeDefined();
  });

  it('triggers JSON data export download on button click', async () => {
    const { triggerJSONDownload } = await import('../../src/utils/privacy/dataExporter');
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={vi.fn()}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );

    const exportBtn = screen.getByRole('button', { name: /Unduh Data JSON/i });
    fireEvent.click(exportBtn);
    expect(triggerJSONDownload).toHaveBeenCalled();
  });

  it('handles pseudonym modification with character counter and feedback', () => {
    const handleUpdate = vi.fn().mockReturnValue({ valid: true, sanitized: 'GayaBaru' });
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        privacyState={DEFAULT_PRIVACY_STATE}
        onUpdatePseudonym={handleUpdate}
        onUpdateCountryFlag={vi.fn()}
        onToggleAnalyticsConsent={vi.fn()}
        onToggleLeaderboardOptOut={vi.fn()}
        onResetLocalProgress={vi.fn()}
        currentUser={null}
      />
    );

    const input = screen.getByPlaceholderText(/Ketik nama samaran/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'GayaBaru' } });
    fireEvent.click(screen.getByRole('button', { name: /Simpan Profil/i }));
    expect(handleUpdate).toHaveBeenCalledWith('GayaBaru');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/settingsModal.test.tsx --run`
Expected: FAIL (Cannot find module `../../src/components/privacy/SettingsModal`)

- [ ] **Step 3: Implement SettingsModal and DeletionReceiptModal**

Create `src/components/privacy/SettingsModal.tsx`:
```tsx
import React, { useState } from 'react';
import {
  X,
  Settings,
  User,
  Shield,
  Download,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { PrivacyState } from '../../types';
import { PseudonymValidationResult } from '../../utils/privacy/pseudonymValidator';
import { exportAllGameData, triggerJSONDownload } from '../../utils/privacy/dataExporter';
import { executeAccountDeletion } from '../../utils/privacy/accountDeletion';
import { soundManager } from '../../utils/sound';
import { User as FirebaseUser } from 'firebase/auth';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  privacyState: PrivacyState;
  onUpdatePseudonym: (name: string) => PseudonymValidationResult;
  onUpdateCountryFlag: (country: string, flag: string) => void;
  onToggleAnalyticsConsent: () => void;
  onToggleLeaderboardOptOut: () => void;
  onResetLocalProgress: () => void;
  currentUser: FirebaseUser | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  privacyState,
  onUpdatePseudonym,
  onUpdateCountryFlag,
  onToggleAnalyticsConsent,
  onToggleLeaderboardOptOut,
  onResetLocalProgress,
  currentUser,
}) => {
  const [pseudonymInput, setPseudonymInput] = useState<string>(privacyState.pseudonym);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState<string>('');
  const [deletionReceipt, setDeletionReceipt] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
    soundManager.playClick();
    setValidationError(null);
    setSuccessMsg(null);
    const result = onUpdatePseudonym(pseudonymInput);
    if (!result.valid) {
      setValidationError(result.error || 'Nama samaran tidak valid.');
    } else {
      setSuccessMsg('Profil berhasil diperbarui!');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleExportJSON = () => {
    soundManager.playClick();
    const data = exportAllGameData();
    const jsonStr = JSON.stringify(data, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    triggerJSONDownload(`hitung-kilat-data-${dateStr}.json`, jsonStr);
  };

  const handleConfirmReset = () => {
    soundManager.playClick();
    onResetLocalProgress();
    setShowResetConfirm(false);
    onClose();
  };

  const handleExecuteDeleteAccount = async () => {
    if (deleteConfirmationText !== 'HAPUS') return;
    soundManager.playClick();
    setIsDeleting(true);
    try {
      const receipt = await executeAccountDeletion(currentUser?.uid);
      setDeletionReceipt(receipt);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl my-8 overflow-hidden rounded-3xl border-4 border-indigo-950 bg-gradient-to-b from-indigo-900 to-indigo-950 p-6 text-white shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-indigo-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-amber-950 font-black shadow-md border-b-2 border-amber-600">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 id="settings-title" className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400">
                Pengaturan & Privasi
              </h2>
              <p className="text-xs text-indigo-300">
                Data Governance & Tata Kelola Privasi V2.0
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playClick();
              onClose();
            }}
            className="rounded-xl p-2 text-indigo-300 hover:bg-white/10 hover:text-white transition"
            aria-label="Tutup Pengaturan"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1 custom-scrollbar">
          {/* Section 1: Profil Publik */}
          <div className="rounded-2xl border-2 border-indigo-800/80 bg-indigo-950/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-yellow-400">
              <User className="h-4 w-4" />
              <span>Profil Publik</span>
            </div>
            <p className="text-xs text-indigo-200">
              Nama samaran yang tampil pada papan peringkat global. Identitas Google Anda tidak akan dipublikasikan.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={pseudonymInput}
                    maxLength={20}
                    onChange={(e) => setPseudonymInput(e.target.value)}
                    placeholder="Ketik nama samaran..."
                    className="w-full rounded-xl bg-indigo-900/90 border border-indigo-700 px-3.5 py-2.5 text-sm font-bold text-white placeholder-indigo-400 focus:outline-none focus:border-amber-400"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] font-mono text-indigo-400">
                    {pseudonymInput.length}/20
                  </span>
                </div>
              </div>

              <select
                value={privacyState.playerCountry}
                onChange={(e) => {
                  const val = e.target.value;
                  const flags: Record<string, string> = { ID: '🇮🇩', MY: '🇲🇾', SG: '🇸🇬', GLOBAL: '🌐' };
                  onUpdateCountryFlag(val, flags[val] || '🇮🇩');
                }}
                className="rounded-xl bg-indigo-900/90 border border-indigo-700 px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
              >
                <option value="ID">🇮🇩 Indonesia</option>
                <option value="MY">🇲🇾 Malaysia</option>
                <option value="SG">🇸🇬 Singapura</option>
                <option value="GLOBAL">🌐 Global</option>
              </select>

              <button
                onClick={handleSaveProfile}
                className="rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 px-4 py-2 text-xs sm:text-sm font-black transition border-b-2 border-amber-600 shadow-md whitespace-nowrap"
              >
                Simpan Profil
              </button>
            </div>

            {validationError && (
              <div className="rounded-xl bg-rose-500/20 border border-rose-500/40 p-2.5 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-2.5 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* Section 2: Privasi & Visibilitas */}
          <div className="rounded-2xl border-2 border-indigo-800/80 bg-indigo-950/50 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-yellow-400">
              <Shield className="h-4 w-4" />
              <span>Privasi & Visibilitas</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-900/60 border border-indigo-800/60">
              <div>
                <div className="text-xs sm:text-sm font-bold text-white">Status Kelayakan Usia</div>
                <div className="text-[11px] text-indigo-300">
                  {privacyState.ageEligibility === '13plus'
                    ? '13 Tahun ke Atas (Fitur Cloud & Peringkat Aktif)'
                    : privacyState.ageEligibility === 'under13'
                    ? 'Di Bawah 13 Tahun (Mode Lokal Aman Aktif)'
                    : 'Belum Ditetapkan'}
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                privacyState.ageEligibility === '13plus'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {privacyState.ageEligibility}
              </span>
            </div>

            {/* Analytics Consent Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-900/60 border border-indigo-800/60">
              <div className="pr-4">
                <div className="text-xs sm:text-sm font-bold text-white">Persetujuan Telemetri Anonim</div>
                <div className="text-[11px] text-indigo-300 leading-normal">
                  Membantu kami menyeimbangkan tingkat kesulitan soal. Bebas PII, email, atau jawaban spesifik.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={privacyState.analyticsConsent}
                onClick={() => {
                  soundManager.playClick();
                  onToggleAnalyticsConsent();
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  privacyState.analyticsConsent ? 'bg-emerald-500' : 'bg-indigo-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                    privacyState.analyticsConsent ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Leaderboard Opt-Out Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-900/60 border border-indigo-800/60">
              <div className="pr-4">
                <div className="text-xs sm:text-sm font-bold text-white">Sembunyikan dari Papan Peringkat (Opt-Out)</div>
                <div className="text-[11px] text-indigo-300 leading-normal">
                  Skor Anda tidak akan diproyeksikan ke publik (&le; 24 jam). Progres lokal Anda tetap tersimpan.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={privacyState.leaderboardOptOut}
                onClick={() => {
                  soundManager.playClick();
                  onToggleLeaderboardOptOut();
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  privacyState.leaderboardOptOut ? 'bg-amber-500' : 'bg-indigo-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                    privacyState.leaderboardOptOut ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Section 3: Portabilitas Data */}
          <div className="rounded-2xl border-2 border-indigo-800/80 bg-indigo-950/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-black text-yellow-400">
              <Download className="h-4 w-4" />
              <span>Portabilitas Data</span>
            </div>
            <p className="text-xs text-indigo-200">
              Unduh salinan lengkap seluruh rekor permainan, progres level, dan riwayat belajar Anda dalam format JSON terstandarisasi.
            </p>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-2 rounded-xl bg-indigo-800 hover:bg-indigo-700 text-white px-4 py-2.5 text-xs sm:text-sm font-bold border border-indigo-600 transition shadow-sm"
            >
              <Download className="h-4 w-4 text-amber-300" />
              <span>Unduh Data JSON</span>
            </button>
          </div>

          {/* Section 4: Zona Bahaya */}
          <div className="rounded-2xl border-2 border-rose-900/60 bg-rose-950/20 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-black text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              <span>Zona Bahaya</span>
            </div>

            {/* Reset Local Progress */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-rose-900/20 border border-rose-800/30">
              <div>
                <div className="text-xs sm:text-sm font-bold text-white">Reset Progres Permainan Lokal</div>
                <div className="text-[11px] text-rose-200/80">
                  Mengembalikan progres level dan statistik ke awal pada perangkat ini.
                </div>
              </div>
              <button
                onClick={() => {
                  soundManager.playClick();
                  setShowResetConfirm(true);
                }}
                className="rounded-xl bg-rose-800/80 hover:bg-rose-700 text-rose-100 px-3.5 py-2 text-xs font-bold border border-rose-600 transition whitespace-nowrap"
              >
                Reset Progres
              </button>
            </div>

            {/* Delete Account (Cloud) */}
            {currentUser && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-rose-950/40 border border-rose-700/50">
                <div>
                  <div className="text-xs sm:text-sm font-bold text-white">Hapus Akun Cloud & Seluruh Data</div>
                  <div className="text-[11px] text-rose-200/80">
                    Menghapus data Firestore, skor publik, sesi login, dan menerbitkan kwitansi resmi DEL-XXXXXX.
                  </div>
                </div>
                <button
                  onClick={() => {
                    soundManager.playClick();
                    setShowDeleteModal(true);
                  }}
                  className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 text-xs font-black transition whitespace-nowrap shadow-md"
                >
                  Hapus Akun Cloud
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Confirmation: Reset Local Progress */}
        {showResetConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-indigo-900 border-2 border-rose-500 p-5 text-center space-y-4">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-rose-500/20 text-rose-300">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-white">Konfirmasi Reset Progres?</h3>
              <p className="text-xs text-indigo-200">
                Seluruh 72 level, bintang, dan statistik lokal akan dikembalikan ke level 1. Aksi ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-xl bg-indigo-800 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-black text-white"
                >
                  Ya, Reset Progres
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Delete Account Cloud Double Confirmation */}
        {showDeleteModal && !deletionReceipt && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-indigo-950 border-2 border-rose-500 p-5 space-y-4">
              <div className="flex items-center gap-3 text-rose-400">
                <Trash2 className="h-6 w-6" />
                <h3 className="text-base font-black text-white">Hapus Permanen Akun Cloud</h3>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                Aksi ini menghapus seluruh data cloud dan sesi akun Anda secara permanen. Untuk konfirmasi, ketik <strong className="text-yellow-300">HAPUS</strong> di bawah ini:
              </p>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="Ketik HAPUS..."
                className="w-full rounded-xl bg-indigo-900 border border-rose-500/50 px-3 py-2 text-sm font-mono text-white placeholder-indigo-400 focus:outline-none focus:border-rose-400"
              />
              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmationText('');
                  }}
                  className="rounded-xl bg-indigo-800 px-4 py-2 text-xs font-bold text-white"
                >
                  Batal
                </button>
                <button
                  disabled={deleteConfirmationText !== 'HAPUS' || isDeleting}
                  onClick={handleExecuteDeleteAccount}
                  className="rounded-xl bg-rose-600 disabled:opacity-40 hover:bg-rose-500 px-4 py-2 text-xs font-black text-white"
                >
                  {isDeleting ? 'Menghapus...' : 'Hapus Akun Permanen'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Modal: Deletion Success */}
        {deletionReceipt && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-indigo-900 border-2 border-emerald-500 p-6 space-y-4 text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-black text-white">Penghapusan Akun Selesai</h3>
              <p className="text-xs text-indigo-200">
                Seluruh data akun cloud Anda telah dihapus secara permanen. Simpan ID kwitansi ini untuk arsip Anda:
              </p>
              <div className="rounded-xl bg-indigo-950/80 p-3 border border-indigo-700 flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-amber-300">
                  {deletionReceipt.receiptId}
                </span>
                <button
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(deletionReceipt.receiptId);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-indigo-800 text-indigo-200 hover:text-white"
                  title="Salin ID Kwitansi"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[11px] text-indigo-400">
                Waktu: {deletionReceipt.timestamp}
              </p>
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black py-2.5 text-xs sm:text-sm"
              >
                Muat Ulang Permainan
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/settingsModal.test.tsx --run`
Expected: PASS (3/3 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/components/privacy/SettingsModal.tsx tests/unit/settingsModal.test.tsx
git commit -m "feat(privacy): add SettingsModal component with data portability and danger zone

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Header and App Integration & Identity Decoupling

**Files:**
- Modify: `src/components/Header.tsx`
- Modify: `src/App.tsx`
- Test: `tests/unit/privacyAppIntegration.test.tsx`

**Interfaces:**
- Consumes: `usePrivacySettings`, `SettingsModal`, `AgeGateModal`
- Produces:
  - Accessible Settings gear button (`id="settings-modal-trigger"`)
  - Lazy-loaded `SettingsModal` and `AgeGateModal` under Suspense
  - Interceptive age protection on cloud sync and ranked modes
  - Complete decoupling from Google profile photo / displayName on leaderboards

- [ ] **Step 1: Write integration tests for App privacy workflow**

```typescript
// tests/unit/privacyAppIntegration.test.tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../src/App';

vi.mock('../../src/lib/firebase', () => ({
  auth: null,
  db: null,
  loginWithGoogle: vi.fn(),
  loginAsGuest: vi.fn(),
  logoutUser: vi.fn(),
  onAuthStateChanged: vi.fn((_auth, callback) => {
    callback(null);
    return () => {};
  }),
  saveGameDataToCloud: vi.fn(),
  loadGameDataFromCloud: vi.fn(),
  submitTimeAttackScore: vi.fn().mockResolvedValue(true),
}));

describe('App Privacy & Child Safety Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders settings button in Header and opens SettingsModal on click', async () => {
    render(<App />);
    const settingsBtn = screen.getByRole('button', { name: /Buka Pengaturan dan Privasi/i });
    expect(settingsBtn).toBeDefined();

    fireEvent.click(settingsBtn);
    expect(await screen.findByRole('dialog', { name: /Pengaturan & Privasi/i })).toBeDefined();
  });

  it('triggers age gate interceptor when clicking cloud sync with unspecified age', async () => {
    render(<App />);
    const syncBtn = screen.getByRole('button', { name: /Sinkronisasi Progres/i });
    fireEvent.click(syncBtn);

    expect(await screen.findByRole('dialog', { name: /Verifikasi Usia & Privasi/i })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/privacyAppIntegration.test.tsx --run`
Expected: FAIL (Button not found or AgeGate modal not rendered)

- [ ] **Step 3: Update Header.tsx and App.tsx**

1. In `src/components/Header.tsx`:
   - Import `Settings` from `lucide-react`.
   - Add `onOpenSettings: () => void;` to `HeaderProps`.
   - Insert Settings button next to achievements/stats:
     ```tsx
     <button
       id="settings-modal-trigger"
       onClick={() => {
         soundManager.playClick();
         onOpenSettings();
       }}
       className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-indigo-200 hover:text-white hover:bg-white/20 border border-white/15 transition shadow-sm"
       title="Pengaturan & Privasi"
       aria-label="Buka Pengaturan dan Privasi"
     >
       <Settings className="h-5 w-5" />
     </button>
     ```

2. In `src/App.tsx`:
   - Lazy load `SettingsModal` and `AgeGateModal`:
     ```tsx
     const SettingsModal = React.lazy(() =>
       import('./components/privacy/SettingsModal').then((m) => ({ default: m.SettingsModal }))
     );
     const AgeGateModal = React.lazy(() =>
       import('./components/privacy/AgeGateModal').then((m) => ({ default: m.AgeGateModal }))
     );
     ```
   - Wire `usePrivacySettings` hook:
     ```tsx
     const {
       privacyState,
       isAgeGateOpen,
       openAgeGate,
       closeAgeGate,
       confirmAge,
       updatePseudonym,
       updateCountryFlag,
       toggleAnalyticsConsent,
       toggleLeaderboardOptOut,
       requestAgeProtectedAction,
     } = usePrivacySettings();
     const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
     ```
   - Intercept Cloud Sync trigger:
     ```tsx
     const handleOpenSyncModal = () => {
       requestAgeProtectedAction(
         () => setShowSyncModal(true),
         () => {
           // Fallback for under 13: Local mode notification
           alert('Mode Lokal Aman Aktif: Anda dapat memainkan seluruh 72 level tanpa akun.');
         }
       );
     };
     ```
   - Decouple `submitTimeAttackScore`:
     ```tsx
     if (
       summary.mode === 'time_attack' &&
       currentUser &&
       summary.score > 0 &&
       !privacyState.leaderboardOptOut &&
       privacyState.ageEligibility !== 'under13'
     ) {
       submitTimeAttackScore({
         userId: currentUser.uid,
         displayName: privacyState.pseudonym || 'Pemain Kilat',
         photoURL: null, // Strictly decoupled from Google identity
         score: summary.score,
         accuracy: summary.accuracy,
         streak: summary.maxStreak,
         solvedCount: summary.correctCount,
         playerFlag: privacyState.playerFlag || '🇮🇩',
       }).catch((e) => console.error('Auto-submit time attack score error:', e));
     }
     ```
   - Render `SettingsModal` and `AgeGateModal` modals inside Suspense boundaries.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/privacyAppIntegration.test.tsx --run`
Expected: PASS (2/2 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/components/Header.tsx src/App.tsx tests/unit/privacyAppIntegration.test.tsx
git commit -m "feat(privacy): integrate SettingsModal, AgeGate, and decouple Google identity

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: Full Regression, Typecheck, and Bundle Verification

**Files:**
- Modify: Any files if regressions observed.

- [ ] **Step 1: Run TypeScript typecheck / lint**

Run: `npm run lint`
Expected: 0 errors (`tsc --noEmit` exits cleanly with code 0).

- [ ] **Step 2: Run complete unit test suite**

Run: `npm test -- --run`
Expected: All 73+ test suites pass with 0 failures.

- [ ] **Step 3: Run production build and bundle budget check**

Run: `npm run build && npm run verify:bundle`
Expected: Entry bundle size $\le$ 350 KiB gzip, `vendor-charts` and `vendor-firebase` remain isolated.

- [ ] **Step 4: Commit any final cleanup**

```bash
git commit --allow-empty -m "chore(privacy): complete verification of privacy and child safety subsystem

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
