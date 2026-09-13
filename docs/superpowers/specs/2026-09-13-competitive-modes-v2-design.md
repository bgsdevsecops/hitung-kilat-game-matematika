# Milestone V2.3 Competitive Modes Design Specification

**Status:** APPROVED  
**Date:** 2026-09-13  
**Milestone:** V2.3 — Competitive Modes (PRD §15, §16, §17, §28)  
**Target Branch:** `feature/12.9.12.11-competitive-modes`  

---

## 1. Executive Summary & Scope

Milestone V2.3 implements the competitive gameplay subsystem and trusted server-side validation layer for Hitung Kilat. Moving beyond personal campaign and practice modes, competitive play introduces authoritative ranking and real-time leaderboards while strictly guaranteeing game integrity against manipulation, payload tampering, and direct client writes.

### Key Deliverables:
1. **Competitive Game Modes (§15)**:
   - **Sprint 60s (§15.3)**: 60.000 ms fixed-duration time-attack with dynamic difficulty scaling ($1–6$) and combo multipliers ($1.0\times - 3.0\times$).
   - **Survival Kilat (§15.4)**: Dynamic endurance mode (+2s reward, -4s penalty, 60s timer cap, 10-minute session cap, 5s heartbeat interval).
   - **Daily Challenge V2 (§15.2)**: Single deterministic daily seed (`YYYY-MM-DD@Asia/Jakarta:<dailyContentVersion>`), 10 questions, 75s target / 90s hard limit, standardized scoring with streak and speed bonuses.
2. **Session Protocol & Anti-Cheat State Machine (§16.2.2)**:
   - Authoritative sliding-window question buffer (Option A: $3–5$ question views pre-buffered).
   - Zero secret leakage (client receives prompt, input constraints, and opaque token; no answers or generator seeds).
   - Anti-replay and sequential token validation.
3. **Server-Side Trusted Validator & Scoring (§16.2.3, §17)**:
   - Pure functional validator engine shared between server runtime and test harnesses.
   - 100% server re-computation of scores, correctness, duration, and streaks.
   - Idempotent transaction handling for session start and finalization.
4. **Firestore Security Rules & Public Leaderboards (§16.2.4)**:
   - Zero direct client writes to `/competitiveResults/*` and `/leaderboardEntries/*`.
   - `/competitiveSessions/*` restricted strictly to backend Admin SDK.
   - Public leaderboard projections featuring sanitized pseudonyms and complete isolation from private user IDs and gameplay tokens.

---

## 2. Architecture & File Organization

The competitive engine is designed with clean boundaries, separating pure business logic and validation from network and database I/O:

```text
src/engine/competitive/
├── types.ts              # Data contracts, session state, payloads, and leaderboard models
├── scoring.ts            # Pure integer arithmetic scoring and comparator functions
├── modes/
│   ├── sprint.ts         # Sprint 60s mechanics and difficulty progression
│   ├── survival.ts       # Survival timer dynamics, penalties, and hard caps
│   └── daily.ts          # Daily challenge seed hashing, duration, and bonuses
├── stateMachine.ts       # Session lifecycle state transitions and buffer management
├── validator.ts          # Authoritative validation engine and anti-cheat verification
├── projection.ts         # Sanitized public leaderboard projection generator
└── index.ts              # Public competitive API exports

firestore.rules           # Security rules denying direct client writes on competitive collections
tests/unit/competitive/
├── scoring.test.ts       # Unit tests for scoring formulas, brackets, and comparators
├── sessionState.test.ts  # Session lifecycle, idempotency, and buffer tests
├── validator.test.ts     # Authoritative server re-computation tests
├── invariants.test.ts    # Property-based testing for AC-COMP-01 through AC-COMP-12
└── rules.test.ts         # Firestore security rules emulator verification
```

---

## 3. Game Mode Rules & Authoritative Scoring

All scoring and time calculations use exact integer arithmetic. Floating-point rounding is governed strictly by:
$$\text{roundHalfUp}(n, d) = \left\lfloor \frac{2n + d}{2d} \right\rfloor$$

### 3.1 Sprint 60s
* **Duration**: Server deadline strictly $60.000\text{ ms}$.
* **Difficulty Progression** (based on cumulative verified correct count):
  * $1–5$: Difficulty 1
  * $6–10$: Difficulty 2
  * $11–15$: Difficulty 3
  * $16–20$: Difficulty 4
  * $21–25$: Difficulty 5
  * $26+$: Difficulty 6
* **Scoring Formulas**:
  $$\text{basePoints} = 100 + 25 \times (\text{difficulty} - 1)$$
  $$\text{comboTenths} = \min(30, 10 + \text{currentStreak} - 1) \quad (\text{range: } 1.0\times \text{ to } 3.0\times)$$
  $$\text{correctPoints} = \text{roundHalfUp}(\text{basePoints} \times \text{comboTenths}, 10)$$
  $$\text{wrongPoints} = 0 \quad (\text{streak resets to } 0)$$
* **Best Record Comparator**:
  `score DESC` $\rightarrow$ `accuracy DESC` $\rightarrow$ `correctCount DESC` $\rightarrow$ `wrongCount ASC` $\rightarrow$ `finalizedAt ASC` $\rightarrow$ `resultId ASC`.

### 3.2 Survival Kilat
* **Initial Timer**: $60.000\text{ ms}$.
* **Timer Dynamics**:
  * Correct: $+2.000\text{ ms}$, capped at $\min(\text{currentTimer} + 2000, 60000)$.
  * Wrong: $-4.000\text{ ms}$.
  * Termination: Timer reaches $\le 0\text{ ms}$ or duration reaches hard cap of $600.000\text{ ms}$ (10 minutes).
* **Difficulty Progression**: $\min(6, 1 + \lfloor\text{correctCount} / 5\rfloor)$.
* **Scoring**: Identical to Sprint 60s base and combo formulas.
* **Heartbeat Invariant**: Client must send an answer or heartbeat every $\le 5.000\text{ ms}$. If gap exceeds $10.000\text{ ms}$, session is marked `FAILED / REJECTED`.
* **Best Record Comparator**:
  `score DESC` $\rightarrow$ `survivalDurationMs DESC` $\rightarrow$ `accuracy DESC` $\rightarrow$ `finalizedAt ASC` $\rightarrow$ `resultId ASC`.

### 3.3 Daily Challenge V2
* **Deterministic Seed**: `YYYY-MM-DD@Asia/Jakarta:<dailyContentVersion>`.
* **Questions**: Exactly 10 questions.
* **Duration Bounds**: $75.000\text{ ms}$ target, $90.000\text{ ms}$ hard limit.
* **Active Duration Calculation**:
  If all 10 questions are answered:
  $$\text{rankedActiveDurationMs} = \min(90000, \text{lastAcceptedAnswerServerAt} - \text{serverStartedAt})$$
  Otherwise: $90.000\text{ ms}$.
* **Scoring Formulas**:
  $$\text{accuracy} = \frac{\text{correctCount}}{10} \times 100$$
  $$\text{base} = \text{correctCount} \times 120$$
  $$\text{streakBonus} = \min(300, \text{maxStreak} \times 30)$$
  $$\text{speedNum} = \max(0, 75000 - \text{rankedActiveDurationMs}) \times 800 \times \text{correctCount}$$
  $$\text{speedDen} = 75000 \times 10 = 750000$$
  $$\text{speedBonus} = \text{roundHalfUp}(\text{speedNum}, \text{speedDen})$$
  $$\text{perfectBonus} = (\text{correctCount} == 10) \; ? \; 200 : 0$$
  $$\text{score} = \text{base} + \text{streakBonus} + \text{speedBonus} + \text{perfectBonus}$$
* **Streak Eligibility**: Streak increments if and only if session is `VALIDATED`, all 10 questions are answered, and $\text{correctCount} \ge 6$.
* **Ranked Slot**: Exactly one ranked attempt per user per WIB day (00:00:00–23:59:59 WIB), consumed atomically when question sequence 1 is issued. Subsequent runs are unranked replays.
* **Best Record Comparator**:
  `score DESC` $\rightarrow$ `correctCount DESC` $\rightarrow$ `rankedActiveDurationMs ASC` $\rightarrow$ `finalizedAt ASC` $\rightarrow$ `resultId ASC`.

---

## 4. Session Protocol & State Machine

### 4.1 State Machine Lifecycle
```text
  [UNINITIALIZED]
         │
         │ POST /start
         ▼
     [ACTIVE] ──── Heartbeat gap >10s / Deadline Expiry ────► [FAILED / REJECTED]
         │
         ├──► POST /answers (stream answer batch)
         │    └─► Validates tokens, updates server state, refills question buffer
         │
         │ POST /finalize
         ▼
     [PENDING]
         │
         ├──► Validation Succeeded ──► [VALIDATED] (Updates Leaderboard)
         └──► Validation Failed ────► [REJECTED]  (Unranked only)
```

### 4.2 Data Interfaces (`src/engine/competitive/types.ts`)

```typescript
export type CompetitiveMode = 'sprint' | 'survival' | 'daily';
export type CompetitiveSessionStatus = 
  | 'ACTIVE' 
  | 'PENDING' 
  | 'VALIDATED' 
  | 'REJECTED' 
  | 'FAILED' 
  | 'ABANDONED';

export interface CompetitiveSessionContract {
  sessionId: string;
  userId: string;
  mode: CompetitiveMode;
  rulesVersion: string;
  contentVersion: string;
  challengeId?: string;
  serverStartedAt: number;        // UTC epoch ms
  serverDeadlineAt: number;       // UTC epoch ms
  status: CompetitiveSessionStatus;
  isRanked: boolean;
  idempotencyKey: string;
}

export interface CompetitiveQuestionView {
  questionInstanceId: string;
  sequence: number;               // 1-based index
  renderedPrompt: string;
  answerInputKind: 'numeric' | 'fraction' | 'decimal';
  constraints?: {
    min?: number;
    max?: number;
    allowNegative?: boolean;
    precision?: number;
  };
  questionToken: string;          // Opaque HMAC token
}

export interface SubmittedAnswerPayload {
  sequence: number;
  questionToken: string;
  rawInput: string;
  clientAnsweredAt: number;       // Relative ms from start
  inputLatencyMs: number;         // Time spent on this question
  idempotencyKey: string;
}

export interface CompetitiveResultDoc {
  resultId: string;
  sessionId: string;
  userId: string;
  mode: CompetitiveMode;
  status: 'VALIDATED' | 'REJECTED';
  isRanked: boolean;
  score: number;
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  questionsAnswered: number;
  rankedActiveDurationMs: number;
  maxStreak: number;
  difficultyReached: number;
  rejectionReasons: string[];
  finalizedAt: number;
  rulesVersion: string;
  contentVersion: string;
  challengeId?: string;
}
```

### 4.3 Sliding Window Buffer Protocol
1. **Initial Buffer**: On `POST /start`, backend returns `CompetitiveSessionContract` and an initial queue of 5 `CompetitiveQuestionView` items.
2. **Local Feedback**: Client renders top question. When user submits, client gives instant visual feedback ($\le 100\text{ ms}$) and pops the next buffered question.
3. **Asynchronous Dispatch**: Client submits `POST /answers` with answer batch in background.
4. **Replenishment**: Server verifies sequence and tokens, computes authoritative results, evaluates difficulty progression, and returns next batch of question views to maintain $3–5$ items in client buffer.

---

## 5. Server-Side Validation Pipeline & Anti-Cheat Engine

The validator function in `src/engine/competitive/validator.ts` executes deterministically:

1. **Token & Sequence Integrity**:
   - Every submitted answer must contain a valid `questionToken` matching the session seed and sequence.
   - Sequences must be contiguous with zero gaps or duplicates.
2. **Authoritative Correctness Re-computation**:
   - Re-evaluates each input against canonical `AnswerSpec` using `evaluateAnswer`.
   - Discards all client-reported correctness and scores.
3. **Timing & Deadline Enforcement**:
   - Sprint: Discards answers received after $60.000\text{ ms}$.
   - Daily: Clamps active duration to $[0, 90.000\text{ ms}]$.
   - Survival: Recomputes time additions/deductions and checks for $>10.000\text{ ms}$ heartbeat gaps.
4. **Score & Multiplier Re-computation**:
   - Computes base points, streaks, combo multipliers, speed bonuses, and perfect bonuses using canonical formulas.
5. **Anomaly Checks**:
   - Flags or rejects runs with sub-human latency ($<120\text{ ms}$ per question across multiple non-trivial answers).

---

## 6. Firestore Authority & Public Projection

### 6.1 Collection Boundaries
* `/competitiveSessions/{sessionId}`: Read/Write forbidden for all client SDKs (`allow read, write: if false;`). Admin SDK only.
* `/competitiveResults/{resultId}`: Owner read-only (`resource.data.userId == request.auth.uid`), write forbidden for all clients.
* `/leaderboardEntries/{entryId}`: Public read (`allow read: if true;`), write forbidden for all clients.
* `/users/{uid}/profile`: Owner read/write for pseudonym and opt-in settings.

### 6.2 Leaderboard Entry Schema & Keying
* **`entryId`**: `${mode}_${periodKey}_${rulesVersion}_${contentVersion}_${leaderboardSubjectId}`
* **Schema**:
```typescript
export interface LeaderboardEntryDoc {
  entryId: string;
  mode: CompetitiveMode;
  periodKey: string;             // YYYY-MM-DD for daily, YYYY-Www for weekly, "all" for all-time
  rulesVersion: string;
  contentVersion: string;
  pseudonym: string;             // Sanitized display name (no PII)
  score: number;
  accuracy: number;
  correctCount: number;
  wrongCount: number;
  durationMs: number;
  finalizedAt: number;
  resultId: string;
}
```
* **Privacy Assurance**: Auth UIDs, emails, tokens, and raw question inputs are never written to public collections.

---

## 7. Acceptance Criteria (AC-COMP) & Verification Strategy

| ID | Criterion | Verification Method |
|---|---|---|
| **AC-COMP-01** | Unauthenticated requests cannot start ranked sessions | Integration / Mock Auth Tests |
| **AC-COMP-02** | Direct client writes to `/leaderboardEntries` or `/competitiveResults` are denied | Firestore Rules Unit Test Suite |
| **AC-COMP-03** | Client-reported score, accuracy, and counts are ignored and recomputed | Validator Unit Test Suite |
| **AC-COMP-04** | Invalid tokens, duplicate sequences, and expired sessions are rejected | Validator Unit Test Suite |
| **AC-COMP-05** | 100 concurrent finalize calls produce 1 result and at most 1 leaderboard mutation | Idempotency & Invariant Suite |
| **AC-COMP-06** | Daily ranked slot consumed on sequence 1 dispatch; subsequent attempts are unranked | State Machine Test Suite |
| **AC-COMP-07** | Sprint deadline strictly enforced at 60.000 ms | Scoring & Invariant Test Suite |
| **AC-COMP-08** | Survival time additions (+2s), penalties (-4s), and caps recomputed server-side | Scoring & Invariant Test Suite |
| **AC-COMP-09** | Rejected results award zero rank, streak, or competitive achievements | State Machine Test Suite |
| **AC-COMP-10** | Public leaderboard contains zero private identity or token data | Projection Unit Test Suite |
| **AC-COMP-11** | Leaderboards partitioned by mode, periodKey, rulesVersion, and contentVersion | Projection Unit Test Suite |
| **AC-COMP-12** | Survival heartbeat gap >10.000 ms terminates session with FAILED / REJECTED status | State Machine Test Suite |

---

## 8. Rollout & Exit Gate

Completion of Milestone V2.3 requires:
1. 100% pass rate across all unit and property-based invariant test suites (all 12 AC-COMP criteria).
2. Zero TypeScript errors across the entire repository.
3. Updated memory tracking and clean local merge back to `main`.
