# SPESIFIKASI DESAIN ARSITEKTUR: HITUNG KILAT V2 — MILESTONE V2.0-A (FOUNDATION)

| Metadata | Nilai |
|---|---|
| Dokumen | 2026-09-11-v2-foundation-design.md |
| Status | Approved Design / Ready for Planning |
| Target Milestone | Milestone V2.0-A (Foundation) |
| Tanggal | 11 September 2026 |
| Baseline | `bgsdevsecops/hitung-kilat-game-matematika` branch `main` |
| Dokumen Induk | `docs/PRD-Hitung-Kilat-V2.md` |

---

## 1. Ringkasan Eksekutif & Tujuan

Milestone V2.0-A (Foundation) bertujuan meletakkan fondasi arsitektur mental-math engine yang scalable, decoupled, dan bebas dari cacat desain V1 (race conditions, timer drift, undercount jawaban terakhir, dan generator berbasis numeric level ID).

Pekerjaan ini mencakup:
1. Pembangunan arsitektur modular di `src/engine/` tanpa mengganggu layar permainan V1 yang sedang berjalan.
2. Penggantian `correctAnswer: number` dengan model jawaban diskriminatif `AnswerSpec` (Integer, Rational, Decimal, Choice).
3. Penggantian branch ID numerik (`config.id === 4, 11, ...`) dengan `QuestionGeneratorRegistry` berbasis aturan bertipe (*typed rules*).
4. Implementasi `UnifiedGameplaySession` Reducer berbasis finite state machine (FSM) dan monotonic clock.
5. Pembangunan framework migrasi progres V1 ke V2 yang idempotent dan menjaga perolehan bintang serta skor pengguna lama (Appendix B PRD).
6. Penyediaan automated testing harness (Vitest) dengan property-based testing ($\ge 10.000$ kasus uji/famili generator).

---

## 2. Struktur Direktori Modul Baru (`src/engine/`)

Modul engine dibangun secara mandiri dan terisolasi di `src/engine/`:

```text
src/engine/
├── types/
│   ├── answer.ts          # AnswerSpec (Integer, Rational, Decimal, Choice) & Evaluator types
│   ├── rules.ts           # Discriminated union GeneratorRule per operasi
│   ├── question.ts        # Model kanonikal Question & display prompt
│   ├── level.ts           # LevelConfig V2 dengan stable string ID & prerequisites
│   ├── session.ts         # Session lifecycle types, events, & immutable results
│   └── version.ts         # VersionTuple contract (schema, content, rules, dll.)
├── registry/
│   ├── index.ts           # QuestionGeneratorRegistry singleton/factory
│   └── validator.ts       # Validasi integritas manifest level & DAG prasyarat
├── generators/
│   ├── addition.ts        # Generator penjumlahan bertipe
│   ├── subtraction.ts     # Generator pengurangan bertipe
│   ├── multiplication.ts   # Generator perkalian bertipe
│   ├── division.ts        # Generator pembagian bertipe (invarian integer & div-by-zero)
│   └── missingOperand.ts  # Generator operand hilang (? + b = c, a * ? = c)
├── session/
│   ├── reducer.ts         # FSM gameplay session reducer (CREATED -> ACTIVE -> FINALIZING -> COMPLETED/FAILED)
│   ├── timer.ts           # Monotonic clock & absolute deadline calculator
│   └── summary.ts         # Rekapitulasi hasil sesi yang akurat dan immutable
├── migration/
│   ├── mapping.ts         # Pemetaan normatif 24 level V1 ke V2 (Appendix B)
│   └── migrator.ts        # Idempotent state migrator & legacy star credits calculator
└── adapter/
    └── v1Adapter.ts       # Adapter jembatan untuk kompatibilitas UI V1 yang sudah ada
```

---

## 3. Desain Model Domain

### 3.1 Model Jawaban (`AnswerSpec`) & Evaluator
Menghindari penggunaan `parseInt` dan evaluasi string mentah:

```typescript
export type AnswerSpec =
  | { kind: 'integer'; value: number }
  | { kind: 'rational'; numerator: number; denominator: number; requireSimplified?: boolean }
  | { kind: 'decimal'; scaledValue: number; scale: number; acceptedTolerance?: number }
  | { kind: 'choice'; optionId: string; options: Array<{ id: string; label: string }> };

export interface EvaluationResult {
  isCorrect: boolean;
  normalizedUserAnswer: string;
  expectedDisplay: string;
}
```

- **Integer**: Memvalidasi digit bulat dan satu minus opsional.
- **Rational**: Menerima input `numerator/denominator`, menyederhanakan pecahan dengan pembagi persekutuan terbesar (GCD), dan membandingkan secara ekuivalen kecuali `requireSimplified: true`.
- **Decimal**: Mengonversi string input dengan koma/titik menjadi scaled integer untuk mencegah floating-point inaccuracy.
- **Choice**: Memvalidasi kesesuaian `optionId`.

### 3.2 Aturan Generator Bertipe (`GeneratorRule`)
Setiap generator dipetakan ke discriminated union:

```typescript
export type AdditionRule = {
  kind: 'addition';
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
  termsCount?: number;
  targetSumMax?: number;
};

export type SubtractionRule = {
  kind: 'subtraction';
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
  allowNegative?: boolean;
};

export type MultiplicationRule = {
  kind: 'multiplication';
  fixedOperand?: number;
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
};

export type DivisionRule = {
  kind: 'division';
  minDivisor: number;
  maxDivisor: number;
  minQuotient: number;
  maxQuotient: number;
  requireInteger?: boolean;
};

export type MissingOperandRule = {
  kind: 'missing_operand';
  operation: '+' | '-' | '×' | '÷';
  missingPosition: 'first' | 'second' | 'random';
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
};

export type GeneratorRule =
  | AdditionRule
  | SubtractionRule
  | MultiplicationRule
  | DivisionRule
  | MissingOperandRule;
```

### 3.3 Model Identitas Level Baru (`LevelConfig`)
```typescript
export interface LevelConfigV2 {
  id: string; // Stable string ID, misal: "T1-ADD-01"
  order: number; // Urutan linier tampilan
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  description: string;
  generatorKey: string;
  rules: GeneratorRule;
  answerKind: 'integer' | 'rational' | 'decimal' | 'choice';
  difficulty: 1 | 2 | 3 | 4 | 5 | 6;
  questionCount: number;
  targetTimeSec: number;
  timeLimitSec: number;
  boss: boolean;
  passingAccuracy: number;
  prerequisiteIds: string[];
  primarySkillId: string;
  skillTags: string[];
  contentVersion: string;
}
```

---

## 4. `QuestionGeneratorRegistry` & Invarian Matematika (P0)

### 4.1 Interface Generator
```typescript
export interface GenerationContext {
  levelId: string;
  sequenceIndex: number;
  contentVersion: string;
  rulesVersion: string;
  existingSignatures?: Set<string>;
}

export interface QuestionGenerator<TRule extends GeneratorRule = GeneratorRule> {
  readonly key: string;
  readonly version: number;
  validateRule(rule: unknown): TRule;
  generate(rule: TRule, prng: () => number, context: GenerationContext): Question;
}
```

### 4.2 Invarian Mutlak Matematika
1. **Division Guard**: `divisor !== 0`. Pada clean division, pembagi dan hasil bagi ditentukan terlebih dahulu, lalu hasil perkaliannya dijadikan pembilang ($A = B \times C$).
2. **Subtraction Bounds**: Jika `allowNegative: false`, selalu diberlakukan $A \ge B$.
3. **Missing Operand Uniqueness**: Persamaan linear memiliki tepat satu nilai solusi bulat.
4. **Anti-Duplikasi**: Generator memeriksa collision hash prompt dalam sesi yang sama (maksimal 20 percobaan sampling ulang).
5. **No Runtime Eval**: Pembuatan soal dan evaluasi jawaban dilarang keras menggunakan fungsi `eval()` JavaScript.

---

## 5. `UnifiedGameplaySession` Reducer & Monotonic Timer

### 5.1 Siklus Hidup Sesi (Finite State Machine)
```text
CREATED ──(START)──► ACTIVE ──(SUBMIT/TIMEOUT/ABANDON)──► FINALIZING ──► COMPLETED / FAILED / ABANDONED
```

- **Transisi Atomik**:
  - `SUBMIT_ANSWER`: Mengevaluasi jawaban seketika, mengunci input (`inputLocked: true`), mencatat `AnswerEvent`, memperbarui combo, dan transisi ke soal berikutnya atau ke `FINALIZING`.
  - `DEADLINE_REACHED`: Menghentikan penerimaan input, menandai sisa soal sebagai `unanswered`, dan memfinalkan sesi ke status `FAILED`.
  - `ABANDON`: Pemain keluar sebelum selesai, sesi berstatus `ABANDONED`.
- **Monotonic Clock**:
  - `startedAtMonotonic = performance.now()`
  - `deadlineMonotonic = startedAtMonotonic + (timeLimitSec * 1000)`
  - Jeda waktu (pause) menambah nilai `deadlineMonotonic` secara proporsional.
- **Pemberian Bintang (Stars Formula)**:
  - 0★: Timeout, abandon, atau akurasi $< 70\%$.
  - 1★: Selesai tepat waktu, akurasi $\ge 70\%$.
  - 2★: Selesai tepat waktu, akurasi $\ge 85\%$.
  - 3★: Selesai dalam `targetTimeSec`, akurasi $\ge 95\%$.
  - Perfect: Selesai dalam `targetTimeSec`, akurasi $100\%$.

---

## 6. Framework Migrasi Progres V1 $\rightarrow$ V2

### 6.1 Pemetaan Normatif (Berdasarkan Appendix B PRD)
Setiap ID numerik V1 (1–24) dipetakan secara deklaratif ke stable ID V2:
- `1` $\rightarrow$ `T1-ADD-01` (Penjumlahan 1–10)
- `2` $\rightarrow$ `T1-ADD-02` (Penjumlahan 1–20)
- `3` $\rightarrow$ `T1-SUB-01` (Pengurangan 1–15)
- `4` $\rightarrow$ `T1-SUB-02` (Pengurangan 1–20)
- `5` $\rightarrow$ `T2-MUL-02` (Perkalian Dasar 2, 3, 5)
- ... hingga `24` $\rightarrow$ `T6-GRANDMASTER`.

### 6.2 Prinsip Migrasi
1. **Idempotensi**: Menjalankan migrasi $N$ kali menghasilkan state yang identik.
2. **Non-Destructive**: Progres V1 disimpan di `legacyImport.v1Levels` dan tidak dihapus dari storage.
3. **Legacy Star Credits**: Jika total bintang V1 melebihi bintang terpetakan di V2, selisihnya dicatat sebagai `legacyStarCredits` agar perolehan pengguna tetap terjaga.
4. **Prerequisite Unlocking**: Menyelesaikan level V1 membuka rantai level V2 hingga mapped level terkait. Pengguna baru (*fresh user*) hanya membuka `T1-ADD-01`.

---

## 7. Testing Strategy (Vitest)

### 7.1 Cakupan Unit & Property Test
1. `tests/unit/answerEvaluator.test.ts`: Uji presisi format integer, pecahan (ekuivalensi dan GCD), desimal berskala, dan pilihan ganda.
2. `tests/unit/generators.test.ts`: Uji spesifik setiap generator (penjumlahan, pengurangan, perkalian, pembagian, missing operand).
3. `tests/unit/sessionReducer.test.ts`: Uji pencegahan race condition jawaban terakhir, ketukan ganda, timeout locking, dan kalkulasi bintang.
4. `tests/unit/migration.test.ts`: Uji idempotensi migrasi data V1, preservation bintang, dan rantai buka kunci level.
5. `tests/property/generatorInvariants.test.ts`: Uji coba $\ge 10.000$ kasus acak ter-seed per famili generator untuk memastikan 0 pembagian nol, 0 ekspresi malformed, dan determinisme 100%.

---

## 8. Batasan Git & Release Gates
Sesuai instruksi pengguna:
- Tidak ada file atau kode lama yang dihapus (*no delete*).
- Tidak ada pergantian atau pembuatan branch baru (*stay on branch main*).
- Tidak ada eksekusi `git push` ke remote.
- Tidak ada pembuatan Merge Request (MR) atau Pull Request (PR).
- Seluruh penambahan kode dilakukan secara bertahap dan teruji.
