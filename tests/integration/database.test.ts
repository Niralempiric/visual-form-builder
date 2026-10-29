import { expect, test } from 'vitest';
import { withMongoFixture } from '../helpers/mongo.js';
import { syntheticRecord } from '../fixtures/synthetic-record.js';

// Uses the same known-safe synthetic record for the acceptance failure/correction.
test('disposable fixture commits the expected synthetic record for an independent reader', async () => {
  await withMongoFixture(async fixture => {
    expect(fixture.project).toMatch(/^vfb-d032-[a-f0-9]{12}$/);
    const writer = await fixture.connect();
    const observer = await fixture.connect();
    expect(writer.name).toBe(fixture.databaseName);
    expect(observer.getClient()).not.toBe(writer.getClient());
    const records = writer.collection<{ _id: string; label: string }>('fixture_records');
    await writer.createCollection('fixture_records');
    await writer.transaction(async session => {
      await records.insertOne({ ...syntheticRecord }, { session });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000 });
    const stored = await observer.collection<{ _id: string; label: string }>('fixture_records').findOne({ _id: syntheticRecord._id });
    expect(stored).toEqual({ _id: 'd032-synthetic-record', label: 'Synthetic fixture record' });
  });
});

test('a failing fixture body is cleaned and a new fixture starts empty', async () => {
  let firstDatabase = '';
  const intentional = new Error('Intentional synthetic fixture failure');
  await expect(withMongoFixture(async fixture => {
    firstDatabase = fixture.databaseName;
    const connection = await fixture.connect();
    await connection.collection<{ _id: string; label: string }>('fixture_records').insertOne({ ...syntheticRecord });
    throw intentional;
  })).rejects.toBe(intentional);
  // The helper verifies pools/containers/volumes/network cleanup before rejecting.
  await withMongoFixture(async fixture => {
    expect(fixture.databaseName).not.toBe(firstDatabase);
    const connection = await fixture.connect();
    expect(await connection.collection<{ _id: string; label: string }>('fixture_records').countDocuments({})).toBe(0);
  });
});
