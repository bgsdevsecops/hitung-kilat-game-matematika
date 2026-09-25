let rankedOverride: boolean | null = null;

export function isCompetitiveRankedEnabled(): boolean {
  if (rankedOverride !== null) {
    return rankedOverride;
  }
  const envVal = (import.meta as any).env?.VITE_COMPETITIVE_RANKED_ENABLED;
  return envVal === 'true' || envVal === '1';
}

export function setCompetitiveRankedOverride(enabled: boolean | null): void {
  rankedOverride = enabled;
}
