/**
 * Daily Challenge Engine & Global Leaderboard
 * Generates a unique, curated, deterministic math sequence per day
 * and handles persistent leaderboard ranking and daily streaks.
 */

import {
  DailyChallengePuzzle,
  DailyChallengeQuestion,
  DailyChallengeRecord,
  DailyChallengeUserState,
  LeaderboardEntry,
  Question,
} from '../types';

// Simple fast deterministic pseudo-random number generator (Mulberry32)
function createSeededPRNG(seed: number) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convert string like "2026-09-06" into a 32-bit integer seed
export function hashDateStringToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Helper to get formatted YYYY-MM-DD
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date into human-readable Indonesian date
export function formatIndonesianDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${days[date.getDay()]}, ${d} ${months[date.getMonth()]} ${y}`;
  } catch {
    return dateStr;
  }
}

// Themes for days
const DAILY_THEMES = [
  { title: 'Harmoni Refleks & Logika', desc: 'Kombinasi kecepatan aritmatika dan kalkulasi aljabar terstruktur.' },
  { title: 'Badai Perkalian Kilat', desc: 'Fokus pada kecepatan tabel perkalian ganda dan kuadrat cepat.' },
  { title: 'Tantangan Master BODMAS', desc: 'Kalkulasi presisi prioritas operasi hitung dan tanda kurung.' },
  { title: 'Misteri Angka Hilang', desc: 'Temukan nilai variabel tersembunyi dengan nalar logika terbalik.' },
  { title: 'Ketangkasan Tiga Bilangan', desc: 'Rantai operasi matematika 3 angka berturutan tanpa jeda.' },
  { title: 'Grandmaster Aljabar Kilat', desc: 'Persamaan linear kilat satu langkah untuk mengasah insting matematika.' },
  { title: 'Kalkulasi Ekstrim Akhir Pekan', desc: 'Ujian komprehensif seluruh trik berhitung cepat mental.' },
];

/**
 * Generates the 10-question curated math sequence for the specific date.
 * Every user worldwide gets the EXACT same 10 curated questions in the same order.
 */
export function getDailyPuzzle(dateStr: string = getTodayDateString()): DailyChallengePuzzle {
  const seed = hashDateStringToSeed(dateStr);
  const rng = createSeededPRNG(seed);

  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  const themeIdx = seed % DAILY_THEMES.length;
  const theme = DAILY_THEMES[themeIdx];

  const questions: DailyChallengeQuestion[] = [];

  // STAGE 1: Pemanasan Refleks Puluhan (Addition)
  const s1_a = randInt(26, 68);
  const s1_b = randInt(18, 49);
  questions.push({
    id: `daily_${dateStr}_q1`,
    stageNumber: 1,
    stageTitle: 'Pemanasan Refleks',
    stageIcon: '⚡',
    difficultyRating: 1,
    prompt: `${s1_a} + ${s1_b}`,
    num1: s1_a,
    num2: s1_b,
    operation: '+',
    correctAnswer: s1_a + s1_b,
    explanation: `Trik: Bulatkan ${s1_b} ke puluhan atau jumlahkan puluhan (${Math.floor(s1_a / 10) * 10} + ${Math.floor(s1_b / 10) * 10}) lalu satuan (${s1_a % 10} + ${s1_b % 10}) = ${s1_a + s1_b}.`,
  });

  // STAGE 2: Pengurangan Cepat (Subtraction)
  const s2_a = randInt(65, 99);
  const s2_b = randInt(27, s2_a - 15);
  questions.push({
    id: `daily_${dateStr}_q2`,
    stageNumber: 2,
    stageTitle: 'Pengurangan Puluhan',
    stageIcon: '➖',
    difficultyRating: 2,
    prompt: `${s2_a} - ${s2_b}`,
    num1: s2_a,
    num2: s2_b,
    operation: '-',
    correctAnswer: s2_a - s2_b,
    explanation: `Trik: ${s2_a} dikurangi ${Math.floor(s2_b / 10) * 10} = ${s2_a - Math.floor(s2_b / 10) * 10}, lalu kurangi ${s2_b % 10} = ${s2_a - s2_b}.`,
  });

  // STAGE 3: Perkalian Refleks Tabel (Multiplication)
  const s3_a = randInt(6, 12);
  const s3_b = randInt(7, 12);
  questions.push({
    id: `daily_${dateStr}_q3`,
    stageNumber: 3,
    stageTitle: 'Perkalian Kilat',
    stageIcon: '✖️',
    difficultyRating: 2,
    prompt: `${s3_a} × ${s3_b}`,
    num1: s3_a,
    num2: s3_b,
    operation: '*',
    correctAnswer: s3_a * s3_b,
    explanation: `Refleks perkalian: ${s3_a} dikali ${s3_b} adalah ${s3_a * s3_b}.`,
  });

  // STAGE 4: Pembagian Bersih Tanpa Sisa (Division)
  const s4_quotient = randInt(6, 14);
  const s4_divisor = randInt(4, 9);
  const s4_dividend = s4_quotient * s4_divisor;
  questions.push({
    id: `daily_${dateStr}_q4`,
    stageNumber: 4,
    stageTitle: 'Pembagian Pas Bersih',
    stageIcon: '➗',
    difficultyRating: 2,
    prompt: `${s4_dividend} ÷ ${s4_divisor}`,
    num1: s4_dividend,
    num2: s4_divisor,
    operation: '/',
    correctAnswer: s4_quotient,
    explanation: `Kebalikan perkalian: ${s4_divisor} × ${s4_quotient} = ${s4_dividend}, jadi ${s4_dividend} ÷ ${s4_divisor} = ${s4_quotient}.`,
  });

  // STAGE 5: Angka Misteri Hilang (?) (Missing Operand)
  const s5_type = randInt(0, 1);
  if (s5_type === 0) {
    const missing = randInt(6, 13);
    const mult = randInt(6, 11);
    const prod = missing * mult;
    questions.push({
      id: `daily_${dateStr}_q5`,
      stageNumber: 5,
      stageTitle: 'Angka Misteri (?)',
      stageIcon: '❓',
      difficultyRating: 3,
      prompt: `? × ${mult} = ${prod}`,
      missingPosition: 'first',
      num1: missing,
      num2: mult,
      operation: '*',
      correctAnswer: missing,
      explanation: `Bagi hasilnya: ? = ${prod} ÷ ${mult} = ${missing}.`,
    });
  } else {
    const missing = randInt(18, 48);
    const add = randInt(25, 55);
    const sum = missing + add;
    questions.push({
      id: `daily_${dateStr}_q5`,
      stageNumber: 5,
      stageTitle: 'Angka Misteri (?)',
      stageIcon: '❓',
      difficultyRating: 3,
      prompt: `${add} + ? = ${sum}`,
      missingPosition: 'second',
      num1: add,
      num2: missing,
      operation: '+',
      correctAnswer: missing,
      explanation: `Kurangkan: ? = ${sum} - ${add} = ${missing}.`,
    });
  }

  // STAGE 6: Urutan Operasi BODMAS (Mixed Operations)
  const s6_multA = randInt(3, 8);
  const s6_multB = randInt(4, 9);
  const s6_add = randInt(12, 35);
  questions.push({
    id: `daily_${dateStr}_q6`,
    stageNumber: 6,
    stageTitle: 'Urutan Operasi (BODMAS)',
    stageIcon: '📐',
    difficultyRating: 4,
    prompt: `${s6_add} + ${s6_multA} × ${s6_multB}`,
    num1: s6_add,
    num2: s6_multA,
    num3: s6_multB,
    operation: '+*',
    correctAnswer: s6_add + s6_multA * s6_multB,
    explanation: `Dahulukan perkalian! Hitung ${s6_multA} × ${s6_multB} = ${s6_multA * s6_multB}, lalu tambahkan ${s6_add} = ${s6_add + s6_multA * s6_multB}.`,
  });

  // STAGE 7: Tanda Kurung Cepat (Parentheses Priority)
  const s7_p1 = randInt(15, 35);
  const s7_p2 = randInt(6, 14);
  const s7_mult = randInt(3, 6);
  questions.push({
    id: `daily_${dateStr}_q7`,
    stageNumber: 7,
    stageTitle: 'Kurung Prioritas',
    stageIcon: '()',
    difficultyRating: 4,
    prompt: `(${s7_p1} - ${s7_p2}) × ${s7_mult}`,
    num1: s7_p1 - s7_p2,
    num2: s7_mult,
    operation: '()*',
    correctAnswer: (s7_p1 - s7_p2) * s7_mult,
    explanation: `Selesaikan dalam kurung: (${s7_p1} - ${s7_p2}) = ${s7_p1 - s7_p2}, lalu kalikan ${s7_mult} = ${(s7_p1 - s7_p2) * s7_mult}.`,
  });

  // STAGE 8: Tiga Bilangan Berantai (Three Terms Chain)
  const s8_a = randInt(45, 85);
  const s8_b = randInt(18, 38);
  const s8_c = randInt(12, 29);
  questions.push({
    id: `daily_${dateStr}_q8`,
    stageNumber: 8,
    stageTitle: 'Rantai 3 Bilangan',
    stageIcon: '⛓️',
    difficultyRating: 4,
    prompt: `${s8_a} - ${s8_b} + ${s8_c}`,
    num1: s8_a,
    num2: s8_b,
    num3: s8_c,
    operation: '-+',
    correctAnswer: s8_a - s8_b + s8_c,
    explanation: `Langkah: ${s8_a} - ${s8_b} = ${s8_a - s8_b}, kemudian + ${s8_c} = ${s8_a - s8_b + s8_c}.`,
  });

  // STAGE 9: Mini Aljabar Mental (Linear Equation)
  const s9_m = randInt(3, 7);
  const s9_x = randInt(4, 11);
  const s9_c = randInt(8, 25);
  const s9_res = s9_m * s9_x + s9_c;
  questions.push({
    id: `daily_${dateStr}_q9`,
    stageNumber: 9,
    stageTitle: 'Aljabar Mental Kilat',
    stageIcon: '🧩',
    difficultyRating: 5,
    prompt: `${s9_m} × ? + ${s9_c} = ${s9_res}`,
    missingPosition: 'second',
    num1: s9_m,
    num2: s9_c,
    operation: 'algebra',
    correctAnswer: s9_x,
    explanation: `Kurangkan konstanta: ${s9_res} - ${s9_c} = ${s9_res - s9_c}. Lalu bagi koefisien: ${s9_res - s9_c} ÷ ${s9_m} = ${s9_x}.`,
  });

  // STAGE 10: Teka-teki Bos Harian (The Grand Finale Boss Puzzle)
  const bossType = randInt(0, 1);
  if (bossType === 0) {
    // Square trick: n² - something
    const n = randInt(12, 16);
    const sub = randInt(15, 45);
    questions.push({
      id: `daily_${dateStr}_q10`,
      stageNumber: 10,
      stageTitle: 'Bos Harian: Kuadrat Kilat',
      stageIcon: '👑',
      difficultyRating: 6,
      prompt: `${n}² - ${sub}`,
      num1: n,
      num2: sub,
      operation: '²-',
      correctAnswer: n * n - sub,
      explanation: `Kuadratkan: ${n}² = ${n * n}. Lalu kurangi ${sub} = ${n * n - sub}!`,
    });
  } else {
    // Combined double parentheses: (A × B) - (C × D)
    const a = randInt(7, 12);
    const b = randInt(6, 9);
    const c = randInt(3, 6);
    const d = randInt(4, 7);
    questions.push({
      id: `daily_${dateStr}_q10`,
      stageNumber: 10,
      stageTitle: 'Bos Harian: Ganda Berimbang',
      stageIcon: '👑',
      difficultyRating: 6,
      prompt: `(${a} × ${b}) - (${c} × ${d})`,
      num1: a * b,
      num2: c * d,
      operation: 'boss',
      correctAnswer: a * b - c * d,
      explanation: `Hitung sisi kiri: ${a} × ${b} = ${a * b}. Hitung sisi kanan: ${c} × ${d} = ${c * d}. Hasil: ${a * b} - ${c * d} = ${a * b - c * d}!`,
    });
  }

  return {
    date: dateStr,
    seed,
    formattedDate: formatIndonesianDate(dateStr),
    title: `Tantangan Harian: ${theme.title}`,
    theme: theme.title,
    description: theme.desc,
    questions,
    targetTimeSec: 75,
  };
}

// Deterministic mock players to populate realistic global leaderboard benchmarks
const GLOBAL_BOT_POOL = [
  { name: 'Kenshin_Speed', country: 'JP', flag: '🇯🇵', baseScore: 2320, variance: 80, time: 32.4, acc: 100 },
  { name: 'BintangMath', country: 'ID', flag: '🇮🇩', baseScore: 2260, variance: 90, time: 34.1, acc: 100 },
  { name: 'Sophie_V', country: 'FR', flag: '🇫🇷', baseScore: 2190, variance: 75, time: 36.8, acc: 100 },
  { name: 'Lucas_B', country: 'DE', flag: '🇩🇪', baseScore: 2120, variance: 85, time: 39.2, acc: 100 },
  { name: 'Arjun_N', country: 'IN', flag: '🇮🇳', baseScore: 2070, variance: 60, time: 41.0, acc: 100 },
  { name: 'Min-Jun_K', country: 'KR', flag: '🇰🇷', baseScore: 1990, variance: 70, time: 43.5, acc: 100 },
  { name: 'Maya_Jakarta', country: 'ID', flag: '🇮🇩', baseScore: 1930, variance: 80, time: 45.8, acc: 90 },
  { name: 'Oliver_UK', country: 'GB', flag: '🇬🇧', baseScore: 1860, variance: 70, time: 48.2, acc: 100 },
  { name: 'Chen_Wei', country: 'SG', flag: '🇸🇬', baseScore: 1810, variance: 65, time: 51.0, acc: 90 },
  { name: 'Elena_R', country: 'IT', flag: '🇮🇹', baseScore: 1750, variance: 80, time: 53.6, acc: 90 },
  { name: 'Farhan_MY', country: 'MY', flag: '🇲🇾', baseScore: 1690, variance: 60, time: 56.1, acc: 90 },
  { name: 'Zack_USA', country: 'US', flag: '🇺🇸', baseScore: 1620, variance: 75, time: 58.4, acc: 90 },
  { name: 'Rian_Surabaya', country: 'ID', flag: '🇮🇩', baseScore: 1560, variance: 70, time: 61.2, acc: 80 },
  { name: 'Carlos_M', country: 'ES', flag: '🇪🇸', baseScore: 1480, variance: 65, time: 64.7, acc: 80 },
  { name: 'Anisa_Jogja', country: 'ID', flag: '🇮🇩', baseScore: 1390, variance: 80, time: 68.3, acc: 80 },
];

/**
 * Gets the global leaderboard for a specific date puzzle.
 * Integrates deterministic benchmark scores with any real user scores submitted for that day.
 */
export function getLeaderboardForDate(dateStr: string): LeaderboardEntry[] {
  const seed = hashDateStringToSeed(dateStr);
  const rng = createSeededPRNG(seed + 9999);

  // Load user saved record for this date if exists
  const userState = loadDailyChallengeState();
  const userRecord = userState.history[dateStr];

  const entries: LeaderboardEntry[] = [];

  // Generate benchmark global competitors based on date seed
  GLOBAL_BOT_POOL.forEach((bot, index) => {
    // slight variation based on day's puzzle
    const scoreVar = Math.floor((rng() - 0.5) * bot.variance);
    const finalScore = Math.max(1200, bot.baseScore + scoreVar);
    const timeVar = (rng() - 0.5) * 3;
    const finalTime = Math.round((bot.time + timeVar) * 10) / 10;

    entries.push({
      id: `bot_${dateStr}_${index}`,
      rank: 0,
      playerName: bot.name,
      countryCode: bot.country,
      flag: bot.flag,
      score: finalScore,
      timeTakenSec: finalTime,
      accuracy: bot.acc,
      maxStreak: bot.acc === 100 ? 10 : Math.floor(rng() * 4) + 6,
      date: dateStr,
      timestamp: Date.now() - (index + 1) * 3600000,
      badge: index === 0 ? '🏆 Juara 1' : index === 1 ? '🥈 Juara 2' : index === 2 ? '🥉 Juara 3' : undefined,
    });
  });

  // If user has a record for this date, add user
  if (userRecord && userRecord.completed) {
    entries.push({
      id: `user_${dateStr}`,
      rank: 0,
      playerName: userState.playerName || 'Kamu (Pemain)',
      countryCode: userState.playerCountry || 'ID',
      flag: userState.playerFlag || '🇮🇩',
      score: userRecord.score,
      timeTakenSec: userRecord.timeTakenSec,
      accuracy: userRecord.accuracy,
      maxStreak: userRecord.maxStreak,
      isCurrentUser: true,
      date: dateStr,
      timestamp: new Date(userRecord.completedAt).getTime() || Date.now(),
      badge: 'Bintang Hari Ini',
    });
  }

  // Sort entries: Score DESC, Accuracy DESC, Time ASC
  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return a.timeTakenSec - b.timeTakenSec;
  });

  // Assign 1-indexed ranks
  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
    if (idx === 0) entry.badge = '🏆 Juara 1';
    else if (idx === 1) entry.badge = '🥈 Juara 2';
    else if (idx === 2) entry.badge = '🥉 Juara 3';
  });

  return entries;
}

// LocalStorage Keys
const DAILY_STATE_KEY = 'hitung_kilat_daily_challenge_v1';

export function loadDailyChallengeState(): DailyChallengeUserState {
  const defaultState: DailyChallengeUserState = {
    currentStreak: 0,
    bestStreak: 0,
    playerName: 'Ksatria Kilat',
    playerCountry: 'ID',
    playerFlag: '🇮🇩',
    history: {},
  };

  if (typeof window === 'undefined') return defaultState;

  try {
    const raw = localStorage.getItem(DAILY_STATE_KEY);
    if (!raw) return defaultState;
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return defaultState;
  }
}

export function saveDailyChallengeState(state: DailyChallengeUserState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DAILY_STATE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save daily challenge state', err);
  }
}

/**
 * Calculates score for the 10-question sequence:
 * - Base points: 120 per correct answer (up to 1,200)
 * - Speed bonus: based on targetTime (75s) vs actual time (up to 800)
 * - Streak bonus: combo multiplier (up to 300)
 * - 100% Perfect accuracy bonus: 200
 */
export function calculateDailyScore(
  correctCount: number,
  timeTakenSec: number,
  maxStreak: number,
  accuracy: number,
  targetTimeSec: number = 75
): number {
  const basePoints = correctCount * 120;
  const streakBonus = Math.min(300, maxStreak * 30);
  const speedRatio = Math.max(0, (targetTimeSec - timeTakenSec) / targetTimeSec);
  const speedBonus = Math.round(speedRatio * 800 * (accuracy / 100));
  const perfectBonus = accuracy === 100 ? 200 : 0;

  return Math.max(100, basePoints + streakBonus + speedBonus + perfectBonus);
}

/**
 * Submits the user's score for today's puzzle, updates daily streak,
 * re-evaluates the leaderboard, and returns the user's rank.
 */
export function submitDailyChallengeScore(
  dateStr: string,
  correctCount: number,
  totalQuestions: number,
  timeTakenSec: number,
  maxStreak: number,
  answers: Question[]
): {
  record: DailyChallengeRecord;
  userRank: number;
  totalParticipants: number;
  percentile: number;
  streak: number;
  leaderboard: LeaderboardEntry[];
} {
  const accuracy = Math.round((correctCount / totalQuestions) * 100);
  const score = calculateDailyScore(correctCount, timeTakenSec, maxStreak, accuracy);

  const state = loadDailyChallengeState();

  // Streak logic
  let newStreak = state.currentStreak || 0;
  const today = getTodayDateString();

  if (dateStr === today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    if (state.lastCompletedDate === yesterdayStr) {
      newStreak += 1;
    } else if (state.lastCompletedDate === today) {
      // already completed today, keep streak
    } else {
      newStreak = 1;
    }
  }

  const existingRecord = state.history[dateStr];
  const finalScore = existingRecord ? Math.max(existingRecord.score, score) : score;

  const record: DailyChallengeRecord = {
    date: dateStr,
    completed: true,
    score: finalScore,
    timeTakenSec,
    correctCount,
    totalQuestions,
    accuracy,
    maxStreak,
    rank: 1, // calculated below
    completedAt: new Date().toISOString(),
    answers,
  };

  state.history[dateStr] = record;
  state.lastCompletedDate = dateStr;
  state.currentStreak = newStreak;
  state.bestStreak = Math.max(state.bestStreak || 0, newStreak);

  saveDailyChallengeState(state);

  // Compute updated leaderboard
  const leaderboard = getLeaderboardForDate(dateStr);
  const userEntry = leaderboard.find((e) => e.isCurrentUser);
  const userRank = userEntry ? userEntry.rank : 1;
  const totalParticipants = leaderboard.length;
  const percentile = Math.max(1, Math.round((userRank / totalParticipants) * 100));

  // Update record with actual rank
  record.rank = userRank;
  state.history[dateStr] = record;
  saveDailyChallengeState(state);

  return {
    record,
    userRank,
    totalParticipants,
    percentile,
    streak: newStreak,
    leaderboard,
  };
}

/**
 * Calculates remaining hours, minutes, and seconds until the next daily challenge (midnight)
 */
export function getTimeUntilNextDaily(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = midnight.getTime() - now.getTime();

  const totalSec = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return { hours, minutes, seconds };
}
