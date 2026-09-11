import { describe, it, expect } from 'vitest';
import { SKILL_TAXONOMY, getSubSkill, getAllSubSkills, isValidSubSkillId } from '../../src/engine/taxonomy';

describe('Skill Taxonomy Registry', () => {
  it('defines all 14 mandatory skill categories from PRD §8.4', () => {
    const expectedCategories = [
      'addition', 'subtraction', 'multiplication', 'division',
      'missing_operand', 'multi_operation', 'bodmas', 'signed_number',
      'algebra', 'square', 'root', 'percentage', 'fraction', 'ratio'
    ];
    for (const cat of expectedCategories) {
      expect(SKILL_TAXONOMY[cat]).toBeDefined();
      expect(SKILL_TAXONOMY[cat].id).toBe(cat);
      expect(SKILL_TAXONOMY[cat].name).toBeTruthy();
      expect(SKILL_TAXONOMY[cat].subSkills.length).toBeGreaterThan(0);
    }
  });

  it('formats every sub-skill ID as lowercase <skillId>.<subSkillKey>', () => {
    const all = getAllSubSkills();
    expect(all.length).toBeGreaterThanOrEqual(40);
    for (const sub of all) {
      expect(sub.id).toMatch(/^[a-z_]+\.[a-z0-9_]+$/);
      expect(sub.id.startsWith(`${sub.skillId}.`)).toBe(true);
      expect(isValidSubSkillId(sub.id)).toBe(true);
    }
  });

  it('retrieves sub-skills correctly via getSubSkill', () => {
    const x7 = getSubSkill('multiplication.x7');
    expect(x7).toBeDefined();
    expect(x7?.name).toContain('×7');
    expect(x7?.skillId).toBe('multiplication');

    expect(getSubSkill('nonexistent.skill')).toBeUndefined();
    expect(isValidSubSkillId('nonexistent.skill')).toBe(false);
  });

  it('has unique IDs across all sub-skills', () => {
    const all = getAllSubSkills();
    const ids = all.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(all.length);
  });

  it('validates prerequisiteSubSkillIds reference valid sub-skills', () => {
    const all = getAllSubSkills();
    for (const sub of all) {
      if (sub.prerequisiteSubSkillIds) {
        for (const prereq of sub.prerequisiteSubSkillIds) {
          expect(isValidSubSkillId(prereq)).toBe(true);
        }
      }
    }
  });

  it('assigns valid difficultyBase between 1 and 6 for all sub-skills', () => {
    const all = getAllSubSkills();
    for (const sub of all) {
      expect(sub.difficultyBase).toBeGreaterThanOrEqual(1);
      expect(sub.difficultyBase).toBeLessThanOrEqual(6);
      expect(Number.isInteger(sub.difficultyBase)).toBe(true);
    }
  });

  it('ensures each category matches its subSkills and icons are present', () => {
    for (const [catId, cat] of Object.entries(SKILL_TAXONOMY)) {
      expect(cat.id).toBe(catId);
      expect(cat.icon).toBeTruthy();
      for (const sub of cat.subSkills) {
        expect(sub.skillId).toBe(catId);
      }
    }
  });
});
