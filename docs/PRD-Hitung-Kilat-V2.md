# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# HITUNG KILAT V2

**Dokumen:** PRD-Hitung-Kilat-V2  
**Versi:** 2.0 Draft  
**Tanggal:** 10 September 2026  
**Status:** Ready for Product/Engineering Review  
**Produk:** Hitung Kilat — Speed Math / Mental Math Training Game  
**Baseline:** Repository `bgsdevsecops/hitung-kilat-game-matematika` branch `main`

---

## 1. Executive Summary

Hitung Kilat V2 adalah evolusi dari game matematika cepat berbasis web yang saat ini sudah memiliki campaign 24 level, 6 tier, sistem bintang, score, combo, statistik, daily challenge, Lari Kilat, latihan bebas, achievement, autentikasi, cloud sync, dan leaderboard.

V2 tidak ditujukan sebagai redesign total. Identitas visual, core interaction, dan fitur yang sudah bekerja dipertahankan. Fokus V2 adalah menjadikan Hitung Kilat sebagai **mental-math training game yang scalable, terukur, personal, dan kompetitif**.

Perubahan utama V2 adalah:

1. Campaign berkembang dari 24 menjadi **72 level** dalam 6 tier × 12 level.
2. Level/question engine direfactor menjadi **data-driven dan rule-driven**, tidak lagi bergantung pada numeric level ID.
3. Progress menggunakan **stable level identifier** agar urutan level dapat berkembang tanpa merusak progress user.
4. Ditambahkan **skill mastery** dan sub-skill mastery berdasarkan accuracy dan response time.
5. Ditambahkan **Latih Kesalahan Saya** untuk remediation berdasarkan pola jawaban salah.
6. Adaptive mode ditingkatkan dari score/streak-based menjadi **skill-aware adaptive practice**.
7. Daily leaderboard menjadi leaderboard pemain nyata dan leaderboard kompetitif dibuat lebih aman.
8. Mode Lari Kilat dipisahkan menjadi **Sprint 60s** dan **Survival Kilat**.
9. Ditambahkan Boss Level per tier.
10. Math generator mendapatkan automated correctness/invariant tests dan observability yang memadai.

V2 tetap mempertahankan prinsip produk: sesi singkat, input cepat, feedback segera, replayability tinggi, dan progres kemampuan yang mudah dilihat pemain.

---

## 2. Product Vision

> **Hitung Kilat adalah tempat pemain melatih kecepatan, ketepatan, dan refleks matematika mental melalui sesi singkat yang terasa seperti game, bukan ujian.**

V2 harus menggeser persepsi dari “quiz matematika 24 level” menjadi:

**Mental Math Speed Trainer + Competitive Math Game**

Loop utama produk:

```text
LEARN
Campaign 72 level
   ↓
TRAIN
Weak Skill + Adaptive Practice
   ↓
COMPETE
Daily Challenge + Sprint + Leaderboard
   ↓
IMPROVE
Speed + Accuracy + Mastery
   ↓
REPEAT
```

---

## 3. Background dan Baseline V1

Berdasarkan source saat ini, V1 sudah mempunyai fondasi berikut:

| Area | Baseline V1 |
|---|---|
| Campaign | 24 level |
| Tier | 6: Pemula, Menengah, Terampil, Mahir, Master, Legenda |
| Campaign progression | Level unlock berurutan |
| Rating level | 1–3 bintang |
| Gameplay | Score, accuracy, streak/combo, timer |
| Result | Ringkasan dan history jawaban |
| Daily | Deterministic 10-question daily challenge |
| Time Attack | Adaptive berdasarkan score + streak |
| Practice | Latihan bebas |
| Achievement | Tersedia |
| Stats | Global player stats tersedia |
| Account | Google/anonymous auth |
| Sync | Firebase cloud sync |
| Leaderboard | Time Attack leaderboard Firestore |
| Daily ranking | Masih menggunakan simulated benchmark players |
| Testing | TypeScript compile check; belum ada automated math test suite |

### 3.1 Technical constraints V1 yang perlu dibereskan

Current `LevelConfig` menggunakan `id: number`, sementara generator memiliki beberapa branch seperti `config.id === 4`, `config.id === 11`, `config.id === 19`, `config.id === 21`, dan seterusnya. Unlock juga menggunakan asumsi `nextLevel = currentId + 1`, dengan beberapa hard-code batas 24.

Model ini layak untuk 24 level tetapi akan menimbulkan technical debt ketika campaign menjadi 72+ level. Karena itu **engine refactor adalah prerequisite V2**, bukan pekerjaan opsional setelah penambahan level.

---

## 4. Goals V2

| ID | Goal | Definition of Done |
|---|---|---|
| G-01 | Campaign lebih dalam | 72 level aktif, 12 per tier |
| G-02 | Engine scalable | Penambahan level tidak membutuhkan conditional berdasarkan numeric ID |
| G-03 | Progress aman | V1 progress termigrasi tanpa kehilangan score/star yang sudah dicapai |
| G-04 | Learning intelligence | Mastery per skill dan weak-skill detection tersedia |
| G-05 | Remediation | User dapat melatih pola soal yang salah |
| G-06 | Adaptive practice | Difficulty dan distribusi skill menyesuaikan performa user |
| G-07 | Competitive integrity | Ranking production tidak bergantung pada score client yang tidak tervalidasi |
| G-08 | Math correctness | Generator memiliki automated invariant tests |
| G-09 | Replayability | Boss, Sprint, Survival, Daily, mastery memberi alasan replay |
| G-10 | UI continuity | Visual identity existing dipertahankan dan state progression diperjelas |

---

## 5. Non-Goals V2

V2 **tidak** mencakup scope utama berikut:

| Out of Scope | Catatan |
|---|---|
| Real-time 1v1 multiplayer | Kandidat V3 |
| Tournament bracket real-time | Kandidat V3 |
| Clan/guild | Kandidat V3 |
| Marketplace berbayar | Belum diperlukan |
| Kurikulum formal per kelas sekolah | V2 fokus skill mental math, bukan LMS |
| Teacher/parent dashboard lengkap | Future education expansion |
| Major visual redesign | Pertahankan branding existing |
| AI tutor conversational | Tidak diperlukan untuk core V2 |

---

## 6. Target Users

V2 dirancang sebagai produk lintas umur, dengan primary behavior segmentation, bukan grade segmentation.

| Persona | Kebutuhan | Fitur utama |
|---|---|---|
| Beginner Learner | Menguasai operasi dasar secara bertahap | T1–T3, practice, mastery |
| Student Improver | Lebih cepat dan akurat | T2–T5, mistake training, stats |
| Mental Math Enthusiast | Tantangan skill tingkat tinggi | T4–T6, Boss, Sprint, Survival |
| Competitive Player | Membandingkan kemampuan | Daily, Sprint leaderboard, record |
| Casual Player | Sesi cepat dan fun | Daily, achievements, short sessions |

### 6.1 Usability assumption

UI dan bahasa harus tetap mudah dipahami pemain muda, tetapi konten tingkat Master/Legenda boleh menantang pemain remaja dan dewasa. V2 tidak mengunci user ke umur atau kelas sekolah tertentu.

---

## 7. Product Principles

| Principle | Implementasi |
|---|---|
| Fast to start | Maksimal beberapa klik dari home ke soal pertama |
| Short sessions | Campaign rata-rata 30–90 detik |
| Skill before grind | Unlock berasal dari penyelesaian skill, bukan farming XP |
| Accuracy matters | Speed tidak boleh mengalahkan accuracy sepenuhnya |
| Replay has purpose | Replay meningkatkan star, record, mastery, atau remediation |
| Fair competition | Mode leaderboard harus mempunyai rules yang sama untuk semua pemain |
| Explain mistakes | Setelah sesi, jawaban salah bisa dipahami dan dilatih ulang |
| Data driven content | Level baru tidak memerlukan conditional code berdasarkan ID |

---

# 8. Scope Utama V2

## 8.1 Campaign 72 Level

Campaign tetap menggunakan enam tier existing:

```text
T1 Pemula   : Lv 01–12
T2 Menengah : Lv 13–24
T3 Terampil : Lv 25–36
T4 Mahir    : Lv 37–48
T5 Master   : Lv 49–60
T6 Legenda  : Lv 61–72
```

Level 12, 24, 36, 48, 60, dan 72 adalah **Tier Boss**.

### 8.1.1 T1 — Pemula: Number Sense dan Dasar +/−

| Lv | Code | Nama | Fokus | Contoh |
|---:|---|---|---|---|
| 1 | T1-ADD-01 | Penjumlahan 1–10 | Tambah satuan | `3 + 6` |
| 2 | T1-ADD-02 | Penjumlahan 1–20 | Tambah sampai 20 | `8 + 9` |
| 3 | T1-SUB-01 | Pengurangan 1–15 | Minus dasar tanpa negatif | `14 - 6` |
| 4 | T1-SUB-02 | Pengurangan 1–20 | Minus lebih lebar | `18 - 9` |
| 5 | T1-CHAIN-01 | Duo Tambah | Tiga operand tambah | `4 + 7 + 3` |
| 6 | T1-CHAIN-02 | Duo Kurang | Pengurangan berantai | `18 - 5 - 4` |
| 7 | T1-MIX-01 | Duo Tambah Kurang | + dan − berantai | `12 + 7 - 5` |
| 8 | T1-COMP-01 | Pasangan ke 10 | Number complement | `7 + ? = 10` |
| 9 | T1-COMP-02 | Pasangan ke 20 | Number complement | `? + 8 = 20` |
| 10 | T1-MISS-01 | Cari Angka Hilang + | Inverse addition | `? + 7 = 16` |
| 11 | T1-MISS-02 | Cari Angka Hilang − | Inverse subtraction | `18 - ? = 9` |
| 12 | T1-BOSS | Boss Pemula | Campuran T1 | multi-skill |

### 8.1.2 T2 — Menengah: Multiplication dan Division Mastery

| Lv | Code | Nama | Fokus | Contoh |
|---:|---|---|---|---|
| 13 | T2-MUL-02 | Perkalian ×2 | Tabel 2 | `2 × 8` |
| 14 | T2-MUL-03 | Perkalian ×3 | Tabel 3 | `3 × 7` |
| 15 | T2-MUL-04 | Perkalian ×4 | Tabel 4 | `4 × 9` |
| 16 | T2-MUL-05 | Perkalian ×5 | Tabel 5 | `5 × 8` |
| 17 | T2-MUL-06 | Perkalian ×6 | Tabel 6 | `6 × 7` |
| 18 | T2-MUL-07 | Perkalian ×7 | Tabel 7 | `7 × 8` |
| 19 | T2-MUL-08 | Perkalian ×8 | Tabel 8 | `8 × 9` |
| 20 | T2-MUL-09 | Perkalian ×9 | Tabel 9 | `9 × 7` |
| 21 | T2-DIV-01 | Pembagian Dasar | Divisor 2,3,5 | `30 ÷ 5` |
| 22 | T2-DIV-02 | Pembagian Penuh | Divisor 4–9 | `56 ÷ 7` |
| 23 | T2-MISS-01 | Misteri Pengali | Missing factor | `? × 8 = 56` |
| 24 | T2-BOSS | Boss Kali Bagi | Semua ×/÷ | multi-skill |

### 8.1.3 T3 — Terampil: Arithmetic Fluency

| Lv | Code | Nama | Fokus | Contoh |
|---:|---|---|---|---|
| 25 | T3-ADD-01 | Tambah Puluhan | Dua digit tanpa fokus carry | `23 + 34` |
| 26 | T3-ADD-02 | Tambah dengan Carry | Carry satuan | `47 + 38` |
| 27 | T3-SUB-01 | Kurang Puluhan | Dua digit mudah | `75 - 21` |
| 28 | T3-SUB-02 | Kurang dengan Borrow | Borrow | `83 - 47` |
| 29 | T3-ADD-03 | Tambah Ratusan | Mental addition ratusan | `125 + 68` |
| 30 | T3-SUB-03 | Kurang Ratusan | Mental subtraction ratusan | `200 - 87` |
| 31 | T3-MUL-10 | Kali 10 & 100 | Place value | `34 × 10` |
| 32 | T3-DIV-10 | Bagi 10 & 100 | Place value | `700 ÷ 10` |
| 33 | T3-MUL-TENS | Puluhan × Satuan | Tens multiplication | `30 × 7` |
| 34 | T3-DIV-TENS | Puluhan ÷ Satuan | Clean division | `240 ÷ 6` |
| 35 | T3-MIX-01 | 4 Operasi Dasar | + − × ÷ random | mixed |
| 36 | T3-BOSS | Boss Terampil | Campuran T1–T3 | multi-skill |

### 8.1.4 T4 — Mahir: Multi Operation dan BODMAS

| Lv | Code | Nama | Fokus | Contoh |
|---:|---|---|---|---|
| 37 | T4-CHAIN-03 | Tiga Angka Beruntun | Tiga operand | `15 + 24 - 11` |
| 38 | T4-CHAIN-04 | Empat Angka Beruntun | Empat operand | `18 - 4 + 7 - 6` |
| 39 | T4-MIX-MA | Kali + Tambah | × dan + | `7 × 4 + 6` |
| 40 | T4-MIX-MS | Kali + Kurang | × dan − | `8 × 6 - 13` |
| 41 | T4-MIX-DA | Bagi + Tambah | ÷ dan + | `48 ÷ 6 + 7` |
| 42 | T4-MIX-DS | Bagi + Kurang | ÷ dan − | `72 ÷ 8 - 5` |
| 43 | T4-BODMAS-01 | Prioritas Perkalian | BODMAS dasar | `8 + 4 × 5` |
| 44 | T4-BODMAS-02 | Prioritas Pembagian | BODMAS dasar | `20 + 24 ÷ 6` |
| 45 | T4-PAREN-01 | Operasi Kurung | Parentheses | `(12 + 8) ÷ 4` |
| 46 | T4-PAREN-02 | Kurung + Perkalian | Parentheses mixed | `(18 - 9) × 4` |
| 47 | T4-BODMAS-03 | BODMAS Mahir | Multi precedence | `8 + 4 × (9 - 6)` |
| 48 | T4-BOSS | Boss BODMAS | Semua T4 | multi-skill |

### 8.1.5 T5 — Master: Negative dan Algebra

| Lv | Code | Nama | Fokus | Contoh |
|---:|---|---|---|---|
| 49 | T5-NEG-01 | Bilangan Negatif | Hasil negatif | `14 - 31` |
| 50 | T5-NEG-02 | Negatif + Positif | Signed number | `-8 + 17` |
| 51 | T5-NEG-03 | Negatif − Negatif | Signed subtraction | `-8 - (-4)` |
| 52 | T5-NEG-MUL | Kali Negatif | Sign multiplication | `-7 × 6` |
| 53 | T5-NEG-DIV | Bagi Negatif | Sign division | `-42 ÷ 7` |
| 54 | T5-MUL-11-14 | Perkalian 11–14 | Mental multiplication | `13 × 8` |
| 55 | T5-MUL-15-19 | Perkalian 15–19 | Mental multiplication | `17 × 6` |
| 56 | T5-MISS-02 | Misteri Operand | Inverse operation | `7 × ? = 63` |
| 57 | T5-ALG-01 | Aljabar 1 Langkah | Linear basic | `x + 8 = 21` |
| 58 | T5-ALG-02 | Aljabar 2 Langkah | Linear two-step | `3x + 5 = 20` |
| 59 | T5-BLITZ | Master Blitz | Mixed high speed | mixed |
| 60 | T5-BOSS | Boss Master | Semua T1–T5 | multi-skill |

### 8.1.6 T6 — Legenda: Advanced Mental Math

| Lv | Code | Nama | Fokus | Contoh |
|---:|---|---|---|---|
| 61 | T6-SQUARE-01 | Kuadrat 1²–10² | Square recall | `8²` |
| 62 | T6-SQUARE-02 | Kuadrat 11²–15² | Square recall | `13²` |
| 63 | T6-SQUARE-03 | Kuadrat 16²–25² | Square recall | `23²` |
| 64 | T6-ROOT-01 | Akar Kuadrat | Perfect square roots | `√144` |
| 65 | T6-PCT-01 | Persentase Dasar | 10%, 20%, 25%, 50% | `25% dari 200` |
| 66 | T6-PCT-02 | Persentase Kilat | Non-trivial percent | `15% dari 240` |
| 67 | T6-FRAC-01 | Pecahan Mental | Pecahan sederhana | `1/2 + 1/4` |
| 68 | T6-RATIO-01 | Rasio Kilat | Equivalent ratio | `2:5 = ?:20` |
| 69 | T6-ALG-03 | Aljabar Bersarang | Parenthesized linear | `3(2x + 1)=21` |
| 70 | T6-MULTI | Multi-Operasi Kilat | Advanced BODMAS | mixed |
| 71 | T6-BLITZ | Legendary Blitz | Dynamic advanced mix | mixed |
| 72 | T6-GRANDMASTER | Ujian Akhir Grandmaster | Final comprehensive boss | all skills |

---

## 8.2 Boss Level System

Boss Level tidak boleh hanya berupa level normal dengan jumlah soal lebih banyak.

### Boss behavior

| Boss | Skill Scope | Suggested Questions | Suggested Time | Passing |
|---|---|---:|---:|---|
| Lv12 Pemula | T1 | 15 | 45s | ≥70% |
| Lv24 Kali Bagi | T2 | 18 | 50s | ≥70% |
| Lv36 Terampil | T1–T3 | 18 | 60s | ≥75% |
| Lv48 BODMAS | T4 | 15 | 60s | ≥75% |
| Lv60 Master | T1–T5 | 20 | 75s | ≥80% |
| Lv72 Grandmaster | T1–T6 | 25 | 90s | ≥85% |

Boss card harus secara visual berbeda dari regular card dan mempunyai label `TIER BOSS` atau `GRANDMASTER`.

Boss unlock mengikuti progression normal. Boss completion membuka tier berikutnya. Lv72 menandai completion campaign V2.

---

## 8.3 Star dan Mastery Rules

### 8.3.1 Level Stars

Recommended campaign criteria:

| Rating | Rule |
|---|---|
| 0★ | Gagal memenuhi minimum completion |
| 1★ | Accuracy ≥70% dan level selesai |
| 2★ | Accuracy ≥85% dan level selesai |
| 3★ | Accuracy ≥95% + memenuhi target time |
| Perfect Badge | 100% accuracy + memenuhi target time |

**Unlock next level membutuhkan minimal 1★.**

Stars berfungsi untuk mastery/replay, bukan untuk memblokir pemain yang sudah cukup menguasai level.

Maximum campaign stars V2 = **216★**.

### 8.3.2 Skill Mastery

Stars mengukur performa level. Mastery mengukur kemampuan skill lintas sesi.

Setiap answer event minimal menyimpan:

```text
skill
subSkill
difficulty
isCorrect
responseTimeMs
sourceMode
levelCode
createdAt
```

Recommended mastery scale:

| Mastery | Status |
|---:|---|
| 0–39 | Perlu Latihan |
| 40–59 | Berkembang |
| 60–79 | Cukup |
| 80–94 | Mahir |
| 95–100 | Dikuasai |

Mastery score tidak boleh dihitung hanya dari accuracy. Response time dan recency harus diperhitungkan.

Recommended conceptual model:

```text
Mastery = weighted_accuracy
        + speed_component
        + consistency_component
        + recent_performance_component
```

Nilai final dinormalisasi 0–100.

---

## 8.4 Skill Taxonomy

V2 membutuhkan taxonomy agar question engine, mastery, adaptive practice, dan analytics menggunakan vocabulary yang sama.

| Skill | Example Sub-skills |
|---|---|
| Addition | single_digit, within_20, tens, carry, hundreds |
| Subtraction | single_digit, within_20, tens, borrow, hundreds |
| Multiplication | x2, x3, x4, x5, x6, x7, x8, x9, tens, 11_19 |
| Division | basic_235, x4_9_inverse, tens, signed |
| Missing Operand | add_inverse, sub_inverse, multiplication_factor |
| Multi Operation | three_terms, four_terms |
| BODMAS | mul_priority, div_priority, parentheses, advanced |
| Signed Number | negative_add, negative_sub, negative_mul, negative_div |
| Algebra | one_step, two_step, nested |
| Square | square_1_10, square_11_15, square_16_25 |
| Root | perfect_square_root |
| Percentage | standard_percentage, derived_percentage |
| Fraction | simple_fraction_arithmetic |
| Ratio | equivalent_ratio |

---

# 9. Question Engine V2

## 9.1 Requirement

Question generation harus **rule-driven**, bukan numeric-level-driven.

### Current anti-pattern to remove

```text
if config.id == 4 → behavior A
if config.id == 11 → behavior B
if config.id == 19 → behavior C
```

### Target model

```text
LevelConfig
   ↓
generatorKey + rules
   ↓
QuestionGeneratorRegistry
   ↓
Question
```

Example conceptual config:

```json
{
  "id": "T2-MUL-07",
  "order": 18,
  "tier": 2,
  "title": "Perkalian ×7",
  "generator": "multiplication",
  "rules": {
    "fixedOperand": 7,
    "otherOperandMin": 2,
    "otherOperandMax": 12
  },
  "questionCount": 12,
  "timeLimitSec": 35
}
```

### 9.2 Stable Level Identity

Required fields:

| Field | Purpose |
|---|---|
| `id` | Stable string identity, tidak berubah |
| `order` | Urutan campaign |
| `tier` | Tier 1–6 |
| `generator` | Generator strategy |
| `rules` | Generator parameters |
| `questionCount` | Jumlah soal |
| `timeLimitSec` | Time target |
| `boss` | Boolean |
| `contentVersion` | Migration/content version |

Tidak boleh menggunakan `id + 1` untuk navigasi. Next level ditentukan berdasarkan `order` atau campaign registry.

### 9.3 Generator Registry

Target generator categories minimal:

```text
addition
subtraction
multiplication
division
missing_operand
chain_operations
bodmas
signed_number
algebra
square
square_root
percentage
fraction
ratio
mixed
boss_mix
```

---

## 10. Math Correctness Requirements

Math correctness adalah P0.

Setiap generator wajib memenuhi invariant sesuai jenisnya.

| Rule | Requirement |
|---|---|
| Division | Tidak boleh divide by zero |
| Clean division | Harus menghasilkan integer jika level mensyaratkan integer |
| Missing operand | Harus mempunyai satu solusi yang jelas |
| Negative | Hanya muncul jika level mengizinkan |
| Fraction | Penyebut tidak nol dan output sesuai format level |
| Square root | Campaign basic hanya menggunakan perfect square |
| BODMAS | Evaluasi harus mengikuti precedence yang benar |
| Range | Operand selalu berada di rule range |
| Answer | `correctAnswer` selalu konsisten dengan prompt |
| Duplicate | Regular session tidak menghasilkan prompt identik kecuali explicitly allowed |

### 10.1 Automated Generator Test

Tambahkan unit test framework dan test generator dalam skala besar.

Acceptance target:

```text
100,000+ generated questions / CI run or sampled property suite
0 divide-by-zero
0 malformed expressions
0 invalid unique-solution questions
0 wrong correctAnswer
0 illegal operand-range output
```

Test harus deterministic melalui injectable seed/PRNG pada test environment.

---

# 11. Progress Migration V1 → V2

V1 menggunakan numeric campaign progress. V2 menggunakan stable level ID.

## 11.1 Migration principles

Tidak boleh menghapus achievement, stars, best score, best time, atau completed history user secara diam-diam.

Mapping V1 existing level ke V2 dilakukan berdasarkan semantic skill, bukan semata numeric position.

Recommended behavior:

```text
Existing completed V1 level
   ↓
Map ke closest V2 equivalent
   ↓
Preserve stars/best score/best time
   ↓
Unlock prerequisite chain sampai mapped level
   ↓
Mark migratedFromVersion = 1
```

Contoh:

```text
V1 Lv1 Penjumlahan 1–10
→ V2 T1-ADD-01

V1 Lv5 Perkalian Dasar (2,3,5)
→ preserve evidence pada subskill ×2, ×3, ×5
→ campaign unlock tidak harus memberi full mastery pada level ×4 dst.
```

Migration harus idempotent: menjalankan migration dua kali tidak menggandakan progress atau mereset data.

---

# 12. Result Screen V2

Existing review history dipertahankan dan diperluas.

Result screen minimum menunjukkan:

| Metric | Required |
|---|---|
| Score | Yes |
| Stars | Campaign/Boss |
| Accuracy | Yes |
| Correct / Wrong | Yes |
| Total Time | Yes |
| Avg Answer Time | Yes |
| Fastest Answer | New |
| Questions Per Minute | Yes |
| Max Combo | Yes |
| Personal Best | Yes |
| Mastery change | New |
| Weak skill detected | New |

Primary actions:

```text
MAIN LAGI
LEVEL BERIKUT
LATIH KESALAHAN SAYA
KEMBALI
```

`LATIH KESALAHAN SAYA` hanya tampil jika sesi memiliki jawaban salah yang dapat diremediasi.

---

# 13. Latih Kesalahan Saya

## 13.1 Objective

Mengubah review pasif menjadi remediation loop.

Jika user salah `7 × 8`, sistem tidak sekadar mengulang soal yang sama. Sistem mengidentifikasi sub-skill `multiplication.x7/x8` dan membangun practice set yang relevan.

Example generated remediation:

```text
7 × 6
7 × 9
8 × 7
56 ÷ 7
? × 8 = 56
```

## 13.2 Rules

| Requirement | Rule |
|---|---|
| Minimum errors | ≥1 |
| Session size | 5–15 tergantung error set |
| Exact duplicate | Maksimal sebagian kecil untuk recall |
| Similar variants | Mayoritas sesi |
| Difficulty | Tidak lebih tinggi secara signifikan dari failed question |
| Completion | Update mastery, bukan campaign stars |

---

# 14. Adaptive Practice V2

Existing Time Attack adaptive logic berdasarkan score dan streak dipertahankan sebagai referensi tetapi tidak cukup untuk personalized training.

V2 adaptive practice memilih pertanyaan berdasarkan:

```text
Mastery rendah
+ Recent errors
+ Response time lambat
+ Skill yang jarang dilatih
+ Player current difficulty ceiling
```

Recommended question distribution:

```text
50% weak skills
25% medium skills
15% recently failed variants
10% strong-skill maintenance
```

Distribusi dapat dikalibrasi melalui analytics.

### 14.1 Adaptive guardrails

Adaptive mode tidak boleh:

- menaikkan difficulty setelah satu jawaban benar saja;
- terus menerus memberi skill yang sama sampai monoton;
- memberi advanced skill yang prerequisite-nya belum dikuasai;
- menghukum response lambat pada sesi accessibility mode;
- mencampur competitive leaderboard score dengan adaptive practice score.

---

# 15. Game Modes V2

## 15.1 Campaign

72 level progression, stars, boss, mastery.

## 15.2 Tantangan Harian

Deterministic daily challenge tetap dipertahankan sehingga seluruh pemain mendapat puzzle harian yang sama.

V2 requirements:

| Requirement | Rule |
|---|---|
| Daily seed | Tanggal + content version |
| Questions | 10 |
| Same puzzle | Ya, untuk semua pemain pada daily version yang sama |
| Score | Standardized |
| Attempts | First score + optional replay policy yang jelas |
| Leaderboard | Real player records |
| Simulated players | Tidak ditampilkan sebagai pemain nyata |
| Daily streak | Dipertahankan |

Content version harus menjadi bagian seed untuk mencegah perubahan generator diam-diam mengubah challenge yang sama pada tanggal yang sama.

## 15.3 Sprint 60s

Mode kompetitif fixed-duration.

```text
Duration: exactly 60 seconds
Correct: score, no time addition
Wrong: combo reset and/or score penalty
Difficulty: standardized progression
Leaderboard: eligible
```

Score multiplier harus mempunyai cap agar leaderboard tetap stabil.

Recommended combo cap: **3.0× max**.

## 15.4 Survival Kilat

Mekanik existing yang memberi waktu saat benar dan mengurangi waktu saat salah dipindahkan menjadi Survival.

```text
Starting Time: 60s
Correct: +2s, max timer 60s
Wrong: -4s
Difficulty: adaptive upward
End: timer reaches 0
```

Survival memiliki leaderboard terpisah dari Sprint 60s.

## 15.5 Latihan Bebas

Dipertahankan dan diperluas agar user dapat memilih:

```text
Skill
Sub-skill
Difficulty
Jumlah soal
Timer on/off
```

Practice tidak memengaruhi competitive leaderboard.

---

# 16. Competitive Integrity dan Leaderboard

## 16.1 Problem

Score leaderboard saat ini dapat ditulis oleh authenticated client ke document miliknya sendiri. Untuk production competition, ownership validation saja belum cukup membuktikan bahwa score berasal dari permainan yang sah.

## 16.2 V2 Requirement

Competitive score harus tervalidasi server-side atau melalui trusted validation layer.

Recommended architecture:

```text
Client
  ↓ Start session
Trusted backend / Cloud Function
  ↓ sessionId + seed + rulesVersion
Client gameplay
  ↓ answers + timing evidence
Trusted validator
  ↓ verify
Leaderboard write
```

Client tidak boleh menjadi authority final untuk score kompetitif.

### 16.2.1 Minimum validation

| Field | Validation |
|---|---|
| User | Authenticated UID |
| Mode | Allowed competitive mode |
| Session | Valid / unused |
| Rules version | Known server version |
| Score | Recomputed atau bounded |
| Accuracy | Recomputed dari answers |
| Solved count | Recomputed |
| Duration | Within expected limits |
| Timestamp | Server timestamp |

### 16.3 Leaderboard categories

```text
Sprint 60s — Daily / Weekly / All Time
Survival — Daily / Weekly / All Time
Daily Challenge — Per Date
```

1v1 dan tournament belum termasuk V2.

---

# 17. Achievement V2

Existing achievement system dipertahankan. Star-related achievements harus disesuaikan karena total stars berubah dari 72 menjadi 216.

Recommended milestone:

| Achievement | Threshold |
|---|---:|
| Pengumpul Bintang | 15★ |
| Bintang Terang | 40★ |
| Veteran | 72★ |
| Master Kampanye | 144★ |
| Mahkota Sempurna | 216★ |

Tambahan achievement dapat berasal dari mastery, Boss, perfect run, Daily streak, Sprint, dan Survival tanpa memengaruhi campaign unlock.

---

# 18. Statistics & Skill Heatmap

Stats V2 harus menjawab tiga pertanyaan pemain:

```text
Seberapa cepat saya?
Seberapa akurat saya?
Skill mana yang paling lemah/kuat?
```

### 18.1 Global profile metrics

```text
Total Questions
Total Correct
Accuracy
Total Time Played
Highest SPM
Fastest Answer
Best Combo
Campaign Stars / 216
Campaign Completion
Daily Streak
Sprint High Score
Survival High Score
```

### 18.2 Skill heatmap example

| Skill | Accuracy | Avg Speed | Mastery |
|---|---:|---:|---:|
| Addition | 97% | 1.2s | 95 |
| Subtraction | 91% | 1.6s | 87 |
| Multiplication | 82% | 2.0s | 74 |
| Division | 69% | 2.6s | 61 |
| BODMAS | 78% | 3.2s | 70 |
| Algebra | 72% | 3.8s | 64 |

Multiplication drill-down dapat menunjukkan ×2 sampai ×9 agar weak sub-skill seperti ×7/×8 terlihat jelas.

---

# 19. UX/UI Requirements

Visual identity purple/pink/orange existing dipertahankan.

### 19.1 Level card states

| State | Visual Requirement |
|---|---|
| Completed | Stars/check jelas |
| Current | Pink glow/highlight |
| Available | Normal purple |
| Locked | Dim tetapi title tetap readable |
| Boss | Special border/icon/crown |

Locked card tidak boleh terlalu redup sehingga nama dan requirement unlock sulit dibaca.

### 19.2 Tier layout

12 level per tier harus tetap nyaman pada desktop dan responsive pada mobile. Grid boleh menggunakan 3 kolom desktop, 2 tablet, 1 mobile.

### 19.3 Dynamic content count

Tidak boleh hard-code display `24 level` atau max star. UI menggunakan campaign registry:

```text
totalLevels = levels.length
maxStars = levels.length × 3
```

### 19.4 Accessibility

Minimum V2:

```text
Keyboard support
Focus visible
Sufficient text contrast
Reduced motion support where feasible
Sound can be muted
Important correctness feedback not sound-only
Touch targets mobile-friendly
```

---

# 20. Data Model V2 — Conceptual

## 20.1 LevelConfig

```text
id: string
order: number
tier: 1..6
title: string
description: string
generator: string
rules: object
questionCount: number
timeLimitSec: number
boss: boolean
contentVersion: number
```

## 20.2 UserLevelProgress

```text
levelId: string
stars: 0..3
bestScore: number
bestTimeSec: number
bestAccuracy: number
completedAt?: timestamp
perfect: boolean
contentVersion: number
```

Unlock state idealnya dapat diturunkan dari progression, tetapi bila disimpan harus tetap konsisten dengan prerequisite graph.

## 20.3 SkillMastery

```text
skillId: string
subSkillId?: string
masteryScore: 0..100
attempts: number
correct: number
avgResponseTimeMs: number
recentAccuracy: number
lastPracticedAt: timestamp
```

## 20.4 AnswerEvent

```text
sessionId
userId?
mode
levelId?
questionId
skillId
subSkillId
difficulty
isCorrect
responseTimeMs
createdAt
```

Raw answer history retention harus dibatasi sesuai kebutuhan privacy/storage. Aggregated mastery dapat disimpan lebih lama daripada raw detailed events.

## 20.5 CompetitiveSession

```text
sessionId
userId
mode
seed
rulesVersion
startedAt
expiresAt
status
validatedScore
completedAt
```

---

# 21. Analytics dan Product Telemetry

V2 membutuhkan telemetry agar balancing tidak berdasarkan tebakan.

Recommended events:

```text
session_started
session_completed
question_answered
level_started
level_completed
level_failed
level_replayed
boss_started
boss_completed
star_improved
perfect_earned
mistake_training_started
mistake_training_completed
adaptive_session_started
weak_skill_detected
daily_started
daily_completed
sprint_completed
survival_completed
leaderboard_submitted
leaderboard_rejected
```

Recommended properties:

```text
mode
levelId
tier
skillId
subSkillId
difficulty
accuracy
duration
score
stars
masteryBefore
masteryAfter
appVersion
contentVersion
```

Do not send answer-event data containing unnecessary personal information.

---

# 22. Success Metrics

Initial V2 product metrics:

| Metric | Desired Direction |
|---|---|
| Campaign Lv1 → Lv12 completion | Increase |
| Tier-to-tier conversion | Increase |
| Replay rate after 1–2 stars | Increase |
| Mistake Training usage | Measurable adoption |
| Weak skill mastery improvement | Positive over repeated sessions |
| Daily challenge repeat days | Increase |
| D7 returning player rate | Increase |
| Average sessions/player/week | Increase |
| Generator correctness incidents | 0 |
| Invalid competitive leaderboard submissions | Detect/reject |

Numeric targets sebaiknya ditetapkan setelah V1 baseline telemetry tersedia agar target tidak arbitrer.

---

# 23. Performance Requirements

| Requirement | Target |
|---|---|
| Initial app interaction | Tidak terasa lebih lambat dari V1 |
| Question transition | Near-instant, no network dependency |
| Campaign question generation | Client-side/local generation permitted |
| Competitive validation | Async/network tolerant after session |
| Offline campaign/practice | Tetap dapat berjalan bila memungkinkan |
| Sync | Conflict-safe dan non-destructive |
| 72-level config | Tidak meningkatkan initial bundle secara signifikan |

Question generation tidak boleh membutuhkan network call per question.

---

# 24. Security Requirements

| Area | Requirement |
|---|---|
| Auth | Firebase authenticated identity untuk cloud/competitive features |
| User progress | User hanya dapat menulis datanya sendiri |
| Leaderboard | Client tidak final-authoritative |
| Server timestamp | Gunakan trusted timestamp untuk competitive result |
| Replay abuse | Competitive session one-time/finalized |
| Input | Validate numeric answer dan payload |
| Firestore | Rules version-controlled dan tested |
| Secrets | Tidak ada privileged backend secret di client bundle |

Anonymous play tetap diperbolehkan untuk campaign lokal; submission ke leaderboard dapat mensyaratkan account tergantung final policy.

---

# 25. Testing Strategy

## 25.1 Unit Tests

Priority:

```text
Question generator
Score calculation
Star calculation
Mastery calculation
Progress migration
Daily seed determinism
Adaptive selector
Leaderboard validation helpers
```

## 25.2 Property/Invariant Tests

Generate banyak kombinasi pertanyaan dan validate mathematical properties.

## 25.3 Component Tests

```text
Level card states
Result screen
Boss card
Mastery heatmap
Mistake training CTA
Sprint / Survival HUD
```

## 25.4 E2E

Critical scenarios:

```text
New player → complete Lv1 → unlock next
Fail level → next remains locked
Earn higher stars → best progress updates
V1 stored progress → V2 migration
Complete Boss → next tier unlocked
Wrong answers → mistake training generated
Daily puzzle same seed on same date
Sprint ends exactly at fixed duration
Survival time reward/penalty works
Unauthorized leaderboard mutation rejected
Cloud sync does not overwrite newer progress incorrectly
```

Recommended stack: Vitest for unit/component-compatible testing and Playwright for browser E2E.

---

# 26. Acceptance Criteria per Epic

## E1 — Engine Refactor

```text
AC-E1-01: Level behavior tidak bergantung pada numeric level ID.
AC-E1-02: 72 level dapat didaftarkan sebagai configuration.
AC-E1-03: Next level menggunakan campaign order/registry.
AC-E1-04: Total level dan max stars dynamic.
AC-E1-05: Existing 24-level behavior tetap functionally valid sebelum migration.
```

## E2 — Progress Migration

```text
AC-E2-01: Existing V1 progress tetap tersedia setelah upgrade.
AC-E2-02: Migration idempotent.
AC-E2-03: No regression pada best score/time/stars mapped level.
AC-E2-04: Fresh user dimulai dari T1-L1 saja.
```

## E3 — 72 Level Campaign

```text
AC-E3-01: 6 tier × 12 level tersedia.
AC-E3-02: Boss berada pada 12/24/36/48/60/72.
AC-E3-03: Semua level menghasilkan valid questions.
AC-E3-04: Difficulty progression tidak mempunyai major unintended spike.
```

## E4 — Mastery

```text
AC-E4-01: Setiap eligible answer memperbarui skill statistics.
AC-E4-02: Player dapat melihat mastery per major skill.
AC-E4-03: Weakest skill dapat diidentifikasi.
AC-E4-04: Mastery tidak naik hanya karena repeated incorrect attempts.
```

## E5 — Mistake Training

```text
AC-E5-01: Result dengan error menyediakan Latih Kesalahan Saya.
AC-E5-02: Generated remediation relevan dengan failed sub-skill.
AC-E5-03: Remediation result memperbarui mastery.
AC-E5-04: Practice tidak mengubah campaign stars secara langsung.
```

## E6 — Adaptive Practice V2

```text
AC-E6-01: Weak skills memiliki selection weight lebih besar.
AC-E6-02: Strong skills tetap muncul sebagai maintenance.
AC-E6-03: Difficulty dibatasi prerequisite/current ability.
AC-E6-04: Session tetap mempunyai skill variety.
```

## E7 — Sprint & Survival

```text
AC-E7-01: Sprint berakhir pada fixed 60s tanpa time bonus.
AC-E7-02: Survival menggunakan +2s/-4s atau balancing final equivalent.
AC-E7-03: Kedua mode mempunyai leaderboard terpisah.
AC-E7-04: Combo multiplier mempunyai configured cap.
```

## E8 — Competitive Security

```text
AC-E8-01: Production leaderboard submission tervalidasi trusted layer.
AC-E8-02: Score/accuracy/solvedCount tidak dipercaya langsung dari client.
AC-E8-03: Invalid session ditolak.
AC-E8-04: Daily simulated benchmark tidak ditampilkan sebagai pemain nyata.
```

## E9 — Testing

```text
AC-E9-01: Math generator unit/invariant tests tersedia di CI.
AC-E9-02: Migration tests tersedia.
AC-E9-03: Daily deterministic tests tersedia.
AC-E9-04: Critical gameplay E2E tersedia.
```

---

# 27. Delivery Plan

## Phase V2.0-A — Foundation

**Scope:** engine refactor, stable IDs, dynamic campaign metadata, tests, migration framework.

Exit criteria: current V1 game behavior lulus regression test menggunakan engine baru.

## Phase V2.0-B — Campaign Expansion

**Scope:** 72 level, six Boss levels, revised stars/achievements, balancing.

Exit criteria: seluruh level playable dan generator invariant suite lulus.

## Phase V2.1 — Learning Intelligence

**Scope:** skill taxonomy, mastery, heatmap, weak-skill detection, mistake training.

Exit criteria: player dapat melihat kelemahan dan menjalankan remediation.

## Phase V2.2 — Adaptive Practice

**Scope:** skill-aware adaptive selector, personalized drill distribution.

Exit criteria: adaptive practice menggunakan mastery dan recent errors.

## Phase V2.3 — Competitive Modes

**Scope:** fixed Sprint 60s, Survival, real Daily leaderboard, secure validation.

Exit criteria: leaderboard production mempunyai trusted validation path.

## Phase V2.4 — Polish & Balance

**Scope:** telemetry-driven balancing, accessibility polish, performance, content tuning.

Exit criteria: release candidate siap public rollout.

---

# 28. Priority Matrix

| Priority | Item |
|---|---|
| P0 | Level/question engine refactor |
| P0 | Stable level IDs + migration |
| P0 | Math generator automated tests |
| P0 | Competitive validation design |
| P1 | Campaign 72 levels |
| P1 | Boss system |
| P1 | Skill mastery |
| P1 | Mistake training |
| P1 | Adaptive Practice V2 |
| P1 | Real Daily leaderboard |
| P2 | Fixed Sprint 60s |
| P2 | Survival Kilat |
| P2 | Skill heatmap polish |
| P2 | Achievement rebalance |
| P3 | XP/player meta-level if later proven useful |
| V3 | 1v1, tournament, clan/social |

---

# 29. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 72 levels terasa repetitif | Retention turun | Sub-skill progression + Boss + different generators |
| Difficulty spike | Player churn | Telemetry, playtest, calibrated ranges |
| Migration merusak progress | Trust loss | Versioned/idempotent migration + backup/local fallback |
| Generator menghasilkan soal salah | Product credibility | Property/invariant tests |
| Leaderboard cheating | Competitive mode kehilangan nilai | Trusted validation layer |
| Mastery terlalu rumit | User bingung | UI cukup tampil 0–100 + weak/strong labels |
| Over-gamification | Learning value hilang | Campaign unlock based on competence, not XP grind |
| Scope V2 terlalu besar | Delivery melambat | Release bertahap V2.0–V2.4 |

---

# 30. Definition of Done V2

Hitung Kilat dapat disebut V2 complete jika:

```text
72 campaign levels tersedia.
6 Boss levels tersedia.
Level engine tidak bergantung pada numeric ID behavior.
V1 progress dapat dimigrasi.
Math generator mempunyai automated correctness tests.
Campaign stars maksimal 216 dan achievement sudah rebalance.
Skill mastery dan weak-skill detection tersedia.
Latih Kesalahan Saya tersedia.
Adaptive Practice menggunakan skill performance.
Sprint 60s benar-benar fixed 60 seconds.
Survival menjadi mode tersendiri.
Daily leaderboard tidak menyamar sebagai global real users melalui bot benchmark.
Competitive leaderboard mempunyai trusted validation.
UI responsive dan visual identity existing tetap terjaga.
Critical E2E dan regression tests lulus.
```

---

# 31. Recommended Engineering Workstreams

Untuk mengurangi risiko, implementation sebaiknya dibagi menjadi workstream terpisah tetapi menggunakan model domain bersama:

```text
A. Content & Level Engine
B. Progress & Migration
C. Mastery & Adaptive Learning
D. Competitive Backend / Firebase
E. UI/UX Campaign & Statistics
F. Automated Testing / QA
G. Analytics & Balancing
```

Urutan dependency utama:

```text
Engine Refactor
   ↓
Migration + Tests
   ↓
72-Level Campaign
   ↓
Mastery
   ↓
Mistake Training
   ↓
Adaptive V2
   ↓
Competitive V2
   ↓
Balance & Release
```

---

# 32. Repository-Specific Change Map

Dokumen ini bukan implementation plan, tetapi area source existing yang kemungkinan terdampak dapat dipetakan sebagai berikut:

| Existing Area | V2 Impact |
|---|---|
| `src/utils/mathGenerator.ts` | Major refactor menjadi generator registry + level configs |
| `src/types.ts` | Stable IDs, rule types, mastery types, new game modes |
| `src/App.tsx` | Dynamic progression, migration, mode navigation |
| `src/components/LevelMap.tsx` | 72-level rendering, Boss visual, dynamic counts |
| `src/components/PlayScreen.tsx` | Skill metadata, mastery events, Boss rules |
| `src/components/ResultModal.tsx` | Mastery delta + mistake training CTA |
| `src/components/TimeAttackScreen.tsx` | Split Sprint/Survival behavior |
| `src/utils/dailyChallenge.ts` | Versioned seed + real leaderboard integration |
| `src/lib/firebase.ts` | Mastery sync + secure leaderboard workflow |
| `firestore.rules` | Updated data validation/ownership rules |
| `package.json` | Test scripts/tooling |

Final implementation plan harus dibuat setelah design/PRD ini disetujui agar perubahan dapat dilakukan bertahap tanpa big-bang rewrite.

---

# 33. Product Decision Summary

| Decision | V2 Choice |
|---|---|
| Number of tiers | Tetap 6 |
| Campaign levels | 72 |
| Levels per tier | 12 |
| Boss frequency | Setiap akhir tier |
| Visual identity | Pertahankan |
| Next level unlock | Minimum 1★ |
| Total max stars | 216★ |
| Primary learning metric | Skill mastery |
| Remediation | Similar-question mistake training |
| Adaptive logic | Skill-aware |
| Daily puzzle | Deterministic + versioned |
| Sprint | Fixed 60s |
| Existing +time mechanic | Dipindahkan ke Survival |
| Multiplayer | V3 |
| Leaderboard authority | Trusted validation/server-side |
| Generator architecture | Rule-driven registry |
| Testing | P0 requirement |

---

## 34. Closing Product Statement

V2 tidak bertujuan membuat Hitung Kilat mempunyai sebanyak mungkin fitur. V2 bertujuan memperkuat tiga hal yang menjadi inti produk:

**Content depth:** 72-level progression yang terasa bertahap dan bermakna.  
**Learning intelligence:** pemain mengetahui kelemahan dan mendapat latihan yang relevan.  
**Competitive integrity:** score dan ranking mempunyai arti karena rules jelas dan hasil dapat dipercaya.

Dengan fondasi tersebut, fitur sosial seperti 1v1, tournament, classroom, atau teacher dashboard dapat dikembangkan pada V3 tanpa harus merombak core game lagi.

---

## Appendix A — V1 Source Findings Used for This PRD

Baseline review dilakukan terhadap source existing, terutama:

```text
src/utils/mathGenerator.ts
src/types.ts
src/App.tsx
src/components/TimeAttackScreen.tsx
src/components/ResultModal.tsx
src/utils/dailyChallenge.ts
src/lib/firebase.ts
firestore.rules
package.json
```

Temuan baseline yang secara langsung memengaruhi requirement V2:

```text
- Campaign existing = 24 levels / 6 tiers.
- LevelConfig existing memakai numeric id.
- Question generator mempunyai beberapa level-specific conditional berdasarkan config.id.
- App progression masih mempunyai hard-coded upper bound 24.
- Daily Challenge sudah deterministic berdasarkan date seed.
- Daily ranking existing mempunyai deterministic simulated benchmark players.
- Time Attack difficulty sudah naik berdasarkan score dan streak.
- Time Attack existing memberi +2s pada jawaban benar dan -4s pada jawaban salah.
- Firestore leaderboard write existing memvalidasi owner UID tetapi score masih berasal dari client.
- package scripts belum mempunyai automated test command.
```

