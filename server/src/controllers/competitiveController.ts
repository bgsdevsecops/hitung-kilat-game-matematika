import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/firebaseAuth.js';
import { SessionService } from '../services/sessionService.js';
import { ValidationService } from '../services/validationService.js';
import { LeaderboardService } from '../services/leaderboardService.js';
import { CompetitiveMode } from '@engine/competitive/types.js';

const VALID_MODES: readonly string[] = ['sprint', 'survival', 'daily'];

export class CompetitiveController {
  constructor(
    private sessionService: SessionService,
    private validationService: ValidationService,
    private leaderboardService: LeaderboardService
  ) {}

  createSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mode, idempotencyKey } = req.body;
      if (!mode || !VALID_MODES.includes(mode)) {
        res.status(400).json({ error: 'INVALID_MODE', message: 'Mode must be sprint, survival, or daily.' });
        return;
      }
      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        res.status(400).json({ error: 'INVALID_IDEMPOTENCY_KEY', message: 'A non-empty string idempotencyKey is required.' });
        return;
      }

      const userId = req.user!.uid;
      const result = await this.sessionService.createSession({ userId, mode: mode as CompetitiveMode, idempotencyKey });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  submitSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const { answers, submissionIdempotencyKey, pseudonym } = req.body;

      if (!Array.isArray(answers)) {
        res.status(400).json({ error: 'INVALID_ANSWERS', message: 'answers must be an array.' });
        return;
      }
      if (!submissionIdempotencyKey || typeof submissionIdempotencyKey !== 'string') {
        res.status(400).json({ error: 'INVALID_IDEMPOTENCY_KEY', message: 'A non-empty submissionIdempotencyKey is required.' });
        return;
      }

      const userId = req.user!.uid;
      const result = await this.validationService.validateAndFinalize({
        sessionId,
        userId,
        answers,
        submissionIdempotencyKey,
        pseudonym,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getLeaderboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { periodKey } = req.params;
      const { mode, limit, offset } = req.query;

      if (!mode || !VALID_MODES.includes(mode as string)) {
        res.status(400).json({ error: 'INVALID_MODE', message: 'Query parameter mode is required.' });
        return;
      }

      const result = await this.leaderboardService.getLeaderboard({
        periodKey,
        mode: mode as CompetitiveMode,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getMyResults = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.uid;
      const { mode, limit, offset } = req.query;

      const result = await this.leaderboardService.getUserResults({
        userId,
        mode: mode ? (mode as CompetitiveMode) : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
