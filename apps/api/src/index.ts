import { createServer } from 'node:http';
import { createApp } from './app.js';
import { readConfiguration, ConfigurationError } from './configuration.js';
import { connectDatabase, DatabaseConnectionError } from './database.js';

import { createUserStore } from './modules/auth/store.js';
import { createAuthService } from './modules/auth/service.js';
import { createAuthRouter } from './modules/auth/router.js';

let database: Awaited<ReturnType<typeof connectDatabase>> | undefined;
try {
  const configuration = readConfiguration();
  const activeDatabase = await connectDatabase(configuration);
  database = activeDatabase;
  const auth = await createAuthService(await createUserStore(activeDatabase.connection), configuration.AUTH_BOOTSTRAP_TOKEN);
  let stopping = false;
  const server = createServer(createApp(() => stopping ? Promise.resolve(false) : activeDatabase.isReady(), createAuthRouter(auth)));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(configuration.API_PORT, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  console.log(`API listening at http://127.0.0.1:${configuration.API_PORT}`);

  function shutdown() {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 5000);
    deadline.unref();
    server.close(async (error) => {
      try {
        await activeDatabase.close();
        if (error) throw error;
      } catch {
        console.error('API shutdown failed.');
        process.exitCode = 1;
      } finally { clearTimeout(deadline); }
    });
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  await database?.close().catch(() => {});
  if (error instanceof ConfigurationError || error instanceof DatabaseConnectionError) {
    console.error(error.message);
  } else {
    // Allowlist operational codes instead of serializing an arbitrary error or URI.
    const code = error instanceof Error && 'code' in error && error.code === 'EADDRINUSE'
      ? 'EADDRINUSE' : 'unknown error';
    console.error(`API startup failed (${code}).`);
  }
  process.exitCode = 1;
}
