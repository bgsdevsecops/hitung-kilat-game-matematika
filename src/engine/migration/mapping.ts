export interface V1LevelMapping {
  v1Id: number;
  primaryLevelId: string;
  order: number;
  title: string;
}

export const V1_TO_V2_LEVEL_MAPPING: Record<number, V1LevelMapping> = {
  1: { v1Id: 1, primaryLevelId: 'T1-ADD-01', order: 1, title: 'Penjumlahan satuan 1–10' },
  2: { v1Id: 2, primaryLevelId: 'T1-SUB-01', order: 2, title: 'Pengurangan dasar tanpa negatif' },
  3: { v1Id: 3, primaryLevelId: 'T1-MIX-01', order: 3, title: 'Satu operasi acak +/− sampai puluhan kecil' },
  4: { v1Id: 4, primaryLevelId: 'T1-MISS-01', order: 4, title: 'Missing addend' },
  5: { v1Id: 5, primaryLevelId: 'T2-MUL-05', order: 13, title: 'Perkalian faktor 2, 3, dan 5' },
  6: { v1Id: 6, primaryLevelId: 'T2-MUL-09', order: 15, title: 'Perkalian faktor 4–9' },
  7: { v1Id: 7, primaryLevelId: 'T2-DIV-02', order: 18, title: 'Pembagian integer bersih, divisor/quotient 2–10' },
  8: { v1Id: 8, primaryLevelId: 'T3-MIX-01', order: 25, title: 'Satu operasi acak +/−/×/÷' },
  9: { v1Id: 9, primaryLevelId: 'T3-ADD-01', order: 26, title: 'Penjumlahan puluhan' },
  10: { v1Id: 10, primaryLevelId: 'T3-SUB-01', order: 27, title: 'Pengurangan puluhan' },
  11: { v1Id: 11, primaryLevelId: 'T2-MISS-01', order: 23, title: 'Missing multiplication factor' },
  12: { v1Id: 12, primaryLevelId: 'T3-MIX-01', order: 35, title: 'Campuran tambah/kurang puluhan' },
  13: { v1Id: 13, primaryLevelId: 'T4-CHAIN-03', order: 37, title: 'Tiga operand +/−' },
  14: { v1Id: 14, primaryLevelId: 'T4-BODMAS-01', order: 43, title: 'a + b × c' },
  15: { v1Id: 15, primaryLevelId: 'T4-PAREN-02', order: 45, title: '(a - b) × c' },
  16: { v1Id: 16, primaryLevelId: 'T4-BODMAS-03', order: 48, title: 'Penjumlahan/pengalian dengan pembagian bersih' },
  17: { v1Id: 17, primaryLevelId: 'T5-NEG-01', order: 49, title: '+/− dengan kemungkinan hasil negatif' },
  18: { v1Id: 18, primaryLevelId: 'T5-MUL-15-19', order: 54, title: 'Faktor pertama 11–19, faktor kedua 3–14' },
  19: { v1Id: 19, primaryLevelId: 'T5-ALG-02', order: 57, title: 'Aljabar dua langkah m × ? + c' },
  20: { v1Id: 20, primaryLevelId: 'T5-BLITZ', order: 60, title: 'Satu operasi campuran range lebar' },
  21: { v1Id: 21, primaryLevelId: 'T6-SQUARE-03', order: 61, title: 'Kuadrat 4²–22²' },
  22: { v1Id: 22, primaryLevelId: 'T6-ALG-03', order: 69, title: 'Aljabar bersarang (base - ?) × m' },
  23: { v1Id: 23, primaryLevelId: 'T6-BLITZ', order: 70, title: 'Satu operasi campuran range sangat lebar' },
  24: { v1Id: 24, primaryLevelId: 'T6-GRANDMASTER', order: 72, title: 'Final 20 soal, satu operasi per soal, range terlebar' },
};
