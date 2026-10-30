import { once } from 'node:events';
import type { Express } from 'express';
import type { TestContext } from 'vitest';

export async function listen(t: TestContext, app: Express) {
  const server = app.listen(0, '127.0.0.1');
  t.onTestFinished(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  }));
  await once(server, 'listening');
  return server;
}
