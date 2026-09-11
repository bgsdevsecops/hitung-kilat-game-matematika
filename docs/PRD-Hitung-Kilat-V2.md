# PRODUCT REQUIREMENTS DOCUMENT — HITUNG KILAT V2

| Metadata | Nilai |
|---|---|
| Dokumen | PRD-Hitung-Kilat-V2 |
| Versi produk | 2.x |
| Revisi dokumen | 2.1 |
| Tanggal | 11 September 2026 |
| Status | Review Candidate |
| Produk | Hitung Kilat — Speed Math / Mental Math Training Game |
| Baseline | Repository `bgsdevsecops/hitung-kilat-game-matematika` branch `main` |
| Pemilik keputusan | Product Owner |
| Pemberi persetujuan | Product, Engineering, Design, QA, dan Operations |
| Zona waktu produk | Asia/Jakarta (WIB, UTC+7) |

---

## 0. Cara Membaca Dokumen

Dokumen ini adalah **satu-satunya PRD normatif untuk keseluruhan Hitung Kilat V2**. V2 dikirim melalui milestone internal V2.0-A sampai V2.4, tetapi seluruh Definition of Done pada dokumen ini wajib terpenuhi sebelum status produk dinyatakan **V2 General Availability (V2 GA)**.

Kata kunci requirement digunakan secara konsisten:

| Kata | Arti |
|---|---|
| **WAJIB** | Release gate; tidak dapat dihapus tanpa revisi PRD dan persetujuan lintas fungsi |
| **TIDAK BOLEH** | Larangan produk/teknis yang menjadi acceptance criterion |
| **DAPAT** | Pilihan implementasi yang tidak mengubah outcome produk |
| **PASCA-V2** | Bukan bagian dari Definition of Done V2 GA |

Jika contoh, appendix, dan requirement utama bertentangan, requirement utama dan Product Decision Register menjadi sumber kebenaran. Angka balancing hanya dapat berubah melalui konfigurasi versioned dan eksperimen terkontrol yang mempunyai owner, hypothesis, guardrail, rollback, serta `contentVersion` atau `rulesVersion` baru. Perubahan tidak boleh mencampur hasil dari rules berbeda pada leaderboard yang sama atau melonggarkan release gate tanpa revisi PRD.

### 0.1 Release boundary

```text
V2.0-A  Foundation
V2.0-B  Campaign Expansion
V2.1    Learning Intelligence
V2.2    Adaptive Practice
V2.3    Competitive Modes
V2.4    Polish, Balance, and GA Rollout
```

Milestone bukan PRD atau produk terpisah. Fitur milestone yang belum aktif harus berada di balik feature flag dan tidak boleh mengubah data pengguna secara irreversibel.

### 0.2 Peta dokumen

| Bagian | Isi |
|---|---|
| §1–§7 | Konteks, masalah, tujuan, pengguna, journey, dan prinsip produk |
| §8–§19 | Campaign, learning loop, mode permainan, kompetisi, statistik, dan UX |
| §20–§25 | Privacy/safety, data contract, telemetry, target produk, NFR, dan security |
| §26–§31 | Quality gates, acceptance criteria, delivery, risiko, dan Definition of Done |
| Appendix A–H | Temuan V1, migration mapping, dependency, impact map, decision, referensi, glossary, dan riwayat |

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

V2 menyelesaikan terlebih dahulu cacat integritas pada baseline V1—final-answer undercount, duplicate submission, timer drift, partial reset, dan score leaderboard yang dipercaya dari client—sebelum menambahkan progression atau kompetisi baru. Ekspansi konten tidak dianggap selesai bila hasil permainan belum akurat, dapat dimigrasi, dapat diuji, dan aman untuk pemain muda.

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

### 3.2 Product problem statement

V1 telah membuktikan core loop menjawab soal cepat, tetapi belum memberi jalur yang konsisten dari **bermain → memahami kelemahan → berlatih terarah → membuktikan peningkatan**. Progress berorientasi level, sementara pemain belum dapat melihat skill mana yang lemah. Mode kompetitif juga belum mempunyai aturan dan authority yang cukup kuat agar ranking dipercaya.

V2 memecahkan empat masalah:

1. **Depth:** 24 level terlalu sempit untuk progression jangka menengah.
2. **Learning feedback:** score dan stars belum menjelaskan skill yang harus dilatih berikutnya.
3. **Integrity:** beberapa race/timer/statistics path V1 dapat menghasilkan summary yang tidak akurat, sedangkan leaderboard mempercayai client.
4. **Scalability:** level identity, generator, sync, dan storage belum aman untuk content growth serta multi-device use.

### 3.3 Evidence dan hypotheses

Karena V1 belum mempunyai telemetry produk yang memadai, klaim retensi dan efektivitas belajar V2 diperlakukan sebagai hypothesis, bukan fakta. Milestone Foundation WAJIB merekam baseline V1-compatible untuk funnel, duration, completion, error, dan repeat usage sebelum target improvement dinilai.

Hypothesis utama:

| ID | Hypothesis | Sinyal validasi |
|---|---|---|
| H-01 | Progress 72 level yang bertahap meningkatkan kelanjutan antartier | Tier conversion dan campaign progression meningkat tanpa kenaikan fail/exit rate berlebihan |
| H-02 | Mistake Training meningkatkan kemampuan pada sub-skill yang sama | Accuracy atau response time sub-skill membaik setelah remediation |
| H-03 | Mastery membuat pemain memilih sesi yang lebih relevan | Penggunaan rekomendasi weak-skill dan repeat training meningkat |
| H-04 | Daily dan ranked modes yang fair meningkatkan return behavior | D7 return dan valid competitive participation meningkat |
| H-05 | Sesi 3–10 menit cocok untuk kebiasaan latihan | Completion rate tinggi dan median session duration tetap dalam rentang sasaran |

Setiap hypothesis dievaluasi pada cohort yang memenuhi syarat dan tidak boleh mengorbankan correctness, accessibility, privacy, atau leaderboard integrity.

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
| G-11 | Core integrity | Setiap jawaban, timer, score, dan finalization dihitung tepat satu kali |
| G-12 | Safe operation | V2 dapat dirilis, dimonitor, dimigrasi, dan di-rollback tanpa kehilangan data |
| G-13 | Inclusive experience | Critical journeys memenuhi accessibility gate dan tidak mengekspos identitas pemain secara default |

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
| Chat, direct message, atau user-generated social feed | Tidak diperlukan dan menambah risiko moderasi pemain muda |
| Iklan tertarget dan monetisasi berbayar | Tidak termasuk V2 |
| Native mobile application | V2 tetap responsive web/PWA-compatible; native app adalah PASCA-V2 |

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

### 6.2 Jobs to Be Done

**Primary job:** ketika memiliki waktu 3–10 menit, pemain ingin melatih satu kemampuan hitung mental, memahami kesalahannya, dan melihat bukti kemajuan tanpa merasa sedang mengikuti ujian.

**Secondary job:** ketika memilih mode kompetitif, pemain ingin membandingkan hasil pada soal, waktu, scoring, dan eligibility rules yang setara.

**Safety job:** pemain atau wali ingin mengetahui data apa yang disimpan, menghindari paparan identitas publik secara tidak sengaja, serta dapat menghapus data cloud dengan jelas.

### 6.3 Primary journeys

| Journey | Entry | Success state | Next best action | Failure/offline state |
|---|---|---|---|---|
| New player | Home tanpa akun | Menyelesaikan Level 1 | Level berikutnya atau review kesalahan | Campaign tetap dapat dimainkan lokal |
| Campaign progression | Level tersedia | Summary akurat, stars/mastery tersimpan, next level dihitung registry | Next level, replay, atau remediation | Timeout menghasilkan attempt gagal yang tetap dapat direview |
| Mistake Training | Result mempunyai ≥1 kesalahan eligible | Set relevan selesai dan mastery diperbarui | Kembali ke level atau adaptive practice | Tetap tersedia offline dari session history lokal |
| Adaptive Practice | Ada cukup mastery evidence atau cold start | Sesi bervariasi sesuai kemampuan | Rekomendasi sesi berikutnya | Cold start memakai diagnostic mix yang deterministik |
| Daily Challenge | Daily hub | Satu-satunya ranked session hari itu berstatus `VALIDATED` | Lihat ranking atau replay practice | Ranked membutuhkan koneksi; session gagal tetap mengonsumsi slot; practice copy dapat dimainkan lokal |
| Sprint/Survival | Competitive hub dan user login | Result berstatus `VALIDATED` dan masuk leaderboard | Replay atau lihat ranking | Result tampil `PENDING`; retry idempotent; `REJECTED` menjelaskan alasan umum |
| Account sync | Local player memilih login | Merge selesai tanpa kehilangan progress | Lanjut bermain lintas perangkat | Outbox tetap lokal dan retry dengan backoff |
| Delete/reset | Settings dengan konfirmasi eksplisit | Scope reset/delete jelas dan receipt lokal/cloud tersedia | Mulai ulang atau logout | Tidak boleh diam-diam direhidrasi dari cloud lama |

### 6.4 Research and validation requirement

Sebelum V2 GA, minimal dua putaran usability test dilakukan pada critical journey dengan total sedikitnya 10 partisipan yang mencakup pemain muda dengan pendamping, pemain kasual, dan pemain kompetitif. Temuan severity tinggi pada comprehension, input, result, account consent, atau leaderboard eligibility WAJIB ditutup sebelum GA.

---

## 7. Product Principles

| Principle | Implementasi |
|---|---|
| Fast to start | Maksimal dua primary action dari home yang sudah termuat ke soal pertama |
| Short sessions | Campaign rata-rata 30–90 detik |
| Skill before grind | Unlock berasal dari penyelesaian skill, bukan farming XP |
| Accuracy matters | Speed tidak boleh mengalahkan accuracy sepenuhnya |
| Replay has purpose | Replay meningkatkan star, record, mastery, atau remediation |
| Fair competition | Mode leaderboard harus mempunyai rules yang sama untuk semua pemain |
| Explain mistakes | Setelah sesi, jawaban salah bisa dipahami dan dilatih ulang |
| Data driven content | Level baru tidak memerlukan conditional code berdasarkan ID |

---

## 8. Scope Utama V2

### 8.1 Campaign 72 Level

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

#### 8.1.1 T1 — Pemula: Number Sense dan Dasar +/−

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

#### 8.1.2 T2 — Menengah: Multiplication dan Division Mastery

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

#### 8.1.3 T3 — Terampil: Arithmetic Fluency

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

#### 8.1.4 T4 — Mahir: Multi Operation dan BODMAS

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

#### 8.1.5 T5 — Master: Negative dan Algebra

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

#### 8.1.6 T6 — Legenda: Advanced Mental Math

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

#### 8.1.7 Session defaults dan content-manifest gate

Seluruh level non-Boss memakai parameter awal berikut. Accuracy dibandingkan sebagai pecahan exact `correctCount / questionCount`, bukan persentase yang sudah dibulatkan.

| Tier | Questions | Target time 3★ | Hard deadline | Passing accuracy |
|---|---:|---:|---:|---:|
| T1 | 10 | 30s | 45s | 70% |
| T2 | 12 | 36s | 50s | 70% |
| T3 | 12 | 40s | 55s | 70% |
| T4 | 12 | 45s | 60s | 70% |
| T5 | 12 | 50s | 65s | 70% |
| T6 | 12 | 55s | 70s | 70% |

Level 1 tidak mempunyai prerequisite; setiap level reguler atau Boss lain memerlukan minimal 1★ pada level dengan `order` tepat sebelumnya. V2.0-B WAJIB menerbitkan satu immutable content manifest di repository yang memuat seluruh 72 `LevelConfig` sesuai §21.2, typed operand constraints, `AnswerSpec.kind`, template family, primary/supporting skill, dan parameter tabel di atas. Manifest tersebut adalah artifact konfigurasi turunan dari PRD ini, bukan PRD kedua. Build menolak manifest yang tidak lengkap atau menyimpang dari keputusan PRD; perubahan setelah publish memerlukan version baru dan recorded Product + Content approval.

---

### 8.2 Boss Level System

Boss Level tidak boleh hanya berupa level normal dengan jumlah soal lebih banyak.

#### Boss behavior

| Boss | Skill scope | Questions | Target | Deadline | 1★ | 2★ | 3★ |
|---|---|---:|---:|---:|---:|---:|---:|
| Lv12 Pemula | T1 | 15 | 36s | 45s | 70% | 85% | 95% + target |
| Lv24 Kali Bagi | T2 | 18 | 40s | 50s | 70% | 85% | 95% + target |
| Lv36 Terampil | T1–T3 | 18 | 48s | 60s | 75% | 85% | 95% + target |
| Lv48 BODMAS | T4 | 15 | 48s | 60s | 75% | 85% | 95% + target |
| Lv60 Master | T1–T5 | 20 | 60s | 75s | 80% | 90% | 95% + target |
| Lv72 Grandmaster | T1–T6 | 25 | 72s | 90s | 85% | 90% | 95% + target |

Boss card harus secara visual berbeda dari regular card dan mempunyai label `TIER BOSS` atau `GRANDMASTER`.

Boss unlock mengikuti progression normal. Boss completion membuka tier berikutnya. Lv72 menandai completion campaign V2.

#### 8.2.1 Boss attempt policy

- Ambang stars mengikuti tabel Boss dan dibandingkan dari `correctCount / questionCount` tanpa membulatkan accuracy display.
- 1★ atau 2★ diberikan hanya bila seluruh soal dijawab sebelum deadline dan ambang accuracy terkait tercapai.
- 3★ diberikan hanya bila seluruh soal dijawab, accuracy mencapai 95%, dan waktu selesai tidak melebihi target Boss.
- Perfect Badge diberikan untuk 100% accuracy yang memenuhi target waktu.
- Timeout sebelum semua soal terjawab menghasilkan 0★. Attempt tetap masuk review dan global learning statistics, tetapi tidak memperbarui best completion time.
- Penyelesaian Boss bersifat idempotent; event finalization ganda tidak boleh memberi unlock atau reward ganda.

---

### 8.3 Star dan Mastery Rules

#### 8.3.1 Level Stars

Campaign criteria:

| Rating | Rule |
|---|---|
| 0★ | Timeout, keluar sebelum selesai, atau accuracy di bawah ambang lulus |
| 1★ | Seluruh soal dijawab, accuracy ≥70%, dan selesai sebelum deadline |
| 2★ | Seluruh soal dijawab, accuracy ≥85%, dan selesai sebelum deadline |
| 3★ | Seluruh soal dijawab, accuracy ≥95%, dan memenuhi target time |
| Perfect Badge | Seluruh soal benar dan memenuhi target time |

**Unlock next level membutuhkan minimal 1★.**

Stars berfungsi untuk mastery/replay, bukan untuk memblokir pemain yang sudah cukup menguasai level.

Maximum campaign stars V2 = **216★**.

`deadline` adalah batas maksimum attempt. `targetTime` adalah batas lebih ketat untuk 3★ dan WAJIB tersedia pada setiap `LevelConfig`. Score tidak menentukan kelulusan atau stars; score hanya menjadi feedback replay dan personal record. Best score, best accuracy, dan best completion time diperbarui secara independen hanya oleh attempt yang valid, sedangkan total attempt/failure tetap direkam untuk learning analytics.

#### 8.3.2 Skill Mastery

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

Mastery scale:

| Mastery | Status |
|---:|---|
| 0–39 | Perlu Latihan |
| 40–59 | Berkembang |
| 60–79 | Cukup |
| 80–94 | Mahir |
| 95–100 | Dikuasai |

Mastery score tidak boleh dihitung hanya dari accuracy. Response time, consistency, dan recency harus diperhitungkan.

#### 8.3.3 Mastery algorithm V2.0

Mastery dihitung per `skillId` dan `subSkillId` dari maksimum 30 eligible answer terakhir dalam 90 hari. Answer lebih baru diberi exponential recency weight dengan half-life 30 hari. Setiap algorithm change WAJIB menggunakan `masteryAlgorithmVersion` baru dan tidak boleh mengubah historical display secara diam-diam.

```text
accuracyComponent    = recency-weighted correctness, 0..100
speedComponent       = recency-weighted response score terhadap targetResponseTimeMs
consistencyComponent = persentase dari maksimal 5 sesi terakhir dengan accuracy ≥80%

masteryScore = round(
  0.65 × accuracyComponent
  + 0.20 × speedComponent
  + 0.15 × consistencyComponent
)
```

Response score per answer adalah `clamp(0, 100, 100 × (2 - responseTimeMs / targetResponseTimeMs))`; jawaban salah selalu mempunyai response score 0. Pada accessibility/untimed practice, speed component dikeluarkan dan bobot dinormalisasi menjadi 80% accuracy serta 20% consistency.

`targetResponseTimeMs` berasal dari difficulty question dan disimpan bersama `AnswerEvent` agar recompute tidak bergantung pada config terbaru:

| Difficulty | Target response |
|---:|---:|
| 1 | 2.500 ms |
| 2 | 3.000 ms |
| 3 | 3.500 ms |
| 4 | 4.000 ms |
| 5 | 5.000 ms |
| 6 | 6.000 ms |

Untuk offline event, backend menetapkan `normalizedOccurredAt` satu kali pada first ingestion dengan nilai `createdAtClient` yang dibatasi ke rentang `receivedAtServer - 90 hari` sampai `receivedAtServer`; nilai hasil normalisasi lalu immutable. Reducer mengurutkan `(normalizedOccurredAt ASC, eventId ASC)`, memilih 30 event terbaru, dan menghitung recency terhadap waktu evaluasi yang di-pin. Upload retry/order tidak boleh mengubah event yang sudah dinormalisasi. `recentAccuracy` memakai maksimal 10 event terbaru dari urutan yang sama; consistency memakai maksimal 5 session terbaru yang masing-masing memiliki sedikitnya satu eligible event untuk skill tersebut.

Mastery tampil sebagai **Belum Cukup Data** sampai terdapat minimal 10 eligible answers dari sedikitnya 2 sesi. Weak skill adalah mastery <60 atau recent accuracy <70% setelah ambang sampel terpenuhi. Strong skill adalah mastery ≥80 dan recent accuracy ≥85%.

Soal multi-skill WAJIB memiliki `primarySkillId` dan `skillTags[]`. Primary skill menerima evidence weight 1, supporting skill menerima weight 0.5. Satu answer tetap dihitung satu kali pada global question statistics.

---

### 8.4 Skill Taxonomy

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

Semua ID taxonomy disimpan sebagai stable lowercase machine key, misalnya `multiplication.x7` dan `bodmas.parentheses`. Label terjemahan tidak menjadi identity. Taxonomy bersifat versioned, ID tidak boleh didaur ulang, dan skill deprecated tetap dapat dibaca untuk history serta migration.

---

## 9. Question Engine V2

### 9.1 Requirement

Question generation harus **rule-driven**, bukan numeric-level-driven.

#### Current anti-pattern to remove

```text
if config.id == 4 → behavior A
if config.id == 11 → behavior B
if config.id == 19 → behavior C
```

#### Target model

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
  "targetTimeSec": 36,
  "timeLimitSec": 50
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
| `timeLimitSec` | Hard deadline attempt |
| `boss` | Boolean |
| `contentVersion` | Migration/content version |
| `targetTimeSec` | Target untuk 3★; selalu ≤ `timeLimitSec` |
| `prerequisiteIds` | Stable IDs yang harus lulus sebelum level terbuka |
| `skillWeights` | Primary/supporting skill contribution untuk mastery |

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

### 9.4 Typed generator rules

`rules` TIDAK BOLEH menjadi blob bebas. Setiap `generator` mempunyai discriminated rule schema yang divalidasi saat build dan runtime content load. Registry WAJIB menolak generator key tidak dikenal, range terbalik, prerequisite tidak valid, duplicate stable ID/order, serta rule yang tidak mempunyai compatible answer type.

Campaign registry WAJIB memenuhi invariant berikut:

- `id` unik, immutable, dan tidak pernah didaur ulang;
- `order` unik tetapi dapat berubah melalui `contentVersion` baru;
- prerequisite graph acyclic dan seluruh reference tersedia atau dideklarasikan deprecated;
- setiap level dapat menghasilkan jumlah soal yang dikonfigurasi tanpa duplicate prompt dalam satu attempt;
- level deprecated tetap dapat dibaca pada history/migration tetapi tidak ditawarkan sebagai level baru.

### 9.5 Answer model dan input contract

`Question.correctAnswer: number` pada V1 diganti oleh `AnswerSpec` agar integer, pecahan, persentase/desimal, dan pilihan dapat divalidasi tanpa `parseInt`, binary floating-point comparison, atau string equality yang keliru.

```text
AnswerSpec =
  | IntegerAnswer  { kind, value }
  | RationalAnswer { kind, numerator, denominator, requireSimplified }
  | DecimalAnswer { kind, scaledValue, scale, acceptedTolerance }
  | ChoiceAnswer  { kind, optionId, options[] }

Question = {
  questionDefinitionId,
  questionInstanceId,
  promptModel,
  displayPrompt,
  answerSpec,
  primarySkillId,
  skillTags[],
  difficulty,
  generatorKey,
  generatorVersion,
  contentVersion,
  targetResponseTimeMs,
  templateFamily,
  explanationModel
}
```

Input rules:

| Answer kind | Accepted input |
|---|---|
| Integer | Digit dengan satu optional leading minus; whitespace dinormalisasi; exponent tidak diterima |
| Rational | `numerator/denominator`; denominator bukan nol; pecahan ekuivalen dibandingkan secara exact setelah normalisasi GCD |
| Decimal | Digit dengan satu separator `,` atau `.`; nilai dikonversi ke scaled integer; tolerance default 0 dan hanya dapat dibuka oleh rule eksplisit |
| Choice | Hanya `optionId` yang berasal dari question contract |

Level pecahan menerima jawaban ekuivalen seperti `3/4` dan `6/8`, kecuali level secara eksplisit menguji simplification melalui `requireSimplified: true`. Persentase WAJIB menghasilkan jawaban integer atau decimal berskala eksplisit. Prompt tidak pernah menjadi source of truth untuk evaluasi.

### 9.6 Determinism dan version contract

Generator menerima injected PRNG dan menghasilkan canonical question payload. Output yang sama WAJIB diperoleh dari kombinasi `seed + contentVersion + generatorVersion + rulesVersion` yang sama pada seluruh runtime yang didukung.

```text
questionDefinitionId = SHA-256(canonical question payload)
questionInstanceId   = SHA-256(sessionId + ":" + sequence)
```

`questionDefinitionId` dipakai untuk golden fixture dan duplicate-content detection. `questionInstanceId` dipakai untuk submission/idempotency dalam satu session. Keduanya tidak dapat saling menggantikan.

Campaign/practice dapat menghasilkan seed lokal. Daily dan competitive session memperoleh challenge/session contract dari trusted backend. Released content manifest bersifat immutable; perubahan konten selalu menaikkan version dan mempertahankan fixture version sebelumnya selama compatibility window.

### 9.7 Unified gameplay session contract

Semua mode menggunakan lifecycle yang sama:

```text
CREATED → ACTIVE → FINALIZING → COMPLETED | FAILED | ABANDONED
```

- Satu `sessionId` hanya dapat finalized satu kali.
- Satu `questionInstanceId` hanya menerima satu eligible `AnswerEvent`.
- Input dikunci sejak submit sampai feedback/transition selesai.
- Summary diturunkan dari immutable answer history/reducer, bukan membaca beberapa React state update yang belum committed.
- `questionsPresented`, `questionsAnswered`, `correctCount`, `wrongCount`, dan `unansweredCount` adalah field berbeda.
- Exit eksplisit menghasilkan `ABANDONED`. Timeout Campaign menghasilkan `FAILED`; deadline Daily/Sprint dan timer/cap Survival adalah natural end yang menghasilkan `COMPLETED`. Expiry karena protocol/connectivity failure menghasilkan `FAILED`. Tidak satu pun menghitung unanswered sebagai solved.

Competitive validation merupakan state orthogonal: `PENDING → VALIDATED | REJECTED`. Ia tidak membuat lifecycle kedua. `REJECTED` tidak mengubah immutable session terminal status, tetapi result tersebut tidak eligible untuk leaderboard, streak, achievement kompetitif, reward, atau mastery.

### 9.8 Timer semantics

Timer domain memakai monotonic clock dan absolute deadline. `setInterval` hanya menyegarkan display dan TIDAK menjadi sumber kebenaran durasi.

| Mode | Pause | Background tab | Deadline policy |
|---|---|---|---|
| Campaign | Diizinkan | Auto-pause setelah visibility event | Paused duration dikeluarkan dari level dan response time |
| Practice/remediation | Configurable | Auto-pause | Untimed atau active-time deadline |
| Daily ranked | Tidak diizinkan | Deadline terus berjalan | Server-issued deadline |
| Sprint ranked | Tidak diizinkan | Deadline terus berjalan | Tepat 60.000 ms dari server session start |
| Survival ranked | Tidak diizinkan | Timer terus berjalan | Monotonic timer dengan bounded reward/penalty tervalidasi |

Race antara final answer dan deadline diselesaikan tepat sekali oleh session reducer. Pada mode lokal, event dengan monotonic submit time ≤ deadline diterima. Pada mode ranked, backend menentukan eligibility dari server session window; result yang belum tervalidasi berstatus `PENDING`, bukan langsung masuk leaderboard.

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
| Answer | Canonical `AnswerSpec` dari expression/payload model selalu konsisten dengan display prompt |
| Duplicate | Regular session tidak menghasilkan prompt identik kecuali explicitly allowed |
| Parsing | Evaluasi memakai `AnswerSpec`, bukan `parseInt` atau float equality generik |
| Determinism | Seed dan seluruh version yang sama menghasilkan canonical payload yang sama |
| Expression safety | Generator/evaluator tidak menggunakan runtime `eval` pada prompt string |

### 10.1 Automated Generator Test

Tambahkan unit test framework dan test generator dalam skala besar.

Acceptance target mengikuti satu gate yang sama dengan §26.1:

```text
Pull request: ≥10.000 generated cases per generator family
Nightly/release: ≥100.000 generated cases per generator family
0 divide-by-zero
0 malformed expressions
0 invalid unique-solution questions
0 wrong canonical AnswerSpec evaluation
0 illegal operand-range output
```

Test harus deterministic melalui injectable seed/PRNG. Oracle test matematika WAJIB independen dari implementation generator, dan setiap failure mencetak seed, rule, version, serta minimized counterexample agar dapat direproduksi.

---

## 11. Progress Migration V1 → V2

V1 menggunakan numeric campaign progress. V2 menggunakan stable level ID.

### 11.1 Migration principles

Tidak boleh menghapus achievement, stars, best score, best time, atau completed history user secara diam-diam.

Mapping V1 existing level ke V2 dilakukan berdasarkan semantic skill, bukan semata numeric position.

Required behavior:

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

### 11.2 Migration mapping policy

Mapping normatif seluruh V1 level 1–24 berada di **Appendix B**. Setiap V1 record mempunyai satu `primaryLevelId` V2 untuk anchor history dan nol atau lebih `evidenceTargets` yang hanya membentuk `LegacySkillEvidence` low-confidence untuk urutan diagnostic/recommendation. Evidence V1 TIDAK BOLEH masuk `eligibleAttempts`, correctness, recency, speed, `masteryScore`, atau mastery confidence.

- Snapshot asli disimpan immutable pada `legacyImport.v1Levels` beserta `migrationVersion` dan source fingerprint.
- Hanya primary anchor menerima imported stars/best record. Evidence target tidak memberi campaign stars.
- Bila beberapa V1 level bertemu pada anchor yang sama, anchor menyimpan best-of dan selisih stars disimpan sebagai `legacyStarCredits` agar historical achievement tidak hilang.
- `displayedLevelStars = max(earnedStarsV2, importedStars)` dan `campaignStarsV2 = sum(displayedLevelStars)` dengan batas 216. `legacyStarCredits = max(0, total V1 source stars - total importedStars pada unique anchors)` ditampilkan terpisah; credits tidak membuka V2 achievement atau progression baru.
- Imported best score/time tetap terlihat sebagai record berlabel `Legacy`; ia tidak menggantikan V2 personal best kecuali comparator serta `rulesVersion` dinyatakan compatible.
- V1 level dengan ≥1★ membuka prerequisite chain sampai primary anchor tanpa memberi stars pada prerequisite yang belum dimainkan.
- `unlocked: true` tanpa ≥1★ hanya membuat primary anchor tersedia; ia tidak membuka chain berikutnya.
- Tidak ada aggregate V1 yang langsung memberi mastery. Skill yang memang tidak ada di V1—termasuk fraction, ratio, percentage, root, dan advanced BODMAS—juga tidak boleh menerima `LegacySkillEvidence` positif.
- Fresh user hanya mempunyai `T1-ADD-01` terbuka.

### 11.3 Migration safety and rollback

Migration envelope minimal menyimpan:

```text
migrationVersion
sourceSchemaVersion
sourceFingerprint
startedAt
completedAt
status
legacySnapshot
targetAccountEpoch
failureCode?
```

Migration bersifat additive. Data V1 tidak dihapus selama minimal 30 hari setelah V2 GA dan client V2 tetap dapat dual-read selama rollback window. Payload corrupt/unknown disimpan sebagai orphaned legacy record, tidak dibuang. Migrasi tidak boleh berlangsung sebagian: target state dipublikasikan hanya setelah validation berhasil.

Fixture wajib mencakup fresh state, setiap single-level completion, partial campaign, perfect 24-level campaign, corrupt/unknown keys, anonymous-to-account upgrade, serta conflict dua perangkat.

Release gate migrasi:

```text
AC-MIG-01: Semua V1 level 1–24 dipetakan sesuai Appendix B.
AC-MIG-02: Migration satu kali dan dua kali menghasilkan canonical snapshot identik.
AC-MIG-03: Stars, best score, best valid time, accuracy, achievement, dan history yang dilindungi tidak hilang.
AC-MIG-04: Retry atau migration dua perangkat tidak menggandakan stars, counters, atau mastery evidence.
AC-MIG-05: User V1 Lv24 ≥1★ dapat mengakses T6-GRANDMASTER, tetapi mastery skill baru tetap Belum Cukup Data.
AC-MIG-06: Canary migration success ≥99.9%; satu bukti data loss menghentikan rollout.
AC-MIG-07: Rollback client mempertahankan V1 dan V2 records tanpa destructive down-migration.
AC-MIG-08: LegacySkillEvidence tidak mengubah eligibleAttempts, masteryScore, confidence, atau V2 achievement.
```

---

## 12. Result Screen V2

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

Summary WAJIB berasal dari finalized session snapshot. Final answer harus terlihat tepat satu kali pada correct/wrong count, score, combo, mastery delta, dan history. Untuk timeout, UI membedakan `answered` dari `unanswered`; total solved hanya menghitung answered questions.

Action behavior:

| Action | Behavior |
|---|---|
| Main Lagi | Membuat session baru dengan mode/config yang sama; tidak sekadar menutup modal |
| Level Berikut | Tampil hanya bila prerequisite/unlock terpenuhi dan membuka stable ID berikutnya dari registry |
| Latih Kesalahan Saya | Membawa error evidence dari session finalized ke remediation builder |
| Kembali | Kembali ke hub asal tanpa mem-finalize session kedua kali |

Result competitive mempunyai status `PENDING`, `VALIDATED`, atau `REJECTED`. Hanya `VALIDATED` yang menampilkan rank/reward. `REJECTED` memberi alasan umum yang dapat ditindaklanjuti tanpa membocorkan anti-cheat detail.

---

## 13. Latih Kesalahan Saya

### 13.1 Objective

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

### 13.2 Rules

| Requirement | Rule |
|---|---|
| Minimum errors | ≥1 |
| Session size | `min(15, max(5, 3 × jumlah distinct failed template family yang dipilih))` |
| Exact duplicate | Maksimal satu exact prompt repeat per session |
| Similar variants | Sedikitnya 80% question bukan exact prompt repeat |
| Difficulty | `difficultyRank` tidak melebihi nilai tertinggi dari failed evidence yang dipilih |
| Completion | Update mastery, bukan campaign stars |
| Eligibility | Hanya answer finalized yang mempunyai skill metadata valid |
| Repetition cap | Satu template family maksimal 30% dari satu remediation session |
| Exit | Partial session tetap menyimpan eligible answer evidence, tanpa campaign reward |

Seratus persen question remediation harus memiliki failed `primarySkillId` atau failed supporting skill tag yang dipilih. Remediation builder menggunakan `primarySkillId`, `skillTags`, `templateFamily`, dan difficulty dari error evidence; prompt text tidak boleh digunakan untuk menebak skill. Bila generator yang sesuai tidak tersedia, CTA tidak ditampilkan dan error tetap dapat direview.

---

## 14. Adaptive Practice V2

Existing Time Attack adaptive logic berdasarkan score dan streak dipertahankan sebagai referensi tetapi tidak cukup untuk personalized training.

V2 adaptive practice memilih pertanyaan berdasarkan:

```text
Mastery rendah
+ Recent errors
+ Response time lambat
+ Skill yang jarang dilatih
+ Player current difficulty ceiling
```

Initial question distribution:

```text
50% weak skills
25% medium skills
15% recently failed variants
10% strong-skill maintenance
```

Distribusi di atas adalah default V2. Eksperimen hanya boleh mengubah setiap bucket maksimal ±10 poin persentase, total harus tetap 100%, serta wajib memakai `selectorPolicyVersion`, experiment ID, guardrail metric, dan fallback ke default.

Setiap adaptive session mempunyai sedikitnya 10 soal. Selector menggunakan seeded weighted sampling agar keputusan dapat direproduksi dalam test, membatasi satu sub-skill maksimal 40% sesi, dan tidak menampilkan template identik berturut-turut. Cold start menggunakan diagnostic mix dari skill yang prerequisite-nya sudah tersedia sampai mastery minimum sample terpenuhi.

### 14.1 Adaptive guardrails

Adaptive mode tidak boleh:

- menaikkan difficulty setelah satu jawaban benar saja;
- terus menerus memberi skill yang sama sampai monoton;
- memberi advanced skill yang prerequisite-nya belum dikuasai;
- menghukum response lambat pada sesi accessibility mode;
- mencampur competitive leaderboard score dengan adaptive practice score.

Adaptive recommendation WAJIB menjelaskan alasan sederhana seperti “Perkalian ×7 perlu latihan” dan menyediakan pilihan ganti skill. Perubahan distribution melalui remote config harus mempunyai experiment ID, guardrail metric, dan fallback ke distribution di atas.

---

## 15. Game Modes V2

### 15.1 Campaign

72 level progression, stars, boss, mastery.

Campaign dapat dimainkan tanpa login dan tanpa network. Session yang selesai offline disimpan ke durable outbox. Campaign score bersifat personal dan tidak masuk competitive leaderboard. Pause mengikuti active-time policy pada §9.8.

### 15.2 Tantangan Harian

Deterministic daily challenge tetap dipertahankan sehingga seluruh pemain mendapat puzzle harian yang sama.

V2 requirements:

| Requirement | Rule |
|---|---|
| Daily seed | Tanggal + content version |
| Questions | 10 |
| Target / hard limit | 75 detik / 90 detik |
| Same puzzle | Ya, untuk semua pemain pada daily version yang sama |
| Score | Standardized |
| Ranked attempt | Satu server-issued ranked session per account/challenge |
| Replay | Diizinkan sebagai practice, tidak mengubah rank, record, atau streak |
| Leaderboard | Real player records |
| Simulated players | Tidak ditampilkan sebagai pemain nyata |
| Daily streak | Dipertahankan |
| Connectivity | Online dan authenticated untuk ranked; offline hanya practice copy |

Content version harus menjadi bagian seed untuk mencegah perubahan generator diam-diam mengubah challenge yang sama pada tanggal yang sama. Backend mem-pin tepat satu `dailyContentVersion` untuk seluruh window WIB; deployment di tengah hari tidak boleh membuat challenge kedua. Client yang tidak compatible dengan version tersebut tidak dapat memulai ranked Daily dan diarahkan untuk update atau bermain mode lokal.

`challengeId` berbentuk `YYYY-MM-DD@Asia/Jakarta:<dailyContentVersion>` dan diterbitkan backend berdasarkan WIB, bukan jam perangkat. Window dimulai 00:00:00 WIB dan berakhir 23:59:59 WIB. Ranked slot dikonsumsi secara atomic ketika backend menerbitkan `questionInstanceId` sequence 1 untuk session pertama `(uid, challengeId)`. `ABANDONED`, `FAILED`, expired, atau `REJECTED` tetap mengonsumsi slot dan tidak memberi rank/streak; start berikutnya selalu menjadi unranked replay. Retry dengan idempotency key yang sama mengembalikan session pertama. Session mempunyai hard deadline 90 detik; evidence yang sudah acknowledged dapat finalized maksimal lima menit setelah pergantian hari. Start baru setelah window selalu memakai challenge berikutnya. Historical challenge hanya dapat dimainkan unranked.

Jika seluruh 10 soal terjawab, `rankedActiveDurationMs = min(90.000, lastAcceptedAnswerServerAt - serverStartedAt)`; jika tidak, nilainya 90.000 ms. Network/finalize delay tidak masuk duration; timestamp sebelum start ditolak. Seluruh threshold dan score memakai integer milliseconds.

Daily score V2:

```text
accuracy     = correctCount / 10 × 100
base         = correctCount × 120
streakBonus  = min(300, maxStreak × 30)
speedNum     = max(0, 75.000 - rankedActiveDurationMs) × 800 × correctCount
speedDen     = 75.000 × 10
speedBonus   = roundHalfUp(speedNum / speedDen)
perfectBonus = 200 jika correctCount = 10, selainnya 0
score        = base + streakBonus + speedBonus + perfectBonus
```

Pada hard deadline, unanswered question dicatat terpisah dan memberi 0 poin. Daily streak bertambah satu kali bila consumed ranked session berstatus `VALIDATED`, menjawab seluruh soal, dan `correctCount ≥6`. Replay/historical play tidak dapat mengubah `lastCompletedChallengeId`. Tie-breaker: `score DESC`, `correctCount DESC`, `rankedActiveDurationMs ASC`, `finalizedAt ASC`, lalu `resultId ASC`.

### 15.3 Sprint 60s

Mode kompetitif fixed-duration.

```text
Duration: exactly 60 seconds
Correct: score, no time addition
Wrong: 0 point dan combo reset; tidak ada pengurangan waktu
Difficulty: standardized progression
Leaderboard: eligible
```

Sprint memakai server deadline tepat 60.000 ms. Difficulty ditentukan dari jumlah jawaban benar: 1–5 pada difficulty 1, 6–10 pada difficulty 2, 11–15 pada difficulty 3, 16–20 pada difficulty 4, 21–25 pada difficulty 5, dan berikutnya difficulty 6.

```text
basePoints    = 100 + 25 × (difficulty - 1)
comboTenths   = min(30, 10 + newStreak - 1)
correctPoints = roundHalfUp(basePoints × comboTenths / 10)
wrongPoints   = 0
```

Question values berasal dari server session seed dengan template distribution yang sama untuk semua pemain pada `rulesVersion` yang sama. Sprint menyimpan best `VALIDATED` result per user untuk scope sprint-daily, sprint-weekly, dan sprint-all-time. Kandidat hanya menggantikan record bila menang comparator lengkap: `score DESC`, `accuracy DESC`, `correctCount DESC`, `wrongCount ASC`, `finalizedAt ASC`, lalu `resultId ASC`.

### 15.4 Survival Kilat

Mekanik existing yang memberi waktu saat benar dan mengurangi waktu saat salah dipindahkan menjadi Survival.

```text
Starting Time: 60s
Correct: +2s, max timer 60s
Wrong: -4s
Difficulty: `min(6, 1 + floor(correctCount / 5))`
End: timer reaches 0
```

Survival memakai scoring dan bracket difficulty Sprint berdasarkan `correctCount`; tidak memakai mastery atau personalization. Question sequence diturunkan dari server seed + sequence + `rulesVersion`. Survival mempunyai board sendiri untuk survival-daily, survival-weekly, dan survival-all-time. Kandidat best record memakai comparator `score DESC`, `survivalDurationMs DESC`, `accuracy DESC`, `finalizedAt ASC`, lalu `resultId ASC`. Session mempunyai hard cap 10 menit; saat cap tercapai session finalized secara valid. Reward/penalty waktu dan score dihitung backend. Satu user hanya dapat mempunyai satu active competitive session per mode, maksimal 10 ranked starts per mode per WIB day, dan maksimal 20 starts per jam per account dengan abuse protection tambahan di backend.

### 15.5 Latihan Bebas

Dipertahankan dan diperluas agar user dapat memilih:

```text
Skill
Sub-skill
Difficulty
Jumlah soal
Timer on/off
```

Practice tidak memengaruhi competitive leaderboard.

Setiap practice answer memperbarui global learning statistics dan mastery sesuai eligibility, termasuk session yang diselesaikan sebagian. Practice dapat berjalan offline, timer tidak wajib, dan response-time speed component dikeluarkan ketika timer/accessibility untimed dipilih.

### 15.6 Mode eligibility matrix

| Mode | Offline | Login required | Mastery | Campaign stars | Ranked leaderboard |
|---|---|---|---|---|---|
| Campaign | Ya | Tidak | Ya | Ya | Tidak |
| Mistake Training | Ya | Tidak | Ya | Tidak | Tidak |
| Adaptive Practice | Ya setelah config tersedia | Tidak | Ya | Tidak | Tidak |
| Practice | Ya | Tidak | Ya | Tidak | Tidak |
| Daily practice/replay | Ya setelah puzzle tersedia | Tidak | Tidak untuk exact replay | Tidak | Tidak |
| Daily ranked | Tidak | Ya | Ya setelah validation | Tidak | Ya |
| Sprint ranked | Tidak | Ya | Ya setelah validation | Tidak | Ya |
| Survival ranked | Tidak | Ya | Ya setelah validation | Tidak | Ya |

Anonymous player dapat memakai seluruh non-ranked journey. Saat login, local history dimigrasi melalui sync contract; anonymous result lama tidak dapat diajukan retroaktif sebagai ranked result.

### 15.7 Scoring dan leaderboard version semantics

Seluruh score menggunakan integer/fixed-point arithmetic; binary floating-point tidak menjadi source of truth. `roundHalfUp(n/d)` untuk bilangan non-negatif berarti `floor((2n + d) / (2d))`. Golden fixtures WAJIB mencakup boundary tepat `.5`, Daily pada 75.000/90.000 ms, combo cap Sprint, deadline race, serta reward/penalty Survival.

Kecuali Daily yang selalu memakai denominator 10, competitive `accuracy = correctCount / questionsAnswered`; bila belum ada answer, accuracy = 0. Threshold dan tie-break membandingkan pecahan exact melalui cross-multiplication, bukan rounded display percentage.

Leaderboard dipartisi dengan key `(mode, periodKey, rulesVersion, contentVersion)`; hasil dari version berbeda tidak dibandingkan. Daily Challenge memakai `periodKey = challengeId`. Scope daily Sprint/Survival mengikuti 00:00:00–23:59:59 WIB; weekly dimulai Senin 00:00:00 WIB dan berakhir Minggu 23:59:59 WIB; all-time memakai `periodKey = all`. `entryId` memakai HMAC backend atas scope dan opaque `leaderboardSubjectId`, bukan Auth UID. UI menampilkan board version aktif dan dapat menampilkan board lama sebagai archive berlabel.

---

## 16. Competitive Integrity dan Leaderboard

### 16.1 Problem

Score leaderboard saat ini dapat ditulis oleh authenticated client ke document miliknya sendiri. Untuk production competition, ownership validation saja belum cukup membuktikan bahwa score berasal dari permainan yang sah.

### 16.2 V2 Requirement

Competitive score WAJIB tervalidasi server-side melalui trusted validation layer. Client tidak boleh menjadi authority final untuk eligibility, duration, correctness, score, result status, atau leaderboard mutation.

Required architecture:

```text
Client
  ↓ Start session
Trusted backend / Cloud Function
  ↓ opaque session contract + version tuple + question views/tokens
Client gameplay
  ↓ answers + timing evidence
Trusted validator
  ↓ verify
Leaderboard write
```

V2 menggunakan Firebase Authentication, App Check, Firestore, dan Cloud Functions trusted backend dengan Firebase Admin SDK. Static Vite/Nginx frontend tetap terpisah dari validator backend.

#### 16.2.1 Threat model V2

V2 WAJIB mencegah direct Firestore score writes, payload field manipulation, duplicate/replayed session, cross-user submission, expired session, unknown rules/content version, impossible sequence, dan basic automated abuse melalui rate limit/anomaly detection.

V2 tidak mengklaim dapat membuktikan bahwa manusia—bukan bot canggih—menjawab setiap soal. Tournament-grade anti-bot, device attestation khusus, dan proctoring adalah PASCA-V2. Hasil mencurigakan dapat ditahan dari leaderboard untuk review tanpa menghapus personal local result.

#### 16.2.2 Competitive session lifecycle

```text
POST /v1/competitive-sessions/start
  auth + App Check + idempotencyKey + mode/challenge
  → sessionId + signed/opaque contract + version tuple + server window + question views/tokens

POST /v1/competitive-sessions/{sessionId}/answers
  append-only answer batches + question tokens + idempotency keys
  → acknowledged sequence/checkpoint

POST /v1/competitive-sessions/{sessionId}/finalize
  idempotencyKey
  → PENDING | VALIDATED | REJECTED result
```

Competitive question view hanya memuat `questionInstanceId`, sequence, rendered prompt, `answerInputKind`, bounded input constraints, dan opaque question token. Backend tidak mengirim seed, canonical payload hash, canonical `AnswerSpec` value, expression AST, atau answer key. Informasi yang terlihat di web client tidak diperlakukan sebagai security secret; client dapat memberi feedback provisional, tetapi backend tetap menghitung correctness dan score canonical.

Answer upload dapat berlangsung asynchronous agar feedback provisional lokal tetap ≤100 ms. Survival mengirim heartbeat/checkpoint setiap paling lama 5 detik. Bila server tidak menerima heartbeat atau answer selama lebih dari 10.000 ms, session berubah menjadi `FAILED` dengan competitive status `REJECTED`; answer sesudah expiry ditolak dan UI hanya boleh menyimpan personal result sebagai `UNRANKED`. Sprint dan Daily menggunakan server start/accepted-answer window sebagai duration bound. Loss of connectivity tidak pernah mengalihkan authority ke client: result tetap personal `UNRANKED` atau `PENDING` sampai validator memutuskan.

Start retry dengan idempotency key yang sama mengembalikan session yang sama. Finalize bersifat transactional: session berubah dari active ke terminal state, immutable competitive result dibuat, dan leaderboard projection diperbarui paling banyak satu kali.

#### 16.2.3 Minimum validation

| Field | Validation |
|---|---|
| User | Authenticated UID |
| Mode | Allowed competitive mode |
| Session | Valid / unused |
| Rules version | Known server version |
| Score | Recomputed dari server-owned rules dan validated answers |
| Accuracy | Recomputed dari answers |
| Solved count | Recomputed |
| Duration | Dihitung/dibatasi server session window |
| Timestamp | Server timestamp |
| Idempotency | Duplicate start/answer/finalize tidak menggandakan hasil |
| Replay | Used/finalized token tidak dapat digunakan ulang |
| Rate | Per-account dan abuse-oriented network rate limit |
| Version | Content, generator, rules, taxonomy, dan app compatibility diketahui |

#### 16.2.4 Firestore authority and public projection

```text
/users/{uid}                              private profile/settings
/users/{uid}/progress/{levelId}           owner-readable, trusted materializer write
/users/{uid}/mastery/{skillId}            owner-readable, trusted materializer write
/users/{uid}/sessions/{sessionId}          sanitized owner-readable summary
/users/{uid}/migrations/{migrationVersion} owner-readable, trusted migration write
/competitiveSessions/{sessionId}          server-only; sanitized status via API
/competitiveResults/{resultId}             owner-readable, server-write only
/leaderboardEntries/{entryId}              public read, server-write only
```

Client Firestore SDK TIDAK BOLEH create/update/delete competitive results atau leaderboard entries. Public projection hanya berisi pseudonym tervalidasi, flag opsional, score/ranking metrics, mode/scope, version, dan server timestamp. UID internal, email, Google photo, answers, tokens, device ID, serta rejection detail tidak boleh terekspos.

Rank tidak disimpan sebagai permanent mutable truth. Query menggunakan comparator mode yang ditentukan pada §15, kemudian UI menghitung/display rank dari ordered result atau backend pagination response.

#### 16.2.5 Competitive acceptance criteria

```text
AC-COMP-01: Request tanpa authenticated user dan valid App Check tidak dapat memulai ranked session.
AC-COMP-02: Firestore emulator membuktikan seluruh direct client leaderboard/result writes ditolak.
AC-COMP-03: Field score/accuracy/count/duration dari client diabaikan dan dihitung ulang backend.
AC-COMP-04: Wrong UID, duplicate sequence, invalid token, expiry, finalized session, dan unknown version ditolak.
AC-COMP-05: 100 concurrent finalize requests menghasilkan satu immutable result dan maksimal satu leaderboard mutation.
AC-COMP-06: Daily slot dikonsumsi saat backend menerbitkan sequence 1; failed/abandoned/rejected session tidak memperoleh slot kedua.
AC-COMP-07: Sprint server window tepat 60.000 ms dan tidak menerima time mutation.
AC-COMP-08: Survival reward/penalty serta timer cap dihitung ulang dari acknowledged answer sequence.
AC-COMP-09: Rejected result tidak memberi rank, streak, achievement kompetitif, atau reward.
AC-COMP-10: Public leaderboard tidak mengungkap private identity atau gameplay evidence.
AC-COMP-11: Leaderboard key memisahkan mode, period, rulesVersion, dan contentVersion sesuai §15.7.
AC-COMP-12: Survival heartbeat gap >10.000 ms mengakhiri ranked eligibility secara deterministic.
```

### 16.3 Leaderboard categories

```text
Sprint 60s — Daily / Weekly / All Time
Survival — Daily / Weekly / All Time
Daily Challenge — Per challengeId
```

Period boundary, version partition, entry ID, comparator, dan best-record replacement mengikuti §15.2–§15.7. Ranked participation pertama kali meminta opt-in public pseudonym; bila user menolak atau kemudian opt-out, mode yang sama tetap dapat dimainkan sebagai unranked practice tanpa public projection.

1v1 dan tournament belum termasuk V2.

---

## 17. Achievement V2

Existing achievement system dipertahankan. Star-related achievements harus disesuaikan karena total stars berubah dari 72 menjadi 216.

Star achievement milestones:

| Achievement | Threshold |
|---|---:|
| Pengumpul Bintang | 15★ |
| Bintang Terang | 40★ |
| Veteran | 72★ |
| Master Kampanye | 144★ |
| Mahkota Sempurna | 216★ |

Tambahan achievement dapat berasal dari mastery, Boss, perfect run, Daily streak, Sprint, dan Survival tanpa memengaruhi campaign unlock.

---

## 18. Statistics & Skill Heatmap

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

## 19. UX/UI Requirements

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

Critical journeys WAJIB memenuhi WCAG 2.2 Level AA. Scope conformance mencakup home, level map, seluruh gameplay/input kind, result/review, stats/mastery, authentication/consent, Settings, dan leaderboard pada responsive layouts.

- Seluruh aksi dapat diselesaikan dengan keyboard; focus visible, logical, tidak tertutup, dan dikunci dengan benar di modal.
- Icon-only control mempunyai accessible name; status timer, benar/salah, combo, dan validation result diumumkan melalui live region tanpa merebut focus.
- Feedback tidak hanya mengandalkan warna, animasi, suara, atau haptic.
- `prefers-reduced-motion` menonaktifkan confetti, shake, parallax, pulse non-esensial, dan transition besar.
- Touch target utama minimal 44×44 CSS px dengan spacing yang mencegah salah tekan.
- HTML locale default adalah `id`; format angka, tanggal, dan separator input mengikuti locale tetapi canonical value tetap stabil.
- Mute persisten dan tidak menonaktifkan feedback visual/text.
- Campaign/practice menyediakan `standard`, `extended`, dan `untimed` timing profile. `extended` mengalikan target serta deadline standard dengan 1,5 dan membulatkan ke atas ke detik penuh. `untimed` tidak mempunyai deadline; 1★/2★/3★ hanya memakai threshold accuracy 70%/85%/95%, sedangkan Perfect Badge memerlukan 100%. Extended/untimed tidak eligible untuk ranked mode, speed mastery dikeluarkan sesuai §8.3.3, dan time record disimpan sebagai accessibility record yang tidak dibandingkan dengan standard record.

Release gate: automated accessibility test tidak mempunyai critical/serious violation; keyboard-only E2E lulus; screen-reader smoke test dilakukan pada minimal satu kombinasi desktop dan satu mobile yang didukung.

---

## 20. Privacy, Safety, and Data Governance

V2 dirancang untuk general audience, termasuk pemain muda. Self-managed cloud account dan ranked leaderboard dibatasi untuk pemain yang mengonfirmasi usia 13+; pemain di bawah 13 tahun selalu menggunakan local-only mode pada V2. Guardian-managed cloud consent adalah PASCA-V2. Produk tidak mengklaim legal compliance hanya dari age confirmation—launch review tetap WAJIB memverifikasi kebijakan market distribusi.

### 20.1 Safe defaults

- Anonymous/local play tidak meminta nama, email, foto, tanggal lahir, atau lokasi.
- Age gate hanya muncul ketika user mencoba login/cloud/ranked. Sistem menyimpan eligibility band `under13 | 13plus`, policy version, dan consent timestamp—bukan tanggal lahir.
- Public identity selalu pseudonym pilihan pemain; nama dan foto Google tidak dipublikasikan otomatis.
- Leaderboard bersifat opt-in. Opt-out menyembunyikan seluruh public projection maksimal 24 jam tanpa menghapus progress lokal; ranked mode berubah menjadi unranked practice sampai user opt-in kembali.
- Pseudonym memiliki panjang 3–20 karakter, character allowlist, profanity filter, rate-limited rename, serta report-name action.
- Negara/bendera bersifat opsional dan dipilih manual; precise location tidak pernah dikumpulkan.
- Tidak ada chat, direct message, contact discovery, targeted advertising, atau public raw answer history.

### 20.2 Data purpose and retention

| Data class | Purpose | Retention |
|---|---|---|
| Local anonymous progress | Menjalankan game offline | Sampai user melakukan reset/clear storage |
| Cloud progress/mastery | Sync dan learning history | Selama account aktif; dihapus melalui Delete Account |
| Competitive answer evidence | Validasi, dispute, dan anti-replay | Maksimal 30 hari |
| Product analytics aggregates | Balancing dan funnel | Maksimal 13 bulan |
| Security/audit logs | Abuse dan incident investigation | Maksimal 90 hari |
| Public leaderboard projection | Ranking yang dipilih user | Sampai user opt-out/delete; projection lalu dihapus maksimal 24 jam |

Retention dijalankan oleh TTL/deletion job yang dimonitor. Raw prompt dan raw answer tidak dikirim ke product analytics. Competitive evidence berada pada restricted backend path dan tidak digunakan untuk profiling iklan.

### 20.3 Consent, export, and deletion

- Consent analytics terpisah dari Terms/Privacy acceptance dan dapat dicabut.
- Essential security/reliability events meminimalkan identifier dan dijelaskan pada notice produk.
- Settings menyediakan export data, Reset Progress, opt-out leaderboard, dan Delete Account sebagai action terpisah dengan scope yang jelas.
- Delete Account mencabut session, menghapus private cloud data, serta menghapus seluruh public profile/leaderboard projection dalam 30 hari; UI memberikan request receipt. Aggregate integrity yang tersisa harus non-identifiable dan tidak dapat direlasikan kembali ke result atau pemain.
- Reset Progress tidak boleh dianggap Delete Account dan tidak boleh menghapus leaderboard tanpa pilihan eksplisit.
- Setiap analytics/validation schema mempunyai data owner, purpose, field allowlist, retention class, dan automated contract test.

### 20.4 Child-safety acceptance criteria

```text
AC-PRIV-01: Local-only journey dapat selesai tanpa memberikan PII atau analytics consent.
AC-PRIV-02: Google display name/photo tidak pernah muncul publik tanpa explicit profile opt-in.
AC-PRIV-03: Under-13 selection selalu menonaktifkan self-managed cloud/ranked flow pada V2; guardian-managed cloud adalah PASCA-V2.
AC-PRIV-04: Product analytics payload tidak mengandung raw prompt, raw answer, email, photo URL, atau precise location.
AC-PRIV-05: Retention jobs dan Delete Account diuji di staging dan menghasilkan auditable completion status.
AC-PRIV-06: Public profile hanya memuat pseudonym tervalidasi dan optional flag.
AC-PRIV-07: Opt-out menghapus public projection ≤24 jam; Delete Account menghapusnya dan private cloud data ≤30 hari.
```

---

## 21. Data Model and Synchronization Contract

### 21.1 VersionTuple

Setiap persisted session, result, question evidence, progress record, mastery aggregate, dan competitive record WAJIB menyimpan compatible version tuple:

```text
schemaVersion
appVersion
contentVersion
generatorVersion
rulesVersion
taxonomyVersion
masteryAlgorithmVersion
```

Released `contentVersion` bersifat immutable. Perubahan generator/rules/taxonomy menaikkan version terkait. Session pinned ke tuple pada saat start; backend hanya menerima supported tuple dan historical result tetap readable menggunakan version asalnya.

### 21.2 LevelConfig

```text
id: stable string
order: unique number
tier: 1..6
titleKey / descriptionKey: localized content keys
generatorKey: registered generator
rules: typed GeneratorRule union
answerKind: integer | rational | decimal | choice
difficulty: integer 1..6
questionCount: positive integer
targetTimeSec: positive number
timeLimitSec: positive number >= targetTimeSec
boss: boolean
passingAccuracy: 0..100
prerequisiteIds: stable string[]
skillWeights: { skillId, weight }[]
templateFamilies: non-empty stable string[]
contentVersion: immutable version
```

### 21.3 UserLevelProgress

```text
levelId
accountEpoch
earnedStarsV2: 0..3
importedStars: 0..3
displayedStars: derived max(earnedStarsV2, importedStars)
bestV2RecordsByRulesVersion[]
importedBestScore?
importedBestTimeSec?
importedBestAccuracy?
legacyAnchorSourceIds[]
attemptCount
completedAt?
perfect
contentVersion
completionEvidenceIds[]
```

Unlock dihitung dari prerequisite graph dan valid completion/import evidence; cached unlock state bukan source of truth. Best V2 records di-key oleh `(levelId, recordRulesVersion)` dan hanya dibandingkan bila scoring/timer rules compatible. Historical/legacy record tetap terlihat dengan label dan tidak ditimpa oleh comparator version lain. `campaignStarsV2` dan `legacyStarCredits` mengikuti formula §11.2.

#### 21.3.1 MigrationState dan legacy records

```text
MigrationState {
  migrationVersion
  sourceSchemaVersion
  sourceFingerprint
  status
  targetAccountEpoch
  legacyImport.v1Levels[]
  orphanedRecords[]
  completedAt?
  failureCode?
}

LegacySkillEvidence {
  sourceLevelId
  targetSkillIds[]
  confidence: low
  diagnosticOnly: true
}

LegacyStarCredits {
  total
  sourceLevelIds[]
}
```

Migration state disimpan pada private trusted path per account dan immutable setelah status `COMPLETED`, kecuali append-only audit status. Tidak satu pun field `LegacySkillEvidence` masuk mastery reducer.

### 21.4 SkillMastery

```text
skillId
subSkillId?
accountEpoch
masteryScore: 0..100
confidence: insufficient | sufficient
eligibleAttempts
correct
avgResponseTimeMs
recentAccuracy
lastPracticedAt
masteryAlgorithmVersion
sourceEventWatermark
```

### 21.5 AnswerEvent and SessionResult

```text
AnswerEvent {
  eventId
  accountEpoch
  sessionId
  sequence
  questionDefinitionId
  questionInstanceId
  primarySkillId
  skillTags[]
  difficulty
  targetResponseTimeMs
  answerKind
  isCorrect
  responseTimeMs?
  createdAtClient
  normalizedOccurredAt?
  receivedAtServer?
  deviceId
  deviceSequence
  sourceMode
  versionTuple
}

SessionResult {
  resultId
  accountEpoch
  sessionId
  sessionStatus: COMPLETED | FAILED | ABANDONED
  questionsPresented
  questionsAnswered
  correctCount
  wrongCount
  unansweredCount
  score
  activeDurationMs
  maxStreak
  stars?
  competitiveStatus?: PENDING | VALIDATED | REJECTED
  answerEventIds[]
  finalizedAt
  versionTuple
}
```

Event ID immutable dan globally unique. Retry event/result dengan ID yang sama tidak memberi contribution kedua. Raw submitted answer TIDAK BOLEH berada pada analytics `AnswerEvent`; ia hanya berada pada local review history atau model restricted berikut sesuai retention §20:

```text
CompetitiveAnswerEvidence {
  evidenceId
  sessionId
  questionInstanceId
  sequence
  submittedAnswerCanonical
  receivedAtServer
  questionTokenHash
  versionTuple
  expiresAt: receivedAtServer + 30 hari
}
```

Product analytics hanya menerima correctness dan bucketed metadata.

### 21.6 CompetitiveSession

```text
sessionId
ownerUserId
mode
challengeId?
serverSeedReference
serverStartedAt
serverDeadlineAt
lastAcknowledgedSequence
sessionStatus: CREATED | ACTIVE | FINALIZING | COMPLETED | FAILED | ABANDONED
competitiveStatus?: PENDING | VALIDATED | REJECTED
idempotencyKeys
resultId?
versionTuple
```

Allowed session transition mengikuti canonical lifecycle §9.7. `EXPIRED` adalah failure reason, bukan terminal state kedua: ia menghasilkan `sessionStatus = FAILED` dan `competitiveStatus = REJECTED`. Competitive transition hanya `PENDING → VALIDATED | REJECTED`. Session terminal dan competitive final state tidak dapat dibalik; setiap write memakai transaction/precondition.

#### 21.6.1 LeaderboardEntry

```text
LeaderboardEntry {
  entryId: backend HMAC-derived opaque ID
  leaderboardSubjectId: random public-safe ID, bukan Auth UID
  mode
  periodKey
  score dan tie-break metrics
  pseudonym
  optionalFlag
  finalizedAt
  versionTuple
}
```

### 21.7 Offline journal and merge semantics

Local-first mode menggunakan durable journal/outbox. Event disimpan sebelum completion UI ditampilkan dan baru dihapus dari outbox setelah server acknowledgment. Retry memakai exponential backoff dengan jitter dan tidak memblokir permainan lokal.

Cloud ingestion memakai trusted endpoint, bukan direct aggregate write:

```text
POST /v1/sync/events
Auth: Firebase ID token + valid App Check
Body: accountEpoch, deviceId, idempotencyKey, maksimal 100 immutable events
Result: acceptedEventIds[], duplicateEventIds[], rejectedEvents[{ eventId, code }], aggregateRevision
```

Backend memverifikasi owner, account epoch, event/version schema, sequence, bounds, dan event ID; menyimpan bounded journal; mendeduplikasi retry; lalu menjalankan trusted materializer untuk progress, statistics, achievement, dan mastery. Client Firestore SDK tidak dapat menulis aggregate tersebut. `createdAtClient`, `deviceSequence`, dan event ID immutable; normalization/order mastery mengikuti §8.3.3.

| Data class | Merge rule |
|---|---|
| Level progress | Stars/evidence union by event ID; best records dibandingkan hanya dalam compatible `recordRulesVersion` |
| Campaign unlock | Derived dari prerequisite graph dan evidence, bukan boolean merge |
| Counters/statistics | Reducer dari deduplicated result/answer events; TIDAK BOLEH memakai `Math.max` pada cumulative counters |
| Mastery | Deterministic versioned reducer dari deduplicated eligible events |
| Daily | Keyed by challenge ID; satu consumed ranked session immutable; hanya result `VALIDATED` session itu eligible; replay separate/unranked |
| Profile/settings | Field-level last-write-wins dengan server revision dan validation |
| Achievement | Derived per account epoch; first earned timestamp immutable |
| Legacy import | Immutable per migration version dan source fingerprint |

Raw session/event history TIDAK BOLEH disimpan dalam satu monolithic `/users/{uid}` document. User aggregate document tidak boleh melebihi 512 KiB; raw journal dipartisi menjadi bounded documents/subcollections dengan TTL/archival policy. Dua perangkat yang menyelesaikan level berbeda secara offline harus menghasilkan union yang sama terlepas dari urutan sync.

### 21.8 Reset and account epoch

`Reset Progress` membuat `accountEpoch` baru secara transactional. Event/outbox epoch lama tidak dapat menghidupkan kembali data setelah reconnect. Reset mencakup campaign progress/stars/best records, learning stats, mastery, remediation queue, daily streak/history, dan learning achievements; public competitive result tidak dihapus kecuali user juga memilih opt-out/delete.

`Delete Account` adalah flow terpisah sesuai §20. Reset menyimpan minimal audit tombstone `resetId`, prior/new epoch, dan server timestamp tanpa menyimpan deleted gameplay detail.

Acceptance criteria:

```text
AC-SYNC-01: Dua perangkat offline menyelesaikan level berbeda dan sync dalam urutan apa pun menghasilkan union identik.
AC-SYNC-02: Event berbeda +10 dan +12 menghasilkan total +22; bukan max 10/12.
AC-SYNC-03: Retry event 100 kali menghasilkan satu aggregate contribution.
AC-SYNC-04: Reset mencegah seluruh event epoch lama direhidrasi dari device offline.
AC-SYNC-05: Conflict tidak menghapus completion, mastery evidence, atau record yang lebih baik.
AC-SYNC-06: Tidak ada user aggregate document >512 KiB; raw event berada pada bounded partition, bukan monolithic user document.
AC-SYNC-07: Direct client write ke progress/mastery/stat aggregate ditolak; event ingestion hanya melalui trusted sync endpoint.
AC-SYNC-08: Duplicate di-ACK tanpa kontribusi kedua; stale epoch/malformed event ditolak per event; request >100 events ditolak seluruhnya tanpa aggregate mutation.
```

---

## 22. Analytics dan Product Telemetry

V2 membutuhkan telemetry agar balancing tidak berdasarkan tebakan.

### 22.1 Event contract

Setiap event mempunyai schema registry, owner role, `eventVersion`, contoh payload, dan contract test. Field wajib:

```text
eventName
eventVersion
eventId
occurredAtClient
receivedAtServer?
anonymousOrUserId
sessionId?
appVersion
contentVersion
rulesVersion
platform
locale
consentState
```

`eventId` digunakan untuk deduplication. Breaking schema change membutuhkan `eventVersion` baru; dashboard harus dapat membedakan version. Analytics client harus gagal secara aman dan tidak boleh menghambat gameplay.

### 22.2 Product and learning events

```text
app_started
session_started
session_completed
session_abandoned
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

Properties domain:

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

### 22.3 Operational events

```text
feature_flag_exposed
migration_started
migration_completed
migration_failed
migration_skipped
sync_started
sync_completed
sync_conflict_detected
sync_retry_exhausted
validator_started
validator_accepted
validator_rejected
validator_error
client_error
asset_load_failed
performance_vital
retention_job_completed
retention_job_failed
```

Migration event memuat source/target version dan non-PII failure code. Validator event memuat mode, reject reason class, latency, dan idempotency outcome. Sync event memuat conflict strategy, retry count, dan oldest queue age. Error log tidak boleh memuat submitted answer, token, atau Firebase ID token.

### 22.4 Telemetry governance

`question_answered` untuk analytics hanya mengirim skill/sub-skill, difficulty bucket, correctness, response-time bucket, mode, dan version. Raw prompt dan raw answer hanya dapat dikirim ke restricted competitive validation path. Retention mengikuti §20. Analytics non-esensial menghormati consent dan opt-out pada event berikutnya maksimal satu menit setelah setting berubah.

Metrics pipeline WAJIB memonitor event delivery rate, duplicate rate, schema rejection, consent leakage, dan version coverage. Missing analytics tidak boleh mengubah progress/mastery source of truth.

---

## 23. Success Metrics

Foundation milestone merekam baseline selama minimal 28 hari dan sampai terdapat sedikitnya 1.000 activated players, mana yang lebih akhir. Target berikut adalah launch hypothesis V2 GA dan hanya dapat direvisi melalui Product Decision Register bila baseline menunjukkan cohort tidak representatif.

| Metric | Definition | V2 target |
|---|---|---:|
| Lv1 completion | New players yang menyelesaikan Lv1 / yang memulai Lv1 | ≥70% |
| T1 conversion | Pemain yang menyelesaikan Boss Lv12 ≤14 hari / yang menyelesaikan Lv1 | ≥30% |
| Tier continuation | Pemain yang memulai tier berikut ≤7 hari / yang menyelesaikan Boss sebelumnya | ≥40% |
| D7 retention | Activated players aktif pada hari ke-7 ±1 / activated players | ≥25% |
| Purposeful replay | Pemain replay ≤7 hari setelah 1–2★ / pemain yang mendapat 1–2★ | ≥30% |
| Mistake Training adoption | Qualifying results yang memulai remediation / seluruh qualifying results | ≥35% |
| Remediation completion | Remediation completed / remediation started | ≥70% |
| Weak-skill improvement | Eligible players yang 10 answer berikut pada sub-skill sama, finalized ≤14 hari setelah baseline event, mencapai accuracy ≥ baseline recent accuracy +10 poin / eligible weak-skill players | ≥55% |
| Daily repeat | Pemain dengan Daily validated pada ≥3 tanggal dalam 7 hari / pemain dengan satu Daily validated | ≥20% |
| Ranked final status coverage | Finalize request yang menjadi `VALIDATED`/`REJECTED` ≤30 detik sejak first `serverReceivedAt` / seluruh finalize request yang diterima validator | ≥99.5% |

Definitions:

- `activated player`: pemain yang finalized sedikitnya satu non-replay session.
- `new player`: pemain yang pertama kali memulai Level 1 dalam measurement window dan tidak mempunyai V1 legacy import.
- `qualifying result`: finalized session dengan ≥1 error yang mempunyai remediation generator.
- `eligible weak-skill player`: mempunyai baseline ≥10 answers dari ≥2 sessions dan recent accuracy ≤80% pada sub-skill.
- Semua retention/funnel metrics mengecualikan team/test/bot accounts dan dibagi per app/content version.

Guardrails dan zero-tolerance metrics:

| Metric | Gate |
|---|---:|
| Production mathematical correctness incident | 0 |
| Accepted invalid/replayed leaderboard result | 0 |
| Verified migration data-loss incident | 0 |
| Public-profile safety/privacy severity-1 incident | 0 |
| Campaign fatal client-error sessions | <0.5% |
| V2 vs baseline Lv1 exit-rate regression | Kenaikan relatif ≤10% |

---

## 24. Performance Requirements

Pengukuran synthetic dilakukan pada production build, cold cache, viewport 390×844, emulasi 1.6 Mbps downlink/750 Kbps uplink/150 ms RTT, dan CPU slowdown 4×. CI memakai median tiga run; production memakai p75 rolling 28 hari.

| Area | V2 GA gate |
|---|---|
| Initial JavaScript | ≤350 KiB gzip pada home entry |
| Initial CSS | ≤60 KiB gzip |
| Initial transfer | ≤600 KiB compressed, tidak termasuk cached font |
| Code splitting | Recharts, heatmap, achievements, leaderboard, dan non-home modes tidak berada pada initial chunk |
| Synthetic | Lighthouse mobile Performance ≥90, Accessibility 100, Best Practices ≥95 pada home dan campaign |
| Production CWV | p75 LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.10 |
| Local answer feedback | p95 submit-to-visual-feedback ≤100 ms pada synthetic device profile di atas |
| Question transition | p95 ≤100 ms; tidak ada request network untuk local modes |
| Local generation | p95 generate satu question ≤10 ms dan satu 25-question session ≤100 ms |
| Competitive endpoints | p95 server processing start/finalize ≤1,5 s dan answer acknowledgement ≤500 ms; final status ≤30 s untuk ≥99,5% submission |
| Fatal client error | <0.5% session per rolling 24 jam |

Browser support: dua major stable version terakhir Chrome, Edge, Firefox, Safari macOS, dan Safari iOS pada tanggal release. Critical E2E berjalan pada Chromium setiap PR dan seluruh browser matrix pada nightly/release.

Question generation tidak membutuhkan network call per question pada local modes. Campaign, practice, remediation, dan downloaded Daily replay tetap usable saat offline. Regresi initial bundle >5% atau p75 LCP/INP >10% dibanding release sebelumnya memerlukan review performance owner.

### 24.1 Reliability SLO and error budget

SLI dihitung per bulan kalender UTC dan dikelompokkan minimal per `appVersion`, `contentVersion`, dan `rulesVersion`.

| Journey | SLI numerator / denominator | Monthly SLO | Error budget |
|---|---|---:|---:|
| Static application delivery | Probe yang memuat HTML dan seluruh referenced critical asset / seluruh scheduled probes | 99,90% | 0,10%; 43m12s time-equivalent |
| Campaign/practice | Non-user-abandoned starts yang mencapai terminal tanpa fatal client error / seluruh non-user-abandoned starts | 99,50% | 0,50%; 3h36m time-equivalent |
| Cloud sync | Operation yang seluruh accepted event-nya mendapat ACK ≤60s saat online atau ≤24h dari durable queue / seluruh operation yang diterima client outbox | 99,50% | 0,50% operations |
| Competitive validation | Protocol request yang mendapat non-5xx valid response ≤5s / seluruh request yang mencapai trusted backend | 99,50% | 0,50% requests |
| Ranked finalization | Accepted finalize request yang mendapat terminal status ≤30s / seluruh accepted finalize requests | 99,50% | 0,50% requests |

Jika >50% error budget satu journey habis dalam tujuh hari, rollout feature baru pada journey tersebut dibekukan. Leaderboard integrity adalah zero-tolerance gate terpisah, bukan availability SLO: accepted invalid/replayed result harus 0. Satu pelanggaran integrity, satu verified migration data-loss incident, atau privacy severity-1 incident langsung menghentikan rollout dan mengaktifkan incident/rollback procedure.

### 24.2 Operational acceptance criteria

```text
AC-OPS-01: Bundle, Lighthouse, CWV, local latency, dan competitive latency memenuhi seluruh gate §24.
AC-OPS-02: Critical E2E lulus pada browser matrix yang didukung tanpa unresolved blocker.
AC-OPS-03: Dashboard dan alert menghitung setiap SLI §24.1 dari numerator/denominator serta version dimension yang ditentukan.
AC-OPS-04: Setiap tahap rollout §28.2 hanya naik setelah observation, sample, dan error-budget gate terpenuhi.
AC-OPS-05: Staging exercise membuktikan rollback frontend/backend/rules ≤15 menit dan stop migration ≤30 menit.
```

---

## 25. Security Requirements

| Area | Requirement |
|---|---|
| Auth | Firebase authenticated identity wajib untuk cloud dan seluruh ranked mode |
| App attestation | Valid App Check wajib pada seluruh trusted mutation endpoint, termasuk competitive dan sync; monitoring mode mendahului enforcement |
| User writes | Client hanya dapat menulis allowlisted profile fields; sync event masuk melalui trusted endpoint dan client bukan aggregate authority |
| Leaderboard | Competitive collection server-write only; public projection mematuhi §20 |
| Server time | Session window, final result, dan leaderboard memakai trusted timestamp |
| Replay/idempotency | One-time session/token dan idempotency key pada seluruh mutation |
| Input | Schema, type, range, length, answer kind, mode, version, dan state transition divalidasi server |
| Firestore | Rules serta indexes version-controlled dan diuji pada Emulator Suite |
| Rate limits | Per UID, IP/risk signal, endpoint, dan mode; response tidak membocorkan detection detail |
| Secrets | Tidak ada Admin credential, signing secret, atau privileged backend configuration di client bundle |
| Web platform | CSP, frame protection, MIME sniffing protection, referrer policy, dan TLS ownership didefinisikan pada deploy config |
| Supply chain | Frozen lockfile, secret scan, dependency/image scan, dan SBOM menjadi release gate |

Anonymous play tetap diperbolehkan untuk local campaign/practice. Anonymous account atau offline result tidak eligible untuk ranked submission. Authentication dan App Check saling melengkapi; keduanya tidak menggantikan server-side authorization serta validation.

Security logging mencatat request/result ID, rule version, generic rejection code, dan server time tanpa jawaban mentah, token, atau email. Critical vulnerability pada reachable production path memblokir promotion; accepted forged/replayed result diperlakukan sebagai severity-1 integrity incident.

---

## 26. Testing Strategy

Vitest digunakan untuk unit/component/domain tests dan Playwright untuk browser E2E. Property-testing library dapat dipilih Engineering, tetapi seed replay dan independent mathematical oracle adalah requirement.

### 26.1 Test pyramid and release gates

| Layer | Minimum scope | Pull request | Nightly/release |
|---|---|---|---|
| Static | TypeScript strict, lint, production build, unused/dead import check | Wajib | Wajib |
| Unit domain | Generator, parser, score, stars, mastery, migration, seed, selector, reducers, validator | Branch coverage P0 domain ≥95% | Wajib |
| Property/invariant | Independent oracle, ranges, unique solution, answer format, duplicate, determinism | ≥10.000 cases per generator family | ≥100.000 cases per family |
| Component | Level/Boss card, keypad variants, result, heatmap, remediation, mode HUD, pending/rejected/error state | Wajib | Wajib |
| Emulator integration | Auth/rules deny paths, trusted write, idempotency, replay, sync conflict, account epoch | Wajib | Wajib |
| Browser E2E | Campaign, migration, Daily, practice, remediation, Sprint, Survival, sync, delete/reset | Chromium critical subset | Full supported-browser matrix |
| Accessibility | axe, keyboard, focus, live region, reduced motion | Zero critical/serious | Manual screen-reader smoke |
| Performance | Bundle budget dan synthetic Lighthouse | Wajib | Production-like staging |
| Security/supply chain | Secret/dependency scan | Wajib | Image scan dan SBOM |
| Deployment smoke | HTML, hashed assets, SPA refresh, config, validator health, satu playable local question | Staging | Production |

### 26.2 Core regression scenarios

```text
AC-CORE-01: Final answer benar atau salah masuk summary tepat satu kali.
AC-CORE-02: Double click, touch, dan keyboard repeat tidak membuat duplicate event/score.
AC-CORE-03: Timeout/input race menghasilkan satu terminal SessionResult.
AC-CORE-04: Timer tidak melambat/berulang ketika React state berubah atau tab background/resume.
AC-CORE-05: Pause mengeluarkan paused duration dari campaign response time dan speed score.
AC-CORE-06: Main Lagi membuat session baru pada Campaign, Sprint, Survival, dan Practice.
AC-CORE-07: Unanswered timeout tidak dihitung sebagai solved; displayed totals tetap konsisten.
AC-CORE-08: Reset local/cloud tidak direhidrasi oleh stale device/outbox.
AC-CORE-09: Practice dan Daily memperbarui stats/mastery tepat sesuai eligibility matrix.
AC-CORE-10: Navigation/counts tidak mempunyai literal 24/72/216 di luar registry atau explicit fixture.
```

### 26.3 Critical end-to-end scenarios

```text
New local player → Level 1 → valid summary → next unlocked → offline reload persists.
Failed/timeout level → review unanswered → next locked → remediation available.
V1 snapshots 1–24 → V2 migration → sync second device → no protected-field loss.
Boss completed at each threshold → tier unlock and star policy correct.
Integer/rational/decimal input → canonical validation and accessible keypad behavior.
Daily same challenge instant → same WIB challenge ID/version across devices.
Daily first server-issued slot consumed → failed/abandoned/rejected cannot obtain a second ranked slot → replay clearly unranked.
Sprint deadline exactly 60.000 ms → no time bonus → server-recomputed result.
Survival +2/-4 and 60 s cap → server sequence and client HUD reconcile.
Forged/direct/duplicate/cross-user leaderboard writes → rejected without projection.
Offline events on two devices → deterministic union; repeated upload remains idempotent.
Analytics opt-out and under-13 mode → prohibited events/profile writes absent.
Delete Account → private data dan public projection deleted within policy; retained aggregate cannot be related back to player/result.
```

Property failure WAJIB mencetak generator key, all version fields, seed, rules, dan minimized counterexample. E2E flake rate maksimal 1% rolling 30 hari; flaky test dikarantina dan tidak dapat dipakai sebagai release evidence. Clean checkout WAJIB menghasilkan artifact identik menggunakan satu frozen package-manager lockfile.

---

## 27. Acceptance Criteria per Epic

### E1 — Engine Refactor

```text
AC-E1-01: Domain generator/navigation tidak mempunyai branch behavior berdasarkan numeric level ID.
AC-E1-02: Registry memuat tepat 72 unique stable IDs dan menolak duplicate ID/order atau invalid DAG.
AC-E1-03: Next level/unlock berasal dari order + prerequisite registry, bukan arithmetic ID.
AC-E1-04: Total level/max stars/tier count dihitung dari registry tanpa literal UI.
AC-E1-05: Integer, rational, decimal, dan choice AnswerSpec lulus parser/evaluator contract tests.
AC-E1-06: Session reducer memenuhi seluruh AC-CORE pada §26.2.
AC-E1-07: Immutable 72-level content manifest memuat seluruh field §21.2 dan lulus schema/invariant validation.
```

### E2 — Progress Migration

```text
AC-E2-01: Seluruh mapping dan protected field memenuhi AC-MIG pada §11.3 dan Appendix B.
AC-E2-02: Migration, retry, dan multi-device merge idempotent.
AC-E2-03: Legacy stars collision tersimpan sebagai visible legacy credits, bukan hilang/digandakan.
AC-E2-04: Fresh user hanya membuka T1-ADD-01 tanpa legacy import.
AC-E2-05: Rollback window 30 hari mempertahankan V1/V2 dual-read data.
AC-E2-06: LegacySkillEvidence tidak berkontribusi ke mastery, confidence, atau V2 achievement.
```

### E3 — 72 Level Campaign

```text
AC-E3-01: 6 tier × 12 level tersedia.
AC-E3-02: Boss berada pada 12/24/36/48/60/72.
AC-E3-03: Seluruh level lulus property/invariant gate pada §10 dan §26.
AC-E3-04: Dalam closed playtest, adjacent non-Boss completion-rate drop ≤20 poin persentase dan median-time increase ≤40%; exception membutuhkan documented Product+Content sign-off.
AC-E3-05: Boss passing/star rules persis mengikuti §8.2.1.
```

### E4 — Mastery

```text
AC-E4-01: Eligible answer memperbarui tagged mastery tepat satu kali berdasarkan event ID.
AC-E4-02: Mastery menunjukkan Belum Cukup Data sebelum 10 answers/2 sessions.
AC-E4-03: Formula, weak/strong threshold, recency, dan accessibility behavior mengikuti §8.3.3.
AC-E4-04: Recompute event set/version yang sama menghasilkan mastery score identik.
AC-E4-05: Repeated incorrect attempt tidak menaikkan mastery.
```

### E5 — Mistake Training

```text
AC-E5-01: Result dengan error menyediakan Latih Kesalahan Saya.
AC-E5-02: 100% remediation question membawa failed primary/supporting skill tag yang sesuai.
AC-E5-03: Session berisi 5–15 soal, exact prompt repeat ≤1, template-family share ≤30%.
AC-E5-04: Eligible remediation result memperbarui mastery tetapi tidak campaign stars/leaderboard.
```

### E6 — Adaptive Practice V2

```text
AC-E6-01: Pada ≥100 seeded sessions, distribusi tiap bucket berada ±10 poin persentase dari 50/25/15/10 policy.
AC-E6-02: Satu sub-skill maksimal 40% session dan template identik tidak berurutan.
AC-E6-03: 100% generated question memenuhi prerequisite dan configured difficulty ceiling.
AC-E6-04: Cold-start diagnostic serta fallback config deterministic dan teruji.
```

### E7 — Sprint & Survival

```text
AC-E7-01: Sprint server window tepat 60.000 ms, tanpa pause/time mutation.
AC-E7-02: Survival memakai +2s benar, -4s salah, cap 60s, dan hard cap session 10 menit.
AC-E7-03: Mode, record, achievement, rulesVersion, dan leaderboard Sprint/Survival terpisah.
AC-E7-04: Sprint/Survival score serta tie-break persis mengikuti §15.
AC-E7-05: Given seed reference, answer sequence, contentVersion, dan rulesVersion yang sama, difficulty/timer/score sequence identik.
```

### E8 — Competitive Security

```text
AC-E8-01: Seluruh AC-COMP pada §16.2.5 dan Emulator deny-path tests lulus.
AC-E8-02: Client tidak mempunyai write path ke competitive result/leaderboard projection.
AC-E8-03: Invalid/replayed result accepted = 0 pada CI, closed beta, dan GA gate.
AC-E8-04: Simulated benchmark diberi label benchmark non-player atau tidak ditampilkan pada production leaderboard.
```

### E9 — Testing

```text
AC-E9-01: Seluruh PR/nightly/release gates §26 aktif pada protected branch.
AC-E9-02: Property failure dapat direproduksi dari printed seed/version/counterexample.
AC-E9-03: E2E flake rate rolling 30 hari ≤1%.
AC-E9-04: Artifact clean checkout dibangun dari frozen lockfile dan dipromosikan tanpa rebuild.
```

### E10 — Privacy, Accessibility, and Safety

```text
AC-E10-01: Seluruh AC-PRIV §20.4 lulus.
AC-E10-02: Critical journeys conform ke WCAG 2.2 AA dan release gate §19.4.
AC-E10-03: Under-13 local-only, analytics opt-out, pseudonym, report, export, reset, dan delete flows lulus E2E.
AC-E10-04: Zero critical/serious automated accessibility violation pada release artifact.
```

### E11 — Sync, Observability, and Operations

```text
AC-E11-01: Seluruh AC-SYNC §21.8 lulus pada local, emulator, dan two-device fixtures.
AC-E11-02: Seluruh AC-OPS §24.2 lulus dan dashboard/alerts mengelompokkan app/content/rules version.
AC-E11-03: Canary dapat dihentikan dan immutable frontend/backend/rules artifact dapat di-rollback sesuai §28.
AC-E11-04: Retention, migration restore, validator outage, dan integrity incident runbook diuji di staging.
```

---

## 28. Delivery, Rollout, and Rollback Plan

V2 adalah satu public GA. Bagian berikut adalah internal milestones dengan owner role, dependency, artifact, dan exit gate; milestone completion tidak mengubah Definition of Done V2 GA.

### Milestone V2.0-A — Foundation

**Owner:** Engineering Lead + QA Lead

**Scope:** core regression fixes, strict type/lint/build CI, typed answer model, registry engine, stable IDs, version tuple, timer/session reducer, migration framework, Firestore Emulator baseline.

**Exit gate:** AC-CORE lulus; P0 domain branch coverage ≥95%; V1 fixtures 1–24 lulus migration once/twice; clean checkout memakai npm frozen `package-lock.json`; V1-compatible UI dapat dimainkan melalui engine baru.

### Milestone V2.0-B — Campaign Expansion

**Owner:** Product Owner + Content Owner + Engineering Lead

**Dependency:** V2.0-A

**Scope:** 72 level, six Boss, revised stars/achievements, rational/decimal input, content versioning, balancing.

**Exit gate:** registry tepat 72 level; seluruh generator property suite lulus 10.000 cases/family PR dan 100.000 nightly; no invariant failure; closed-playtest difficulty gate §27 E3 lulus; bundle di bawah budget.

### Milestone V2.1 — Learning Intelligence

**Owner:** Product Owner + Learning/Content Owner

**Dependency:** V2.0-B event/taxonomy metadata

**Scope:** taxonomy, mastery, heatmap, weak-skill detection, mistake training, analytics contracts.

**Exit gate:** versioned mastery fixtures deterministic; insufficient-data behavior benar; result→remediation E2E lulus; telemetry contract dan 30-day restricted-evidence TTL aktif.

### Milestone V2.2 — Adaptive Practice

**Owner:** Product Owner + Engineering Lead

**Dependency:** V2.1 mastery

**Scope:** skill-aware selector, cold start, personalized distribution, accessibility timing profile.

**Exit gate:** seeded selector/distribution/prerequisite gates E6 lulus; explanation/fallback tersedia; keyboard/reduced-motion flows lulus.

### Milestone V2.3 — Competitive Modes

**Owner:** Backend/Security Lead + Product Owner

**Dependency:** V2.0 session/version contract, separate staging Firebase project, App Check, alerting, pseudonym/age policy

**Scope:** fixed Sprint, Survival, real Daily leaderboard, Cloud Functions trusted validator, server-only projection, abuse controls.

**Exit gate:** AC-COMP dan Emulator deny paths lulus; 100% closed-beta submissions mendapat terminal status; zero accepted invalid/replayed result; validator dashboard, alert, and outage fallback aktif.

### Milestone V2.4 — Polish and GA Readiness

**Owner:** Release Owner bersama Product, Engineering, Design, QA, Operations

**Dependency:** seluruh milestone sebelumnya

**Scope:** telemetry-driven balancing, accessibility, performance, privacy validation, operational runbooks, progressive rollout.

**Exit gate:** seluruh §31 Definition of Done dan quality gates hijau pada immutable release candidate; staging restore/rollback exercise lulus; sign-off lintas fungsi tercatat.

### 28.1 Build and environment policy

- NPM adalah package manager canonical; `package-lock.json` committed dan install memakai `npm ci`.
- Frontend, Cloud Functions, Firestore rules/indexes, dan content manifest mempunyai version/tag yang dapat dilacak ke commit SHA.
- Development, staging, dan production memakai Firebase project terpisah dan least-privilege service identity.
- Artifact frontend/backend dibangun sekali, mempunyai checksum dan SBOM, lalu artifact yang sama dipromosikan tanpa rebuild.
- Feature flag server-controlled memisahkan migration, 72-level registry, mastery/adaptive, dan setiap ranked mode.

### 28.2 Progressive rollout

| Stage | Audience | Minimum observation | Gate untuk lanjut |
|---|---:|---:|---|
| Internal | Team/test accounts | 7 hari | Tidak ada trigger §28.3; journey error budget tersisa ≥90%; zero data loss/integrity incident |
| Closed beta | Undangan pemain representatif | 7 hari | Usability severity tinggi ditutup; ranked terminal coverage ≥99,5%; tidak ada trigger §28.3 |
| Canary | 1% eligible accounts | 24 jam | Fatal error <0,5%; migration failure <0,1%; validator p95 ≤5 s; journey error budget tersisa ≥90% |
| Progressive 1 | 5% | 24 jam | Tidak ada trigger §28.3; CWV regression ≤10%; journey error budget tersisa ≥85% |
| Progressive 2 | 25% | 48 jam | Lv1 completion cohort tidak >10% relatif di bawah matched control; minimal 200 first Lv1 starts pada cohort dan control; error budget ≥80% |
| Progressive 3 | 50% | 48 jam | ≥80% error budget tersisa; zero integrity/privacy incident |
| V2 GA | 100% | Continuous | Product, Engineering, Design, QA, Operations sign-off |

Jika minimum observation atau sample belum terpenuhi, cohort tidak dinaikkan. Matched control memakai eligible account pada periode sama, platform mix yang sama, dan artifact production sebelumnya; team/test/bot account dikeluarkan.

Competitive flags tetap off sampai V2.3 exit gate. Migration additive berjalan per cohort; V1 data tidak dihapus selama rollback window 30 hari.

### 28.3 Rollback triggers and actions

| Trigger | Required action |
|---|---|
| Asset/HTTP failure >2% selama 5 menit | Stop rollout dan promote frontend artifact sebelumnya |
| Fatal client error >1% sessions selama 15 menit | Disable affected flag; rollback bila release-correlated |
| Validator error >2% atau p95 >5 s selama 10 menit | Disable new ranked starts; pertahankan pending queue; rollback function |
| Satu invalid/replayed result diterima | Freeze leaderboard write; severity-1 incident; invalidate/recompute affected scope |
| Migration failure >0.1% selama 15 menit | Stop cohort migration dan disable migration flag |
| Satu protected field terbukti hilang | Severity-1; stop rollout dan jalankan restore runbook |
| Privacy prohibited-field leakage | Stop pipeline, purge affected data, dan jalankan privacy incident process |

RTO rollback frontend/backend/rules adalah 15 menit; RTO menghentikan migration adalah 30 menit. RPO protected V1 progress adalah nol karena migration tidak menghapus atau menimpa legacy snapshot selama rollback window. Staging exercise mengukur RTO dari keputusan rollback tercatat sampai health probe dan satu playable local question pada artifact sebelumnya kembali lulus.

---

## 29. Priority Matrix

Priority menunjukkan urutan eksekusi, bukan izin untuk mengeluarkan item dari V2 GA.

| Priority | Item |
|---|---|
| P0 | Core integrity regression fixes: exactly-once answer/finalization dan monotonic timer |
| P0 | Level/question engine refactor |
| P0 | Stable level IDs + migration |
| P0 | Math generator automated tests |
| P0 | Versioned session/event/sync contract |
| P0 | Privacy/public-profile policy dan trusted validation foundation |
| P1 | Campaign 72 levels |
| P1 | Boss system |
| P1 | Skill mastery |
| P1 | Mistake training |
| P1 | Adaptive Practice V2 |
| P1 | Real Daily leaderboard |
| P1 | Fixed Sprint 60s dan Survival Kilat |
| P1 | Secure competitive validator + server-only leaderboard |
| P2 | Skill heatmap dan achievement presentation polish |
| P2 | Performance, accessibility, observability, rollout, and operational readiness |
| PASCA-V2 | XP/player meta-level, 1v1, tournament, clan/social |

---

## 30. Risks and Mitigations

| Risk | Measurable trigger | Mitigation / response |
|---|---|---|
| 72 levels repetitif | Purposeful replay atau tier continuation berada di bawah target §23 pada dua weekly cohorts berurutan | Template-family diversity, Boss mechanics, content review |
| Difficulty spike | Adjacent completion drop >20 pp atau median time rise >40% | Block content promotion, calibrate rules, rerun playtest |
| V1/V2 compatibility break | State parse error >0.1% session | Stop rollout, dual-read fallback, add failing payload fixture |
| Migration data loss | Satu protected field missing | Severity-1, stop migration, restore legacy snapshot |
| Wrong math/content drift | Satu invariant failure atau daily hash mismatch | Block content version, replay failing seed, restore previous manifest |
| Leaderboard forgery/replay | Satu invalid result accepted | Freeze writes, invalidate scope, security incident and recomputation |
| Validator outage | Error >2% atau p95 >5 s selama 10 menit | Disable new ranked sessions, retain pending results, rollback function |
| Firebase quota/cost spike | >80% daily quota atau forecast >120% monthly budget | Batch/aggregate, limit noncritical sampling, apply rate controls |
| Offline conflict | Conflict >0.5% sync/day atau stale data resurrection | Preserve evidence union, account epoch, deterministic reducer |
| Mastery confusing | Comprehension failure severity-high in usability test | Show status labels/reason, hide score before sufficient evidence |
| Mastery gaming | Exact-repeat contribution or abnormal event rate | Eligibility/dedupe cap, anomaly detection, no Daily replay evidence |
| Scope delay | Milestone misses exit gate twice | Freeze new scope; move only PASCA-V2 items, never silently relax integrity gates |
| Browser regression | Supported-browser E2E failure or >1% fatal error in one family | Stop promotion and disable affected feature |
| Privacy/public-name abuse | Prohibited telemetry field or validated harmful pseudonym | Stop/purge pipeline, hide profile, incident/moderation flow |
| Supply-chain issue | Reachable critical vulnerability | Block artifact, update locked dependency/image, regenerate SBOM |
| Static health false positive | Browser smoke fails while root HTTP is 200 | Treat deploy as failed and rollback; healthcheck includes asset/gameplay |

---

## 31. Definition of Done V2

Hitung Kilat hanya dapat disebut **V2 GA** jika seluruh kondisi berikut mempunyai evidence pada release candidate yang sama:

- Registry dan immutable content manifest berisi 72 level, 6 Boss, 216 maximum stars, typed AnswerSpec, parameter session lengkap, dan zero generator invariant failure.
- Tidak ada numeric level-ID behavior; versioned registry/session/event contracts menjadi source of truth.
- Seluruh AC-CORE, AC-MIG, AC-SYNC, AC-COMP, AC-PRIV, dan E1–E11 lulus.
- V1 progress 1–24 termigrasi idempotent tanpa protected-field loss dan rollback window aktif.
- Campaign/Boss, result review, mastery, heatmap, Mistake Training, dan Adaptive Practice tersedia.
- Sprint benar-benar fixed 60 detik; Survival terpisah; Daily memakai canonical WIB challenge.
- Daily/Sprint/Survival ranked hanya menerima server-validated result, memisahkan leaderboard per version, dan tidak menampilkan bot sebagai pemain nyata.
- Privacy/child-safety controls, retention jobs, export/reset/delete, pseudonym moderation, dan analytics consent aktif.
- Critical journeys memenuhi WCAG 2.2 AA dan seluruh performance/browser gates §19/§24.
- CI/test pyramid, seluruh AC-OPS, emulator rules, security scan, SBOM, staging/production smoke, dashboards, alerts, dan runbooks aktif.
- Progressive rollout selesai tanpa rollback trigger, integrity incident, privacy incident, atau migration data loss.
- Product, Engineering, Design, QA, Security, dan Operations memberi recorded sign-off.

---

## 32. Closing Product Statement

V2 tidak bertujuan membuat Hitung Kilat mempunyai sebanyak mungkin fitur. V2 memperkuat empat hal yang menjadi inti produk:

- **Content depth:** progression 72 level yang bertahap dan bermakna.
- **Learning intelligence:** pemain mengetahui kelemahan dan mendapat latihan relevan.
- **Core integrity:** setiap answer, timer, score, migration, dan sync menghasilkan state yang benar.
- **Competitive integrity:** ranking mempunyai arti karena rules jelas dan authority berada pada backend.

Dengan fondasi tersebut, fitur sosial seperti 1v1, tournament, classroom, atau teacher dashboard dapat dikembangkan PASCA-V2 tanpa merombak core domain kembali.

---

## Appendix A — V1 Source Findings

Baseline review dilakukan terhadap source branch `main`. Temuan ini adalah regression input, bukan daftar implementasi V2 yang lengkap.

| Finding V1 | Evidence area | Consequence in this PRD |
|---|---|---|
| Campaign mempunyai 24 level/6 tier dengan numeric ID | `src/utils/mathGenerator.ts`, `src/types.ts` | Stable string ID, registry, 72-level content |
| Generator bercabang pada `config.id` | `src/utils/mathGenerator.ts` | Typed rule-driven generator registry |
| Navigation/unlock memakai `id + 1` dan batas 24 | `src/App.tsx` | Registry order/prerequisite dan dynamic counts |
| Final campaign answer dapat dibaca dari state sebelum update committed | `src/components/PlayScreen.tsx` | Immutable answer reducer dan AC-CORE-01 |
| Interval timer dibuat ulang saat callback/state jawaban berubah | `PlayScreen.tsx`, `TimeAttackScreen.tsx` | Monotonic absolute deadline dan timer regression tests |
| Feedback delay tidak mempunyai universal answer lock | Semua gameplay screens | Exactly-once question event dan input lock |
| Retry result hanya benar-benar restart Campaign | `src/App.tsx`, `ResultModal.tsx` | Action contract per mode pada §12 |
| Practice tidak mengirim summary ke global stats | `PracticeScreen.tsx` | Unified session/result pipeline dan eligibility matrix |
| Stars total dapat tertinggal; reset tidak mencakup Daily/achievement/cloud epoch | `src/App.tsx`, `achievements.ts` | Event-derived aggregates dan account-epoch reset |
| Daily memakai browser-local date dan historical replay dapat mengubah streak basis | `src/utils/dailyChallenge.ts` | Server-issued WIB challenge dan immutable ranked record |
| Daily “global” ranking berisi deterministic bot benchmarks | `src/utils/dailyChallenge.ts` | Real-player projection; bot tidak menyamar sebagai user |
| Cloud merge memakai max/last-write semantics pada cumulative data | `src/lib/firebase.ts` | Idempotent event journal dan per-data merge rules |
| Time Attack menerima +2/-4 dan score ditulis dari client | `TimeAttackScreen.tsx`, `firebase.ts`, `firestore.rules` | Pisah Sprint/Survival dan trusted validator |
| Tidak ada automated test/CI; Docker npm install tidak memakai npm lockfile | `package.json`, `Dockerfile`, `bun.lock` | Frozen npm toolchain dan §26 quality gates |

---

## Appendix B — Normative V1 → V2 Level Mapping

`Legacy skill evidence` adalah aggregate low-confidence signal untuk diagnostic priority; ia tidak menambah eligible mastery attempts karena V1 tidak menyimpan reliable per-question history. Imported stars hanya masuk primary anchor. `Highest available` membuka prerequisite chain tanpa memberi stars pada level yang belum dimainkan.

| V1 | Actual V1 content | Primary V2 anchor | Legacy skill evidence | Highest available |
|---:|---|---|---|---|
| 1 | Penjumlahan satuan 1–10 | `T1-ADD-01` | `addition.single_digit` | `T1-ADD-01` |
| 2 | Pengurangan dasar tanpa negatif | `T1-SUB-01` | `subtraction.single_digit` | `T1-SUB-01` |
| 3 | Satu operasi acak +/− sampai puluhan kecil | `T1-MIX-01` | `addition.within_20`, `subtraction.within_20` | `T1-MIX-01` |
| 4 | Missing addend | `T1-MISS-01` | `missing_operand.add_inverse` | `T1-MISS-01` |
| 5 | Perkalian faktor 2, 3, dan 5 | `T2-MUL-05` | `multiplication.x2`, `.x3`, `.x5` | `T2-MUL-05` |
| 6 | Perkalian faktor 4–9 | `T2-MUL-09` | `multiplication.x4` sampai `.x9` | `T2-MUL-09` |
| 7 | Pembagian integer bersih, divisor/quotient 2–10 | `T2-DIV-02` | `division.basic_235`, `.x4_9_inverse` | `T2-DIV-02` |
| 8 | Satu operasi acak +/−/×/÷ | `T3-MIX-01` | Four basic operations | `T3-MIX-01` |
| 9 | Penjumlahan puluhan | `T3-ADD-01` | `addition.tens` | `T3-ADD-01` |
| 10 | Pengurangan puluhan | `T3-SUB-01` | `subtraction.tens` | `T3-SUB-01` |
| 11 | Missing multiplication factor | `T2-MISS-01` | `missing_operand.multiplication_factor` | `T2-MISS-01` |
| 12 | Campuran tambah/kurang puluhan | `T3-MIX-01` | `addition.tens`, `subtraction.tens` | `T3-MIX-01` |
| 13 | Tiga operand +/− | `T4-CHAIN-03` | `multi_operation.three_terms` | `T4-CHAIN-03` |
| 14 | `a + b × c` | `T4-BODMAS-01` | `bodmas.mul_priority` | `T4-BODMAS-01` |
| 15 | `(a - b) × c` | `T4-PAREN-02` | `bodmas.parentheses` | `T4-PAREN-02` |
| 16 | Penjumlahan/pengalian dengan pembagian bersih | `T4-BODMAS-03` | `bodmas.div_priority`, `.parentheses` | `T4-BODMAS-03` |
| 17 | +/− dengan kemungkinan hasil negatif | `T5-NEG-01` | `signed_number.negative_sub` | `T5-NEG-01` |
| 18 | Faktor pertama 11–19, faktor kedua 3–14 | `T5-MUL-15-19` | `multiplication.11_14`, `.15_19` | `T5-MUL-15-19` |
| 19 | Aljabar dua langkah `m × ? + c` | `T5-ALG-02` | `algebra.two_step` | `T5-ALG-02` |
| 20 | Satu operasi campuran range lebar | `T5-BLITZ` | Four basic operations; signed result possible | `T5-BLITZ` |
| 21 | Kuadrat 4²–22² | `T6-SQUARE-03` | Seluruh square bands sebagai low-confidence evidence | `T6-SQUARE-03` |
| 22 | Aljabar bersarang `(base - ?) × m` | `T6-ALG-03` | `algebra.nested` | `T6-ALG-03` |
| 23 | Satu operasi campuran range sangat lebar | `T6-BLITZ` | Four basic operations; signed result possible | `T6-BLITZ` |
| 24 | Final 20 soal, satu operasi per soal, range terlebar | `T6-GRANDMASTER` | Four basic operations; tidak memberi evidence skill V2 baru | `T6-GRANDMASTER` |

V1 Lv8 dan Lv12 berbagi primary anchor. Best-of masuk anchor tersebut; star collision masuk `legacyStarCredits`. V1 Lv24 boleh membuka akses hingga Grandmaster untuk menjaga progression, tetapi tidak memberi mastery pada fraction, ratio, percentage, root, signed operand, atau advanced BODMAS yang tidak dibuktikan V1.

---

## Appendix C — Engineering Workstreams and Dependencies

| Workstream | Primary deliverable | Depends on | Accountable role |
|---|---|---|---|
| A. Core Domain and Content | Registry, generators, AnswerSpec, session reducer, 72-level manifest | — | Engineering Lead |
| B. Progress and Migration | Legacy import, event journal, account epoch, sync reducers | A contracts | Data/Platform Lead |
| C. Learning Intelligence | Taxonomy, mastery, remediation, adaptive selector | A events + B persistence | Product/Learning Lead |
| D. Competitive Backend | Cloud Functions sessions, validator, rules, projections | A versions + B identity | Backend/Security Lead |
| E. Product UI | Campaign, Boss, input kinds, result, heatmap, competitive states | A–D stable contracts | Design/Frontend Lead |
| F. Quality Engineering | Unit/property/component/emulator/E2E/performance/a11y gates | Starts with A; continuous | QA Lead |
| G. Analytics and Operations | Schemas, dashboards, flags, SLO, rollout/rollback | B events + D backend | Operations/Analytics Lead |

Critical dependency path:

```text
Core integrity + versioned contracts
  → migration/sync + tests
  → 72-level content
  → mastery/remediation
  → adaptive practice
  → competitive validator/modes
  → balance, accessibility, rollout, V2 GA
```

---

## Appendix D — Repository-Specific Change Map

Dokumen ini bukan implementation plan; tabel hanya menunjukkan impact surface yang harus tercakup saat planning.

| Existing/new area | V2 impact |
|---|---|
| `src/utils/mathGenerator.ts` | Pecah menjadi registry, typed generators, injected PRNG, independent evaluator |
| `src/types.ts` | Stable IDs, rules, AnswerSpec, VersionTuple, session/result/mastery contracts |
| New versioned campaign manifest | Seluruh 72 LevelConfig, typed rules, skills, timing, prerequisites, dan contentVersion |
| `src/App.tsx` | Route/state orchestration, migration gate, account epoch, feature flags |
| `src/components/LevelMap.tsx` | 72-level registry rendering, Boss states, virtualized/collapsible tiers bila dibutuhkan |
| `src/components/PlayScreen.tsx` | Unified reducer, monotonic timer, answer lock, multiple input kinds |
| `src/components/ResultModal.tsx` | Truthful totals, validation states, mastery delta, remediation CTA, mode-aware retry |
| `src/components/TimeAttackScreen.tsx` | Pisah Sprint/Survival contracts dan HUD |
| `src/components/DailyChallengeScreen.tsx` | WIB challenge, ranked/replay split, real leaderboard |
| `src/utils/dailyChallenge.ts` | Versioned deterministic content; hapus bot-as-player path |
| `src/lib/firebase.ts` | Decompose monolithic sync; trusted API client; no direct score write |
| `firestore.rules` + indexes | Field allowlists, server-only competitive paths, emulator tests |
| New Cloud Functions workspace | Competitive start/answer/finalize, materializers, retention/deletion jobs |
| New migration/storage modules | Legacy mapping, durable outbox, reducers, reset epoch |
| `index.html` and components | Indonesian locale, semantic controls, accessibility metadata |
| `package.json`/lockfile | npm canonical scripts for lint/typecheck/test/build/e2e/security |
| New CI workflows | PR, nightly property/browser, release artifact/promotion gates |
| Docker/Nginx/deploy config | Immutable artifact, CSP, meaningful browser smoke, frontend/backend separation |

Implementation plan dibuat setelah PRD disetujui dan memecah workstream menjadi independently reviewable increments; big-bang rewrite tidak diperbolehkan.

---

## Appendix E — Product Decision Register

| ID | Decision | V2 choice |
|---|---|---|
| D-01 | Document/release model | Satu PRD dan satu V2 GA; V2.0-A–V2.4 adalah internal milestones |
| D-02 | Campaign | 6 tier × 12 level = 72 level; Boss di akhir setiap tier |
| D-03 | Progression | Minimum 1★; stable ID + prerequisite registry; maksimum 216★ |
| D-04 | V1 preservation | Full legacy snapshot, primary anchor, low-confidence skill evidence, legacy star credits |
| D-05 | Answer types | Typed integer, rational, decimal, dan choice; no generic `parseInt` validation |
| D-06 | Primary learning metric | Versioned mastery formula dengan 10 answers/2 sessions minimum sample |
| D-07 | Remediation | Similar tagged variants; 5–15 soal; no campaign star/leaderboard effect |
| D-08 | Adaptive mix | 50% weak, 25% medium, 15% recent error, 10% maintenance dengan caps |
| D-09 | Daily authority | Server challenge ID, one content version per WIB day, 75 s target/90 s hard limit |
| D-10 | Daily attempt | Slot dikonsumsi saat backend menerbitkan sequence 1; tidak ada retry slot setelah fail/abandon/reject |
| D-11 | Sprint | Fixed server window 60.000 ms, no time mutation, score formula §15.3 |
| D-12 | Survival | Start/cap 60 s, correct +2 s, wrong -4 s, Sprint difficulty bands, hard cap 10 menit |
| D-13 | Ranked eligibility | Authenticated + online + App Check; client result provisional |
| D-14 | Competitive authority | Cloud Functions validates and writes; Firestore client write denied |
| D-15 | Anti-cheat scope | Server anti-tamper/replay/rate controls; advanced human-vs-bot proof PASCA-V2 |
| D-16 | Public identity | Opt-in pseudonym + optional flag + opaque subject ID; no automatic Google name/photo/Auth UID |
| D-17 | Child mode | Under-13 selalu local-only pada V2; guardian-managed cloud adalah PASCA-V2 |
| D-18 | Retention | Competitive raw evidence 30 hari; analytics aggregate 13 bulan; audit 90 hari; public projection removed on opt-out/delete |
| D-19 | Offline/sync | Durable immutable event journal, trusted ingestion, deterministic reducers, account epoch reset |
| D-20 | Accessibility | WCAG 2.2 AA critical journeys; non-ranked accessibility timing profile |
| D-21 | Toolchain | npm + committed `package-lock.json` + `npm ci`; immutable promoted artifacts |
| D-22 | Visual identity | Purple/pink/orange identity existing dipertahankan; no major redesign |
| D-23 | Session state | Satu canonical lifecycle; competitive validation adalah state orthogonal |
| D-24 | Content contract | One immutable 72-level manifest implementing §8/§21; bukan PRD terpisah |

Perubahan decision membutuhkan revisi dokumen, rationale, impact analysis, dan approval role yang tercantum pada metadata.

---

## Appendix F — External Standards and Platform References

- [W3C Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
- [Core Web Vitals metrics and thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds)
- [Firebase App Check](https://firebase.google.com/products/app-check)
- [Firebase App Check for custom backend resources](https://firebase.google.com/docs/app-check/web/custom-resource)

External references membantu interpretasi requirement, tetapi versioned product decisions pada Appendix E tetap menjadi contract V2. Jika platform limit berubah, implementation dapat menyesuaikan storage layout tanpa mengurangi outcome privacy, integrity, atau reliability.

---

## Appendix G — Glossary

| Term | Definition |
|---|---|
| Account epoch | Generasi data account; reset membuat epoch baru agar stale event tidak hidup kembali |
| Active duration | Waktu gameplay yang eligible setelah pause exclusion sesuai mode |
| Answer event | Immutable record satu submission untuk satu question sequence |
| Challenge ID | Stable Daily identity yang mengikat tanggal WIB dan content version |
| Content manifest | Immutable versioned registry level, rules reference, dan content metadata |
| Eligible answer | Answer finalized tepat sekali dan memenuhi policy mode untuk stats/mastery |
| Finalized | Session sudah mempunyai satu terminal immutable result |
| Legacy star credit | Stars V1 yang dipreservasi ketika beberapa V1 records bertemu satu V2 anchor |
| Mastery | Versioned 0–100 learning estimate; bukan campaign stars atau competitive score |
| Ranked | Online authenticated session yang eligible untuk trusted leaderboard |
| Rules version | Version scoring, timer, eligibility, tie-break, dan validation |
| Stable ID | Identity immutable yang tidak bergantung pada display order atau translation |
| Trusted validator | Cloud Function yang menjadi authority competitive session/result |

---

## Appendix H — Revision History

| Document revision | Date | Summary |
|---|---|---|
| 2.0 Draft | 10 September 2026 | Initial V2 proposal: 72 levels, mastery, adaptive, and competition |
| 2.1 Review Candidate | 11 September 2026 | Consolidated normative PRD; exact mode rules, migration map, data/privacy, quality and rollout gates |
