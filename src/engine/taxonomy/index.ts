import { SkillCategoryDefinition, SubSkillDefinition } from './types';

export * from './types';

export const TAXONOMY_VERSION = '2.1.0';

export const SKILL_TAXONOMY: Record<string, SkillCategoryDefinition> = {
  addition: {
    id: 'addition',
    name: 'Penjumlahan',
    icon: 'plus',
    subSkills: [
      {
        id: 'addition.single_digit',
        skillId: 'addition',
        name: 'Penjumlahan Satu Digit',
        description: 'Penjumlahan dasar angka 1–9 tanpa menyimpan',
        difficultyBase: 1,
      },
      {
        id: 'addition.within_20',
        skillId: 'addition',
        name: 'Penjumlahan Sampai 20',
        description: 'Penjumlahan dengan rentang hasil hingga 20',
        difficultyBase: 2,
        prerequisiteSubSkillIds: ['addition.single_digit'],
      },
      {
        id: 'addition.tens',
        skillId: 'addition',
        name: 'Penjumlahan Kelipatan 10',
        description: 'Penjumlahan bilangan kelipatan sepuluh',
        difficultyBase: 2,
        prerequisiteSubSkillIds: ['addition.single_digit'],
      },
      {
        id: 'addition.carry',
        skillId: 'addition',
        name: 'Penjumlahan Menyimpan',
        description: 'Penjumlahan dua digit dengan teknik menyimpan',
        difficultyBase: 3,
        prerequisiteSubSkillIds: ['addition.within_20'],
      },
      {
        id: 'addition.hundreds',
        skillId: 'addition',
        name: 'Penjumlahan Ratusan',
        description: 'Penjumlahan bilangan tiga digit',
        difficultyBase: 4,
        prerequisiteSubSkillIds: ['addition.carry'],
      },
    ],
  },
  subtraction: {
    id: 'subtraction',
    name: 'Pengurangan',
    icon: 'minus',
    subSkills: [
      {
        id: 'subtraction.single_digit',
        skillId: 'subtraction',
        name: 'Pengurangan Satu Digit',
        description: 'Pengurangan dasar angka 1–9 tanpa meminjam',
        difficultyBase: 1,
      },
      {
        id: 'subtraction.within_20',
        skillId: 'subtraction',
        name: 'Pengurangan Sampai 20',
        description: 'Pengurangan dengan rentang hasil hingga 20',
        difficultyBase: 2,
        prerequisiteSubSkillIds: ['subtraction.single_digit'],
      },
      {
        id: 'subtraction.tens',
        skillId: 'subtraction',
        name: 'Pengurangan Kelipatan 10',
        description: 'Pengurangan bilangan kelipatan sepuluh',
        difficultyBase: 2,
        prerequisiteSubSkillIds: ['subtraction.single_digit'],
      },
      {
        id: 'subtraction.borrow',
        skillId: 'subtraction',
        name: 'Pengurangan Meminjam',
        description: 'Pengurangan dua digit dengan teknik meminjam',
        difficultyBase: 3,
        prerequisiteSubSkillIds: ['subtraction.within_20'],
      },
      {
        id: 'subtraction.hundreds',
        skillId: 'subtraction',
        name: 'Pengurangan Ratusan',
        description: 'Pengurangan bilangan tiga digit',
        difficultyBase: 4,
        prerequisiteSubSkillIds: ['subtraction.borrow'],
      },
    ],
  },
  multiplication: {
    id: 'multiplication',
    name: 'Perkalian',
    icon: 'multiply',
    subSkills: [
      {
        id: 'multiplication.x2',
        skillId: 'multiplication',
        name: 'Perkalian ×2',
        description: 'Tabel perkalian 2',
        difficultyBase: 1,
      },
      {
        id: 'multiplication.x3',
        skillId: 'multiplication',
        name: 'Perkalian ×3',
        description: 'Tabel perkalian 3',
        difficultyBase: 2,
        prerequisiteSubSkillIds: ['multiplication.x2'],
      },
      {
        id: 'multiplication.x4',
        skillId: 'multiplication',
        name: 'Perkalian ×4',
        description: 'Tabel perkalian 4',
        difficultyBase: 2,
        prerequisiteSubSkillIds: ['multiplication.x2'],
      },
      {
        id: 'multiplication.x5',
        skillId: 'multiplication',
        name: 'Perkalian ×5',
        description: 'Tabel perkalian 5',
        difficultyBase: 2,
      },
      {
        id: 'multiplication.x6',
        skillId: 'multiplication',
        name: 'Perkalian ×6',
        description: 'Tabel perkalian 6',
        difficultyBase: 3,
        prerequisiteSubSkillIds: ['multiplication.x3'],
      },
      {
        id: 'multiplication.x7',
        skillId: 'multiplication',
        name: 'Perkalian ×7',
        description: 'Tabel perkalian 7',
        difficultyBase: 3,
      },
      {
        id: 'multiplication.x8',
        skillId: 'multiplication',
        name: 'Perkalian ×8',
        description: 'Tabel perkalian 8',
        difficultyBase: 3,
        prerequisiteSubSkillIds: ['multiplication.x4'],
      },
      {
        id: 'multiplication.x9',
        skillId: 'multiplication',
        name: 'Perkalian ×9',
        description: 'Tabel perkalian 9',
        difficultyBase: 3,
        prerequisiteSubSkillIds: ['multiplication.x3'],
      },
      {
        id: 'multiplication.tens',
        skillId: 'multiplication',
        name: 'Perkalian Kelipatan 10',
        description: 'Perkalian angka dengan kelipatan sepuluh',
        difficultyBase: 3,
      },
      {
        id: 'multiplication.11_19',
        skillId: 'multiplication',
        name: 'Perkalian Belasan (11–19)',
        description: 'Perkalian angka belasan 11 sampai 19',
        difficultyBase: 4,
        prerequisiteSubSkillIds: ['multiplication.x9'],
      },
    ],
  },
  division: {
    id: 'division',
    name: 'Pembagian',
    icon: 'divide',
    subSkills: [
      {
        id: 'division.basic_235',
        skillId: 'division',
        name: 'Pembagian Dasar 2, 3, 5',
        description: 'Pembagian dasar faktor 2, 3, dan 5',
        difficultyBase: 2,
      },
      {
        id: 'division.x4_9_inverse',
        skillId: 'division',
        name: 'Pembagian Invers 4–9',
        description: 'Pembagian invers tabel perkalian 4 sampai 9',
        difficultyBase: 3,
        prerequisiteSubSkillIds: ['division.basic_235'],
      },
      {
        id: 'division.tens',
        skillId: 'division',
        name: 'Pembagian Kelipatan 10',
        description: 'Pembagian dengan bilangan puluhan bersih',
        difficultyBase: 3,
        prerequisiteSubSkillIds: ['division.basic_235'],
      },
      {
        id: 'division.signed',
        skillId: 'division',
        name: 'Pembagian Bilangan Bertanda',
        description: 'Pembagian melibatkan bilangan bertanda positif dan negatif',
        difficultyBase: 4,
        prerequisiteSubSkillIds: ['division.x4_9_inverse'],
      },
    ],
  },
  missing_operand: {
    id: 'missing_operand',
    name: 'Operan Hilang',
    icon: 'help-circle',
    subSkills: [
      {
        id: 'missing_operand.add_inverse',
        skillId: 'missing_operand',
        name: 'Operan Hilang Penjumlahan',
        description: 'Menemukan suku hilang pada operasi penjumlahan',
        difficultyBase: 2,
      },
      {
        id: 'missing_operand.sub_inverse',
        skillId: 'missing_operand',
        name: 'Operan Hilang Pengurangan',
        description: 'Menemukan suku hilang pada operasi pengurangan',
        difficultyBase: 2,
      },
      {
        id: 'missing_operand.multiplication_factor',
        skillId: 'missing_operand',
        name: 'Faktor Perkalian Hilang',
        description: 'Menemukan faktor pengali yang belum diketahui',
        difficultyBase: 3,
        prerequisiteSubSkillIds: ['missing_operand.add_inverse'],
      },
    ],
  },
  multi_operation: {
    id: 'multi_operation',
    name: 'Operasi Berantai',
    icon: 'layers',
    subSkills: [
      {
        id: 'multi_operation.three_terms',
        skillId: 'multi_operation',
        name: 'Operasi Berantai 3 Suku',
        description: 'Perhitungan berantai melibatkan 3 bilangan sejenis',
        difficultyBase: 2,
      },
      {
        id: 'multi_operation.four_terms',
        skillId: 'multi_operation',
        name: 'Operasi Berantai 4 Suku',
        description: 'Perhitungan berantai melibatkan 4 bilangan',
        difficultyBase: 3,
        prerequisiteSubSkillIds: ['multi_operation.three_terms'],
      },
    ],
  },
  bodmas: {
    id: 'bodmas',
    name: 'Urutan Operasi (BODMAS)',
    icon: 'parentheses',
    subSkills: [
      {
        id: 'bodmas.mul_priority',
        skillId: 'bodmas',
        name: 'Prioritas Perkalian',
        description: 'Operasi campuran perkalian didahulukan daripada tambah/kurang',
        difficultyBase: 3,
      },
      {
        id: 'bodmas.div_priority',
        skillId: 'bodmas',
        name: 'Prioritas Pembagian',
        description: 'Operasi campuran pembagian didahulukan',
        difficultyBase: 3,
      },
      {
        id: 'bodmas.parentheses',
        skillId: 'bodmas',
        name: 'Operasi Tanda Kurung',
        description: 'Operasi di dalam tanda kurung diselesaikan lebih dahulu',
        difficultyBase: 4,
        prerequisiteSubSkillIds: ['bodmas.mul_priority'],
      },
      {
        id: 'bodmas.advanced',
        skillId: 'bodmas',
        name: 'BODMAS Kompleks',
        description: 'Kombinasi kurung, perkalian/pembagian, dan penjumlahan/pengurangan',
        difficultyBase: 5,
        prerequisiteSubSkillIds: ['bodmas.parentheses'],
      },
    ],
  },
  signed_number: {
    id: 'signed_number',
    name: 'Bilangan Bulat Negatif',
    icon: 'plus-minus',
    subSkills: [
      {
        id: 'signed_number.negative_add',
        skillId: 'signed_number',
        name: 'Penjumlahan Bilangan Negatif',
        description: 'Penjumlahan dengan bilangan bulat negatif',
        difficultyBase: 3,
      },
      {
        id: 'signed_number.negative_sub',
        skillId: 'signed_number',
        name: 'Pengurangan Bilangan Negatif',
        description: 'Pengurangan dengan bilangan bulat negatif',
        difficultyBase: 3,
      },
      {
        id: 'signed_number.negative_mul',
        skillId: 'signed_number',
        name: 'Perkalian Bilangan Negatif',
        description: 'Perkalian bilangan bertanda positif dan negatif',
        difficultyBase: 4,
        prerequisiteSubSkillIds: ['signed_number.negative_add'],
      },
      {
        id: 'signed_number.negative_div',
        skillId: 'signed_number',
        name: 'Pembagian Bilangan Negatif',
        description: 'Pembagian bilangan bertanda positif dan negatif',
        difficultyBase: 4,
        prerequisiteSubSkillIds: ['signed_number.negative_mul'],
      },
    ],
  },
  algebra: {
    id: 'algebra',
    name: 'Aljabar Dasar',
    icon: 'variable',
    subSkills: [
      {
        id: 'algebra.one_step',
        skillId: 'algebra',
        name: 'Persamaan Linear Satu Langkah',
        description: 'Penyelesaian persamaan linear sederhana satu langkah',
        difficultyBase: 3,
      },
      {
        id: 'algebra.two_step',
        skillId: 'algebra',
        name: 'Persamaan Linear Dua Langkah',
        description: 'Penyelesaian persamaan linear ax + b = c',
        difficultyBase: 4,
        prerequisiteSubSkillIds: ['algebra.one_step'],
      },
      {
        id: 'algebra.nested',
        skillId: 'algebra',
        name: 'Persamaan Linear Bertingkat',
        description: 'Persamaan aljabar bertanda kurung atau variabel di kedua ruas',
        difficultyBase: 5,
        prerequisiteSubSkillIds: ['algebra.two_step'],
      },
    ],
  },
  square: {
    id: 'square',
    name: 'Kuadrat',
    icon: 'superscript',
    subSkills: [
      {
        id: 'square.square_1_10',
        skillId: 'square',
        name: 'Kuadrat 1–10',
        description: 'Kuadrat bilangan bulat dari 1 sampai 10',
        difficultyBase: 2,
      },
      {
        id: 'square.square_11_15',
        skillId: 'square',
        name: 'Kuadrat 11–15',
        description: 'Kuadrat bilangan bulat dari 11 sampai 15',
        difficultyBase: 3,
        prerequisiteSubSkillIds: ['square.square_1_10'],
      },
      {
        id: 'square.square_16_25',
        skillId: 'square',
        name: 'Kuadrat 16–25',
        description: 'Kuadrat bilangan bulat dari 16 sampai 25',
        difficultyBase: 4,
        prerequisiteSubSkillIds: ['square.square_11_15'],
      },
    ],
  },
  root: {
    id: 'root',
    name: 'Akar Kuadrat',
    icon: 'radical',
    subSkills: [
      {
        id: 'root.perfect_square_root',
        skillId: 'root',
        name: 'Akar Kuadrat Sempurna',
        description: 'Penarikan akar kuadrat untuk bilangan kuadrat sempurna',
        difficultyBase: 3,
        prerequisiteSubSkillIds: ['square.square_1_10'],
      },
    ],
  },
  percentage: {
    id: 'percentage',
    name: 'Persentase',
    icon: 'percent',
    subSkills: [
      {
        id: 'percentage.standard_percentage',
        skillId: 'percentage',
        name: 'Persentase Standar',
        description: 'Perhitungan persentase acuan dasar (10%, 25%, 50%, 75%)',
        difficultyBase: 3,
      },
      {
        id: 'percentage.derived_percentage',
        skillId: 'percentage',
        name: 'Persentase Turunan',
        description: 'Perhitungan persentase kelipatan 5% atau turunan',
        difficultyBase: 4,
        prerequisiteSubSkillIds: ['percentage.standard_percentage'],
      },
    ],
  },
  fraction: {
    id: 'fraction',
    name: 'Pecahan',
    icon: 'fraction',
    subSkills: [
      {
        id: 'fraction.simple_fraction_arithmetic',
        skillId: 'fraction',
        name: 'Aritmatika Pecahan Sederhana',
        description: 'Operasi pecahan berpenyebut sama dan penyederhanaan',
        difficultyBase: 3,
      },
    ],
  },
  ratio: {
    id: 'ratio',
    name: 'Rasio',
    icon: 'ratio',
    subSkills: [
      {
        id: 'ratio.equivalent_ratio',
        skillId: 'ratio',
        name: 'Rasio Ekuivalen',
        description: 'Perbandingan rasio senilai dan proporsi sederhana',
        difficultyBase: 3,
      },
    ],
  },
};

// Build flattened lookup index for O(1) retrieval
const SUB_SKILL_INDEX = new Map<string, SubSkillDefinition>();
const ALL_SUB_SKILLS: SubSkillDefinition[] = [];

for (const category of Object.values(SKILL_TAXONOMY)) {
  for (const subSkill of category.subSkills) {
    SUB_SKILL_INDEX.set(subSkill.id, subSkill);
    ALL_SUB_SKILLS.push(subSkill);
  }
}

/**
 * Retrieves a sub-skill definition by its canonical ID (e.g. 'multiplication.x7').
 */
export function getSubSkill(id: string): SubSkillDefinition | undefined {
  return SUB_SKILL_INDEX.get(id);
}

/**
 * Returns all registered sub-skill definitions.
 */
export function getAllSubSkills(): SubSkillDefinition[] {
  return ALL_SUB_SKILLS;
}

/**
 * Returns true if the provided string is a valid registered sub-skill ID.
 */
export function isValidSubSkillId(id: string): boolean {
  return SUB_SKILL_INDEX.has(id);
}
