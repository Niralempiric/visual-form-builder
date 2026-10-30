import { expect, test } from 'vitest';
import request from 'supertest';
import { errorEnvelopeSchema, successEnvelopeSchema, userDtoSchema } from '@visual-form-builder/contracts';
import { createApp } from '../../apps/api/src/app.js';
import { createUserStore } from '../../apps/api/src/modules/auth/store.js';
import { createAuthService } from '../../apps/api/src/modules/auth/service.js';
import { createAuthRouter } from '../../apps/api/src/modules/auth/router.js';
import { withMongoFixture } from '../helpers/mongo.js';
import { listen } from '../helpers/http.js';

const password = 'Synthetic account passphrase 123!';
const token = 'synthetic-integration-bootstrap-token-only';

test('two API instances race bootstrap: exactly one durable account and permanent marker, no hashes in responses', async t => {
  await withMongoFixture(async fixture => {
    const first = await fixture.connect();
    const second = await fixture.connect();
    const observer = await fixture.connect();
    const services = await Promise.all([first, second].map(async connection =>
      createAuthService(await createUserStore(connection), token)));
    const servers = await Promise.all(services.map(service => listen(t, createApp(async () => true, createAuthRouter(service)))));
    const results = await Promise.all(servers.map((server, i) => request(server).post('/api/v1/auth/bootstrap')
      .set('X-Bootstrap-Token', token).send({ email: `AUTHOR${i}@example.test`, password }).timeout(15000)));
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    const result = results.find(value => value.status === 201);
    expect(result).toBeDefined();
    const dto = successEnvelopeSchema(userDtoSchema).parse(result?.body).data;
    expect(Object.keys(dto).sort()).toEqual(['email', 'id', 'status']);
    for (const response of results) {
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.text).not.toMatch(/password|recovery|argon2|Synthetic/);
    }
    expect(errorEnvelopeSchema.parse(results.find(value => value.status === 409)?.body).error.code).toBe('CONFLICT');
    const rows = await observer.collection('users').find({}).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,(?:t=2,p=1|p=1,t=2)\$/);
    expect(JSON.stringify(rows)).not.toContain(password);
    expect(rows[0]?.recoveryHashes).toEqual([]);
    expect(await observer.collection('authBootstrap').countDocuments({})).toBe(1);
    expect(await services[0]?.checkCredentials({ email: dto.email.toUpperCase(), password }, 'synthetic-network')).toEqual(dto);
    // Default model projection and JSON defense omit secrets as well.
    const model = first.models.User;
    expect(model).toBeDefined();
    const hidden = await model?.findOne({}).lean();
    expect(hidden?.passwordHash).toBeUndefined();
    expect(hidden?.recoveryHashes).toBeUndefined();
    const explicit = await model?.findOne({}).select('+passwordHash +recoveryHashes');
    expect(JSON.stringify(explicit)).not.toMatch(/passwordHash|recoveryHashes|argon2/);
    // Real unique index prevents normalized-email duplicates.
    await expect(observer.collection('users').insertOne({ normalizedEmail: dto.email, passwordHash: 'synthetic' }))
      .rejects.toMatchObject({ code: 11000 });
    const restarted = await createAuthService(await createUserStore(await fixture.connect()), token);
    await expect(restarted.bootstrap({ email: 'later@example.test', password })).rejects.toMatchObject({ code: 'CONFLICT' });
    await observer.collection('users').updateMany({}, { $set: { status: 'disabled' } });
    await expect(restarted.checkCredentials({ email: dto.email, password }, 'synthetic-network'))
      .rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    // Deleting users alone never reopens bootstrap, including after restart.
    await observer.collection('users').deleteMany({});
    await expect(restarted.bootstrap({ email: 'later@example.test', password })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await observer.collection('users').countDocuments({})).toBe(0);
    expect(await observer.collection('authBootstrap').countDocuments({})).toBe(1);
  });
});

test('pre-existing user blocks bootstrap and rollback removes the attempted marker', async () => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect();
    const service = await createAuthService(await createUserStore(connection), token);
    await connection.collection('users').insertOne({ normalizedEmail: 'existing@example.test', passwordHash: 'synthetic-private' });
    await expect(service.bootstrap({ email: 'new@example.test', password })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await connection.collection('users').countDocuments({})).toBe(1);
    expect(await connection.collection('authBootstrap').countDocuments({})).toBe(0);
  });
});

test('account insertion failure rolls back marker; corrected isolated database can bootstrap; closed pool fails safely', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect();
    const service = await createAuthService(await createUserStore(connection), token);
    const server = await listen(t, createApp(async () => true, createAuthRouter(service)));
    // Fixture-only validator forces failure AFTER the marker insert inside the transaction.
    await connection.db?.command({ collMod: 'users', validator: { syntheticRequired: { $exists: true } } });
    const failed = await request(server).post('/api/v1/auth/bootstrap').set('X-Bootstrap-Token', token)
      .send({ email: 'rollback@example.test', password });
    expect(failed.status).toBe(503);
    expect(errorEnvelopeSchema.parse(failed.body).error.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(failed.text).not.toMatch(/password|validator|Mongo|Synthetic|rollback/);
    expect(await connection.collection('users').countDocuments({})).toBe(0);
    expect(await connection.collection('authBootstrap').countDocuments({})).toBe(0);
    await connection.db?.command({ collMod: 'users', validator: {} });
    expect((await service.bootstrap({ email: 'rollback@example.test', password })).email).toBe('rollback@example.test');
    await connection.close();
    await expect(service.checkCredentials({ email: 'rollback@example.test', password }, 'synthetic-network'))
      .rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
  });
});
