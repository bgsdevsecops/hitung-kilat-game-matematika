import { createApp } from './app.js';
import { initializeFirebaseAdmin, getAdminFirestore } from './config/firebaseAdmin.js';
import { SessionService } from './services/sessionService.js';
import { ValidationService } from './services/validationService.js';
import { LeaderboardService } from './services/leaderboardService.js';
import { logger } from './utils/logger.js';

try {
  initializeFirebaseAdmin();
  const firestore = getAdminFirestore();

  const sessionService = new SessionService(firestore);
  const validationService = new ValidationService(firestore);
  const leaderboardService = new LeaderboardService(firestore);

  const app = createApp({
    sessionService,
    validationService,
    leaderboardService,
  });

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    logger.info('server_started', { port, env: process.env.NODE_ENV || 'development' });
  });
} catch (err: any) {
  logger.error('server_fatal_startup_error', { error: err?.message });
  process.exit(1);
}
