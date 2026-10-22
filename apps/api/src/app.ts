import express from 'express';

export function createApp(isReady: () => Promise<boolean> = async () => false) {
  const app = express();
  app.disable('x-powered-by');

  // Liveness reports only this process, independently of dependency readiness.
  app.get('/health/live', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.json({ status: 'ok', service: 'visual-form-builder-api' });
  });

  app.get('/health/ready', async (_request, response) => {
    let ready = false;
    try { ready = await isReady(); } catch { /* Never expose dependency errors. */ }
    response.set('Cache-Control', 'no-store').status(ready ? 200 : 503)
      .json({ status: ready ? 'ready' : 'not_ready', service: 'visual-form-builder-api' });
  });

  return app;
}
