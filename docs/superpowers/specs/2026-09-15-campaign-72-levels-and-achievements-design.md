# Design Specification: Campaign 72 Levels, Boss System & V2 Achievements (Sub-Project E.4)

**Document ID:** `SPEC-V2-E4-CAMPAIGN-ACHIEVEMENTS`  
**Date:** 2026-09-15  
**Author:** Engineering Team  
**Status:** Approved by User  
**Target Milestone:** Milestone V2.3 Workstream E (Product UI Integration) — Sub-Project E.4  
**Target Branch:** `feature/12.9.14.19-campaign-72-levels-and-achievements`  
**Reference PRD:** `docs/PRD-Hitung-Kilat-V2.md` (§8.1, §8.2, §8.3, §11, §12, §17, §19, §21)

---

## 1. Executive Summary & Goals

### 1.1 Context
Milestones V2.0-A, V2.0-B, V2.1, V2.2, and V2.3 built the engine foundation:
- 72-level immutable manifest (`LEVEL_MANIFEST_72`) and prerequisite validator.
- 12-key generator registry with invariant-tested generators.
- V1 to V2 migration engine (`migrateV1ToV2`).
- Learning Intelligence (`MasteryStore`, BKT, remediation).
- Adaptive Practice V2 selector.
- Competitive Modes (Sprint 60s, Survival Kilat, Daily Challenge V2).
- Sub-Projects E.1, E.2, and E.3 delivered the respective UI arenas.

However, the main Campaign journey (`LevelMap.tsx`, `PlayScreen.tsx`, and `ResultModal.tsx`) currently still runs the legacy 24-level system with numeric IDs (1–24), 72 maximum stars, and legacy achievement thresholds.

### 1.2 Objective
Sub-Project E.4 completely transitions the core Campaign game loop to the V2 architecture:
1. **Peta Kampanye 72 Level (`LevelMap.tsx`)**: Replaces the 24-level list with an accessible 6-tier accordion interface (12 levels per tier), tier star progress counters (`X/36 ★`), global star progress (`X/216 ★`), Boss visual prominence, and legacy credit badges.
2. **Arena Kampanye V2 (`PlayScreen.tsx`)**: Replaces legacy random generation with `createDefaultGeneratorRegistry()` and `LEVEL_MANIFEST_72`, embeds `DynamicKeypad.tsx` (supporting integer, signed `-`, fraction `/`, and decimal `.`), monotonic absolute timers, and live ingestion into `MasteryStore`.
3. **Boss Battle System (§8.2)**: Special boss arena mode with animated Boss HP Bar, rage/shake effects on error, crimson/gold visual theme, and Boss defeat fanfare.
4. **Star Evaluation Engine (§8.3.1 & §8.2.1)**: Canonical star rating rules (0★, 1★, 2★, 3★, and Perfect Badge) comparing accuracy against thresholds and completion time against strict `targetTimeSec`.
5. **V1 $\to$ V2 Migration Lifecycle (`App.tsx` & `V2WelcomeModal.tsx`)**: Automated, idempotent migration of legacy 24-level progress to anchor V2 levels, archiving excess stars into legacy star credits, with a welcoming celebratory modal.
6. **V2 Achievements (§17)**: Expands achievement definitions to 16 canonical achievements (up to 216★, Boss conquests, competitive high scores, streaks, and skill mastery), with celebratory achievement-unlocked cards inside `ResultModal.tsx`.

---

## 2. Architecture & Data Contracts

### 2.1 Campaign Progress Data Model
Campaign progress is stored under `localStorage` key `hitung_kilat_campaign_v2`:

```typescript
export interface V2LevelProgress {
  levelId: string;           // Stable string ID, e.g. "T1-ADD-01" or "T2-BOSS"
  unlocked: boolean;         // True if order === 1 or all prerequisiteIds have stars >= 1
  stars: number;            // 0, 1, 2, or 3
  bestScore: number;         // Highest score achieved
  accuracy: number;          // Best accuracy percentage (0–100)
  bestTimeSec: number;       // Lowest completion time in seconds
  migratedFromV1Id?: number; // Optional reference to legacy level ID
  completedAt?: string;      // ISO timestamp of latest completion
}

export interface V2CampaignState {
  version: 2;
  levels: Record<string, V2LevelProgress>;
  totalStars: number;          // Cumulative stars across all 72 levels (0–216)
  legacyStarCredits: number;   // Archived extra stars from V1 migration
  migrationCompleted: boolean; // Flag to prevent duplicate migration runs
}
```

### 2.2 Storage Keys
* `hitung_kilat_campaign_v2`: Canonical V2 campaign progress object.
* `hitung_kilat_progress_v1`: Legacy 24-level progress (kept intact for 30-day dual-read rollback window per PRD §11.3).
* `hitung_kilat_migration_ack_v2`: Boolean flag indicating user dismissed the V2 welcome modal.
* `hitung_kilat_unlocked_achievements_v2`: Map of unlocked achievement IDs to unlock ISO timestamp.

### 2.3 Automated Migration Lifecycle in `App.tsx`
1. On application mount, check if `hitung_kilat_campaign_v2` exists.
2. If absent:
   - Check for legacy `hitung_kilat_progress_v1` in `localStorage`.
   - Invoke `migrateV1ToV2(v1Progress)` from `src/engine/migration/migrator.ts`.
   - Populate `V2CampaignState` with mapped levels, set `totalStars = sum(levels.stars)`, and store `legacyStarCredits`.
   - Ensure level 1 (`T1-ADD-01`) is unlocked for fresh players if no progress exists.
   - If `v1Progress` had at least one completed level (`stars > 0`), trigger `showWelcomeModal = true`.
   - Persist initial `V2CampaignState` to `localStorage`.

---

## 3. Campaign Map UI Specification (`src/components/LevelMap.tsx`)

### 3.1 Layout & Navigation
* **Global Header**:
  * Title: "Peta Kampanye Matematika (72 Level)" with glowing gradient.
  * Global Star Progress Bar: Shows `X / 216 ★` with percentage fill and tooltip.
  * Legacy Credits Badge: Rendered if `legacyStarCredits > 0`: `+X Bintang Warisan V1`.
  * Mode Quick-Launch Buttons: Shortcuts to Sprint 60s, Survival Kilat, Daily Challenge, and Latihan Adaptif.
* **Tier Accordion Container**:
  * 6 collapsible sections corresponding to Tier 1 through Tier 6.
  * Default State: The tier containing the player's current active level (highest unlocked level with 0 stars, or next level in sequence) is expanded by default.
  * Accordion Header:
    * Tier number, name, and subtitle (e.g., `Tier 1 — Pemula: Number Sense & Dasar +/−`).
    * Tier Star Counter: `X / 36 ★`.
    * Boss Status Chip:
      * `Terkunci` (Gray Lock icon) if prerequisite levels incomplete.
      * `Siap Ditantang` (Pulsing Gold Flame icon) if boss unlocked.
      * `Ditaklukkan` (Green Crown icon) if boss completed with $\ge 1\text{★}$.
    * Collapse/Expand Chevron with `aria-expanded` and touch target $\ge 48\times 48\text{px}$.

### 3.2 Level Card Grid (12 Levels per Tier)
* Responsive Grid: 1 column on mobile (<640px), 2 columns on tablet (640px–1024px), 3 columns on desktop (>1024px).
* **Card States**:
  1. **Completed**:
     * Border: Indigo/Emerald gradient.
     * Stars: 1, 2, or 3 golden bouncing/shining stars (`★`).
     * Metrics: Best time (`bestTimeSec` formatted as `X.Xs`), accuracy (`X%`).
  2. **Active / Current**:
     * Border: 3px solid amber-400 with continuous pulsing glow.
     * Badge: "TANTANGAN SAAT INI" in bold amber font.
     * Button: Prominent "Mulai Level" button ($\ge 48\text{px}$ touch target).
  3. **Available**:
     * Border: 2px indigo-700/80.
     * Level title, description, question count, and target time badge.
  4. **Locked**:
     * Dimmed opacity (`opacity-60`), lock icon, but title and required prerequisites remain legible with WCAG 2.2 AA contrast.
  5. **Tier Boss Card (Levels 12, 24, 36, 48, 60, 72)**:
     * Styling: Crimson and gold gradient background (`from-rose-950 via-indigo-950 to-amber-950`), 3px gold border.
     * Badge: `TIER BOSS` (T1–T5) or `GRANDMASTER` (T6).
     * Icons: Gold Crown (`Crown`) and Skull/Swords accent.
     * Target / Deadline: Shows `Target: Xs • Batas: Ys`.

---

## 4. Campaign Arena Specification (`src/components/PlayScreen.tsx`)

### 4.1 Question Generation
* Remove legacy procedural branching on numeric IDs.
* Initialize session questions using `createDefaultGeneratorRegistry()` and the selected level config from `LEVEL_MANIFEST_72`:
  ```typescript
  const registry = createDefaultGeneratorRegistry();
  const generator = registry.get(level.generatorKey);
  const prng = createMulberry32(`campaign_${level.id}_${Date.now()}`);
  const questions: Question[] = [];
  for (let i = 0; i < level.questionCount; i++) {
    const q = generator.generate(level.rules, prng, {
      levelId: level.id,
      sequenceIndex: i,
    });
    questions.push(q);
  }
  ```

### 4.2 Timers & Progress HUD
* Monotonic clock tracking elapsed time via `Date.now() - startTime`.
* Stopwatch/Countdown Header:
  * Countdown timer displaying remaining time: `Math.max(0, level.timeLimitSec - elapsedSec)`.
  * Speed Target Marker: Indicator on timer showing `level.targetTimeSec` threshold.
  * Question Counter: "Soal X dari Y".
  * Accuracy / Score tracker.

### 4.3 Keypad & Keyboard Input (`DynamicKeypad.tsx`)
* Seamless integration of `DynamicKeypad`:
  * Enables `-` (negative) when `level.rules.allowNegative` or `answerKind === 'signed'`.
  * Enables `/` (fraction) when `level.answerKind === 'rational'`.
  * Enables `.` (decimal) when `level.answerKind === 'decimal'`.
* Physical Keyboard Listener:
  * Handles digits `0–9`, `-`, `/`, `.`, `Backspace`, and `Enter`.
  * Enforces `e.preventDefault()` on all handled inputs.
  * Ignores system chords (`if (e.ctrlKey || e.metaKey || e.altKey) return;`).

### 4.4 Boss Battle Mode (When `level.boss === true`)
* Arena Theme: Crimson/Gold background with vibrating energy particles.
* Header: **"PERTARUNGAN BOSS: [NAMA BOSS]"** with pulsing skull/crown.
* **Boss Health Bar (HP Bar)**:
  * Max HP = `level.questionCount`.
  * Current HP = `level.questionCount - correctAnswersCount`.
  * Visual: Segmented crimson bar that depletes with hit spark animation on each correct answer.
* **Rage & Screen Shake**:
  * On wrong answer: Triggers a 300ms CSS shake animation on the card, accompanied by a crimson border flash.
* **Sound Effects**:
  * Hit sound on correct answer, boss roar / hit taken on wrong answer.

### 4.5 Star & Badge Calculation Engine
Implemented in `src/utils/starRating.ts`:

```typescript
export interface StarRatingResult {
  stars: number;          // 0, 1, 2, or 3
  isPerfect: boolean;     // 100% accuracy within targetTimeSec
  isPassed: boolean;      // stars >= 1
  reason: string;
}

export function calculateLevelStars(
  level: LevelConfigV2,
  correctCount: number,
  totalQuestions: number,
  durationSec: number,
  isTimedOut: boolean
): StarRatingResult {
  if (isTimedOut || durationSec > level.timeLimitSec) {
    return { stars: 0, isPerfect: false, isPassed: false, reason: 'Waktu habis' };
  }

  const accuracy = correctCount / totalQuestions;
  const withinTarget = durationSec <= level.targetTimeSec;
  const isPerfect = correctCount === totalQuestions && withinTarget;

  // Boss and standard levels follow PRD §8.2.1 and §8.3.1
  if (accuracy >= 0.95 && withinTarget) {
    return { stars: 3, isPerfect, isPassed: true, reason: 'Sempurna & Kilat' };
  }
  if (accuracy >= 0.85) {
    return { stars: 2, isPerfect: false, isPassed: true, reason: 'Hebat & Akurat' };
  }
  if (accuracy >= level.passingAccuracy) {
    return { stars: 1, isPerfect: false, isPassed: true, reason: 'Level Selesai' };
  }

  return { stars: 0, isPerfect: false, isPassed: false, reason: 'Akurasi di bawah syarat minimum' };
}
```

### 4.6 Live Learning Ingestion
When the level finishes, call `ingestGameAnswers(sessionId, userId, logs)` to feed the answer history into `MasteryStore`, updating Bayesian Knowledge Tracing parameters and the remediation queue.

---

## 5. Result Modal & Achievement Unlocked Experience (`src/components/ResultModal.tsx`)

### 5.1 Enhanced Result Presentation
* Displays 0–3 animated golden stars with sequential entrance and confetti.
* Speed & Target Comparison Card:
  * Shows actual time taken vs `targetTimeSec` and `timeLimitSec`.
  * Displays "Target Tercapai!" in gold or "Melebihi Target Waktu" in indigo-300.
* Boss Victory Banner:
  * When `level.boss === true` and `stars >= 1`:
  * Displays glowing banner: `★ TIER BOSS DITAKLUKKAN! ★` or `★ GRANDMASTER SEJATI! ★`.
* Perfect Badge:
  * When `isPerfect === true`: displays glowing golden diamond badge "PERFECT RUN".

### 5.2 In-Modal Achievement Unlocked Notification
* If completion triggers new achievements:
  * An animated card slides in above action buttons:
    * Icon: Glowing trophy or badge.
    * Title: "Pencapaian Terbuka!"
    * Name: Achievement title (e.g. "Veteran Kampanye", "Penakluk Pemula").
    * Description: Achievement description.
    * Plays celebration fanfare sound.

### 5.3 Actions
* **Level Berikutnya**: Primary button, unlocked only if `stars >= 1` and a next level exists.
* **Ulangi Level**: Replays the current level.
* **Latih Kesalahan**: Present if `wrongCount > 0`, routing directly into Remediation practice.
* **Peta Kampanye**: Returns to `LevelMap`.

---

## 6. Standardized V2 Achievements System (`src/utils/achievements.ts`)

### 6.1 Canonical 16 Achievement Definitions (PRD §17)

| ID | Title | Description | Category | Tier | Target | Evaluation Logic |
|---|---|---|---|---|---:|---|
| `stars_15` | **Pengumpul Bintang** | Raih 15★ di Peta Kampanye | `milestone` | bronze | 15 | `ctx.totalStars >= 15` |
| `stars_40` | **Bintang Terang** | Raih 40★ di Peta Kampanye | `milestone` | silver | 40 | `ctx.totalStars >= 40` |
| `stars_72` | **Veteran Kampanye** | Raih 72★ di Peta Kampanye | `milestone` | silver | 72 | `ctx.totalStars >= 72` |
| `stars_144`| **Master Kampanye** | Raih 144★ di Peta Kampanye | `milestone` | gold | 144 | `ctx.totalStars >= 144` |
| `stars_216`| **Mahkota Sempurna** | Tuntaskan 216★ penuh di 72 level | `milestone` | diamond| 216 | `ctx.totalStars >= 216` |
| `boss_t1` | **Penakluk Pemula** | Kalahkan Boss Tier 1 (Lv 12) | `milestone` | bronze | 1 | `ctx.completedBossIds.includes('T1-BOSS')` |
| `boss_t3` | **Penakluk Terampil** | Kalahkan Boss Tier 3 (Lv 36) | `milestone` | silver | 1 | `ctx.completedBossIds.includes('T3-BOSS')` |
| `boss_t6` | **Grandmaster Sejati** | Kalahkan Grandmaster (Lv 72) | `milestone` | diamond| 1 | `ctx.completedBossIds.includes('T6-BOSS')` |
| `sprint_1000` | **Kilat Pertama** | Tembus 1.000 poin di Sprint 60s | `speed` | bronze | 1000 | `ctx.highestSprintScore >= 1000` |
| `sprint_2500` | **Kecepatan Suara** | Tembus 2.500 poin di Sprint 60s | `speed` | gold | 2500 | `ctx.highestSprintScore >= 2500` |
| `survival_120`| **Penyintas Tangguh** | Bertahan min. 2 menit di Survival | `streak` | silver | 120 | `ctx.highestSurvivalSec >= 120` |
| `survival_300`| **Dewa Ketahanan** | Bertahan min. 5 menit di Survival | `streak` | diamond| 300 | `ctx.highestSurvivalSec >= 300` |
| `daily_streak_7` | **Seminggu Disiplin** | Pertahankan 7 hari streak harian | `streak` | silver | 7 | `ctx.dailyStreak >= 7` |
| `daily_streak_30`| **Kebiasaan Juara** | Pertahankan 30 hari streak harian | `streak` | diamond| 30 | `ctx.dailyStreak >= 30` |
| `mastery_10` | **Multi-Talenta** | Kuasai min. 10 sub-skill (skor $\ge 85$) | `mastery` | silver | 10 | `ctx.masteredSubSkillsCount >= 10` |
| `mastery_30` | **Ahli Matematika** | Kuasai min. 30 sub-skill (skor $\ge 85$) | `mastery` | gold | 30 | `ctx.masteredSubSkillsCount >= 30` |

### 6.2 Evaluation Context
```typescript
export interface AchievementEvaluationContext {
  stats: UserStats;
  totalStars: number;
  unlockedLevelsCount: number;
  completedBossIds: string[];
  highestSprintScore: number;
  highestSurvivalSec: number;
  dailyStreak: number;
  masteredSubSkillsCount: number;
}
```

---

## 7. Migration Welcome Modal (`src/components/V2WelcomeModal.tsx`)

* Modal pops up once when legacy V1 progress is detected and migrated:
  * Title: **"Selamat Datang di Hitung Kilat V2!"**
  * Body:
    * Explains the expansion to 72 data-driven levels and 6 Boss battles.
    * Summary card:
      * Bintang Ditransfer: `X Bintang`.
      * Bintang Warisan Diarsipkan: `Y Kredit Bintang`.
      * Level Terbuka: `Z Level`.
  * CTA Button: **"Mulai Petualangan 72 Level"** ($\ge 48\text{px}$ touch target).
  * Stores dismissal state in `localStorage.setItem('hitung_kilat_migration_ack_v2', 'true')`.

---

## 8. Accessibility & Quality Engineering Gates

### 8.1 Accessibility (WCAG 2.2 AA)
* All interactive buttons, accordion headers, keypad buttons, and modal dismissals enforce `min-h-[48px]` and `min-w-[48px]`.
* Accordion sections use semantic `aria-expanded` and `aria-controls`.
* Boss Health Bar and countdown timers use `role="progressbar"` and `aria-live="polite"`.
* Color contrast strictly meets 4.5:1 for standard text and 3:1 for large text/icons.

### 8.2 Quality Verification Gates
1. **Unit & Integration Tests**:
   * `tests/unit/campaignLevelMap.test.tsx`: Tests 6-tier accordion, star counts, Boss status chips, level card rendering.
   * `tests/unit/campaignPlayScreen.test.tsx`: Tests generator registry integration, DynamicKeypad input, countdown/deadline, Boss HP bar & rage effect.
   * `tests/unit/starRating.test.ts`: Exhaustive test of star evaluation (0★, 1★, 2★, 3★, Perfect).
   * `tests/unit/v2Achievements.test.ts`: Tests all 16 achievements, context calculation, and notification trigger.
   * `tests/unit/v2WelcomeModal.test.tsx`: Tests modal display, dismissal, and data mapping.
2. **Quality Checks**:
   * `npm test`: 100% test suite passes.
   * `npx tsc --noEmit`: 0 TypeScript compiler errors.
   * `npm run build`: Clean production bundle build.
