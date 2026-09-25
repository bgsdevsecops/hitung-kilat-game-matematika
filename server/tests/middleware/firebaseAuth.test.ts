import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requireFirebaseAuth } from '../../src/middleware/firebaseAuth';
import * as adminConfig from '../../src/config/firebaseAdmin';

describe('requireFirebaseAuth middleware', () => {
  let mockVerifyIdToken: any;

  beforeEach(() => {
    mockVerifyIdToken = vi.fn();
    vi.spyOn(adminConfig, 'getAdminAuth').mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req: any = { headers: {} };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await requireFirebaseAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'MISSING_AUTHORIZATION_HEADER' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer ', async () => {
    const req: any = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await requireFirebaseAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'MISSING_AUTHORIZATION_HEADER' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Bearer token is empty or whitespace only', async () => {
    const req: any = { headers: { authorization: 'Bearer    ' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await requireFirebaseAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'INVALID_TOKEN_FORMAT' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token verification fails or is revoked', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired'));
    const req: any = { headers: { authorization: 'Bearer expired.token.jwt' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    await requireFirebaseAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'INVALID_OR_EXPIRED_TOKEN' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches user to request and calls next when token is valid', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'user-abc-123',
      email: 'player@example.com',
    });
    const req: any = { headers: { authorization: 'Bearer valid.token.jwt' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireFirebaseAuth(req, res, next);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid.token.jwt', true);
    expect(req.user).toEqual({ uid: 'user-abc-123', email: 'player@example.com' });
    expect(next).toHaveBeenCalled();
  });

  it('attaches user with undefined email when token payload does not include email', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'anon-user-456',
    });
    const req: any = { headers: { authorization: 'Bearer valid.anon.jwt' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await requireFirebaseAuth(req, res, next);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid.anon.jwt', true);
    expect(req.user).toEqual({ uid: 'anon-user-456', email: undefined });
    expect(next).toHaveBeenCalled();
  });
});
