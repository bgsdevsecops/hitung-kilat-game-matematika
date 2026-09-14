# Learning Intelligence & Adaptive Practice UI Design Specification
**Sub-Project E.3 of Milestone V2.3 Workstream E (Product UI Integration)**

> **Target Branch:** `feature/12.9.13.34-adaptive-practice-ui`  
> **Source Documents:** `docs/PRD-Hitung-Kilat-V2.md` (§8.3, §8.4, §13, §14, §21), `docs/superpowers/specs/2026-09-12-learning-intelligence-design.md`, `docs/superpowers/specs/2026-09-12-adaptive-practice-design.md`  
> **Author:** Claude Code (Garecon Engine)  
> **Date:** 2026-09-14

---

## 1. Executive Summary & Problem Statement

### 1.1 Context
In Milestones V2.1 and V2.2, the core learning intelligence and adaptive engines were implemented with strict mathematical and algorithmic rigor:
1. **Taxonomy & Mastery Engine V2.0 (`src/engine/mastery/`)**: 14 categories, 48 sub-skills, exponential decay recency weighting (30-day half-life), speed scoring vs. target response times, and persistence in `MasteryStore` (`hk_mastery_events_v2`).
2. **Remediation Engine (`src/engine/remediation/`)**: Focuses on player error history, sizing sessions dynamically ($N = \min(15, \max(5, 3 \times \text{distinctFailedFamilies}))$, enforcing difficulty ceilings, and capping template repetition at $\le 30\%$.
3. **Adaptive Practice Engine (`src/engine/adaptive/`)**: Weighted 50/25/15/10 bucket allocation (Weak, Medium, Recent Errors, Strong Maintenance), diagnostic cold-start mix for new players, sub-skill share cap ($\le 40\%$), and contextual Indonesian recommendations.

However, in the user interface:
- `PracticeScreen.tsx` remained a legacy V1 component with manual number-range sliders and simple arithmetic operators ($+$, $-$, $\times$, $\div$).
- There was no user-facing visualizer for player skill mastery levels or weaknesses across the 48 sub-skills.
- Answers in Campaign, Daily Challenge, and Competitive modes did not feed `AnswerEvent` records back into `MasteryStore`.
- Players had no interactive way to launch targeted remediation ("Latih Kesalahan Saya") after making mistakes.

### 1.2 Objective
Deliver **Sub-Project E.3 (Learning Intelligence & Adaptive Practice UI)**:
1. **Peta Penguasaan Keahlian (Skill Mastery Heatmap)**: A rich, accessible visualizer for 14 arithmetic categories and 48 sub-skills integrated into `StatsModal.tsx`, with filter controls and sub-skill detail cards.
2. **Smart Practice Hub (`PracticeHubView`)**: A 3-mode selector in `PracticeScreen.tsx` providing AI Adaptive Practice, Mistake Training ("Latih Kesalahan Saya"), and Custom Practice.
3. **Adaptive Play Arena & Summary (`AdaptivePlayArena`, `AdaptiveSummaryView`)**: An untimed, accessible math arena ($\ge 48\text{px}$ targets, physical keyboard support) displaying milestone mastery level progressions upon completion.
4. **Mastery Ingestion Pipeline (`masteryBridge.ts`)**: Automatic recording of valid answer events into `MasteryStore` from Campaign, Practice, Daily Challenge, and Competitive sessions.
5. **Remediation Fast-Launch CTA**: Direct action button in `ResultModal.tsx` enabling players to immediately remediate failed concepts.

---

## 2. System Architecture & Flow

```text
                               ┌──────────────────────────────────────────────┐
                               │                 App.tsx                      │
                               │  - Global Navigation Router                  │
                               │  - Cross-mode Ingestion to MasteryStore      │
                               └───────┬──────────────────────────────┬───────┘
                                       │                              │
                     Open Practice     │                              │ Open StatsModal
                     Mode              ▼                              ▼
          ┌─────────────────────────────────────────┐   ┌─────────────────────────────┐
          │         SmartPracticeScreen             │   │         StatsModal          │
          │  ┌───────────────────────────────────┐  │   │  - Tab Personal             │
          │  │     PracticeHubView               │  │   │  - Tab Prestasi             │
          │  │  - Tab 1: Latihan Adaptif AI      │  │   │  - Tab Time Attack          │
          │  │  - Tab 2: Latih Kesalahan Saya    │  │   │  - Tab Peta Keahlian (NEW)  │
          │  │  - Tab 3: Latihan Kustom          │  │   │    └─ SkillMasteryHeatmap   │
          │  └─────────────────┬─────────────────┘  │   └─────────────────────────────┘
          │                    │ Mulai Sesi         │
          │                    ▼                    │
          │  ┌───────────────────────────────────┐  │
          │  │     AdaptivePlayArena             │  │
          │  │  - Header & Untimed Stopwatch     │  │
          │  │  - Central Prompt Card (aria-live)│  │
          │  │  - Virtual Keypad + Keyboard      │  │
          │  └─────────────────┬─────────────────┘  │
          │                    │ Sesi Selesai       │
          │                    ▼                    │
          │  ┌───────────────────────────────────┐  │
          │  │     AdaptiveSummaryView           │  │
          │  │  - Skor, Akurasi, Waktu           │  │
          │  │  - Perubahan Status Mastery       │  │
          │  │  - Tombol Lanjut / Kembali        │  │
          │  └───────────────────────────────────┘  │
          └─────────────────────────────────────────┘
```

---

## 3. Mastery Ingestion Pipeline (`src/utils/masteryBridge.ts`)

### 3.1 Contract & Specifications
Every answer event requires standard target response times per difficulty level as specified in PRD §8.3.3:

| Difficulty | Target Response Time |
|---:|---:|
| 1 | 2.500 ms |
| 2 | 3.000 ms |
| 3 | 3.500 ms |
| 4 | 4.000 ms |
| 5 | 5.000 ms |
| 6 | 6.000 ms |

```typescript
export interface GameAnswerLog {
  questionId: string;
  subSkillId?: string;
  primarySkillId?: string;
  skillTags?: string[];
  isCorrect: boolean;
  responseTimeMs: number;
  difficulty: number;
}

/**
 * Converts game session answer logs into authoritative AnswerEvents
 * and persists them into MasteryStore with deduplication and 90-day pruning.
 */
export function ingestGameAnswers(
  sessionId: string,
  userId: string,
  answers: GameAnswerLog[]
): void;
```

### 3.2 Ingestion Rules & Invariants
1. **Valid Sub-Skill Filter**: Only logs with defined, non-empty `subSkillId` values (e.g. `multiplication.x7`) are processed into `AnswerEvent` records.
2. **Normalized Metadata**: `primarySkillId` defaults to the namespace prefix of `subSkillId` if omitted (e.g. `multiplication`).
3. **Idempotency**: Event IDs are constructed with timestamp and random salt (`evt_${Date.now()}_${salt}`) to avoid collision while adhering to the 30-event per sub-skill capacity limit.
4. **Immediate Snapshot Invalidation**: Writing new events invalidates cached snapshots in `MasteryStore`, triggering fresh recalculation on next query.

---

## 4. Skill Mastery Heatmap (`src/components/mastery/SkillMasteryHeatmap.tsx`)

### 4.1 Component Hierarchy & Location
- Embedded as a dedicated 4th tab (`'heatmap'` or `'mastery'`) inside `StatsModal.tsx`.
- Accompanied by quick-launch modal `SubSkillDetailModal.tsx`.

### 4.2 Visual Layout & Categorization
1. **Global Mastery Meter**:
   - Overall mastery coverage percentage: $\frac{\text{Strong Skills} + 0.5 \times \text{Medium Skills}}{\text{Total Available Sub-Skills}} \times 100\%$.
   - Interactive status filter chips:
     - 🟢 **Dikuasai** (`score >= 80 && recentAccuracy >= 85%`)
     - 🟡 **Berkembang** (`score >= 60 && score < 80`)
     - 🔴 **Perlu Latihan** (`score < 60 || recentAccuracy < 70%`)
     - ⚪ **Belum Cukup Data** (`totalAnswers < 10 || distinctSessions < 2`)
2. **Category Accordion (14 Categories)**:
   - Renders 14 category sections matching `SKILL_TAXONOMY` (Penjumlahan, Pengurangan, Perkalian, Pembagian, Operand Hilang, Operasi Majemuk, BODMAS, Bilangan Negatif, Aljabar, Kuadrat, Akar, Persentase, Pecahan, Rasio).
   - Each category displays average category score badge and expand/collapse toggle.
3. **Sub-Skill Chip Grid**:
   - Touch targets $\ge 48\times 48\text{px}$.
   - Displays Indonesian label, machine key, and color-coded status border.
   - Clicking a chip opens `SubSkillDetailModal`.

### 4.3 `SubSkillDetailModal.tsx`
- Displays:
  - Sub-skill title and description.
  - Recent accuracy (%) over up to 10 events.
  - Average response time vs. target response time.
  - Total eligible questions answered and distinct session count.
  - Status badge (Dikuasai / Berkembang / Perlu Latihan / Belum Cukup Data).
- Action Button:
  - `"Latih Sub-Skill Ini Sekarang"`: Directs the player into a targeted practice session for that specific sub-skill.

---

## 5. Smart Practice Hub (`src/components/practice/PracticeHubView.tsx`)

### 5.1 Tab 1: Latihan Adaptif AI
- **Hero Recommendation Banner**: Displays context-aware recommendations generated by `generateAdaptiveRecommendation(masteryState)`:
  - If player is new ($< 2$ evaluated sub-skills): Displays *"Sesi Diagnostik Pemetaan Kemampuan"* badge.
  - If weak skills exist: Displays *"Fokus Penguatan: [Nama Sub-Skill]"*.
- **Question Composition Badge**: 10 questions composed of:
  - $50\%$ Weak Skills (or foundational diagnostic if cold start).
  - $25\%$ Medium Skills.
  - $15\%$ Recent Errors.
  - $10\%$ Strong-Skill Maintenance.
- **CTA**: `"Mulai Latihan Terarah (10 Soal)"` button ($\ge 48\text{px}$, amber gradient).

### 5.2 Tab 2: Latih Kesalahan Saya
- Queries `MasteryStore` for recent failed answer events.
- **Active Errors State**:
  - Displays count of distinct concepts needing review.
  - Preview chips of failed sub-skills.
  - CTA: `"Mulai Latihan Remediasi (X Soal)"` ($N = \min(15, \max(5, 3 \times \text{distinctFailed}))$, difficulty ceiling enforced).
- **Zero Errors State**:
  - Trophy illustration with Indonesian message: *"Luar Biasa! Tidak ada rekaman kesalahan yang belum dilatih."*
  - Secondary button redirecting to Latihan Adaptif.

### 5.3 Tab 3: Latihan Kustom
- Preserves flexible practice customization:
  - Arithmetic operation: Penjumlahan ($+$), Pengurangan ($-$), Perkalian ($\times$), Pembagian ($\div$), Campuran.
  - Number range: 10, 20, 50, 100.
  - Target count: 5, 10, 20 soal.
- CTA: `"Mulai Latihan Kustom"`.

---

## 6. Adaptive Play Arena & Summary View

### 6.1 `src/components/practice/AdaptivePlayArena.tsx`
- **Timer**: Untimed elapsed stopwatch (`mm:ss`) to foster deep learning without artificial stress.
- **Header**:
  - Back / Exit button ($\ge 48\text{px}$) with confirmation.
  - Progress indicator: `"Soal X dari N"`.
  - Active sub-skill tag badge.
- **Central Card**:
  - High-contrast math prompt card wrapped with `aria-live="polite"`.
  - Large monospace display.
  - Input field for answer with placeholder `"Ketik jawaban..."`.
- **Keypad & Keyboard**:
  - 3-Column mobile-friendly layout ($\ge 48\text{px}$ targets).
  - Digits `0-9`, negative sign (`-`), fraction slash (`/`), `Backspace` (⌫), and `Submit` (↵).
  - Physical keyboard handler with `e.preventDefault()` to eliminate duplicate input events.

### 6.2 `src/components/practice/AdaptiveSummaryView.tsx`
- **Score & Stats**:
  - Total solved count, correct count, accuracy percentage ($0..100\%$), and total elapsed time.
- **Mastery Progression Card**:
  - Compares before-and-after sub-skill mastery status.
  - Highlights positive transitions (e.g. `Perkalian ×7`: 🔴 Perlu Latihan $\rightarrow$ 🟡 Berkembang).
- **Action Buttons**:
  - `"Lanjut Latihan"` ($\ge 48\text{px}$).
  - `"Buka Peta Keahlian"` ($\ge 48\text{px}$).
  - `"Kembali ke Menu Utama"` ($\ge 48\text{px}$).

---

## 7. Direct Remediation Fast-Launch (`ResultModal.tsx`)

In `src/components/ResultModal.tsx`, when a game finishes with `summary.wrongCount > 0`:
- Adds an auxiliary button:
  ```tsx
  {summary.wrongCount > 0 && (
    <button
      type="button"
      onClick={onStartRemediation}
      aria-label="Latih Kesalahan Sekarang"
      className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center justify-center gap-2"
    >
      <Target className="w-4 h-4 text-rose-400" />
      <span>Latih Kesalahan ({summary.wrongCount} Soal Salah)</span>
    </button>
  )}
  ```
- Clicking immediately transitions into `SmartPracticeScreen` with mode set to `'remediation'`.

---

## 8. Accessibility & Responsive Constraints

- **Touch Targets**: All interactive elements (buttons, keypad, category toggles, sub-skill chips) $\ge 48\times 48\text{px}$.
- **Screen Reader Support**: `aria-live="polite"` on prompt cards; semantic progressbars with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- **Color Independence**: Mastery levels use distinct text and icon markers alongside color badges (🔴, 🟡, 🟢, ⚪).
- **Motion Reduction**: `motion-reduce:animate-none` applied to pulsing indicators.
- **Responsive Layout**: Zero horizontal overflow on viewport widths from $360\text{px}$ to desktop $1280\text{px}$.

---

## 9. Testing & Verification Strategy

1. **Mastery Bridge Unit Tests (`tests/unit/masteryBridge.test.ts`)**:
   - Ingestion of answer logs into `MasteryStore`.
   - Correct mapping of target response times by difficulty.
   - Idempotent deduplication and 90-day retention pruning.
2. **Skill Mastery Heatmap Tests (`tests/unit/skillMasteryHeatmap.test.tsx`)**:
   - Render 14 categories and 48 sub-skills.
   - Verify filter toggles (All, Weak, Developing, Mastered, Insufficient Data).
   - Chip click opens `SubSkillDetailModal` with correct statistics.
3. **Practice Hub & Arena Integration Tests (`tests/unit/adaptivePracticeUI.test.tsx`)**:
   - 3-tab navigation in `PracticeHubView`.
   - Contextual AI recommendation banner rendering.
   - Seamless transition into `AdaptivePlayArena`.
   - Virtual keypad and physical keyboard input handling with `e.preventDefault()`.
   - Session completion and summary rendering in `AdaptiveSummaryView`.
4. **Remediation Launch Integration Tests (`tests/unit/remediationNavigation.test.tsx`)**:
   - Verification of `"Latih Kesalahan"` button in `ResultModal.tsx` when `wrongCount > 0`.
   - Direct launch of remediation session from modal.
5. **Full Quality Gates**:
   - `npm test`: 100% pass rate (520+ tests).
   - `npm run lint`: 0 TypeScript compiler errors.
   - `npm run build`: Clean production bundle.
