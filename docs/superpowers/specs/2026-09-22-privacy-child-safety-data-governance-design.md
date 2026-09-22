# Privacy, Child Safety & Data Governance Design

**Date:** 2026-09-22  
**Status:** Approved  
**Author:** Claude Code & cachak  
**Branch:** `feature/12.9.20.12-privacy-child-safety-data-governance`  
**Milestone:** V2.4 Polish, Balance, and GA Rollout  
**References:** PRD §20 (Privacy, Safety, and Data Governance), §21 (Data Model and Synchronization Contract), §31 (Definition of Done V2)

---

## 1. Overview & Problem Statement

Hitung Kilat V2 is built for a general audience, including young learners and students. As the application expands into competitive modes, cloud synchronization, and performance analytics, it must strictly comply with **PRD §20 (Privacy, Safety, and Data Governance)** and the **AC-PRIV acceptance criteria**:

- **Child Safety & Local-Only Guarantee (PRD §20.1 & AC-PRIV-03)**:
  - Players under 13 years of age (`under13`) must operate 100% in a local-only environment without cloud synchronization or public leaderboard broadcasting.
  - Anonymous local play must never demand PII (name, email, photo, date of birth, or geolocation).
- **Public Identity Decoupling (PRD §20.1, AC-PRIV-02 & AC-PRIV-06)**:
  - Google display names and profile photos must never leak automatically to public leaderboards.
  - All public representations must use an approved, sanitized pseudonym (3–20 characters, allowlist characters, profanity filtered, rate-limited) and an optional country flag.
- **Data Governance, Portability, and Right to be Forgotten (PRD §20.2, §20.3, AC-PRIV-05 & AC-PRIV-07)**:
  - Players must be able to export all local game data as standard JSON at any time.
  - Players must be able to opt-out of public leaderboards ($\le$ 24h projection removal) while preserving local progress.
  - Distinct separation between "Reset Progress" (local level and stat reset) and "Delete Account" (cloud purge, auth revocation, local wipe, and issuance of an auditable `DEL-XXXXXX` deletion receipt).
- **Separate Analytics Consent (PRD §20.3 & AC-PRIV-04)**:
  - Telemetry/analytics must be opt-in, separate from general terms, revocable, and strictly free of PII, raw math prompts, or exact answers.

---

## 2. Architecture & File Structure

Following **Architectural Approach 1 (Dedicated Modular Subsystem)**, the privacy subsystem is organized in `src/utils/privacy/` and `src/components/privacy/` with clean interface boundaries:

```text
src/
├── types.ts                                    # Type declarations (PrivacyState, DeletionReceipt, etc.)
├── utils/
│   └── privacy/
│       ├── privacyState.ts                     # Local storage persistence, safe defaults, getters/setters
│       ├── pseudonymValidator.ts               # 3-20 chars, allowlist, profanity filter, 24h cooldown
│       ├── dataExporter.ts                     # Collects campaign, mastery, daily, achievements into JSON
│       └── accountDeletion.ts                  # Cloud purge, auth revocation, local wipe, receipt generator
├── hooks/
│   └── usePrivacySettings.ts                   # Centralized React hook for reactive privacy management
├── components/
│   ├── Header.tsx                              # Added Settings gear icon (⚙️) trigger
│   └── privacy/
│       ├── SettingsModal.tsx                   # Lazy-loaded Settings & Privacy modal
│       └── AgeGateModal.tsx                    # Lazy-loaded Age Verification interceptor modal
└── App.tsx                                     # Lazy routing, age interceptor coordination, safe sync
```

---

## 3. Data Models & Storage Contracts

### 3.1 `PrivacyState` Contract

Stored in `localStorage` under key `hitung_kilat_privacy_v2`:

```typescript
export type AgeEligibility = 'unspecified' | 'under13' | '13plus';

export interface PrivacyState {
  schemaVersion: number;                     // 2
  policyVersion: string;                     // '2.0.0'
  ageEligibility: AgeEligibility;            // 'unspecified' | 'under13' | '13plus'
  ageConfirmedAt?: string;                   // ISO 8601 string
  analyticsConsent: boolean;                 // default: false (opt-in)
  analyticsConsentChangedAt?: string;        // ISO 8601 string
  leaderboardOptOut: boolean;                // default: false (opt-out conceals scores)
  leaderboardOptOutChangedAt?: string;       // ISO 8601 string
  pseudonym: string;                         // 3-20 chars, default: 'Pemain Kilat'
  playerCountry: string;                     // default: 'ID'
  playerFlag: string;                        // default: '🇮🇩'
  lastPseudonymChangeTimestamp?: number;     // epoch ms for 24h rename cooldown
  accountEpoch: number;                      // reset/deletion tracking epoch
}
```

### 3.2 Safe Defaults (`PRD §20.1`)

When no privacy record exists in `localStorage`:
```typescript
export const DEFAULT_PRIVACY_STATE: PrivacyState = {
  schemaVersion: 2,
  policyVersion: '2.0.0',
  ageEligibility: 'unspecified',
  analyticsConsent: false,
  leaderboardOptOut: false,
  pseudonym: 'Pemain Kilat',
  playerCountry: 'ID',
  playerFlag: '🇮🇩',
  accountEpoch: 1,
};
```
No personal data (email, real name, photo URL, birthdate, geolocation) is ever stored.

### 3.3 `DeletionReceipt` Contract

```typescript
export interface DeletionReceipt {
  receiptId: string;                         // format: `DEL-${hex_timestamp}-${random}`
  timestamp: string;                         // ISO 8601 string
  status: 'COMPLETED';
  scopesPurged: Array<'cloud_firestore' | 'auth_session' | 'local_progress'>;
  policyNotice: string;
}
```

---

## 4. Age Gate Interceptor & Child Safety Subsystem

### 4.1 Interception Rules (`PRD §20.1 & AC-PRIV-03`)

1. **Local Play Invariance**:
   - Campaign (72 levels), Adaptive Practice, and Remediation never trigger the Age Gate. Children and anonymous users can play indefinitely without friction.
2. **Online / Cloud Interception Trigger**:
   - Triggered when the user attempts:
     - Cloud Sync login (`onOpenSyncModal` / Google Login / Guest Login)
     - Entering Ranked Competitive Modes (Daily Challenge official slot, Ranked Sprint 60s, Ranked Survival)
3. **Evaluation Flow**:
   - If `privacyState.ageEligibility === 'unspecified'`:
     - Intercept action, mount `AgeGateModal`.
     - Defer the requested action callback until age resolution.
   - If `privacyState.ageEligibility === 'under13'`:
     - Disallow Cloud Sync. Display child-safe explanation:
       *"Mode Lokal Aman Aktif: Kamu dapat memainkan seluruh 72 level dan latihan sepuasnya tanpa akun."*
     - For competitive modes, automatically downgrade the session to **Unranked Practice Mode** (no score emitted to Firestore).
   - If `privacyState.ageEligibility === '13plus'`:
     - Permit Cloud Sync and Ranked leaderboard submissions.

### 4.2 AgeGate UI Specifications (`AgeGateModal.tsx`)

- Modal dialog with distinct, friendly visual cues.
- Clear, age-appropriate text explaining data transmission differences.
- Two distinct interactive options:
  1. **"Saya Berusia 13 Tahun ke Atas"** (`13plus`):
     - Confirms eligibility for cloud sync and competitive rankings.
     - Sets `ageEligibility: '13plus'`, `ageConfirmedAt: new Date().toISOString()`.
     - Executes deferred pending action.
  2. **"Saya Berusia di Bawah 13 Tahun"** (`under13`):
     - Activates 100% Local-Only safety guardrail.
     - Sets `ageEligibility: 'under13'`, `ageConfirmedAt: new Date().toISOString()`.
     - Dismisses modal with confirmation toast/banner.

---

## 5. Pseudonym Validation & Moderation Engine

### 5.1 Rules (`PRD §20.1 & AC-PRIV-06`)

`validatePseudonym(candidate: string, lastChangeTimestamp?: number, currentName?: string): PseudonymValidationResult`

1. **Length**:
   - 3 to 20 characters after `trim()`.
   - Error: `"Nama samaran harus memiliki panjang antara 3 hingga 20 karakter."`
2. **Allowlist Characters**:
   - Permitted: `^[a-zA-Z0-9_-]+( [a-zA-Z0-9_-]+)*$`
   - Rejects special symbols, emojis in name string, control characters, scripts/HTML tags, consecutive spaces.
   - Error: `"Nama samaran hanya boleh memuat huruf, angka, tanda hubung (-), garis bawah (_), dan spasi tunggal."`
3. **Profanity Filter (Lightweight Offline Dictionary)**:
   - Sanitizes and normalizes leetspeak (`4` $\rightarrow$ `a`, `1`/`!` $\rightarrow$ `i`, `0` $\rightarrow$ `o`, `3` $\rightarrow$ `e`, `@` $\rightarrow$ `a`, `$` $\rightarrow$ `s`).
   - Checks against curated list of offensive Indonesian and English terms (e.g., profanities, hate speech, vulgarities).
   - Error: `"Nama samaran mengandung kata yang tidak pantas. Silakan gunakan nama lain."`
4. **24-Hour Rename Cooldown**:
   - If `currentName !== 'Pemain Kilat'` (default is exempt) and `Date.now() - lastChangeTimestamp < 86_400_000`:
     - Rejects change.
     - Computes remaining hours and minutes.
     - Error: `"Nama samaran hanya dapat diubah 1 kali per 24 jam. Coba lagi dalam X jam Y menit."`

### 5.2 Decoupling from Google Identity (`AC-PRIV-02`)

In `src/App.tsx` and leaderboard submitters (`submitTimeAttackScore`, `DailyHubView`):
```typescript
// Strict Decoupling: Never fallback to currentUser.displayName or photoURL
const publicName = privacyState.pseudonym || 'Pemain Kilat';
const publicPhoto = null; // Decoupled from currentUser.photoURL
```

---

## 6. Data Governance Engine

### 6.1 Data Export (`dataExporter.ts`)

Function `exportAllGameDataAsJSON(): string`:
Bundles all local game partitions:
```json
{
  "metadata": {
    "exportedAt": "2026-09-22T10:00:00.000Z",
    "schemaVersion": 2,
    "appVersion": "2.0.0",
    "policyVersion": "2.0.0"
  },
  "privacy": { ... },
  "campaign": { ... },
  "mastery": { ... },
  "dailyChallenge": { ... },
  "achievements": { ... }
}
```
Triggers download via browser DOM helper `downloadJSONFile(filename, jsonString)`.

### 6.2 Leaderboard Opt-Out (`AC-PRIV-07`)

- Controlled via toggle in `SettingsModal`.
- When `leaderboardOptOut === true`:
  - `App.tsx` skips calling `submitTimeAttackScore()` on game completion.
  - Daily Challenge sessions run with `isRanked = false`.
  - In Firestore Cloud Sync, user document flags `leaderboardOptOut: true` so backend aggregators exclude the player from public rankings ($\le$ 24h projection SLA).

### 6.3 Separation of Reset vs Delete (`PRD §20.3 & AC-PRIV-05`)

| Feature | Reset Progress (Lokal) | Hapus Akun Cloud & Data (Delete Account) |
|:---|:---|:---|
| **Audience** | Any user | Authenticated Cloud users |
| **Trigger** | "Reset Progres Permainan" button | "Hapus Akun Cloud & Data" danger button |
| **Confirmation** | Standard two-step confirm dialog | Double confirmation with **Type-to-Confirm: `HAPUS`** |
| **Local Progress** | Reset to Level 1 / 0 stars | Fully wiped (`localStorage.clear()`) |
| **Auth Session** | Kept active (still logged in) | Revoked (`logoutUser()`) |
| **Cloud Firestore** | Overwrites with 0 stars | Hard deletes `users/{uid}` document |
| **Output Artifact** | Re-renders empty map | Generates & displays `DeletionReceipt` (`DEL-XXXXXX`) |

---

## 7. UI Component Specifications

### 7.1 Header Integration (`src/components/Header.tsx`)

Add Settings button alongside Help, Achievements, and Stats:
```tsx
<button
  id="settings-modal-trigger"
  onClick={() => {
    soundManager.playClick();
    onOpenSettings();
  }}
  className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-indigo-200 hover:text-white hover:bg-white/20 border border-white/15 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
  title="Pengaturan & Privasi"
  aria-label="Buka Pengaturan dan Privasi"
>
  <Settings className="h-5 w-5" />
</button>
```

### 7.2 SettingsModal Layout (`src/components/privacy/SettingsModal.tsx`)

Structured into 4 card sections inside a scrollable, responsive modal:

1. **Seksi 1: Profil Publik (Nama Samaran & Bendera)**
   - Input text for `pseudonym` with live character counter (`N/20`).
   - Dropdown or quick picker for flag/country (`🇮🇩 Indonesia`, `🇲🇾 Malaysia`, `🇸🇬 Singapura`, `🌐 Global`).
   - Inline feedback banner for validation errors or cooldown notice.
   - Button "Simpan Profil".
2. **Seksi 2: Privasi & Visibilitas**
   - Status Usia: Badge `13+ (Fitur Cloud Aktif)` or `< 13 Tahun (Mode Lokal Aman)`.
   - Toggle **Persetujuan Analitik (Analytics Consent)**:
     - Clear disclosure: Telemetry is purely anonymized and aggregated.
   - Toggle **Sembunyikan dari Papan Peringkat (Leaderboard Opt-Out)**:
     - Clear disclosure: Your scores won't appear on global leaderboards.
3. **Seksi 3: Portabilitas Data**
   - Card with button: **"Unduh Seluruh Data Permainan (JSON)"** (`Download` icon).
4. **Seksi 4: Zona Bahaya**
   - Sub-action A: **Reset Progres Permainan Lokal**.
   - Sub-action B: **Hapus Akun Cloud & Seluruh Data** (visible if user is logged in).
     - Opens nested verification dialog requiring the user to type `HAPUS`.
     - Upon confirmation, calls `purgeUserAccountAndData(currentUser.uid)` and presents `DeletionReceiptModal`.

### 7.3 Lazy Loading Integration (`src/App.tsx`)

```tsx
const SettingsModal = React.lazy(() =>
  import('./components/privacy/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const AgeGateModal = React.lazy(() =>
  import('./components/privacy/AgeGateModal').then((m) => ({ default: m.AgeGateModal }))
);
```
Both wrapped in `<ChunkErrorBoundary variant="modal">` and `<Suspense fallback={<ModalLoadingFallback />}>` to respect the $\le$ 350 KiB bundle budget.

---

## 8. Security & Integrity Analysis

1. **No PII Leaks (`AC-PRIV-01 & AC-PRIV-04`)**:
   - Data exporter, analytics payload, and public scores omit Google display name, email, photo, or IP/geolocation.
2. **Injection Resistance**:
   - `pseudonymValidator` enforces strict regex (`^[a-zA-Z0-9_-]+( [a-zA-Z0-9_-]+)*$`), blocking XSS/HTML tags (`<script>`, `<iframe>`, `javascript:`).
3. **Auditability (`AC-PRIV-05`)**:
   - Deletion receipt contains unique hash, UTC timestamp, and list of purged scopes.
4. **Offline Resilience**:
   - When offline, deletion or opt-out queue safely wipes local data and registers pending synchronization.

---

## 9. Testing Strategy

### 9.1 Unit Test Suites

1. **`tests/unit/pseudonymValidator.test.ts`**:
   - Length tests: 2 chars (fail), 3 chars (pass), 20 chars (pass), 21 chars (fail).
   - Character allowlist: spaces, hyphens, underscores (pass), special characters `<>`, `{}`, `$`, `&` (fail).
   - Profanity filter: detects common vulgarities in Indonesian/English and leetspeak variations.
   - Rate limit: rejects modification within 24 hours of last change; allows if cooldown expired or if currently default name.
2. **`tests/unit/privacyState.test.ts`**:
   - Verifies safe defaults on clean `localStorage`.
   - Validates idempotent updates, epoch incrementation, and schema version consistency.
3. **`tests/unit/dataExporter.test.ts`**:
   - Verifies JSON structure contains `metadata`, `campaign`, `mastery`, `dailyChallenge`, and `achievements`.
   - Confirms zero PII (no auth tokens, emails, or real names).
4. **`tests/unit/accountDeletion.test.ts`**:
   - Mocks Firebase Firestore deleteDoc and auth signOut.
   - Verifies all local storage partitions are erased and a valid `DeletionReceipt` object is returned.

### 9.2 Component & Integration Test Suites

1. **`tests/unit/settingsModal.test.tsx`**:
   - Renders all 4 sections with accessible ARIA semantics.
   - Tests changing pseudonym with validation and rate limit UI.
   - Tests toggling analytics consent and leaderboard opt-out.
   - Tests Export JSON click invoking download trigger.
   - Tests Delete Account confirmation requiring typing `HAPUS` and rendering receipt modal.
2. **`tests/unit/ageGateIntegration.test.tsx`**:
   - Mocks uninitialized age eligibility (`unspecified`).
   - Verifies interceptor triggers when clicking Cloud Sync or Ranked Daily challenge.
   - Verifies choosing `under13` blocks cloud sync and downgrades competitive mode to unranked practice.
   - Verifies choosing `13plus` persists eligibility and proceeds with requested cloud/ranked action.

### 9.3 Full Regression Gate
- Run full suite (`npm test -- --run`): all 73 existing suites + new privacy suites (100% green).
- Typecheck & linter: `npm run lint` (`tsc --noEmit`) passes with 0 errors.
- Bundle budget: `npm run build && npm run verify:bundle` passes $\le$ 350 KiB gzip limit.
