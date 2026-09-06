import { LevelConfig, Question, TierInfo, UserLevelProgress, UserStats } from '../types';

export const TIERS: TierInfo[] = [
  {
    id: 1,
    name: 'Pemula',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    description: 'Refleks penjumlahan & pengurangan dasar untuk pemanasan.',
  },
  {
    id: 2,
    name: 'Menengah',
    badgeColor: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
    description: 'Tabel perkalian dan pembagian dasar hingga bilangan 10.',
  },
  {
    id: 3,
    name: 'Terampil',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
    description: 'Kalkulasi puluhan dan tebak angka misteri yang hilang.',
  },
  {
    id: 4,
    name: 'Mahir',
    badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    description: 'Urutan operasi (BODMAS), tanda kurung, dan 3 variabel.',
  },
  {
    id: 5,
    name: 'Master',
    badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
    description: 'Bilangan negatif, perkalian belasan, dan mini aljabar.',
  },
  {
    id: 6,
    name: 'Legenda',
    badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    description: 'Kuadrat kilat dan kalkulasi ekstrim kecepatan grandmaster.',
  },
];

export const LEVELS: LevelConfig[] = [
  // TIER 1 - PEMULA
  {
    id: 1,
    title: 'Penjumlahan 1-10',
    tier: 1,
    tierName: 'Pemula',
    description: 'Latihan refleks berhitung angka satuan.',
    questionsCount: 10,
    timeLimitSec: 35,
    operations: ['+'],
    maxNum1: 10,
    maxNum2: 10,
  },
  {
    id: 2,
    title: 'Pengurangan 1-15',
    tier: 1,
    tierName: 'Pemula',
    description: 'Pengurangan angka dasar tanpa nilai minus.',
    questionsCount: 10,
    timeLimitSec: 35,
    operations: ['-'],
    maxNum1: 15,
    maxNum2: 10,
  },
  {
    id: 3,
    title: 'Duo Tambah Kurang',
    tier: 1,
    tierName: 'Pemula',
    description: 'Kombinasi cepat tambah & kurang 1-20.',
    questionsCount: 12,
    timeLimitSec: 40,
    operations: ['+', '-'],
    maxNum1: 20,
    maxNum2: 15,
  },
  {
    id: 4,
    title: 'Cari Angka Hilang (?)',
    tier: 1,
    tierName: 'Pemula',
    description: 'Tebak nilai ? pada penjumlahan sederhana (misal: 6 + ? = 14).',
    questionsCount: 10,
    timeLimitSec: 40,
    operations: ['+'],
    specialType: 'missing_operand',
    maxNum1: 15,
    maxNum2: 12,
  },

  // TIER 2 - MENENGAH
  {
    id: 5,
    title: 'Perkalian Dasar (2, 3, 5)',
    tier: 2,
    tierName: 'Menengah',
    description: 'Kecepatan perkalian dasar yang paling sering dipakai.',
    questionsCount: 12,
    timeLimitSec: 35,
    operations: ['*'],
    maxNum1: 5,
    maxNum2: 10,
  },
  {
    id: 6,
    title: 'Perkalian Penuh (4 - 9)',
    tier: 2,
    tierName: 'Menengah',
    description: 'Uji refleks tabel perkalian 6, 7, 8, dan 9.',
    questionsCount: 12,
    timeLimitSec: 40,
    operations: ['*'],
    maxNum1: 9,
    maxNum2: 9,
  },
  {
    id: 7,
    title: 'Pembagian Pas Bersih',
    tier: 2,
    tierName: 'Menengah',
    description: 'Pembagian bilangan bulat tanpa koma/sisa.',
    questionsCount: 12,
    timeLimitSec: 40,
    operations: ['/'],
    maxNum1: 10,
    maxNum2: 10,
  },
  {
    id: 8,
    title: '4 Operasi Dasar',
    tier: 2,
    tierName: 'Menengah',
    description: 'Campuran acak +, -, ×, dan ÷ secara spontan.',
    questionsCount: 15,
    timeLimitSec: 45,
    operations: ['+', '-', '*', '/'],
    maxNum1: 12,
    maxNum2: 10,
  },

  // TIER 3 - TERAMPIL
  {
    id: 9,
    title: 'Penjumlahan Puluhan',
    tier: 3,
    tierName: 'Terampil',
    description: 'Penjumlahan 2 digit (misal: 27 + 48).',
    questionsCount: 12,
    timeLimitSec: 45,
    operations: ['+'],
    maxNum1: 50,
    maxNum2: 50,
  },
  {
    id: 10,
    title: 'Pengurangan Puluhan',
    tier: 3,
    tierName: 'Terampil',
    description: 'Pengurangan 2 digit yang melatih teknik selisih cepat.',
    questionsCount: 12,
    timeLimitSec: 45,
    operations: ['-'],
    maxNum1: 99,
    maxNum2: 50,
  },
  {
    id: 11,
    title: 'Misteri Pengali (?)',
    tier: 3,
    tierName: 'Terampil',
    description: 'Tebak faktor pengali atau pembagi yang hilang (misal: ? × 7 = 56).',
    questionsCount: 12,
    timeLimitSec: 40,
    operations: ['*'],
    specialType: 'missing_operand',
    maxNum1: 10,
    maxNum2: 10,
  },
  {
    id: 12,
    title: 'Kombinasi Puluhan Cepat',
    tier: 3,
    tierName: 'Terampil',
    description: 'Campuran penjumlahan & pengurangan puluhan dengan batas waktu ketat.',
    questionsCount: 15,
    timeLimitSec: 50,
    operations: ['+', '-'],
    maxNum1: 80,
    maxNum2: 50,
  },

  // TIER 4 - MAHIR
  {
    id: 13,
    title: 'Tiga Angka Beruntun',
    tier: 4,
    tierName: 'Mahir',
    description: 'Operasi 3 bilangan berturut-turut (misal: 15 + 24 - 11).',
    questionsCount: 12,
    timeLimitSec: 45,
    operations: ['+', '-'],
    specialType: 'three_terms',
    maxNum1: 30,
    maxNum2: 20,
  },
  {
    id: 14,
    title: 'Prioritas Perkalian (BODMAS)',
    tier: 4,
    tierName: 'Mahir',
    description: 'Ingat! Perkalian harus dihitung sebelum penjumlahan (a + b × c).',
    questionsCount: 12,
    timeLimitSec: 50,
    operations: ['+', '*'],
    specialType: 'three_terms',
    maxNum1: 20,
    maxNum2: 10,
  },
  {
    id: 15,
    title: 'Operasi Kurung ()',
    tier: 4,
    tierName: 'Mahir',
    description: 'Hitung angka di dalam kurung terlebih dahulu (misal: (18 - 9) × 4).',
    questionsCount: 12,
    timeLimitSec: 50,
    operations: ['*', '-'],
    specialType: 'three_terms',
    maxNum1: 15,
    maxNum2: 10,
  },
  {
    id: 16,
    title: 'BODMAS Mahir Lengkap',
    tier: 4,
    tierName: 'Mahir',
    description: 'Campuran prioritas perkalian, pembagian, tambah & kurang.',
    questionsCount: 15,
    timeLimitSec: 55,
    operations: ['+', '-', '*', '/'],
    specialType: 'three_terms',
    maxNum1: 25,
    maxNum2: 10,
  },

  // TIER 5 - MASTER
  {
    id: 17,
    title: 'Bilangan Negatif',
    tier: 5,
    tierName: 'Master',
    description: 'Hasil bisa bernilai negatif (misal: 14 - 31 = -17).',
    questionsCount: 12,
    timeLimitSec: 45,
    operations: ['+', '-'],
    allowNegative: true,
    maxNum1: 40,
    maxNum2: 50,
  },
  {
    id: 18,
    title: 'Perkalian Belasan (11-19)',
    tier: 5,
    tierName: 'Master',
    description: 'Latihan trik mental perkalian belasan (misal: 13 × 14).',
    questionsCount: 12,
    timeLimitSec: 50,
    operations: ['*'],
    maxNum1: 19,
    maxNum2: 15,
  },
  {
    id: 19,
    title: 'Mini Aljabar (?)',
    tier: 5,
    tierName: 'Master',
    description: 'Selesaikan persamaan linear cepat (misal: 3 × ? + 5 = 26).',
    questionsCount: 12,
    timeLimitSec: 50,
    operations: ['*'],
    specialType: 'missing_operand',
    maxNum1: 10,
    maxNum2: 10,
  },
  {
    id: 20,
    title: 'Master Blitz Challenge',
    tier: 5,
    tierName: 'Master',
    description: 'Uji semua konsep tingkat lanjut dengan kecepatan tinggi.',
    questionsCount: 15,
    timeLimitSec: 55,
    operations: ['+', '-', '*', '/'],
    specialType: 'extreme',
    allowNegative: true,
    maxNum1: 50,
    maxNum2: 20,
  },

  // TIER 6 - LEGENDA
  {
    id: 21,
    title: 'Kuadrat Kilat (1² - 25²)',
    tier: 6,
    tierName: 'Legenda',
    description: 'Hafalan dan kalkulasi kuadrat cepat (misal: 16² = 256).',
    questionsCount: 12,
    timeLimitSec: 45,
    operations: ['*'],
    specialType: 'extreme',
    maxNum1: 25,
    maxNum2: 25,
  },
  {
    id: 22,
    title: 'Aljabar Bersarang',
    tier: 6,
    tierName: 'Legenda',
    description: 'Persamaan dengan pengelompokan (misal: (30 - ?) × 3 = 45).',
    questionsCount: 12,
    timeLimitSec: 50,
    operations: ['-', '*'],
    specialType: 'missing_operand',
    maxNum1: 30,
    maxNum2: 12,
  },
  {
    id: 23,
    title: 'Multi-Operasi Kilat',
    tier: 6,
    tierName: 'Legenda',
    description: 'Soal kompleks dengan batas waktu sangat ketat.',
    questionsCount: 15,
    timeLimitSec: 50,
    operations: ['+', '-', '*', '/'],
    specialType: 'extreme',
    allowNegative: true,
    maxNum1: 80,
    maxNum2: 25,
  },
  {
    id: 24,
    title: 'Ujian Akhir Grandmaster',
    tier: 6,
    tierName: 'Legenda',
    description: 'Tantangan puncak 20 soal untuk membuktikan kecepatan mutlak.',
    questionsCount: 20,
    timeLimitSec: 60,
    operations: ['+', '-', '*', '/'],
    specialType: 'extreme',
    allowNegative: true,
    maxNum1: 100,
    maxNum2: 30,
  },
];

// Random integer between min and max inclusive
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate single question based on level rules
export function generateQuestion(config: LevelConfig, index: number): Question {
  const id = `q_${config.id}_${index}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Special Extreme: Kuadrat (Level 21)
  if (config.id === 21) {
    const n = randomInt(4, 22);
    const ans = n * n;
    return {
      id,
      prompt: `${n}² = ?`,
      num1: n,
      num2: n,
      operation: '²',
      correctAnswer: ans,
      explanation: `${n}² = ${n} × ${n} = ${ans}`,
    };
  }

  // Special Type: Missing Operand (Aljabar Sederhana)
  if (config.specialType === 'missing_operand') {
    if (config.id === 4) {
      // 6 + ? = 14
      const a = randomInt(2, 12);
      const b = randomInt(3, 12);
      const sum = a + b;
      const missingA = Math.random() > 0.5;
      return {
        id,
        prompt: missingA ? `? + ${b} = ${sum}` : `${a} + ? = ${sum}`,
        missingPosition: missingA ? 'first' : 'second',
        num1: a,
        num2: b,
        operation: '+',
        correctAnswer: missingA ? a : b,
        explanation: `${a} + ${b} = ${sum}`,
      };
    }

    if (config.id === 11) {
      // ? × 8 = 56
      const a = randomInt(2, 9);
      const b = randomInt(2, 9);
      const prod = a * b;
      const missingA = Math.random() > 0.5;
      return {
        id,
        prompt: missingA ? `? × ${b} = ${prod}` : `${a} × ? = ${prod}`,
        missingPosition: missingA ? 'first' : 'second',
        num1: a,
        num2: b,
        operation: '*',
        correctAnswer: missingA ? a : b,
        explanation: `${a} × ${b} = ${prod}`,
      };
    }

    if (config.id === 19) {
      // Mini Aljabar: 3 × ? + 5 = 26
      const mult = randomInt(2, 6);
      const missing = randomInt(2, 9);
      const add = randomInt(2, 15);
      const result = mult * missing + add;
      return {
        id,
        prompt: `${mult} × ? + ${add} = ${result}`,
        missingPosition: 'second',
        num1: mult,
        num2: add,
        operation: 'algebra',
        correctAnswer: missing,
        explanation: `${result} - ${add} = ${mult * missing}, lalu ${mult * missing} ÷ ${mult} = ${missing}`,
      };
    }

    if (config.id === 22) {
      // (30 - ?) × 3 = 45 -> (30 - missing) = 15 -> missing = 15
      const mult = randomInt(2, 5);
      const base = randomInt(15, 30);
      const missing = randomInt(3, base - 3);
      const inner = base - missing;
      const result = inner * mult;
      return {
        id,
        prompt: `(${base} - ?) × ${mult} = ${result}`,
        missingPosition: 'second',
        num1: base,
        num2: mult,
        operation: 'algebra',
        correctAnswer: missing,
        explanation: `${result} ÷ ${mult} = ${inner}, lalu ${base} - ${inner} = ${missing}`,
      };
    }
  }

  // Special Type: Three Terms / BODMAS
  if (config.specialType === 'three_terms') {
    if (config.id === 13) {
      // a + b - c or a - b + c
      const a = randomInt(10, 30);
      const b = randomInt(5, 25);
      const c = randomInt(3, 20);
      const isAddFirst = Math.random() > 0.5;
      if (isAddFirst) {
        const ans = a + b - c;
        return {
          id,
          prompt: `${a} + ${b} - ${c}`,
          num1: a,
          num2: b,
          num3: c,
          operation: '+-',
          correctAnswer: ans,
          explanation: `${a} + ${b} = ${a + b}, lalu ${a + b} - ${c} = ${ans}`,
        };
      } else {
        const validA = Math.max(a, b + 5);
        const ans = validA - b + c;
        return {
          id,
          prompt: `${validA} - ${b} + ${c}`,
          num1: validA,
          num2: b,
          num3: c,
          operation: '-+',
          correctAnswer: ans,
          explanation: `${validA} - ${b} = ${validA - b}, lalu ${validA - b} + ${c} = ${ans}`,
        };
      }
    }

    if (config.id === 14) {
      // Prioritas: a + b × c -> b × c dihitung dulu
      const a = randomInt(4, 25);
      const b = randomInt(2, 8);
      const c = randomInt(2, 7);
      const ans = a + b * c;
      return {
        id,
        prompt: `${a} + ${b} × ${c}`,
        num1: a,
        num2: b,
        num3: c,
        operation: '+*',
        correctAnswer: ans,
        explanation: `Perkalian didahulukan: ${b} × ${c} = ${b * c}, lalu ${a} + ${b * c} = ${ans}`,
      };
    }

    if (config.id === 15) {
      // Kurung: (a - b) × c
      const b = randomInt(3, 12);
      const a = b + randomInt(2, 10);
      const c = randomInt(3, 7);
      const diff = a - b;
      const ans = diff * c;
      return {
        id,
        prompt: `(${a} - ${b}) × ${c}`,
        num1: a,
        num2: b,
        num3: c,
        operation: '()',
        correctAnswer: ans,
        explanation: `Dalam kurung dihitung dulu: ${a} - ${b} = ${diff}, lalu ${diff} × ${c} = ${ans}`,
      };
    }

    if (config.id === 16) {
      // Pembagian gabungan: a × b ÷ c atau a + b ÷ c
      const b = randomInt(2, 6);
      const c = randomInt(2, 6);
      const divResult = randomInt(3, 9);
      const dividend = divResult * c;
      const a = randomInt(5, 25);
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        const ans = a + divResult;
        return {
          id,
          prompt: `${a} + ${dividend} ÷ ${c}`,
          num1: a,
          num2: dividend,
          num3: c,
          operation: '+/',
          correctAnswer: ans,
          explanation: `Bagi dulu: ${dividend} ÷ ${c} = ${divResult}, lalu ${a} + ${divResult} = ${ans}`,
        };
      } else {
        const mult = randomInt(2, 5);
        const ans = mult * divResult;
        return {
          id,
          prompt: `${mult} × (${dividend} ÷ ${c})`,
          num1: mult,
          num2: dividend,
          num3: c,
          operation: '*/',
          correctAnswer: ans,
          explanation: `${dividend} ÷ ${c} = ${divResult}, lalu ${mult} × ${divResult} = ${ans}`,
        };
      }
    }
  }

  // Standard Operations (+, -, *, /)
  const op = config.operations[Math.floor(Math.random() * config.operations.length)];

  if (op === '+') {
    let a: number, b: number;
    if (config.id === 1) {
      a = randomInt(1, 10);
      b = randomInt(1, 10);
    } else if (config.id === 9) {
      a = randomInt(14, 59);
      b = randomInt(12, 48);
    } else {
      a = randomInt(2, config.maxNum1);
      b = randomInt(2, config.maxNum2);
    }
    const ans = a + b;
    return {
      id,
      prompt: `${a} + ${b}`,
      num1: a,
      num2: b,
      operation: '+',
      correctAnswer: ans,
      explanation: `${a} + ${b} = ${ans}`,
    };
  }

  if (op === '-') {
    let a: number, b: number;
    if (config.allowNegative) {
      a = randomInt(5, config.maxNum1);
      b = randomInt(a - 5, config.maxNum2);
    } else {
      b = randomInt(2, config.maxNum2);
      a = b + randomInt(1, config.maxNum1);
    }
    const ans = a - b;
    return {
      id,
      prompt: `${a} - ${b}`,
      num1: a,
      num2: b,
      operation: '-',
      correctAnswer: ans,
      explanation: `${a} - ${b} = ${ans}`,
    };
  }

  if (op === '*') {
    let a: number, b: number;
    if (config.id === 5) {
      const allowed = [2, 3, 5];
      a = allowed[Math.floor(Math.random() * allowed.length)];
      b = randomInt(2, 10);
    } else if (config.id === 6) {
      a = randomInt(4, 9);
      b = randomInt(4, 9);
    } else if (config.id === 18) {
      // Perkalian belasan (11-19)
      a = randomInt(11, 19);
      b = randomInt(3, 14);
    } else {
      a = randomInt(2, config.maxNum1);
      b = randomInt(2, config.maxNum2);
    }
    const ans = a * b;
    return {
      id,
      prompt: `${a} × ${b}`,
      num1: a,
      num2: b,
      operation: '×',
      correctAnswer: ans,
      explanation: `${a} × ${b} = ${ans}`,
    };
  }

  // op === '/'
  // Always produce a clean integer result
  const divisor = randomInt(2, Math.min(config.maxNum2, 12));
  const quotient = randomInt(2, Math.min(config.maxNum1, 12));
  const dividend = divisor * quotient;
  return {
    id,
    prompt: `${dividend} ÷ ${divisor}`,
    num1: dividend,
    num2: divisor,
    operation: '÷',
    correctAnswer: quotient,
    explanation: `${dividend} ÷ ${divisor} = ${quotient} (karena ${quotient} × ${divisor} = ${dividend})`,
  };
}

// Generate an entire level's questions
export function generateLevelQuestions(config: LevelConfig): Question[] {
  const list: Question[] = [];
  for (let i = 0; i < config.questionsCount; i++) {
    list.push(generateQuestion(config, i));
  }
  return list;
}

// Adaptive question generator for Time Attack Mode
export function generateTimeAttackQuestion(currentStreak: number, score: number): Question {
  const id = `ta_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  // Difficulty escalates with score & streak
  const difficulty = Math.min(6, Math.floor((score / 150) + (currentStreak / 5)) + 1);

  if (difficulty <= 1) {
    const isAdd = Math.random() > 0.4;
    const a = randomInt(2, 12);
    const b = randomInt(1, 10);
    return isAdd
      ? { id, prompt: `${a} + ${b}`, num1: a, num2: b, operation: '+', correctAnswer: a + b, explanation: `${a} + ${b} = ${a + b}` }
      : { id, prompt: `${a + b} - ${b}`, num1: a + b, num2: b, operation: '-', correctAnswer: a, explanation: `${a + b} - ${b} = ${a}` };
  }

  if (difficulty === 2) {
    const op = Math.random();
    if (op < 0.4) {
      const a = randomInt(3, 9);
      const b = randomInt(2, 9);
      return { id, prompt: `${a} × ${b}`, num1: a, num2: b, operation: '×', correctAnswer: a * b, explanation: `${a} × ${b} = ${a * b}` };
    } else if (op < 0.7) {
      const b = randomInt(2, 8);
      const ans = randomInt(2, 9);
      return { id, prompt: `${b * ans} ÷ ${b}`, num1: b * ans, num2: b, operation: '÷', correctAnswer: ans, explanation: `${b * ans} ÷ ${b} = ${ans}` };
    } else {
      const a = randomInt(12, 38);
      const b = randomInt(9, 25);
      return { id, prompt: `${a} + ${b}`, num1: a, num2: b, operation: '+', correctAnswer: a + b, explanation: `${a} + ${b} = ${a + b}` };
    }
  }

  if (difficulty === 3) {
    // Missing operand or larger numbers
    if (Math.random() > 0.5) {
      const a = randomInt(3, 9);
      const b = randomInt(3, 9);
      const prod = a * b;
      return { id, prompt: `? × ${b} = ${prod}`, missingPosition: 'first', num1: a, num2: b, operation: '*', correctAnswer: a, explanation: `${a} × ${b} = ${prod}` };
    } else {
      const a = randomInt(25, 75);
      const b = randomInt(18, 45);
      return { id, prompt: `${a} - ${b}`, num1: a, num2: b, operation: '-', correctAnswer: a - b, explanation: `${a} - ${b} = ${a - b}` };
    }
  }

  if (difficulty === 4) {
    // BODMAS
    const a = randomInt(4, 20);
    const b = randomInt(2, 7);
    const c = randomInt(2, 6);
    return { id, prompt: `${a} + ${b} × ${c}`, num1: a, num2: b, num3: c, operation: '+*', correctAnswer: a + b * c, explanation: `${b} × ${c} = ${b * c}, lalu + ${a} = ${a + b * c}` };
  }

  if (difficulty === 5) {
    // Mini algebra or negative
    const mult = randomInt(2, 5);
    const missing = randomInt(3, 9);
    const add = randomInt(4, 15);
    const res = mult * missing + add;
    return { id, prompt: `${mult} × ? + ${add} = ${res}`, missingPosition: 'second', num1: mult, num2: add, operation: 'algebra', correctAnswer: missing, explanation: `? = (${res} - ${add}) ÷ ${mult} = ${missing}` };
  }

  // Grandmaster difficulty (difficulty 6)
  if (Math.random() > 0.5) {
    const n = randomInt(11, 20);
    return { id, prompt: `${n}² = ?`, num1: n, num2: n, operation: '²', correctAnswer: n * n, explanation: `${n}² = ${n * n}` };
  } else {
    const a = randomInt(12, 18);
    const b = randomInt(11, 16);
    return { id, prompt: `${a} × ${b}`, num1: a, num2: b, operation: '×', correctAnswer: a * b, explanation: `${a} × ${b} = ${a * b}` };
  }
}

// LocalStorage helpers for persistence
const PROGRESS_KEY = 'hitung_kilat_levels_progress_v1';
const STATS_KEY = 'hitung_kilat_stats_v1';

export function loadUserProgress(): Record<number, UserLevelProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) {
      // Default: Level 1 is unlocked, others locked
      const init: Record<number, UserLevelProgress> = {
        1: { levelId: 1, unlocked: true, stars: 0, bestScore: 0, bestTimeSec: 0, accuracy: 0 }
      };
      return init;
    }
    return JSON.parse(raw);
  } catch {
    return { 1: { levelId: 1, unlocked: true, stars: 0, bestScore: 0, bestTimeSec: 0, accuracy: 0 } };
  }
}

export function saveUserProgress(progress: Record<number, UserLevelProgress>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (err) {
    console.error('Error saving progress', err);
  }
}

export function loadUserStats(): UserStats {
  const defaultStats: UserStats = {
    totalSolved: 0,
    totalCorrect: 0,
    totalTimePlayedSec: 0,
    bestStreak: 0,
    highestTimeAttackScore: 0,
    highestSPM: 0,
    starsTotal: 0,
  };
  if (typeof window === 'undefined') return defaultStats;
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats;
    return { ...defaultStats, ...JSON.parse(raw) };
  } catch {
    return defaultStats;
  }
}

export function saveUserStats(stats: UserStats): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    console.error('Error saving stats', err);
  }
}
