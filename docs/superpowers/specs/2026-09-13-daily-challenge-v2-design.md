# Daily Challenge V2 Design Specification
**Sub-Project E.2 of Milestone V2.3 Workstream E (Product UI Integration)**

> **Target Branch:** `feature/12.9.13.24-daily-challenge-v2-ui`  
> **Source Documents:** `docs/PRD-Hitung-Kilat-V2.md` (§15.2, §15.6, §15.7, §16), `docs/superpowers/specs/2026-09-13-competitive-modes-v2-design.md`  
> **Author:** Claude Code (Garecon Engine)  
> **Date:** 2026-09-13

---

## 1. Executive Summary & Problem Statement

### 1.1 Context
In V1, `DailyChallengeScreen.tsx` operated as an all-in-one component coupled with local storage. It had several critical competitive and architectural weaknesses:
1. **Client Trust & Inconsistent Scoring**: Scores were computed client-side without cryptographic verification, using legacy scoring models rather than the authoritative 4-tier standardized competitive formulas in PRD §15.2.
2. **Local Device Timezone Vulnerability**: Midnight resets used the browser's local time rather than canonical Western Indonesia Time (`Asia/Jakarta`, UTC+7). Players across different timezones received desynchronized puzzle windows.
3. **Unrestricted Re-roll**: Players could abandon an ongoing run and restart to obtain a higher score without consuming their daily ranked attempt slot.
4. **Monolithic Architecture**: Hub navigation, puzzle preview, gameplay keypad, and leaderboard rendering were packed into a single 950-line file without isolated component boundaries.

### 1.2 Objective
Deliver **Sub-Project E.2 (Daily Challenge V2 UI)** by modularizing Daily Challenge components, integrating `useCompetitiveSession` with `mode: 'daily'`, enforcing strict WIB timezone synchronization, guaranteeing one server-issued ranked attempt per WIB day, and providing authoritative 4-tier score breakdowns and daily streak tracking.

---

## 2. Architecture & System Flow

```text
                               ┌────────────────────────────────┐
                               │         DailyHubView           │
                               │  - WIB Date Navigator          │
                               │  - Countdown to 00:00:00 WIB   │
                               │  - 1x Ranked vs Replay Badge   │
                               │  - 10-Stage Curated Preview    │
                               │  - Global Leaderboard Table    │
                               └───────────────┬────────────────┘
                                               │ Start Challenge
                                               ▼
                              ┌──────────────────────────────────┐
                              │    useCompetitiveSession         │
                              │    (mode: 'daily', isRanked)     │
                              │  - 10 Deterministic Questions    │
                              │  - Monotonic 90s Countdown       │
                              │  - Target 75s Speed Baseline     │
                              │  - Sliding-window Buffer         │
                              │  - Sequential HMAC Token Checks  │
                              └────────────────┬─────────────────┘
                                               │
                         ┌─────────────────────┴─────────────────────┐
                         │                                           │
                         ▼                                           ▼
               ┌────────────────────┐                     ┌────────────────────┐
               │    DailyHeader     │                     │ Virtual Keypad &   │
               │ - Segmented 10 Bar │                     │ Physical Keyboard  │
               │ - 90s/75s Timer    │                     │ - 0-9, -, /, ⌫, ↵  │
               │ - Combo Streak     │                     │ - >=48px Targets   │
               └─────────┬──────────┘                     └──────────┬─────────┘
                         │                                           │
                         └─────────────────────┬─────────────────────┘
                                               │ Answer Sequence 10 or Timeout 90s
                                               ▼
                              ┌──────────────────────────────────┐
                              │    validateCompetitiveSession    │
                              │  - HMAC Token Integrity          │
                              │  - 4-Tier Score Breakdown        │
                              │  - Streak Eligibility Check      │
                              └────────────────┬─────────────────┘
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │        DailyResultView         │
                               │  - Base Points (max 1200)      │
                               │  - Streak Bonus (max 300)      │
                               │  - Speed Bonus (max 800)       │
                               │  - Perfect Bonus (+200)        │
                               │  - Total Score (max 2500)      │
                               │  - Flame Streak Tracker        │
                               │  - Ranked Record vs Replay     │
                               └────────────────────────────────┘
```

---

## 3. Data Models, Timezone, and Deterministic Seed

### 3.1 Western Indonesia Time (`Asia/Jakarta`) Standardization
All challenge dates, period boundaries, and midnight countdowns are computed relative to `Asia/Jakarta` (UTC+7):
```typescript
export const DAILY_TIMEZONE = 'Asia/Jakarta';
export const DAILY_TARGET_DURATION_MS = 75000;
export const DAILY_HARD_DEADLINE_MS = 90000;
export const DAILY_QUESTION_COUNT = 10;
export const DAILY_RULES_VERSION = '2.0.0';
export const DAILY_CONTENT_VERSION = '2.0.0';

/**
 * Returns formatted YYYY-MM-DD in Asia/Jakarta timezone
 */
export function getWIBDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Calculates remaining hours, minutes, seconds, and milliseconds until 00:00:00 WIB
 */
export function getWIBTimeUntilMidnight(now: Date = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
} {
  // Compute next midnight in Asia/Jakarta
  const nowMs = now.getTime();
  const wibDateStr = getWIBDateString(now);
  const [y, m, d] = wibDateStr.split('-').map(Number);
  
  // Create UTC date representing next midnight WIB (WIB is UTC+7, so midnight WIB is 17:00:00 UTC previous day)
  const nextDayWib = new Date(Date.UTC(y, m - 1, d + 1, -7, 0, 0, 0));
  const diffMs = Math.max(0, nextDayWib.getTime() - nowMs);

  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return { hours, minutes, seconds, ms: diffMs };
}
```

### 3.2 Canonical Challenge ID & Deterministic PRNG Seed
- **Format**: `${dateStr}@${DAILY_TIMEZONE}:${DAILY_CONTENT_VERSION}` (e.g. `2026-09-13@Asia/Jakarta:2.0.0`).
- **Seed**: 32-bit positive integer hash derived from `challengeId`.
- **Generator**: Uses mulberry32 PRNG to generate 10 questions with progressive stages:
  - Stages 1–2: Reflex addition & subtraction (difficulty 1)
  - Stages 3–4: Rapid multiplication tables & division (difficulty 2)
  - Stages 5–6: 3-number chains & double subtraction (difficulty 3)
  - Stages 7–8: Multi-digit operations & signed integers (difficulty 4)
  - Stages 9–10: Rapid mental algebra & mixed priority (difficulty 5)
- Each generated question produces an authoritative `Question` object:
  ```typescript
  export interface Question {
    id: string;
    prompt: string;
    displayPrompt?: string;
    difficulty: number;
    skillId: string;
    subSkillId: string;
    answerSpec: {
      kind: 'integer' | 'fraction';
      value: number | string;
    };
  }
  ```

---

## 4. Ranked Attempt vs. Replay Practice State

### 4.1 Single Server-Issued Ranked Attempt (PRD §15.2)
1. **First Attempt of the Day**:
   - For a given account and `challengeId`, if no record exists in `userState.history[challengeId]`:
     - Sesi dimulai dengan `isRanked = true`.
     - Status slot langsung ditandai `CONSUMED` saat sequence 1 di-render.
     - Jika pemain menutup browser atau menekan Escape/Kembali, sesi berstatus `ABANDONED`/`REJECTED`. Slot ranked tetap habis, sehingga pemain tidak bisa me-restart untuk meraup skor lebih tinggi.
2. **Replay & Historical Past Days**:
   - Jika rekor untuk `challengeId` sudah ada, atau jika pengguna memilih tanggal lampau:
     - Sesi dimulai dengan `isRanked = false`.
     - UI menampilkan badge jelas: `"Mode Latihan (Tidak Mengubah Rekor)"`.
     - Hasil permainan tidak mengubah posisi peringkat leaderboard publik atau streak.

### 4.2 Daily Streak Increment Eligibility
Sesuai PRD §15.2, streak harian bertambah tepat satu kali jika:
- Hasil berstatus `VALIDATED`.
- Mode adalah `'daily'`.
- Seluruh 10 soal terjawab (`questionsAnswered === 10`).
- `correctCount >= 6`.
- Sesi adalah sesi ranked pertama hari itu (`isRanked === true`).

---

## 5. Unified Hook Integration (`useCompetitiveSession`)

`useCompetitiveSession` diperluas dengan parameter opsional:
```typescript
export interface UseCompetitiveSessionOptions {
  mode: CompetitiveMode; // 'sprint' | 'survival' | 'daily'
  secret: string;
  userId?: string;
  isRanked?: boolean;
  challengeId?: string;
  dailyQuestions?: Question[];
  onFinish?: (output: ValidationOutput) => void;
}
```

### 5.1 Perilaku Mode Daily dalam Hook
1. **Initial Questions**:
   - Jika `mode === 'daily'`, sesi mengonsumsi `dailyQuestions` (10 soal) alih-alih `generateCompetitiveQuestions(1, 5)`.
   - Initial buffer: sequence 1–5.
2. **Buffer Replenishment**:
   - Setiap kali soal terjawab, buffer mengambil soal berikutnya dari `dailyQuestions` (sequence 6 s.d. 10).
3. **Monotonic Timer**:
   - Sesi diinisialisasi dengan `timeRemainingMs = 90000` (`DAILY_HARD_DEADLINE_MS`).
   - Setiap tick (200ms), sisa waktu dikurangi delta wall-clock:
     `remaining = Math.max(0, 90000 - elapsed)`.
   - Jika `remaining <= 0`, sesi langsung difinalisasi.
4. **Auto-Finalization on Sequence 10**:
   - Pada saat sequence 10 diserahkan (`seq === 10`), hook langsung memanggil `finalizeSession()`.
   - `validator.ts` menghitung `rankedActiveDurationMs = Math.min(90000, lastAnswerTime - serverStartedAt)`.
   - Menjalankan kalkulasi 4 komponen skor harian.

---

## 6. Authoritative Daily Score Formulation (PRD §15.2)

Semua kalkulasi skor menggunakan integer fixed-point arithmetic (`roundHalfUp(num, den) = Math.floor((2 * num + den) / (2 * den))`):

$$\text{accuracy} = \frac{\text{correctCount}}{10} \times 100$$

$$\text{base} = \text{correctCount} \times 120 \quad (\text{maksimal } 1.200)$$

$$\text{streakBonus} = \min(300, \text{maxStreak} \times 30) \quad (\text{maksimal } 300)$$

$$\text{speedNum} = \max(0, 75000 - \text{rankedActiveDurationMs}) \times 800 \times \text{correctCount}$$

$$\text{speedBonus} = \text{roundHalfUp}(\text{speedNum}, 750000) \quad (\text{maksimal } 800)$$

$$\text{perfectBonus} = \begin{cases} 200 & \text{jika } \text{correctCount} = 10 \\ 0 & \text{lainnya} \end{cases}$$

$$\text{totalScore} = \text{base} + \text{streakBonus} + \text{speedBonus} + \text{perfectBonus} \quad (\text{maksimal } 2.500)$$

---

## 7. Component Breakdown & Specifications

### 7.1 `src/components/daily/DailyHeader.tsx`
- **Props**:
  - `timeRemainingMs: number`
  - `currentQuestionIdx: number` (0–9)
  - `totalQuestions: number` (10)
  - `comboStreak: number`
  - `stageTitle: string`
  - `onExit: () => void`
- **Features**:
  - Countdown timer: Tampilan mm:ss. Menandai warna hijau jika durasi masih $\le 75\text{s}$ (target kecepatan) dan amber jika $>75\text{s}$.
  - Segmented Progress Bar: 10 strip horizontal yang menunjukkan status setiap nomor (lampau hijau, aktif amber pulsing, belum abu-abu).
  - Floating Combo Badge: Animasi kombo beruntun jika $\text{comboStreak} > 1$.
  - Accessibility: Tombol keluar minimal $48\times 48\text{px}$ dengan label Indonesian ARIA.

### 7.2 `src/components/daily/DailyResultView.tsx`
- **Props**:
  - `output: ValidationOutput`
  - `isRanked: boolean`
  - `challengeId: string`
  - `currentStreak: number`
  - `isStreakIncremented: boolean`
  - `onPlayAgain: () => void`
  - `onExit: () => void`
- **Features**:
  - Victory Banner & Status Badge: "Skor Resmi Tercatat" vs "Mode Latihan (Replay)".
  - 4-Tier Breakdown Cards:
    - Base Points (`correctCount × 120`)
    - Streak Bonus (`maxStreak × 30`)
    - Speed Bonus (durasi vs 75s)
    - Perfect Bonus (+200 jika 10/10)
  - Daily Streak Flame: Animasi api dan jumlah hari streak aktif.
  - Share Button: Menyalin teks ringkasan untuk WhatsApp/medsos.
  - Action Buttons: "Main Ulang (Latihan)" dan "Kembali ke Beranda".

### 7.3 `src/components/daily/DailyHubView.tsx`
- **Props**:
  - `userState: DailyChallengeUserState`
  - `onStartChallenge: (isRanked: boolean) => void`
  - `onExit: () => void`
  - `onOpenStats: () => void`
- **Features**:
  - Hero Header dengan countdown real-time ke pergantian hari WIB (`00:00:00 WIB`).
  - Tombol Utama Aksi:
    - Jika belum main: Tombol Emas `"Mulai Tantangan Resmi (1x Kesempatan)"`.
    - Jika sudah main: Menampilkan kartu rekor hari ini dan tombol `"Main Ulang (Mode Latihan)"`.
  - Navigator Tanggal WIB: Kemampuan meninjau arsip puzzle lampau.
  - Preview 10 Tahap Teka-teki: Grid 10 tahap teka-teki dengan ikon dan judul.
  - Leaderboard Table: Peringkat pemain dunia untuk puzzle yang dipilih.

### 7.4 `src/components/DailyChallengeScreen.tsx` (Container)
- Mengorkestrasi state layar: `'hub' | 'playing' | 'result'`.
- Menyediakan keyboard handler global (Escape untuk kembali/keluar, keypad virtual dan fisik untuk bermain).
- Memastikan persistence rekor lokal di `userState` hanya saat sesi berstatus `VALIDATED` dan `isRanked: true`.

---

## 8. Accessibility & Responsive Constraints

- **WCAG 2.2 AA Compliance**:
  - Touch target minimal $48\times 48\text{px}$ untuk seluruh tombol interaktif (close button, keypad, date arrows, tabs).
  - Kontras warna teks $\ge 4.5:1$ terhadap background indigo gelap.
  - `aria-live="polite"` untuk card soal dan perubahan status timer.
- **Motion Reduction**:
  - `motion-reduce:animate-none` dan `motion-reduce:transform-none` pada efek pulsing, bouncing, dan shaking.
- **Responsive Layout**:
  - Mendukung mobile portrait ($360\text{px}$ – $420\text{px}$) hingga tablet/desktop tanpa horizontal scrollbar.

---

## 9. Testing & Verification Strategy

1. **Unit Tests (`tests/unit/dailyChallengeEngine.test.ts`)**:
   - Presisi konversi zona waktu WIB (`getWIBDateString`, `getWIBTimeUntilMidnight`).
   - Sifat deterministik PRNG mulberry32: seed yang sama menghasilkan 10 soal yang 100% identik.
   - Evaluasi kelayakan streak (`isDailyStreakEligible`).
2. **Hook Integration Tests (`tests/unit/competitiveHookDaily.test.ts`)**:
   - `useCompetitiveSession` dengan `mode: 'daily'`.
   - Monotonic timer 90.000 ms.
   - Auto-finalization saat submit soal sequence 10.
   - Validasi golden fixtures skor PRD §15.2.
3. **Component Tests**:
   - `DailyHeader.test.tsx`: render timer, segmented bar, tombol keluar.
   - `DailyResultView.test.tsx`: rincian 4 komponen skor, status ranked vs replay badge, share copy.
   - `DailyHubView.test.tsx`: tampilan countdown, navigasi tanggal, tombol ranked vs replay.
   - `DailyChallengeScreen.test.tsx`: alur utuh dari hub ke play lalu ke result.
4. **Build & Quality Gates**:
   - `npm test`: 100% pass rate.
   - `npm run lint`: 0 TypeScript compiler errors.
   - `npm run build`: bundle produksi sukses.
