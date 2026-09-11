import { LevelConfigV2 } from '../types/level';
import { QuestionGeneratorRegistry } from '../registry';

export interface ManifestValidationResult {
  isValid: boolean;
  errors: string[];
  totalLevels: number;
}

const VALID_ANSWER_KINDS = new Set(['integer', 'rational', 'decimal', 'choice']);

/**
 * Validates the full campaign manifest against structural invariants,
 * registry capabilities, rule schemas, and DAG acyclicity constraints.
 */
export function validateLevelManifest(
  levels: LevelConfigV2[],
  registry: QuestionGeneratorRegistry
): ManifestValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(levels)) {
    return {
      isValid: false,
      errors: ['Manifest must be an array of LevelConfigV2 objects'],
      totalLevels: 0,
    };
  }

  // 1. Total level count invariant (must be exactly 72)
  if (levels.length !== 72) {
    errors.push(`Manifest total levels count must be exactly 72, got ${levels.length}`);
  }

  const seenIds = new Set<string>();
  const allIds = new Set<string>();
  for (const lvl of levels) {
    if (lvl && typeof lvl.id === 'string') {
      allIds.add(lvl.id);
    }
  }

  // 2. Structural per-level validations
  for (let idx = 0; idx < levels.length; idx++) {
    const lvl = levels[idx];
    const expectedOrder = idx + 1;

    if (!lvl) {
      errors.push(`Level at index ${idx} is null or undefined`);
      continue;
    }

    // ID uniqueness
    if (seenIds.has(lvl.id)) {
      errors.push(`Duplicate level ID: "${lvl.id}" found at index ${idx}`);
    } else {
      seenIds.add(lvl.id);
    }

    // Continuous 1-based order
    if (lvl.order !== expectedOrder) {
      errors.push(
        `Level "${lvl.id}" at index ${idx} has order ${lvl.order}, expected continuous order ${expectedOrder}`
      );
    }

    // Answer kind validation
    if (!VALID_ANSWER_KINDS.has(lvl.answerKind)) {
      errors.push(
        `Level "${lvl.id}" has invalid answerKind: "${lvl.answerKind}". Must be one of: integer, rational, decimal, choice`
      );
    }

    // Generator key registration and rule syntax validation
    if (!registry.has(lvl.generatorKey)) {
      errors.push(`Level "${lvl.id}" references unregistered generatorKey: "${lvl.generatorKey}"`);
    } else {
      try {
        const generator = registry.get(lvl.generatorKey);
        generator.validateRule(lvl.rules);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Level "${lvl.id}" rule validation failed for generator "${lvl.generatorKey}": ${message}`);
      }
    }
  }

  // 3. First level prerequisite constraint
  if (levels.length > 0) {
    const firstLevel = levels[0];
    if (Array.isArray(firstLevel.prerequisiteIds) && firstLevel.prerequisiteIds.length > 0) {
      errors.push(
        `First level "${firstLevel.id}" must have empty prerequisiteIds, got: [${firstLevel.prerequisiteIds.join(', ')}]`
      );
    }
  }

  // 4. Prerequisite existence check
  for (const lvl of levels) {
    if (!lvl || !Array.isArray(lvl.prerequisiteIds)) continue;
    for (const prereqId of lvl.prerequisiteIds) {
      if (!allIds.has(prereqId)) {
        errors.push(`Level "${lvl.id}" references non-existent prerequisite ID: "${prereqId}"`);
      }
    }
  }

  // 5. DFS Prerequisite Graph Cycle Detection
  const levelMap = new Map<string, LevelConfigV2>();
  for (const lvl of levels) {
    if (lvl && lvl.id && !levelMap.has(lvl.id)) {
      levelMap.set(lvl.id, lvl);
    }
  }

  // Visit states: 0 = unvisited, 1 = visiting (in current DFS recursion path), 2 = visited
  const visitStatus = new Map<string, 0 | 1 | 2>();
  for (const lvl of levels) {
    if (lvl && lvl.id) {
      visitStatus.set(lvl.id, 0);
    }
  }

  const reportedCycles = new Set<string>();

  function dfs(currentId: string, path: string[]): void {
    visitStatus.set(currentId, 1);
    path.push(currentId);

    const currentLevel = levelMap.get(currentId);
    if (currentLevel && Array.isArray(currentLevel.prerequisiteIds)) {
      for (const prereqId of currentLevel.prerequisiteIds) {
        if (!levelMap.has(prereqId)) {
          continue; // Non-existent references already reported
        }

        const status = visitStatus.get(prereqId);
        if (status === 1) {
          // Cycle detected
          const cycleStartIndex = path.indexOf(prereqId);
          const cycleNodes = path.slice(cycleStartIndex).concat(prereqId);
          const cycleStr = cycleNodes.join(' -> ');
          if (!reportedCycles.has(cycleStr)) {
            reportedCycles.add(cycleStr);
            errors.push(`Cycle detected in prerequisite graph: ${cycleStr}`);
          }
        } else if (status === 0) {
          dfs(prereqId, path);
        }
      }
    }

    path.pop();
    visitStatus.set(currentId, 2);
  }

  for (const lvl of levels) {
    if (lvl && lvl.id && visitStatus.get(lvl.id) === 0) {
      dfs(lvl.id, []);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    totalLevels: levels.length,
  };
}
