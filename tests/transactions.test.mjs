import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { readConfiguration } from '../apps/api/dist/configuration.js';

// Resolve the API's exact dependency, without adding a separate root Mongo driver.
const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const mongoose = requireApi('mongoose');
const root = fileURLToPath(new URL('../', import.meta.url));

async function availablePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

test('D02.2 multi-collection commit and intentional rollback on a disposable replica set', {
  timeout: 180000,
}, async t => {
  const id = randomUUID().replaceAll('-', '');
  const project = `vfb-d022-${id.slice(0, 12)}`;
  const mongoPort = await availablePort();
  const env = { ...process.env, COMPOSE_PROJECT_NAME: project, MONGO_PORT: String(mongoPort) };
  // Always generate a private fixture URL. Never consume a developer's MONGODB_URI.
  const configuration = readConfiguration({
    MONGODB_URI: `mongodb://127.0.0.1:${mongoPort}/vfb_d022_${id}?replicaSet=vfb-rs&directConnection=true`,
  });
  const connections = [];
  t.after(async () => {
    const closed = await Promise.allSettled(connections.map(connection => connection.close()));
    const cleaned = spawnSync('docker', [
      'compose', '-p', project, '-f', 'infra/compose.yaml', 'down', '--volumes', '--remove-orphans',
    ], { cwd: root, env, encoding: 'utf8', timeout: 30000 });
    assert.equal(cleaned.error, undefined, 'Could not run isolated fixture cleanup');
    assert.equal(cleaned.status, 0, cleaned.stdout + cleaned.stderr);
    assert.ok(closed.every(result => result.status === 'fulfilled'), 'A fixture connection did not close');
  });

  const started = spawnSync(process.execPath, ['scripts/database.mjs', 'up'], {
    cwd: root, env, encoding: 'utf8', timeout: 120000,
  });
  assert.equal(started.error, undefined, 'Could not start disposable Compose replica set');
  assert.equal(started.status, 0, started.stdout + started.stderr);

  async function connect() {
    const connection = mongoose.createConnection();
    connections.push(connection);
    connection.on('error', () => {});
    await connection.openUri(configuration.MONGODB_URI, {
      replicaSet: configuration.MONGODB_REPLICA_SET,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000,
      autoCreate: false,
      autoIndex: false,
      bufferCommands: false,
    });
    return connection;
  }
  const writer = await connect();
  const observer = await connect();
  assert.notEqual(writer.getClient(), observer.getClient(), 'Observer must use an independent client');
  // Prepare collections outside transactions. These are synthetic infrastructure fixtures,
  // not production form/version models or future publish/submit implementations.
  await writer.db.createCollection('fixture_heads');
  await writer.db.createCollection('fixture_values');
  const heads = writer.db.collection('fixture_heads');
  const values = writer.db.collection('fixture_values');
  const observedHeads = observer.db.collection('fixture_heads', { readConcern: { level: 'majority' } });
  const observedValues = observer.db.collection('fixture_values', { readConcern: { level: 'majority' } });
  const options = {
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority', wtimeoutMS: 5000 },
    readPreference: 'primary',
    maxCommitTimeMS: 5000,
  };
  const head = { _id: 'synthetic-head', currentValueId: 'committed-value' };
  const committed = { _id: 'committed-value', headId: head._id, label: 'Synthetic committed fixture' };

  await t.test('successful transaction commits both collections for an independent reader', async () => {
    const result = await writer.transaction(async session => {
      // Keep transaction operations sequential and explicitly pass the same session.
      assert.equal((await values.insertOne(committed, { session })).acknowledged, true);
      assert.equal((await heads.insertOne(head, { session })).acknowledged, true);
      assert.deepEqual(await values.findOne({ _id: committed._id }, { session }), committed);
      assert.deepEqual(await heads.findOne({ _id: head._id }, { session }), head);
      assert.equal(await observedValues.countDocuments({}), 0, 'Uncommitted values leaked');
      assert.equal(await observedHeads.countDocuments({}), 0, 'Uncommitted heads leaked');
      return 'committed';
    }, options);
    assert.equal(result, 'committed');
    assert.deepEqual(await observedHeads.findOne({ _id: head._id }), head);
    assert.deepEqual(await observedValues.findOne({ _id: committed._id }), committed);
  });

  for (const failureStage of ['after-insert', 'after-pointer-update']) {
    await t.test(`${failureStage}: intentional failure removes pending writes and preserves committed state`, async () => {
      const candidate = { _id: failureStage, headId: head._id, label: 'Synthetic rollback fixture' };
      const intentional = new Error(`Intentional rollback: ${failureStage}`);
      let reachedFailure = false;
      await assert.rejects(writer.transaction(async session => {
        assert.equal((await values.insertOne(candidate, { session })).acknowledged, true);
        assert.deepEqual(await values.findOne({ _id: candidate._id }, { session }), candidate);
        if (failureStage === 'after-pointer-update') {
          const updated = await heads.updateOne({ _id: head._id }, {
            $set: { currentValueId: candidate._id },
          }, { session });
          assert.equal(updated.matchedCount, 1);
          assert.equal(updated.modifiedCount, 1);
          assert.equal((await heads.findOne({ _id: head._id }, { session })).currentValueId, candidate._id);
        }
        assert.equal(await observedValues.countDocuments({ _id: candidate._id }), 0);
        assert.deepEqual(await observedHeads.findOne({ _id: head._id }), head);
        reachedFailure = true;
        throw intentional;
      }, options), error => error === intentional);
      assert.equal(reachedFailure, true, 'Failure must occur after acknowledged transactional writes');
      // These checks precede teardown: cleanup cannot hide a broken rollback.
      assert.equal(await observedValues.countDocuments({ _id: candidate._id }), 0, 'Orphan fixture value survived rollback');
      assert.equal(await observedValues.countDocuments({}), 1);
      assert.equal(await observedHeads.countDocuments({}), 1);
      assert.deepEqual(await observedHeads.findOne({ _id: head._id }), head);
      assert.deepEqual(await observedValues.findOne({ _id: committed._id }), committed);
    });
  }

  await t.test('a later transaction commits and a fresh connection reads durable state after aborts', async () => {
    const next = { _id: 'committed-after-rollback', headId: head._id, label: 'Synthetic recovery fixture' };
    await writer.transaction(async session => {
      await values.insertOne(next, { session });
      const updated = await heads.updateOne({ _id: head._id }, {
        $set: { currentValueId: next._id },
      }, { session });
      assert.equal(updated.modifiedCount, 1);
    }, options);
    await writer.close();
    const fresh = await connect();
    assert.equal(await fresh.db.collection('fixture_heads').countDocuments({}), 1);
    assert.equal(await fresh.db.collection('fixture_values').countDocuments({}), 2);
    assert.deepEqual(await fresh.db.collection('fixture_heads').findOne({ _id: head._id }), {
      ...head, currentValueId: next._id,
    });
    assert.deepEqual(await fresh.db.collection('fixture_values').findOne({ _id: next._id }), next);
    assert.deepEqual(await fresh.db.collection('fixture_values').findOne({ _id: committed._id }), committed);
    assert.equal(await fresh.db.collection('fixture_values').countDocuments({
      _id: { $in: ['after-insert', 'after-pointer-update'] },
    }), 0);
  });
});
