import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../src/utils/logger';

describe('Structured Logger', () => {
  let stdoutSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('emits structured JSON to stdout for info level', () => {
    logger.info('session_created', { sessionId: 'sess-123', mode: 'sprint' });
    expect(stdoutSpy).toHaveBeenCalled();
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.level).toBe('info');
    expect(output.msg).toBe('session_created');
    expect(output.sessionId).toBe('sess-123');
    expect(output.mode).toBe('sprint');
    expect(typeof output.timestamp).toBe('string');
  });

  it('redacts sensitive fields like token and authorization', () => {
    logger.info('auth_event', { token: 'secret-token-value', authorization: 'Bearer abc', userId: 'user-1' });
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.token).toBe('[REDACTED]');
    expect(output.authorization).toBe('[REDACTED]');
    expect(output.userId).toBe('user-1');
  });
});
