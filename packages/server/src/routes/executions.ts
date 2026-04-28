import { Router } from 'express';
import type { AppDeps } from '../factory.js';

export function createExecutionsRouter(deps: AppDeps): Router {
  const router = Router();

  router.get('/:workflowId', async (req, res) => {
    const { workflowId } = req.params;
    const logLookupId =
      typeof req.query.executionId === 'string' && req.query.executionId.length > 0
        ? req.query.executionId
        : workflowId;

    const [workflowResult, logsResult] = await Promise.all([
      deps.keeperhub.getWorkflow(workflowId),
      deps.keeperhub.getExecutionLogs(logLookupId),
    ]);

    if (!logsResult.ok) {
      res.status(502).json({ error: logsResult.error.message });
      return;
    }

    res.json({
      workflowId,
      executionId: logLookupId,
      status: workflowResult.ok ? workflowResult.value : null,
      logs: logsResult.value,
      ...(workflowResult.ok ? {} : { workflowStatusError: workflowResult.error.message }),
    });
  });

  return router;
}
