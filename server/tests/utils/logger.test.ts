import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../src/utils/logger';

describe('Structured Logger', () => {
  let stdoutSpy: any;
  let stderrSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
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

  it('traverses and sanitizes objects inside arrays', () => {
    logger.info('batch_event', {
      items: [
        { token: 'secret-1', name: 'alpha' },
        { nested: [{ secretKey: 'top-secret' }] },
      ],
    });
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.items[0].token).toBe('[REDACTED]');
    expect(output.items[0].name).toBe('alpha');
    expect(output.items[1].nested[0].secretKey).toBe('[REDACTED]');
  });

  it('redacts compound keys containing sensitive patterns', () => {
    logger.info('compound_keys_event', {
      userToken: 'tok-123',
      clientSecret: 'sec-456',
      hashedPassword: 'pwd-789',
      apiKey: 'key-abc',
      proxyAuthorization: 'auth-header',
      userAnswer: 'answer-val',
      safeField: 'normal-data',
    });
    const output = JSON.parse(stdoutSpy.mock.calls[0][0]);
    expect(output.userToken).toBe('[REDACTED]');
    expect(output.clientSecret).toBe('[REDACTED]');
    expect(output.hashedPassword).toBe('[REDACTED]');
    expect(output.apiKey).toBe('[REDACTED]');
    expect(output.proxyAuthorization).toBe('[REDACTED]');
    expect(output.userAnswer).toBe('[REDACTED]');
    expect(output.safeField).toBe('normal-data');
  });

  it('properly serializes Error objects in metadata with message and stack', () => {
    const errorInstance = new Error('Database connection failed');
    logger.error('db_failure', { error: errorInstance });
    expect(stderrSpy).toHaveBeenCalled();
    const output = JSON.parse(stderrSpy.mock.calls[0][0]);
    expect(output.level).toBe('error');
    expect(output.msg).toBe('db_failure');
    expect(output.error).toBeDefined();
    expect(output.error.message).toBe('Database connection failed');
    expect(typeof output.error.stack).toBe('string');
  });
});
