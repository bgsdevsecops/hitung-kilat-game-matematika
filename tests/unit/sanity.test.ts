import { describe, it, expect } from 'vitest';

describe('Sanity Test', () => {
  it('verifies vitest test runner is operational', () => {
    const sum = (a: number, b: number) => a + b;
    expect(sum(2, 3)).toBe(5);
  });
});
