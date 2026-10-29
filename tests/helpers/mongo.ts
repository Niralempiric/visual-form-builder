import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { Connection } from 'mongoose';
import { readConfiguration } from '../../apps/api/src/configuration.js';

// Resolve the API's exact installed driver, without introducing a second driver.
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const mongoose: typeof import('mongoose') = requireApi('mongoose');
const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (!address || typeof address === 'string') throw new Error('Fixture port allocation failed.');
  return address.port;
}

export interface MongoFixture {
  readonly project: string;
  readonly databaseName: string;
  connect(): Promise<Connection>;
}

// The lifecycle wraps assertions too, so a failed test still closes pools and
// removes ONLY its generated Compose namespace. No caller-supplied URI or name.
export async function withMongoFixture<T>(run: (fixture: MongoFixture) => Promise<T>): Promise<T> {
  const id = randomUUID().replaceAll('-', '');
  const project = `vfb-d032-${id.slice(0, 12)}`;
  const databaseName = `vfb_d032_${id}`;
  const port = await availablePort();
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('COMPOSE_')));
  env.COMPOSE_PROJECT_NAME = project;
  env.MONGO_PORT = String(port);
  const configuration = readConfiguration({
    MONGODB_URI: `mongodb://127.0.0.1:${port}/${databaseName}?replicaSet=vfb-rs&directConnection=true`,
    MONGODB_REPLICA_SET: 'vfb-rs',
  });
  const connections: Connection[] = [];
  const compose = ['compose', '--env-file', '/dev/null', '-p', project, '-f', 'infra/compose.yaml'];
  async function docker(args: string[], phase: string, timeout = 30000) {
    try {
      return await exec('docker', args, { cwd: root, env, timeout, maxBuffer: 1024 * 1024 });
    } catch {
      // Raw driver/CLI output may include environment or credential details.
      throw new Error(`Disposable Mongo ${phase} failed for ${project}; check Docker access and availability.`);
    }
  }
  const fixture: MongoFixture = {
    project, databaseName,
    async connect() {
      const connection = mongoose.createConnection();
      connections.push(connection);
      connection.on('error', () => {});
      try {
        await connection.openUri(configuration.MONGODB_URI, {
          replicaSet: configuration.MONGODB_REPLICA_SET,
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
          socketTimeoutMS: 5000,
          bufferCommands: false,
          autoCreate: false,
          autoIndex: false,
        });
      } catch {
        throw new Error('Disposable Mongo connection failed.');
      }
      return connection;
    },
  };
  async function cleanup() {
    const closed = await Promise.allSettled(connections.map(connection => connection.close()));
    await docker([...compose, 'down', '--volumes', '--remove-orphans'], 'cleanup');
    // Check cleanup instead of assuming down succeeded; never inspect other data.
    for (const kind of ['container', 'volume', 'network']) {
      const flags = kind === 'container' ? ['-a', '-q'] : ['-q'];
      const result = await docker([kind, 'ls', ...flags, '--filter', `label=com.docker.compose.project=${project}`], 'cleanup verification');
      if (result.stdout.trim()) throw new Error(`Disposable Mongo ${kind} cleanup incomplete for ${project}.`);
    }
    if (closed.some(result => result.status === 'rejected')) throw new Error('A fixture connection did not close.');
  }
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    await docker([...compose, 'up', '-d', 'mongo'], 'start', 60000);
    await docker([...compose, 'run', '--rm', '--no-deps', 'mongo-init'], 'initialize', 60000);
    await docker([...compose, 'up', '-d', '--wait', '--wait-timeout', '90', 'mongo'], 'readiness', 100000);
    outcome = { ok: true, value: await run(fixture) };
  } catch (error) {
    outcome = { ok: false, error };
  }
  try { await cleanup(); } catch (error) {
    if (!outcome.ok) throw new AggregateError([outcome.error, error], 'Fixture body and cleanup both failed.');
    throw error;
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
