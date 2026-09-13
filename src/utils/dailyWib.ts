import { DAILY_TIMEZONE, hashDailySeed } from '../engine/competitive/modes/daily';
import { Question } from '../types';

/**
 * Returns formatted YYYY-MM-DD in Asia/Jakarta timezone
 */
export function getWIBDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns formatted YYYY-MM-DD for yesterday in Asia/Jakarta timezone
 */
export function getYesterdayWIBDateString(now: Date = new Date()): string {
  const wibDateStr = getWIBDateString(now);
  const [y, m, d] = wibDateStr.split('-').map(Number);
  // Yesterday midday in UTC ensures it stays firmly in the previous WIB day
  const yesterdayMidday = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
  return getWIBDateString(yesterdayMidday);
}

/**
 * Calculates remaining hours, minutes, seconds, and milliseconds until 00:00:00 WIB
 */
export function getWIBTimeUntilMidnight(now: Date = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
} {
  const nowMs = now.getTime();
  const wibDateStr = getWIBDateString(now);
  const [y, m, d] = wibDateStr.split('-').map(Number);

  // Next midnight WIB is (d + 1) at 00:00:00 WIB.
  // WIB is UTC+7, so 00:00:00 WIB is 17:00:00 UTC of previous day.
  const nextMidnightUtc = Date.UTC(y, m - 1, d + 1, -7, 0, 0, 0);
  const diffMs = Math.max(0, nextMidnightUtc - nowMs);

  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return { hours, minutes, seconds, ms: diffMs };
}

function createMulberry32(seed: number) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates 10 curated deterministic questions for the daily challenge.
 */
export function generateDailyQuestions(challengeId: string): Question[] {
  const seed = hashDailySeed(challengeId);
  const rng = createMulberry32(seed);
  const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

  const questions: Question[] = [];

  // Stage 1: Refleks Puluhan (Addition)
  const s1_a = randInt(25, 68);
  const s1_b = randInt(18, 49);
  questions.push({
    id: `daily_${challengeId}_q1`,
    prompt: `${s1_a} + ${s1_b} = ?`,
    displayPrompt: `${s1_a} + ${s1_b} = ?`,
    difficulty: 1,
    skillId: 'addition',
    subSkillId: 'add.tens',
    answerSpec: { kind: 'integer', value: s1_a + s1_b },
  });

  // Stage 2: Pengurangan Puluhan
  const s2_a = randInt(65, 99);
  const s2_b = randInt(22, s2_a - 15);
  questions.push({
    id: `daily_${challengeId}_q2`,
    prompt: `${s2_a} - ${s2_b} = ?`,
    displayPrompt: `${s2_a} - ${s2_b} = ?`,
    difficulty: 1,
    skillId: 'subtraction',
    subSkillId: 'sub.tens',
    answerSpec: { kind: 'integer', value: s2_a - s2_b },
  });

  // Stage 3: Perkalian Refleks Tabel
  const s3_a = randInt(6, 12);
  const s3_b = randInt(7, 12);
  questions.push({
    id: `daily_${challengeId}_q3`,
    prompt: `${s3_a} × ${s3_b} = ?`,
    displayPrompt: `${s3_a} × ${s3_b} = ?`,
    difficulty: 2,
    skillId: 'multiplication',
    subSkillId: 'mul.table',
    answerSpec: { kind: 'integer', value: s3_a * s3_b },
  });

  // Stage 4: Pembagian Cepat
  const s4_div = randInt(4, 9);
  const s4_ans = randInt(7, 14);
  const s4_num = s4_div * s4_ans;
  questions.push({
    id: `daily_${challengeId}_q4`,
    prompt: `${s4_num} ÷ ${s4_div} = ?`,
    displayPrompt: `${s4_num} ÷ ${s4_div} = ?`,
    difficulty: 2,
    skillId: 'division',
    subSkillId: 'div.basic',
    answerSpec: { kind: 'integer', value: s4_ans },
  });

  // Stage 5: Rantai Tiga Bilangan
  const s5_a = randInt(15, 35);
  const s5_b = randInt(10, 25);
  const s5_c = randInt(8, 19);
  questions.push({
    id: `daily_${challengeId}_q5`,
    prompt: `${s5_a} + ${s5_b} - ${s5_c} = ?`,
    displayPrompt: `${s5_a} + ${s5_b} - ${s5_c} = ?`,
    difficulty: 3,
    skillId: 'mixed',
    subSkillId: 'chain.three',
    answerSpec: { kind: 'integer', value: s5_a + s5_b - s5_c },
  });

  // Stage 6: Pengurangan Majemuk
  const s6_a = randInt(85, 145);
  const s6_b = randInt(35, 65);
  questions.push({
    id: `daily_${challengeId}_q6`,
    prompt: `${s6_a} - ${s6_b} = ?`,
    displayPrompt: `${s6_a} - ${s6_b} = ?`,
    difficulty: 3,
    skillId: 'subtraction',
    subSkillId: 'sub.compound',
    answerSpec: { kind: 'integer', value: s6_a - s6_b },
  });

  // Stage 7: Perkalian Puluhan Dekat
  const s7_a = randInt(13, 24);
  const s7_b = randInt(4, 8);
  questions.push({
    id: `daily_${challengeId}_q7`,
    prompt: `${s7_a} × ${s7_b} = ?`,
    displayPrompt: `${s7_a} × ${s7_b} = ?`,
    difficulty: 4,
    skillId: 'multiplication',
    subSkillId: 'mul.twodigit',
    answerSpec: { kind: 'integer', value: s7_a * s7_b },
  });

  // Stage 8: Operasi Prioritas BODMAS
  const s8_a = randInt(20, 50);
  const s8_b = randInt(3, 7);
  const s8_c = randInt(4, 9);
  questions.push({
    id: `daily_${challengeId}_q8`,
    prompt: `${s8_a} + ${s8_b} × ${s8_c} = ?`,
    displayPrompt: `${s8_a} + ${s8_b} × ${s8_c} = ?`,
    difficulty: 4,
    skillId: 'mixed',
    subSkillId: 'bodmas.basic',
    answerSpec: { kind: 'integer', value: s8_a + s8_b * s8_c },
  });

  // Stage 9: Persamaan Linear Cepat
  const s9_x = randInt(12, 38);
  const s9_add = randInt(15, 45);
  const s9_total = s9_x + s9_add;
  questions.push({
    id: `daily_${challengeId}_q9`,
    prompt: `x + ${s9_add} = ${s9_total}, x = ?`,
    displayPrompt: `x + ${s9_add} = ${s9_total}, x = ?`,
    difficulty: 5,
    skillId: 'algebra',
    subSkillId: 'linear.step1',
    answerSpec: { kind: 'integer', value: s9_x },
  });

  // Stage 10: Grandmaster Mental Math
  const s10_a = randInt(12, 19);
  const s10_b = randInt(11, 16);
  questions.push({
    id: `daily_${challengeId}_q10`,
    prompt: `${s10_a} × ${s10_b} = ?`,
    displayPrompt: `${s10_a} × ${s10_b} = ?`,
    difficulty: 5,
    skillId: 'multiplication',
    subSkillId: 'mul.teen',
    answerSpec: { kind: 'integer', value: s10_a * s10_b },
  });

  return questions;
}
