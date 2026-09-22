// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportAllGameData, triggerJSONDownload } from '../../src/utils/privacy/dataExporter';

describe('dataExporter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('generates an export payload with standard metadata and partitions', () => {
    const data = exportAllGameData();
    expect(data.metadata).toBeDefined();
    expect(data.metadata.schemaVersion).toBe(2);
    expect(data.metadata.policyVersion).toBe('2.0.0');
    expect(data.privacy).toBeDefined();
    expect(data.campaign).toBeDefined();
    expect(data.mastery).toBeDefined();
    expect(data.dailyChallenge).toBeDefined();
    expect(data.achievements).toBeDefined();
    expect(data.stats).toBeDefined();
  });

  it('does not contain any sensitive PII or authentication tokens', () => {
    const jsonStr = JSON.stringify(exportAllGameData());
    expect(jsonStr).not.toContain('authToken');
    expect(jsonStr).not.toContain('refreshToken');
    expect(jsonStr).not.toContain('password');
  });

  it('triggers json file download via anchor element', () => {
    const originalCreateObjectURL = window.URL.createObjectURL;
    const originalRevokeObjectURL = window.URL.revokeObjectURL;

    const mockCreate = vi.fn().mockReturnValue('blob:http://localhost/mock-uuid');
    const mockRevoke = vi.fn();
    window.URL.createObjectURL = mockCreate;
    window.URL.revokeObjectURL = mockRevoke;

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    triggerJSONDownload('game_export.json', JSON.stringify({ test: 123 }));

    expect(mockCreate).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(mockRevoke).toHaveBeenCalledWith('blob:http://localhost/mock-uuid');

    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
    clickSpy.mockRestore();
  });
});
