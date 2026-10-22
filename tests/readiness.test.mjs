import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { createApp } from '../apps/api/dist/app.js';
import { readConfiguration, ConfigurationError } from '../apps/api/dist/configuration.js';

const service = 'visual-form-builder-api';
async function port() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise(resolve => server.close(resolve));
  return address.port;
}
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { env, encoding: 'utf8', timeout: 180000 });
  assert.equal(result.error, undefined, `${command} could not run`);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}
async function until(check, message, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (!await check()) {
    assert.ok(Date.now() < deadline, message);
    await delay(100);
  }
}
function launch(extra) {
  const env = { ...process.env };
  delete env.MONGODB_URI;
  delete env.MONGODB_REPLICA_SET;
  Object.assign(env, extra);
  const child = spawn(process.execPath, ['apps/api/dist/index.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exited = once(child, 'exit');
  return { child, exited, output: () => output };
}
async function exited(api) {
  let deadline;
  try {
    return await Promise.race([api.exited, new Promise((_, reject) => {
      deadline = setTimeout(() => reject(new Error('API did not exit within startup failure budget')), 10000);
    })]);
  } finally { clearTimeout(deadline); }
}
async function stop(api) {
  if (api.child.exitCode !== null || api.child.signalCode !== null) return;
  api.child.kill('SIGTERM');
  const deadline = setTimeout(() => api.child.kill('SIGKILL'), 6000);
  try { await api.exited; } finally { clearTimeout(deadline); }
}

test('configuration rejects secret-bearing invalid input without echoing values', () => {
  for (const uri of [undefined, '', 'https://synthetic-password@example.invalid', 'mongodb://bad value']) {
    assert.throws(() => readConfiguration({ MONGODB_URI: uri }), error =>
      error instanceof ConfigurationError && error.message === 'Invalid configuration: MONGODB_URI.');
  }
  const parsed = readConfiguration({ MONGODB_URI: 'mongodb://127.0.0.1/test', EXTRA: 'synthetic-password' });
  assert.equal(parsed.API_PORT, 4000);
  assert.equal(parsed.MONGODB_REPLICA_SET, 'vfb-rs');
  assert.equal('EXTRA' in parsed, false);
  assert.throws(() => readConfiguration({ MONGODB_URI: parsed.MONGODB_URI, API_PORT: '0' }), /API_PORT/);
});

test('HTTP liveness and readiness are independent and dependency errors stay private', async t => {
  let ready = false;
  let fail = false;
  const app = createApp(async () => {
    if (fail) throw new Error('synthetic-password');
    return ready;
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const value of [false, true]) {
    ready = value;
    const response = await fetch(base + '/health/ready');
    assert.equal(response.status, value ? 200 : 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.deepEqual(await response.json(), { status: value ? 'ready' : 'not_ready', service });
  }
  fail = true;
  const failed = await fetch(base + '/health/ready');
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { status: 'not_ready', service });
  const live = await fetch(base + '/health/live');
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), { status: 'ok', service });
});

test('D02.1 clean Compose replica set, idempotent initialization and real API readiness', { timeout: 240000 }, async t => {
  const project = `vfb-d021-${randomUUID().slice(0, 8)}`;
  const mongoPort = await port();
  const apiPort = await port();
  const env = { ...process.env, COMPOSE_PROJECT_NAME: project, MONGO_PORT: String(mongoPort) };
  const compose = ['compose', '-p', project, '-f', 'infra/compose.yaml'];
  const docker = args => run('docker', args, env);
  const children = [];
  let paused = false;
  const standalone = project + '-standalone';
  t.after(async () => {
    if (paused) docker([...compose, 'unpause', 'mongo']);
    for (const child of children) await stop(child);
    // These names and volumes belong only to this randomly named disposable fixture.
    const cleaned = spawnSync('docker', [...compose, 'down', '--volumes', '--remove-orphans'], { env, encoding: 'utf8' });
    assert.equal(cleaned.status, 0, cleaned.stderr);
    spawnSync('docker', ['rm', '-fv', standalone], { stdio: 'ignore' });
  });
  const api = extra => {
    const child = launch({ API_PORT: String(apiPort), ...extra });
    children.push(child); return child;
  };
  run(process.execPath, ['scripts/database.mjs', 'up'], env);
  // Running setup twice must retain configuration and the persistent volume.
  run(process.execPath, ['scripts/database.mjs', 'up'], env);
  assert.match(docker([...compose, 'exec', '-T', 'mongo', 'mongosh', '--quiet', '--eval',
    "const c=rs.conf(); print(c._id + ':' + c.version + ':' + c.members.length)"]), /vfb-rs:1:1/);
  const uri = `mongodb://127.0.0.1:${mongoPort}/visual_form_builder_check?replicaSet=vfb-rs&directConnection=true`;
  const active = api({ MONGODB_URI: uri });
  await until(() => {
    assert.equal(active.child.exitCode, null, active.output());
    return active.output().includes('API listening');
  }, 'API did not connect to the replica set');
  const base = `http://127.0.0.1:${apiPort}`;
  async function health(path, status) {
    const response = await fetch(`${base}/health/${path}`, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { status: path === 'live' ? 'ok' : status === 200 ? 'ready' : 'not_ready', service });
  }
  await health('ready', 200);
  const conflict = api({ MONGODB_URI: uri });
  assert.equal((await exited(conflict))[0], 1);
  assert.match(conflict.output(), /EADDRINUSE/);

  docker([...compose, 'pause', 'mongo']); paused = true;
  const started = Date.now();
  await health('ready', 503);
  assert.ok(Date.now() - started < 2500, 'Readiness exceeded its bounded operation timeout');
  await health('live', 200);
  docker([...compose, 'unpause', 'mongo']); paused = false;
  await until(async () => (await fetch(base + '/health/ready')).status === 200, 'Readiness did not recover');

  docker([...compose, 'stop', 'mongo']);
  await health('ready', 503);
  await health('live', 200);
  const failed = api({ API_PORT: String(await port()), MONGODB_URI:
    `mongodb://synthetic-user:synthetic-password@127.0.0.1:${mongoPort}/synthetic-db?directConnection=true` });
  assert.equal((await exited(failed))[0], 1);
  assert.match(failed.output(), /MongoDB connection failed/);
  assert.doesNotMatch(failed.output(), /synthetic-user|synthetic-password|synthetic-db|mongodb:|127\.0\.0\.1/);
  docker([...compose, 'start', 'mongo']);
  await until(async () => (await fetch(base + '/health/ready')).status === 200, 'Readiness did not recover after restart');

  for (const value of [undefined, 'https://synthetic-password@example.invalid', uri + '&syntheticPassword=synthetic-password']) {
    const rejected = api({ API_PORT: String(await port()), MONGODB_URI: value });
    assert.equal((await exited(rejected))[0], 1);
    assert.match(rejected.output(), /Invalid configuration|MongoDB connection failed/);
    assert.doesNotMatch(rejected.output(), /synthetic-password|mongodb:|API listening/);
  }

  const image = 'mongo:8.0.32@sha256:d0d926f94df099bff534b7ee5b5986458131a22489dfff8664509af0c1e2ca9c';
  const standalonePort = await port();
  docker(['run', '-d', '--name', standalone, '-p', `127.0.0.1:${standalonePort}:27017`, image, '--bind_ip_all']);
  await until(() => docker(['logs', standalone]).includes('Waiting for connections'), 'Standalone fixture did not start');
  const unsupported = api({ API_PORT: String(await port()), MONGODB_URI:
    `mongodb://127.0.0.1:${standalonePort}/test?directConnection=true` });
  assert.equal((await exited(unsupported))[0], 1, 'Standalone Mongo must not satisfy the replica-set connection');
  assert.match(unsupported.output(), /MongoDB connection failed/);
  await stop(active);
  assert.equal(active.child.exitCode, 0);
  assert.doesNotMatch(active.output(), /mongodb:|visual_form_builder_check/);
  await assert.rejects(fetch(base + '/health/live'));
});
