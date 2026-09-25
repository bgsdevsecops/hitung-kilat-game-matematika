import { describe, it, expect, beforeEach } from 'vitest';
import { isCompetitiveRankedEnabled, setCompetitiveRankedOverride } from '../../src/lib/featureFlags';

describe('featureFlags', () => {
  beforeEach(() => {
    setCompetitiveRankedOverride(null);
  });

  it('defaults to false when environment variable is not set', () => {
    expect(isCompetitiveRankedEnabled()).toBe(false);
  });

  it('respects programmatic override (kill switch)', () => {
    setCompetitiveRankedOverride(true);
    expect(isCompetitiveRankedEnabled()).toBe(true);

    setCompetitiveRankedOverride(false);
    expect(isCompetitiveRankedEnabled()).toBe(false);
  });
});
