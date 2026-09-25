import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { CompetitiveController } from './controllers/competitiveController.js';
import { createCompetitiveRouter } from './routes/competitive.js';
import { errorHandler } from './middleware/errorHandler.js';
import { SessionService } from './services/sessionService.js';
import { ValidationService } from './services/validationService.js';
import { LeaderboardService } from './services/leaderboardService.js';

export interface AppDependencies {
  sessionService: SessionService;
  validationService: ValidationService;
  leaderboardService: LeaderboardService;
  skipAuth?: boolean;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '256kb' }));

  // Health check — no auth required
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const controller = new CompetitiveController(
    deps.sessionService,
    deps.validationService,
    deps.leaderboardService
  );

  app.use('/api/competitive', createCompetitiveRouter(controller, deps.skipAuth));
  app.use(errorHandler);

  return app;
}
