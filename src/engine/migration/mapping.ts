export interface V1LevelMapping {
  v1Id: number;
  primaryLevelId: string;
  order: number;
  title: string;
}

export const V1_TO_V2_LEVEL_MAPPING: Record<number, V1LevelMapping> = {
  1: { v1Id: 1, primaryLevelId: 'T1-ADD-01', order: 1, title: 'Penjumlahan 1–10' },
  2: { v1Id: 2, primaryLevelId: 'T1-ADD-02', order: 2, title: 'Penjumlahan 1–20' },
  3: { v1Id: 3, primaryLevelId: 'T1-SUB-01', order: 3, title: 'Pengurangan 1–15' },
  4: { v1Id: 4, primaryLevelId: 'T1-SUB-02', order: 4, title: 'Pengurangan 1–20' },
  5: { v1Id: 5, primaryLevelId: 'T2-MUL-02', order: 13, title: 'Perkalian Dasar (2,3,5)' },
  6: { v1Id: 6, primaryLevelId: 'T2-MUL-04', order: 15, title: 'Perkalian 4 & 6' },
  7: { v1Id: 7, primaryLevelId: 'T2-MUL-07', order: 18, title: 'Perkalian 7, 8, 9' },
  8: { v1Id: 8, primaryLevelId: 'T2-DIV-01', order: 21, title: 'Pembagian Dasar' },
  9: { v1Id: 9, primaryLevelId: 'T3-ADD-01', order: 25, title: 'Penjumlahan Dua Digit' },
  10: { v1Id: 10, primaryLevelId: 'T3-SUB-01', order: 27, title: 'Pengurangan Dua Digit' },
  11: { v1Id: 11, primaryLevelId: 'T2-MISS-01', order: 23, title: 'Misteri Pengali' },
  12: { v1Id: 12, primaryLevelId: 'T3-MIX-01', order: 35, title: 'Ujian Terampil' },
  13: { v1Id: 13, primaryLevelId: 'T4-CHAIN-03', order: 37, title: 'Tiga Angka Beruntun' },
  14: { v1Id: 14, primaryLevelId: 'T4-BODMAS-01', order: 43, title: 'Prioritas Operasi Dasar' },
  15: { v1Id: 15, primaryLevelId: 'T4-PAREN-01', order: 45, title: 'Operasi Kurung' },
  16: { v1Id: 16, primaryLevelId: 'T4-BOSS', order: 48, title: 'Ujian Mahir' },
  17: { v1Id: 17, primaryLevelId: 'T5-NEG-01', order: 49, title: 'Bilangan Negatif' },
  18: { v1Id: 18, primaryLevelId: 'T5-MUL-11-14', order: 54, title: 'Perkalian Belasan' },
  19: { v1Id: 19, primaryLevelId: 'T5-ALG-01', order: 57, title: 'Aljabar Sederhana' },
  20: { v1Id: 20, primaryLevelId: 'T5-BOSS', order: 60, title: 'Ujian Master' },
  21: { v1Id: 21, primaryLevelId: 'T6-SQUARE-01', order: 61, title: 'Pangkat Dua' },
  22: { v1Id: 22, primaryLevelId: 'T6-ALG-03', order: 69, title: 'Aljabar Bersarang' },
  23: { v1Id: 23, primaryLevelId: 'T6-MULTI', order: 70, title: 'Multi-Operasi Cepat' },
  24: { v1Id: 24, primaryLevelId: 'T6-GRANDMASTER', order: 72, title: 'Ujian Akhir Legenda' },
};
