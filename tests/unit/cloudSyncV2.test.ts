import { describe, it, expect } from 'vitest';
import { projectV2ToLegacyV1, createDefaultCampaignState } from '../../src/utils/campaignState';

describe('projectV2ToLegacyV1', () => {
  it('projects default campaign state with level 1 unlocked and 2-24 locked', () => {
    const defaultState = createDefaultCampaignState();
    const legacy = projectV2ToLegacyV1(defaultState);

    expect(Object.keys(legacy)).toHaveLength(24);
    expect(legacy[1]).toEqual({
      levelId: 1,
      unlocked: true,
      stars: 0,
      bestScore: 0,
      accuracy: 0,
      bestTimeSec: 0,
    });
    expect(legacy[2].unlocked).toBe(false);
    expect(legacy[24].unlocked).toBe(false);
  });

  it('projects completed V2 levels back to their corresponding V1 IDs', () => {
    const state = createDefaultCampaignState();
    // T1-ADD-01 maps to V1 level 1
    state.levels['T1-ADD-01'] = {
      levelId: 'T1-ADD-01',
      unlocked: true,
      stars: 3,
      bestScore: 1500,
      accuracy: 100,
      bestTimeSec: 18.5,
    };
    // T6-GRANDMASTER maps to V1 level 24
    state.levels['T6-GRANDMASTER'] = {
      levelId: 'T6-GRANDMASTER',
      unlocked: true,
      stars: 2,
      bestScore: 3200,
      accuracy: 90,
      bestTimeSec: 54.2,
    };

    const legacy = projectV2ToLegacyV1(state);
    expect(legacy[1].stars).toBe(3);
    expect(legacy[1].bestTimeSec).toBe(18.5);
    expect(legacy[24].stars).toBe(2);
    expect(legacy[24].bestScore).toBe(3200);
  });
});
