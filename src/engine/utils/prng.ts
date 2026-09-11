/**
 * Generates a 32-bit integer hash from a string seed.
 */
function hashStringSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * Creates a deterministic Mulberry32 pseudo-random number generator.
 * Returns a function producing floats in [0, 1).
 */
export function createMulberry32(seed: string | number): () => number {
  let state = typeof seed === 'string' ? hashStringSeed(seed) : seed >>> 0;
  if (state === 0) state = 1;

  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Helper to pick an integer in [min, max] inclusive using a prng.
 */
export function randomInt(prng: () => number, min: number, max: number): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.floor(prng() * (high - low + 1)) + low;
}
