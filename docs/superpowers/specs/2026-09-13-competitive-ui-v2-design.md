# Milestone V2.3 Workstream E: Competitive Modes UI Design Specification

**Status:** APPROVED  
**Date:** 2026-09-13  
**Workstream:** E.1 — Competitive Modes UI (Sprint 60s & Survival Kilat)  
**Target Branch:** `feature/12.9.13.11-product-ui-integration`  

---

## 1. Executive Summary & Goals

Milestone V2.3 delivered the pure functional competitive engine, sliding window state machine, cryptographic HMAC token generation, authoritative server-side validator, and Firestore security rules. 

Workstream E.1 builds the user-facing interface for **Sprint 60s** and **Survival Kilat**, connecting the authoritative competitive engine to the React web application while meeting strict responsiveness, anti-cheat, and accessibility requirements.

### Key Objectives:
1. **Dedicated Game Arenas**: Separate **Sprint 60s** and **Survival Kilat** from the legacy single `TimeAttackScreen.tsx`.
2. **Sliding-Window Buffer UI Protocol**: Maintain $3–5$ pre-buffered `CompetitiveQuestionView` items, providing $\le 100\text{ ms}$ optimistic transitions on answer submission with seamless background replenishment.
3. **Monotonic Deadlines & Heartbeat Invariants**:
   - Sprint 60s: Monotonic absolute deadline (`serverStartedAt + 60000 ms`).
   - Survival Kilat: Dynamic visual timer bar with live $+2\text{s}$ additions (capped at $60\text{s}$), $-4\text{s}$ penalties (floored at $0\text{s}$), a $600\text{s}$ (10-minute) hard cap, and a $4\text{s}$ client heartbeat interval satisfying the server's $10\text{s}$ heartbeat gap invariant (`AC-COMP-12`).
4. **Authoritative Result Presentation**:
   - Zero local score display in ranked records: results render canonical metrics calculated strictly by `validateCompetitiveSession()`.
   - Displays score, accuracy, questions answered, max streak, and public leaderboard projection preview with pseudonym.
5. **Accessibility (WCAG 2.2 AA)**:
   - Full keyboard navigation and on-screen touch keypad.
   - Screen-reader live regions announcing prompts, time warnings, and streaks.
   - Respects `prefers-reduced-motion`.

---

## 2. Component Architecture & File Organization

The competitive UI is organized under `src/components/competitive/` and `src/hooks/`:

```text
src/
├── hooks/
│   └── useCompetitiveSession.ts         # Headless hook managing session lifecycle, buffer, and timers
├── components/
│   └── competitive/
│       ├── CompetitivePlayScreen.tsx     # Main arena host: prompt, input, transitions
│       ├── SprintHeader.tsx             # 60s circular timer, combo multiplier flame, difficulty badge
│       ├── SurvivalHeader.tsx           # Dynamic timer gauge (+2s/-4s pulses), survival duration, heartbeat
│       ├── CompetitiveResultView.tsx    # Canonical score, accuracy, streaks, and leaderboard projection preview
│       └── CompetitiveModeSelectModal.tsx # Dialog to launch Sprint 60s or Survival Kilat
├── App.tsx                              # Screen routing and mode integration
tests/unit/
├── competitiveHook.test.ts              # Unit tests for useCompetitiveSession state transitions and buffer
└── competitivePlayScreen.test.tsx       # Component tests for HUDs, keypad, and result view
```

---

## 3. Detailed Specifications

### 3.1 Headless Hook: `useCompetitiveSession`

```typescript
export interface UseCompetitiveSessionOptions {
  mode: 'sprint' | 'survival';
  secret: string;
  userId?: string;
  isRanked?: boolean;
  onFinish?: (output: ValidationOutput) => void;
}

export interface UseCompetitiveSessionReturn {
  status: 'ACTIVE' | 'PENDING' | 'VALIDATED' | 'REJECTED';
  currentQuestion: CompetitiveQuestionView | null;
  bufferedCount: number;
  comboStreak: number;
  difficultyReached: number;
  timeRemainingMs: number;
  totalElapsedMs: number;
  isGameOver: boolean;
  submitAnswer: (rawInput: string) => void;
  abandonSession: () => void;
  resultOutput: ValidationOutput | null;
}
```

#### Hook Logic:
1. **Initialization**:
   - Generates initial 5 `Question` instances using the existing generator registry (`src/engine/campaign/registry.ts`) calibrated for difficulty tier 1.
   - Calls `createCompetitiveSession()` from `src/engine/competitive/stateMachine.ts`.
   - Populates initial buffer with 5 `CompetitiveQuestionView` items.
2. **Timer Loops**:
   - **Sprint**: Uses `requestAnimationFrame` calculating `timeRemainingMs = Math.max(0, deadlineAt - performance.now())`. When remaining time hits 0, triggers automatic finalization.
   - **Survival**: Decrements `timeRemainingMs` each tick. On correct answer, adds $2000\text{ ms}$ (clamped to $60000\text{ ms}$). On wrong answer, subtracts $4000\text{ ms}$. If timer reaches 0 or elapsed time reaches $600000\text{ ms}$, triggers automatic finalization.
   - **Heartbeats**: Emits background heartbeat timestamp every $4000\text{ ms}$ for Survival.
3. **Answer Submission**:
   - Records `clientAnsweredAt` (relative epoch ms) and `inputLatencyMs` (delta since question presented).
   - Updates local streak and difficulty tier for instant HUD feedback.
   - Pops current question view; advances buffer by calling `advanceSessionBuffer()` with newly generated questions matching the updated difficulty tier to maintain 5 buffered views.
4. **Finalization**:
   - Assembles `ValidationInput` containing session contract, all server questions, submitted answer payloads, and server timestamps (`startedAt`, `finalizedAt`, `receivedAnswerTimes`).
   - Invokes authoritative `validateCompetitiveSession(input, secret)`.
   - Stores `ValidationOutput` and transitions status to `VALIDATED` or `REJECTED`.

---

### 3.2 UI Components

#### `CompetitivePlayScreen.tsx`
- **Layout**: Full-screen responsive container with top header (swapped dynamically for Sprint or Survival), central prompt card, feedback indicator, and bottom input pad.
- **Optimistic Transitions**:
  - Upon answer submission: emits sound effect (`soundManager.play('correct')` or `'wrong'`), flashes subtle border aura (green/red), and immediately swaps the central prompt with the next view from the buffer ($\le 100\text{ ms}$).
  - Input field automatically clears and refocuses for rapid continuous play.
- **Input Pad**:
  - Touch-friendly 0–9 keypad with Backspace (`<-`) and Submit (`Enter`).
  - Physical keyboard event listeners capturing numbers, Backspace, Enter, and Escape.

#### `SprintHeader.tsx`
- **Timer Badge**: Circular progress indicator displaying remaining seconds (60 down to 0) with pulsating red warning below 10s.
- **Combo Multiplier Flame**: Animated badge displaying current multiplier ($1.0\times$ to $3.0\times$ tenths) with flame intensity scaling with streak length.
- **Difficulty Tier Badge**: Shows current difficulty bracket (Tiers 1–6).

#### `SurvivalHeader.tsx`
- **Dynamic Time Bar**: Horizontal energy gauge representing current timer percentage ($0–60\text{s}$).
  - Correct answer triggers green expansion pulse with floating `+2s` text.
  - Wrong answer triggers red shake with floating `-4s` text.
- **Session Duration Counter**: Digital clock format (`MM:SS`) tracking total survival duration.
- **Heartbeat Status**: Subtle pulse dot confirming active anti-cheat connection.

#### `CompetitiveResultView.tsx`
- **Metric Cards**:
  - Canonical Score (large gradient typography).
  - Accuracy percentage with exact fractions ($C / N$).
  - Max streak achieved and highest difficulty bracket reached.
  - Total active duration.
- **Ranked Status Banner**:
  - If `isRanked && status === 'VALIDATED'`: Displays "Peringkat Sah" with pseudonym, subject ID, and period partition key preview.
  - If `status === 'REJECTED'`: Displays "Latihan Tidak Berperingkat" along with clear, user-friendly rejection explanations (e.g., session timeout or heartbeat interruption).
- **Action Buttons**: "Main Lagi" (restarts mode) and "Kembali ke Menu".

---

## 4. Accessibility & UX Standards

1. **WCAG 2.2 AA Compliance**:
   - Visual contrast: All typography maintains minimum 4.5:1 contrast against dark and light grounds.
   - Interactive targets: All on-screen keypad buttons meet minimum $48 \times 48\text{ px}$ touch targets.
   - `aria-live` regions:
     - Prompt equation announced on change (`aria-live="polite"`).
     - Critical timer countdowns announced at 30s, 10s, and 5s (`aria-live="assertive"`).
2. **Reduced Motion (`prefers-reduced-motion: reduce`)**:
   - Disables floating particle explosions and camera shake on penalties.
   - Replaces timer bar smooth animations with standard non-interpolated transitions.

---

## 5. Verification Strategy & Test Pyramid

1. **Headless Hook Unit Tests (`tests/unit/competitiveHook.test.ts`)**:
   - Verifies initial buffer count is exactly 5.
   - Verifies sequential answer submissions pop top view and replenish buffer to maintain 5 views.
   - Verifies Sprint automatic finalization at 60.000 ms.
   - Verifies Survival timer increment on correct answer and decrement on wrong answer.
   - Verifies Survival automatic finalization on timer reaching 0 ms or 10-minute duration cap.
   - Verifies authoritative validation produces `VALIDATED` status and canonical score.
2. **Component Tests (`tests/unit/competitivePlayScreen.test.tsx`)**:
   - Tests rendering of `SprintHeader` with multiplier flame and countdown.
   - Tests rendering of `SurvivalHeader` with dynamic time bar and $+2\text{s}/-4\text{s}$ feedback.
   - Tests keypad button clicks and physical keyboard events (0–9, Backspace, Enter).
   - Tests `CompetitiveResultView` displaying canonical score and leaderboard projection details.
3. **Full Quality Gates**:
   - `npm test`: 100% pass across all project test suites (455 existing + new test files).
   - `npm run lint`: 0 TypeScript / ESLint errors (`tsc --noEmit`).
   - `npm run build`: Production Vite build passes with exit code 0.
