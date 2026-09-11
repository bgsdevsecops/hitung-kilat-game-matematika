# SPESIFIKASI DESAIN ARSITEKTUR: HITUNG KILAT V2 — MILESTONE V2.0-B (CAMPAIGN EXPANSION)

| Metadata | Nilai |
|---|---|
| Dokumen | 2026-09-11-v2-campaign-expansion-design.md |
| Status | Approved Design / Ready for Planning |
| Target Milestone | Milestone V2.0-B (Campaign Expansion) |
| Tanggal | 11 September 2026 |
| Baseline | `bgsdevsecops/hitung-kilat-game-matematika` branch `feature/12.9.11.15-v2-campaign-expansion` |
| Dokumen Induk | `docs/PRD-Hitung-Kilat-V2.md` |

---

## 1. Ringkasan Eksekutif & Tujuan

Milestone V2.0-B (Campaign Expansion) memperluas skala konten Hitung Kilat dari baseline 24 level V1 menjadi **72 level penuh** yang tersebar di 6 tier linear (12 level per tier) dengan 6 level Tier Boss, manifest konten berbasis data (*data-driven manifest*), generator aritmatika lanjut, dukungan input pecahan/desimal/bilangan negatif, serta integrasi visual level selector yang modern.

### Ruang Lingkup Deliverable:
1. **Generator Families Baru**:
   - `ChainArithmeticGenerator` (`kind: 'chain'`): Operasi beruntun 3–4 operand tanpa kurung.
   - `BodmasGenerator` (`kind: 'bodmas'`): Prioritas operasi kali/bagi dan tanda kurung.
   - `SignedArithmeticGenerator` (`kind: 'signed'`): Bilangan bulat negatif dan operasi tanda.
   - `AlgebraGenerator` (`kind: 'algebra'`): Persamaan linear satu langkah, dua langkah, dan bersarang.
   - `PowersAndRootsGenerator` (`kind: 'power_root'`): Kuadrat $1^2$–$25^2$ dan penarikan akar kuadrat sempurna.
   - `FractionAndPercentageGenerator` (`kind: 'fraction_percentage'`): Penjumlahan pecahan mental, rasio setara, dan persentase mental.
   - `MixedBlitzGenerator` (`kind: 'mixed_blitz'`): Generator komposit untuk level Boss dan Blitz.
2. **Immutable Content Manifest 72 Level (`src/engine/manifest/levels.ts`)**:
   - Konfigurasi lengkap tepat 72 level (T1-ADD-01 s/d T6-GRANDMASTER) sesuai PRD §8.1.
   - Parameter waktu (target 3★, hard deadline), passing accuracy 70%, target question count, dan skill tags.
3. **DAG Prasyarat & Manifest Validator (`src/engine/manifest/validator.ts`)**:
   - Validasi ketat kepadatan urutan `order` 1–72 tanpa gap.
   - Validasi siklus prasyarat (cycle-free DAG) dan keterkaitan Boss level antar-tier.
   - Validasi keterdaftaran generator key di registry.
4. **Input Numpad Ekstensi & Keypad Dinamis**:
   - Dukungan input pecahan (`/`), tanda negatif (`-`), dan desimal (`.`) adaptif sesuai tipe `AnswerSpec` level aktif.
5. **Level Selection View 72 Level**:
   - Tab 6 Tier, layout kartu level responsif, indikator bintang, dan kartu Boss level khusus dengan lencana visual.
6. **Testing Harness**:
   - Property-based testing $\ge 10.000$ kasus acak per generator baru.
   - Unit tests validasi manifest dan komponen input.

---

## 2. Struktur Modul & Berkas Baru

```text
src/
├── engine/
│   ├── types/
│   │   ├── rules.ts             # Diperluas dengan rule types untuk 7 generator baru
│   │   ├── level.ts             # Definisi LevelConfigV2 & manifest types
│   │   └── index.ts
│   ├── generators/
│   │   ├── chain.ts             # Chain arithmetic (3-4 terms, + dan -)
│   │   ├── bodmas.ts            # BODMAS & parentheses precedence
│   │   ├── signed.ts            # Signed/negative numbers arithmetic
│   │   ├── algebra.ts           # Linear equations (1-step, 2-step, nested)
│   │   ├── powerRoot.ts         # Square powers & perfect square roots
│   │   ├── fractionPercentage.ts# Mental fractions, equivalent ratios, mental percentages
│   │   ├── mixedBlitz.ts        # Dynamic composite generator for Boss & Blitz levels
│   │   └── index.ts             # Export seluruh generator
│   └── manifest/
│       ├── levels.ts            # Manifest statis kanonikal 72 level V2
│       ├── validator.ts         # Validasi integritas manifest, DAG prasyarat, dan density
│       └── index.ts
├── components/
│   └── game/
│       ├── DynamicKeypad.tsx    # Numpad cerdas dengan tombol adaptif (-, /, .)
│       └── LevelCardV2.tsx      # Komponen kartu level dengan visual boss badge
```

---

## 3. Spesifikasi Teknis Generator Baru & Invarian

### 3.1 `ChainArithmeticGenerator` (`kind: 'chain'`)
- **Tujuan**: Menguji kecepatan kalkulasi beruntun kiri-ke-kanan.
- **Rule Interface**:
  ```typescript
  export type ChainRule = {
    kind: 'chain';
    operators: Array<'+' | '-'>;
    termsCount: 3 | 4;
    minOperand: number;
    maxOperand: number;
    allowIntermediateNegative?: boolean; // Default false
  };
  ```
- **Invarian Matematika**:
  - Jika `allowIntermediateNegative` bernilai `false`, setiap evaluasi parsial dari kiri ke kanan wajib $\ge 0$.
  - Format prompt: `a + b - c` atau `a - b + c - d`.

### 3.2 `BodmasGenerator` (`kind: 'bodmas'`)
- **Tujuan**: Menguji pemahaman urutan operasi dan evaluasi tanda kurung.
- **Rule Interface**:
  ```typescript
  export type BodmasTemplate =
    | 'a_plus_b_times_c'       // a + b × c
    | 'a_times_b_plus_c'       // a × b + c
    | 'a_minus_b_div_c'        // a - b ÷ c
    | 'paren_add_div_c'        // (a + b) ÷ c
    | 'paren_sub_mul_c'        // (a - b) × c
    | 'paren_nested_bodmas';   // a + b × (c - d)

  export type BodmasRule = {
    kind: 'bodmas';
    template: BodmasTemplate;
    minOperand: number;
    maxOperand: number;
    requireCleanDivision?: boolean; // Default true
  };
  ```
- **Invarian Matematika**:
  - Pada template pembagian, pembilang dan penyebut selalu menghasilkan pembagian bulat bersih tanpa sisa ($A \pmod B = 0$).
  - Penyebut dilarang bernilai 0 ($C \neq 0$).

### 3.3 `SignedArithmeticGenerator` (`kind: 'signed'`)
- **Tujuan**: Menguji pemahaman operasi bilangan bertanda (positif & negatif).
- **Rule Interface**:
  ```typescript
  export type SignedRule = {
    kind: 'signed';
    operation: '+' | '-' | '×' | '÷';
    minOperand: number; // Misal: -20
    maxOperand: number; // Misal: 20
    allowZeroOperand?: boolean; // Default false
  };
  ```
- **Invarian Matematika**:
  - Penulisan operand negatif di sisi kanan ekspresi wajib dilindungi kurung: misal `7 + (-12)` atau `-8 - (-4)`.
  - Pembagian negatif tetap bulat bersih ($A \pmod B = 0$) dan penyebut $B \neq 0$.

### 3.4 `AlgebraGenerator` (`kind: 'algebra'`)
- **Tujuan**: Menguji aljabar mental linear 1-langkah, 2-langkah, dan bersarang.
- **Rule Interface**:
  ```typescript
  export type AlgebraTemplate =
    | 'one_step_add'           // x + c = d atau c + x = d
    | 'one_step_sub'           // x - c = d atau c - x = d
    | 'two_step_linear'        // m*x + c = d atau m*x - c = d
    | 'nested_linear';         // m(a*x + b) = d

  export type AlgebraRule = {
    kind: 'algebra';
    template: AlgebraTemplate;
    variableName?: 'x' | 'y' | 'n';
    minSolution: number;
    maxSolution: number;
    minCoefficient: number;
    maxCoefficient: number;
  };
  ```
- **Invarian Matematika**:
  - Solusi $x$ selalu bilangan bulat eksak di dalam rentang `[minSolution, maxSolution]`.
  - Koefisien $m$ tidak boleh bernilai 0 ($m \ge 1$).

### 3.5 `PowersAndRootsGenerator` (`kind: 'power_root'`)
- **Tujuan**: Uji kecepatan recall kuadrat $N^2$ dan akar kuadrat $\sqrt{N}$.
- **Rule Interface**:
  ```typescript
  export type PowerRootRule = {
    kind: 'power_root';
    mode: 'square' | 'square_root';
    minBase: number;
    maxBase: number;
  };
  ```
- **Invarian Matematika**:
  - Mode `square`: Prompt `$N²$`, jawaban $N \times N$.
  - Mode `square_root`: Radikan adalah $R = N \times N$, prompt `√R`, jawaban $N$ (selalu bilangan bulat positif).

### 3.6 `FractionAndPercentageGenerator` (`kind: 'fraction_percentage'`)
- **Tujuan**: Melatih kelincahan pecahan, rasio, dan persentase mental.
- **Rule Interface**:
  ```typescript
  export type FractionPercentageRule = {
    kind: 'fraction_percentage';
    variant: 'fraction_add' | 'ratio_equality' | 'mental_percentage';
    minBase?: number;
    maxBase?: number;
  };
  ```
- **Invarian Matematika**:
  - `fraction_add`: Menghasilkan prompt pecahan berpenyebut bersahabat (contoh penyebut: 2, 3, 4, 5, 8, 10), jawaban dievaluasi via `AnswerSpec` bertipe `rational`.
  - `ratio_equality`: Menghasilkan persamaan rasio $a:b = ?:d$ dengan solusi bulat tunggal.
  - `mental_percentage`: Menghasilkan persentase umum ($10\%, 20\%, 25\%, 50\%, 15\%$) dari angka yang habis dibagi pembagi terkait.

### 3.7 `MixedBlitzGenerator` (`kind: 'mixed_blitz'`)
- **Tujuan**: Menghasilkan soal komposit multi-famili untuk level Boss dan Blitz.
- **Rule Interface**:
  ```typescript
  export type MixedBlitzRule = {
    kind: 'mixed_blitz';
    subRules: GeneratorRule[];
  };
  ```
- Generator memilih salah satu `subRule` secara acak ter-seed menggunakan PRNG Mulberry32 dan mendelegasikannya ke generator yang sesuai di registry.

---

## 4. Spesifikasi Content Manifest 72 Level (`levels.ts`)

Manifest didefinisikan sebagai array bertipe `LevelConfigV2[]` dengan 72 elemen yang memuat pembagian 6 Tier kanonikal:

### 4.1 Distribusi 6 Tier (6 Tier × 12 Level = 72 Level)
1. **Tier 1 — Pemula (`T1-ADD-01` s/d `T1-BOSS`)**:
   - Fokus: Tambah dasar (1–10, 1–20), kurang dasar (1–15, 1–20), duo chain (+, -), pasangan 10/20, missing addend/subtrahend, dan Boss Pemula (15 soal).
2. **Tier 2 — Menengah (`T2-MUL-02` s/d `T2-BOSS`)**:
   - Fokus: Tabel perkalian ×2 sampai ×9, pembagian dasar 2–9, missing factor, dan Boss Kali Bagi (15 soal).
3. **Tier 3 — Terampil (`T3-ADD-01` s/d `T3-BOSS`)**:
   - Fokus: Penjumlahan & pengurangan puluhan dan ratusan (dengan carry & borrow), perkalian/pembagian 10 & 100, puluhan × satuan, campuran 4 operasi, dan Boss Terampil (15 soal).
4. **Tier 4 — Mahir (`T4-CHAIN-03` s/d `T4-BOSS`)**:
   - Fokus: Chain 3–4 angka, campuran kali/bagi + tambah/kurang, BODMAS dasar, kurung `(a+b)÷c` & `(a-b)×c`, BODMAS mahir, dan Boss BODMAS (15 soal).
5. **Tier 5 — Master (`T5-NEG-01` s/d `T5-BOSS`)**:
   - Fokus: Bilangan negatif (+, -, ×, ÷), perkalian 11–19, missing operand aljabar, aljabar linear 1–2 langkah, Master Blitz, dan Boss Master (15 soal).
6. **Tier 6 — Legenda (`T6-SQUARE-01` s/d `T6-GRANDMASTER`)**:
   - Fokus: Kuadrat $1^2$–$25^2$, akar kuadrat $\sqrt{N}$, persentase dasar & kilat, pecahan mental, rasio kilat, aljabar bersarang, Legendary Blitz, dan Ujian Akhir Grandmaster (20 soal).

### 4.2 Parameter Sesi & Target Waktu

| Parameter | Level Reguler (1–11 per Tier) | Level Boss (12 per Tier T1–T5) | Grandmaster Boss (Level 72) |
|---|---|---|---|
| **Question Count** | 10 (T1) / 12 (T2–T6) | 15 soal | 20 soal |
| **Passing Accuracy** | 70% | 70% | 70% |
| **Target Time (3★)** | 30s (T1) s/d 55s (T6) | 40s (T1) s/d 60s (T5) | 80s |
| **Hard Deadline** | 45s (T1) s/d 70s (T6) | 60s (T1) s/d 80s (T5) | 110s |

---

## 5. Validasi Manifest & Aturan Integritas DAG (`validator.ts`)

Fungsi validator `validateLevelManifest(levels: LevelConfigV2[], registry: QuestionGeneratorRegistry)` bertugas sebagai build & runtime gate:

```typescript
export interface ManifestValidationResult {
  isValid: boolean;
  errors: string[];
  totalLevels: number;
}
```

### Kriteria Validasi Mutlak:
1. **Total Count**: Tepat 72 level.
2. **Order Kontinu**: Nilai `order` bernilai tepat 1 sampai 72 tanpa duplikasi atau urutan yang terlewat.
3. **ID Unik & Stabil**: Seluruh string ID unik dan sesuai format `T{tier}-{KODE}-{no}` atau `T{tier}-BOSS`.
4. **DAG Acyclic (Bebas Siklus)**:
   - Level 1 (`T1-ADD-01`) wajib memiliki `prerequisiteIds: []`.
   - Level reguler $N$ memiliki prasyarat level $N-1$.
   - Level pertama pada Tier $T$ ($T \ge 2$) memiliki prasyarat Boss Level dari Tier $T-1$.
   - Dilakukan verifikasi DFS untuk memastikan graf prasyarat bersifat directed acyclic graph (DAG).
5. **Registry Alignment**: Semua `generatorKey` di setiap level wajib terdaftar dan valid di `QuestionGeneratorRegistry`.

---

## 6. Antarmuka Pengguna & Dynamic Numpad (`DynamicKeypad.tsx`)

Untuk mendukung format jawaban bilangan bertanda (`-`), pecahan (`/`), dan desimal (`.`):

1. **Tata Letak Adaptif Berdasarkan `level.answerKind` dan `rules.kind`**:
   - Jika `answerKind === 'rational'`: Baris bawah menyertakan tombol `/` (garis miring pecahan).
   - Jika `rules.kind === 'signed'` atau ekspresi menghasilkan nilai negatif: Baris bawah menyertakan tombol `+/-` atau `-`.
   - Jika `answerKind === 'decimal'`: Baris bawah menyertakan tombol titik desimal `.`.
   - Mode standar integer murni tetap mempertahankan tampilan numpad besar 0–9 yang bersih.
2. **Penanganan Input**:
   - Penekanan tombol keyboard fisik (`-`, `/`, `.`, `Backspace`, `Enter`) disinkronkan secara konsisten dengan keypad virtual.
   - Cegah double minus (`--`) atau double slash (`//`) pada level komponen sebelum dikirim ke `answerEvaluator`.

---

## 7. Strategi Pengujian (Testing Strategy)

1. **Unit Testing**:
   - `tests/unit/manifest.test.ts`: Uji kelengkapan 72 level, ketunggalan ID, urutan linear, dan validasi DAG bebas siklus.
   - `tests/unit/newGenerators.test.ts`: Uji pembentukan soal untuk 7 generator baru.
   - `tests/unit/keypad.test.ts`: Uji logika pemformatan dan tombol adaptif pada DynamicKeypad.
2. **Property-Based Testing (`tests/property/campaignInvariants.test.ts`)**:
   - $\ge 10.000$ kasus acak ter-seed per generator baru (total $\ge 70.000$ kasus uji baru):
     - `Chain`: 0 hasil negatif parsial jika `allowIntermediateNegative: false`.
     - `Bodmas`: 0 sisa pembagian pada template pembagian, 0 pembagian nol.
     - `Signed`: Penulisan kurung tepat pada operand negatif, evaluasi jawaban sesuai aturan tanda.
     - `Algebra`: Solusi bulat unik, koefisien valid.
     - `PowerRoot`: Radikan akar adalah kuadrat sempurna eksak.
     - `FractionPercentage`: Penyebut bukan nol, desimal/rasio terdefinisi.
     - `MixedBlitz`: Distribusi acak proporsional dan delegasi sukses.

---

## 8. Batasan Git & Release Gate

- Seluruh pengerjaan dilakukan secara terisolasi pada branch: `feature/12.9.11.15-v2-campaign-expansion`.
- Tidak mengubah langsung branch `main` atau `master`.
- Tidak ada penghapusan file lama (`no delete`).
- Tidak ada eksekusi `git push` dan tidak ada pembuatan PR/MR.
- Seluruh git commit menyertakan atribusi:
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`.
