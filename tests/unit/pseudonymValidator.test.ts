import { describe, it, expect } from 'vitest';
import { validatePseudonym } from '../../src/utils/privacy/pseudonymValidator';

describe('pseudonymValidator', () => {
  it('accepts valid alphanumeric pseudonyms with hyphens, underscores and spaces', () => {
    const res = validatePseudonym('Juara_1-Kilat');
    expect(res.valid).toBe(true);
    expect(res.sanitized).toBe('Juara_1-Kilat');
  });

  it('rejects pseudonyms shorter than 3 characters or longer than 20 characters', () => {
    const shortRes = validatePseudonym('AB');
    expect(shortRes.valid).toBe(false);
    expect(shortRes.error).toContain('3 hingga 20');

    const longRes = validatePseudonym('NamaPemainYangSangatPanjangSekaliLebihDari20');
    expect(longRes.valid).toBe(false);
    expect(longRes.error).toContain('3 hingga 20');
  });

  it('rejects forbidden characters, scripts, and multiple consecutive spaces', () => {
    expect(validatePseudonym('<script>alert(1)</script>').valid).toBe(false);
    expect(validatePseudonym('Pemain #1').valid).toBe(false);
    expect(validatePseudonym('Pemain  Kilat').valid).toBe(false);
  });

  it('filters Indonesian and English profanities including leetspeak normalization', () => {
    expect(validatePseudonym('b4j1ng4n').valid).toBe(false);
    expect(validatePseudonym('anjing_liar').valid).toBe(false);
    expect(validatePseudonym('damn_player').valid).toBe(false);
  });

  it('enforces 24-hour rename cooldown when non-default name is modified', () => {
    const now = 100_000_000;
    const recent = now - 3_600_000; // 1 hour ago
    const res = validatePseudonym('NamaBaru', recent, 'NamaLama', now);
    expect(res.valid).toBe(false);
    expect(res.error).toContain('24 jam');
    expect(res.cooldownRemainingMs).toBe(23 * 3_600_000);
  });

  it('exempts initial rename from default "Pemain Kilat" from cooldown', () => {
    const now = 100_000_000;
    const recent = now - 1000;
    const res = validatePseudonym('NamaPertama', recent, 'Pemain Kilat', now);
    expect(res.valid).toBe(true);
  });
});
