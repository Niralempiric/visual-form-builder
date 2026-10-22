import express from 'express';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Liveness reports only this process; database readiness is a separate later task.
  app.get('/health/live', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.json({ status: 'ok', service: 'visual-form-builder-api' });
  });

  return app;
}
