export interface SubSkillDefinition {
  id: string; // e.g., 'multiplication.x7'
  skillId: string; // e.g., 'multiplication'
  name: string; // e.g., 'Perkalian ×7'
  description: string;
  difficultyBase: 1 | 2 | 3 | 4 | 5 | 6;
  prerequisiteSubSkillIds?: string[];
}

export interface SkillCategoryDefinition {
  id: string;
  name: string;
  icon: string;
  subSkills: SubSkillDefinition[];
}
