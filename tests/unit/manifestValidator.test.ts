import { describe, it, expect } from 'vitest';
import { LEVEL_MANIFEST_72 } from '../../src/engine/manifest/levels';
import { validateLevelManifest, ManifestValidationResult } from '../../src/engine/manifest/validator';
import { createDefaultGeneratorRegistry } from '../../src/engine/registry';
import { LevelConfigV2 } from '../../src/engine/types/level';

function cloneManifest(levels: LevelConfigV2[] = LEVEL_MANIFEST_72): LevelConfigV2[] {
  return JSON.parse(JSON.stringify(levels));
}

describe('Manifest and Prerequisite DAG Integrity Validator', () => {
  const registry = createDefaultGeneratorRegistry();

  it('validates canonical LEVEL_MANIFEST_72 as 100% valid', () => {
    const result: ManifestValidationResult = validateLevelManifest(LEVEL_MANIFEST_72, registry);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.totalLevels).toBe(72);
  });

  it('rejects manifests with fewer than 72 levels', () => {
    const manifest = cloneManifest().slice(0, 71);
    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.totalLevels).toBe(71);
    expect(result.errors.some((err) => err.includes('72'))).toBe(true);
  });

  it('rejects manifests with more than 72 levels', () => {
    const manifest = cloneManifest();
    manifest.push({
      ...manifest[71],
      id: 'T6-EXTRA-73',
      order: 73,
      prerequisiteIds: ['T6-GRANDMASTER'],
    });

    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.totalLevels).toBe(73);
    expect(result.errors.some((err) => err.includes('72'))).toBe(true);
  });

  it('rejects an empty manifest', () => {
    const result = validateLevelManifest([], registry);

    expect(result.isValid).toBe(false);
    expect(result.totalLevels).toBe(0);
    expect(result.errors.some((err) => err.includes('72'))).toBe(true);
  });

  it('rejects duplicate level IDs', () => {
    const manifest = cloneManifest();
    manifest[1].id = manifest[0].id; // Duplicate T1-ADD-01

    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.toLowerCase().includes('duplicate') && err.includes(manifest[0].id))).toBe(true);
  });

  it('rejects non-continuous or duplicate level orders', () => {
    const manifest = cloneManifest();
    manifest[2].order = 2; // Duplicate order 2 (indices: 0->1, 1->2, 2->2 instead of 3)

    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.toLowerCase().includes('order'))).toBe(true);
  });

  it('rejects unregistered generator keys', () => {
    const manifest = cloneManifest();
    manifest[5].generatorKey = 'non_existent_generator';

    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.includes('non_existent_generator'))).toBe(true);
  });

  it('rejects invalid rules that fail generator validateRule', () => {
    const manifest = cloneManifest();
    // Addition rule with minA > maxA is invalid
    manifest[0].rules = {
      kind: 'addition',
      minA: 50,
      maxA: 10,
      minB: 1,
      maxB: 10,
    };

    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.includes(manifest[0].id) && err.toLowerCase().includes('rule'))).toBe(true);
  });

  it('rejects level 1 having prerequisites', () => {
    const manifest = cloneManifest();
    manifest[0].prerequisiteIds = ['SOME-PREREQ'];

    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.includes(manifest[0].id) && err.toLowerCase().includes('prerequisite'))).toBe(true);
  });

  it('rejects non-existent prerequisite IDs', () => {
    const manifest = cloneManifest();
    manifest[10].prerequisiteIds = ['NON-EXISTENT-LEVEL-ID'];

    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.includes('NON-EXISTENT-LEVEL-ID'))).toBe(true);
  });

  it('rejects cyclic prerequisite dependencies (2-node cycle)', () => {
    const manifest = cloneManifest();
    // Create cycle: level 2 requires level 3, and level 3 requires level 2
    manifest[1].prerequisiteIds = [manifest[2].id];
    manifest[2].prerequisiteIds = [manifest[1].id];

    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.toLowerCase().includes('cycle'))).toBe(true);
  });

  it('rejects cyclic prerequisite dependencies (3-node cycle)', () => {
    const manifest = cloneManifest();
    // Create 3-node cycle: level 2 -> level 3 -> level 4 -> level 2
    manifest[1].prerequisiteIds = [manifest[2].id];
    manifest[2].prerequisiteIds = [manifest[3].id];
    manifest[3].prerequisiteIds = [manifest[1].id];

    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.toLowerCase().includes('cycle'))).toBe(true);
  });

  it('rejects self-referencing prerequisite (1-node cycle)', () => {
    const manifest = cloneManifest();
    manifest[5].prerequisiteIds = [manifest[5].id];

    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.toLowerCase().includes('cycle'))).toBe(true);
  });

  it('rejects invalid answerKind values', () => {
    const manifest = cloneManifest();
    (manifest[0] as unknown as { answerKind: string }).answerKind = 'unsupported_type';

    const result = validateLevelManifest(manifest, registry);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((err) => err.includes('unsupported_type') || err.toLowerCase().includes('answerkind'))).toBe(true);
  });
});
