import { Router } from 'express';
import { CompetitiveController } from '../controllers/competitiveController.js';
import { requireFirebaseAuth } from '../middleware/firebaseAuth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

export function createCompetitiveRouter(
  controller: CompetitiveController,
  skipAuth = false
): Router {
  const router = Router();
  const authMiddleware = skipAuth
    ? (req: any, _res: any, next: any) => {
        req.user = req.user || { uid: 'test-user-id' };
        next();
      }
    : requireFirebaseAuth;

  const sessionLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });
  const submitLimiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000 });
  const leaderboardLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60_000 });

  router.post('/sessions', authMiddleware, sessionLimiter, controller.createSession);
  router.post('/sessions/:sessionId/submit', authMiddleware, submitLimiter, controller.submitSession);
  router.get('/leaderboard/:periodKey', leaderboardLimiter, controller.getLeaderboard);
  router.get('/results/me', authMiddleware, controller.getMyResults);

  return router;
}
