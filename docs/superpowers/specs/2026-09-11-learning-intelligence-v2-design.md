# Milestone V2.1 Learning Intelligence Design Specification

**Status:** APPROVED  
**Date:** 2026-09-11  
**Milestone:** V2.1 — Learning Intelligence (Epic E4 & E5)  
**Target Branch:** `feature/12.9.11.34-learning-intelligence`

---

## 1. Overview & Objectives

Milestone V2.1 implements the **Learning Intelligence** subsystem for Hitung Kilat V2. It transforms passive arithmetic gameplay into a continuous, data-driven learning cycle.

Key capabilities delivered:
1. **Skill Taxonomy Registry (§8.4)**: Standardized, versioned vocabulary across all 14 arithmetic categories with hierarchical machine keys (e.g. `multiplication.x7`, `bodmas.parentheses`).
2. **Mastery Algorithm V2.0 (§8.3.3 & Epic E4)**: Evidence-based mastery calculation per sub-skill featuring 30-day exponential half-life recency weighting, response-time speed scores, consistency scores, and "Belum Cukup Data" guardrails.
3. **Mistake Training / "Latih Kesalahan Saya" (§13 & Epic E5)**: Algorithmic remediation session generator synthesizing targeted practice sets for failed questions while respecting variation, difficulty ceiling, and family caps.
4. **Dedicated MasteryStore (§21)**: Durable, isolated local storage management with automatic 90-day pruning, 30-event capacity caps per sub-skill, and deduplication.

---

## 2. Skill Taxonomy Registry

### 2.1 Taxonomy Hierarchy
The 14 primary skill categories and their sub-skills:

| Category ID | Display Name | Sub-skills |
|---|---|---|
| `addition` | Penjumlahan | `single_digit`, `within_20`, `tens`, `carry`, `hundreds` |
| `subtraction` | Pengurangan | `single_digit`, `within_20`, `tens`, `borrow`, `hundreds` |
| `multiplication` | Perkalian | `x2`, `x3`, `x4`, `x5`, `x6`, `x7`, `x8`, `x9`, `tens`, `11_19` |
| `division` | Pembagian | `basic_235`, `x4_9_inverse`, `tens`, `signed` |
| `missing_operand` | Operan Hilang | `add_inverse`, `sub_inverse`, `multiplication_factor` |
| `multi_operation` | Operasi Berantai | `three_terms`, `four_terms` |
| `bodmas` | Urutan Operasi | `mul_priority`, `div_priority`, `parentheses`, `advanced` |
| `signed_number` | Bilangan Bulat Negatif | `negative_add`, `negative_sub`, `negative_mul`, `negative_div` |
| `algebra` | Aljabar Dasar | `one_step`, `two_step`, `nested` |
| `square` | Kuadrat | `square_1_10`, `square_11_15`, `square_16_25` |
| `root` | Akar Kuadrat | `perfect_square_root` |
| `percentage` | Persentase | `standard_percentage`, `derived_percentage` |
| `fraction` | Pecahan | `simple_fraction_arithmetic` |
| `ratio` | Rasio | `equivalent_ratio` |

### 2.2 Taxonomy Contracts
- Canonical sub-skill IDs follow the pattern `<skillId>.<subSkillKey>`.
- Category IDs and sub-skill IDs are lowercase immutable machine keys.
- Taxonomy is versioned (`taxonomyVersion: '2.1.0'`). Deprecated skills remain queryable for historical data.

---

## 3. Mastery Engine V2.0

### 3.1 Input Evidence & Windowing
- Evaluated per `subSkillId`.
- Maximum 30 eligible answers per sub-skill within the last 90 days.
- Ingestion sort order: `(normalizedOccurredAt ASC, eventId ASC)`.
- Multi-skill evidence weight:
  - `primarySkillId`: weight $= 1.0$
  - `skillTags` (supporting): weight $= 0.5$

### 3.2 Exponential Recency Weighting
Answers carry exponential decay with a 30-day half-life:
$$w_i = 2^{-\frac{t_{\text{eval}} - t_i}{30 \times 86.400.000\text{ ms}}}$$

### 3.3 Mastery Score Formula
Mastery combines three distinct performance dimensions:
$$\text{masteryScore} = \text{round}(0.65 \times A + 0.20 \times S + 0.15 \times C)$$

#### 1. Accuracy Component ($A \in [0, 100]$)
$$A = \frac{\sum_{i=1}^N (w_i \times \text{evidenceWeight}_i \times [isCorrect_i])}{\sum_{i=1}^N (w_i \times \text{evidenceWeight}_i)} \times 100$$

#### 2. Speed Component ($S \in [0, 100]$)
For correct answers:
$$\text{score}_i = \text{clamp}\left(0, 100, 100 \times \left(2 - \frac{\text{responseTimeMs}_i}{\text{targetResponseTimeMs}_i}\right)\right)$$
For incorrect answers:
$$\text{score}_i = 0$$

$S$ is the recency-weighted average of $\text{score}_i$:
$$S = \frac{\sum_{i=1}^N (w_i \times \text{evidenceWeight}_i \times \text{score}_i)}{\sum_{i=1}^N (w_i \times \text{evidenceWeight}_i)}$$

Target response times by difficulty:
- Difficulty 1: 2,500 ms
- Difficulty 2: 3,000 ms
- Difficulty 3: 3,500 ms
- Difficulty 4: 4,000 ms
- Difficulty 5: 5,000 ms
- Difficulty 6: 6,000 ms

#### 3. Consistency Component ($C \in [0, 100]$)
Percentage of the most recent sessions (up to 5 sessions containing this sub-skill) that achieved an accuracy of $\ge 80\%$:
$$C = \frac{\text{sessionsWithAccuracy} \ge 80\%}{\min(5, \text{totalSessions})} \times 100$$

#### Untimed / Accessibility Profile
When untimed or accessibility mode is active, the speed component is omitted, and weights are normalized:
$$\text{masteryScore}_{\text{untimed}} = \text{round}(0.80 \times A + 0.20 \times C)$$

### 3.4 Status & Guardrails
- **Minimum Data Requirement**: Status is `INSUFFICIENT_DATA` ("Belum Cukup Data") if:
  - Total answers $< 10$, OR
  - Total distinct sessions $< 2$.
- **Mastery Status Bands**:
  - `0–39`: `NEEDS_PRACTICE` ("Perlu Latihan")
  - `40–59`: `DEVELOPING` ("Berkembang")
  - `60–79`: `COMPETENT` ("Cukup")
  - `80–94`: `PROFICIENT` ("Mahir")
  - `95–100`: `MASTERED` ("Dikuasai")
- **Skill Classification**:
  - **Weak Skill**: `masteryScore < 60` OR `recentAccuracy < 70%` (using up to 10 latest answers).
  - **Strong Skill**: `masteryScore >= 80` AND `recentAccuracy >= 85%`.

---

## 4. Mistake Training Engine ("Latih Kesalahan Saya")

### 4.1 Invariants & Business Rules (PRD §13.2)
1. **Session Size ($N$)**:
   $$N = \min(15, \max(5, 3 \times \text{count(distinct failed template families)}))$$
2. **Skill Relevance (100%)**:
   Every generated remediation question must target one of the failed `primarySkillId` or supporting `skillTags` from the error evidence.
3. **Repetition Controls**:
   - **Exact prompt repeat $\le 1$** across the whole remediation session.
   - **$\ge 80\%$ of questions must be new variants** (different operands/numbers for the same template).
   - **Template family share $\le 30\%$** (when $\ge 3$ distinct families exist; proportionally relaxed for 1–2 families).
4. **Difficulty Ceiling**:
   Generated questions cannot exceed the maximum difficulty of the failed questions:
   $$\text{question.difficulty} \le \max_{q \in \text{failedQuestions}}(\text{difficulty}_q)$$
5. **Score & Progression Impact**:
   Completing a remediation session updates the `MasteryStore` (positive feedback for corrected skills) but **does not grant campaign stars or competitive leaderboard score**.

---

## 5. Storage Architecture (`MasteryStore`)

### 5.1 Local Storage Keys
- `hk_mastery_events_v2`: Compressed array of `StoredAnswerEvent` objects.
- `hk_mastery_snapshots_v2`: Computed snapshot cache mapping `subSkillId -> MasteryRecord`.

### 5.2 Pruning & Invariant Enforcement
- Evaluated and enforced during every `recordSessionEvents(events)` call.
- Events older than 90 days are pruned:
  $$t_{\text{event}} < t_{\text{current}} - 90 \times 86.400.000\text{ ms}$$
- Maximum 30 events kept per `subSkillId`, retaining the most recent events.
- Deduplication by `eventId` ensures idempotency on retries or repeated ingestion.

---

## 6. Directory & Code Organization

```text
src/engine/
├── taxonomy/
│   ├── index.ts               # Taxonomy registry with all 14 categories
│   └── types.ts               # Taxonomy category & sub-skill schemas
├── mastery/
│   ├── calculator.ts          # Pure mathematical Mastery V2.0 evaluator
│   ├── store.ts               # Isolated MasteryStore with 90-day pruning
│   └── types.ts               # MasteryRecord, Status, and Event schemas
└── remediation/
    ├── builder.ts             # Algorithmic Latih Kesalahan Saya builder
    └── types.ts               # Remediation input evidence & session configs
```

---

## 7. Verification Strategy

### 7.1 Unit Tests
- `tests/unit/taxonomy.test.ts`: Validate complete coverage of 14 categories, format of sub-skill IDs, and uniqueness.
- `tests/unit/masteryCalculator.test.ts`:
  - Insufficient data (<10 answers or <2 sessions).
  - Accuracy recency weighting verification against mathematical fixtures.
  - Target response time and speed curve calculations.
  - Consistency scoring across sessions.
  - Untimed / accessibility mode normalization.
  - Weak vs. Strong skill categorization.
- `tests/unit/remediationBuilder.test.ts`:
  - Verify session bounds ($5 \le N \le 15$).
  - 100% skill tag relevance.
  - $\le 1$ exact repeat and $\ge 80\%$ distinct variants.
  - Template family cap $\le 30\%$.
  - Difficulty ceiling enforcement.
- `tests/unit/masteryStore.test.ts`:
  - Event ingestion and deduplication.
  - 90-day expiration pruning.
  - 30-event capacity enforcement per sub-skill.

### 7.2 Property-Based & Invariant Tests
- `tests/unit/masteryInvariants.test.ts`:
  - 5,000 randomized evaluation runs.
  - Invariant: $0 \le \text{masteryScore} \le 100$ under all circumstances.
  - Invariant: Adding correct answers never decreases mastery.
  - Invariant: Identical input events yield identical mastery output.
