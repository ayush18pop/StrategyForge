import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { config } from 'dotenv';
import type { AppDeps } from './factory.js';
import { createDeps } from './factory.js';
import { createExecutionsRouter } from './routes/executions.js';
import { createMonitorRouter } from './routes/monitor.js';
import { createSearchRouter } from './routes/search.js';
import { createStrategiesRouter } from './routes/strategies.js';
import { startMonitoringCron } from './lib/monitoring-cron.js';

config();

export function createApp(deps: AppDeps): Express {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/strategies/search', createSearchRouter(deps));
  app.use('/api/strategies', createStrategiesRouter(deps));
  app.use('/api/executions', createExecutionsRouter(deps));
  app.use('/api/monitor', createMonitorRouter(deps));

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    console.error('[StrategyForge Server] unhandled error:', error);
    res.status(500).json({ error: message });
  });

  return app;
}

async function main(): Promise<void> {
  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  const deps = await createDeps();
  const app = createApp(deps);

  app.listen(port, () => {
    console.log(`[StrategyForge Server] listening on port ${port}`);
    startMonitoringCron(deps);
  });
}

main().catch((error) => {
  console.error('[StrategyForge Server] failed to start:', error);
  process.exitCode = 1;
});
