import { createServer } from 'node:http';
import { createApp } from './app.js';

const rawPort = process.env.API_PORT ?? '4000';
const port = Number(rawPort);
if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.');
}

const server = createServer(createApp());
server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(`API startup failed (${error.code ?? 'unknown error'}).`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`API listening at http://127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
  // Bound shutdown even if an open connection does not finish.
  setTimeout(() => process.exit(1), 5000).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
