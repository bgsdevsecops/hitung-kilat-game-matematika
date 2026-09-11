import { GeneratorRule } from './rules';

export interface LevelConfigV2 {
  id: string; // Stable string ID, e.g. "T1-ADD-01"
  order: number;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  description: string;
  generatorKey: string;
  rules: GeneratorRule;
  answerKind: 'integer' | 'rational' | 'decimal' | 'choice';
  difficulty: 1 | 2 | 3 | 4 | 5 | 6;
  questionCount: number;
  targetTimeSec: number;
  timeLimitSec: number;
  boss: boolean;
  passingAccuracy: number;
  prerequisiteIds: string[];
  primarySkillId: string;
  skillTags: string[];
  contentVersion: string;
}
