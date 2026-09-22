export interface PseudonymValidationResult {
  valid: boolean;
  error?: string;
  sanitized: string;
  cooldownRemainingMs?: number;
}

const RENAME_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const ALLOWLIST_REGEX = /^[a-zA-Z0-9_-]+( [a-zA-Z0-9_-]+)*$/;

const FORBIDDEN_WORDS = [
  'anjing', 'babi', 'bangsat', 'bajingan', 'kontol', 'memek', 'jembut',
  'pantek', 'asu', 'kampret', 'tai', 'tolol', 'goblok', 'idiot',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy', 'damn',
];

function normalizeLeetspeak(input: string): string {
  return input
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't');
}

export function validatePseudonym(
  candidate: string,
  lastChangeTimestamp?: number,
  currentName?: string,
  nowMs: number = Date.now()
): PseudonymValidationResult {
  const sanitized = (candidate || '').trim();

  // 1. Length validation (3-20 chars)
  if (sanitized.length < 3 || sanitized.length > 20) {
    return {
      valid: false,
      error: 'Nama samaran harus memiliki panjang antara 3 hingga 20 karakter.',
      sanitized,
    };
  }

  // 2. Character allowlist
  if (!ALLOWLIST_REGEX.test(sanitized)) {
    return {
      valid: false,
      error: 'Nama samaran hanya boleh memuat huruf, angka, tanda hubung (-), garis bawah (_), dan spasi tunggal.',
      sanitized,
    };
  }

  // 3. Profanity filter with leetspeak
  const normalized = normalizeLeetspeak(sanitized);
  const containsProfanity = FORBIDDEN_WORDS.some((word) =>
    normalized.includes(word)
  );
  if (containsProfanity) {
    return {
      valid: false,
      error: 'Nama samaran mengandung kata yang tidak pantas. Silakan gunakan nama lain.',
      sanitized,
    };
  }

  // 4. Rate limit check (24h cooldown)
  const isDefaultName = !currentName || currentName === 'Pemain Kilat';
  if (!isDefaultName && lastChangeTimestamp && sanitized !== currentName) {
    const elapsed = nowMs - lastChangeTimestamp;
    if (elapsed < RENAME_COOLDOWN_MS) {
      const remainingMs = RENAME_COOLDOWN_MS - elapsed;
      const hours = Math.floor(remainingMs / (60 * 60 * 1000));
      const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
      return {
        valid: false,
        error: `Nama samaran hanya dapat diubah 1 kali per 24 jam. Coba lagi dalam ${hours} jam ${minutes} menit.`,
        sanitized,
        cooldownRemainingMs: remainingMs,
      };
    }
  }

  return {
    valid: true,
    sanitized,
  };
}
