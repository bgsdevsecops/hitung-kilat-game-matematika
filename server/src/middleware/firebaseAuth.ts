import { Request, Response, NextFunction } from 'express';
import { getAdminAuth } from '../config/firebaseAdmin.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'MISSING_AUTHORIZATION_HEADER',
      message: 'An Authorization header with Bearer token is required.',
    });
    return;
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    res.status(401).json({
      error: 'INVALID_TOKEN_FORMAT',
      message: 'Bearer token value cannot be empty.',
    });
    return;
  }

  try {
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(idToken, true);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    next();
  } catch (err: any) {
    logger.warn('auth_token_verification_failed', {
      reason: err?.message,
      code: err?.code,
    });
    res.status(401).json({
      error: 'INVALID_OR_EXPIRED_TOKEN',
      message: 'The provided Firebase ID token is invalid, expired, or revoked.',
    });
  }
}
