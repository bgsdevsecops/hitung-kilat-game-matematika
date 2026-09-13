import { describe, it, expect } from 'vitest';
import { generateCompetitiveQuestions } from '../../src/engine/competitive/questionGenerator';

describe('Competitive Question Generator', () => {
  it('generates the exact requested count of questions for a tier', () => {
    const questions = generateCompetitiveQuestions(1, 5);
    expect(questions).toHaveLength(5);
    for (const q of questions) {
      expect(q.id).toBeDefined();
      expect(q.prompt).toBeDefined();
      expect(q.answerSpec).toBeDefined();
    }
  });

  it('clamps tier between 1 and 6 and produces questions across different tiers', () => {
    const tier1Questions = generateCompetitiveQuestions(0, 3);
    const tier6Questions = generateCompetitiveQuestions(10, 3);
    expect(tier1Questions).toHaveLength(3);
    expect(tier6Questions).toHaveLength(3);
    expect(tier1Questions[0].prompt).toBeDefined();
    expect(tier6Questions[0].prompt).toBeDefined();
  });

  it('generates deterministic questions when a pseudo-random generator is provided', () => {
    let seed1 = 12345;
    const prng1 = () => {
      seed1 = (seed1 * 16807) % 2147483647;
      return (seed1 - 1) / 2147483646;
    };
    let seed2 = 12345;
    const prng2 = () => {
      seed2 = (seed2 * 16807) % 2147483647;
      return (seed2 - 1) / 2147483646;
    };
    const q1 = generateCompetitiveQuestions(2, 4, prng1);
    const q2 = generateCompetitiveQuestions(2, 4, prng2);
    expect(q1.map(q => q.prompt)).toEqual(q2.map(q => q.prompt));
  });
});
