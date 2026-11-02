import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { expect, test } from 'vitest';
import type { TestContext } from 'vitest';
import type { Connection } from 'mongoose';
import type { Server } from 'node:http';
import type { Response } from 'supertest';
import request from 'supertest';
import { errorEnvelopeSchema, recoveryCodesDtoSchema, recoveryDtoSchema, successEnvelopeSchema } from '@visual-form-builder/contracts';
import { createApp } from '../../apps/api/src/app.js';
import { createUserStore } from '../../apps/api/src/modules/auth/store.js';
import { createAuthService } from '../../apps/api/src/modules/auth/service.js';
import { createSessionStore } from '../../apps/api/src/modules/auth/session-store.js';
import { createSessionManager, tokenHash } from '../../apps/api/src/modules/auth/sessions.js';
import { createSessionRouter } from '../../apps/api/src/modules/auth/session-router.js';
import { createRecoveryService, recoveryHash } from '../../apps/api/src/modules/auth/recovery.js';
import { createRecoveryRouter } from '../../apps/api/src/modules/auth/recovery-router.js';
import { withMongoFixture } from '../helpers/mongo.js';
import { listen } from '../helpers/http.js';

const origin = 'http://127.0.0.1:3000';
const email = 'recovery-author@example.test';
const password = 'Synthetic original passphrase 123!';
const newPassword = 'Synthetic recovered passphrase 456!';
function cookie(response: Response) {
  const pair = (response.headers['set-cookie'] as unknown as string[] | undefined)?.[0]?.split(';')[0];
  expect(Boolean(pair)).toBe(true);
  return pair ?? '';
}
const hashCookie = (pair: string) => tokenHash(pair.slice(pair.indexOf('=') + 1));
function failure(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(errorEnvelopeSchema.safeParse(response.body).success).toBe(true);
  expect(/passwordHash|recoveryHashes|tokenHash|Mongo|stack/.test(response.text)).toBe(false);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['set-cookie']).toBeUndefined();
}
async function setup(t: TestContext, connection: Connection, seed = true) {
  const users = await createUserStore(connection);
  const auth = await createAuthService(users);
  if (seed) await auth.bootstrap({ email, password });
  const store = await createSessionStore(connection);
  const sessions = createSessionManager(store, users, origin);
  const router = createSessionRouter(auth, sessions);
  router.use(createRecoveryRouter(await createRecoveryService(users, auth), sessions));
  return { server: await listen(t, createApp(async () => true, router)), users, auth, store };
}
async function csrf(server: Server, pair?: string) {
  const call = request(server).get('/api/v1/auth/csrf').timeout(5000);
  if (pair) call.set('Cookie', pair);
  const response = await call;
  expect(response.status).toBe(200);
  return { pair: response.headers['set-cookie'] ? cookie(response) : pair ?? '', token: String(response.body.data.csrfToken) };
}
type Context = Awaited<ReturnType<typeof csrf>>;
function post(server: Server, path: string, context: Context, body: object) {
  return request(server).post('/api/v1/auth/' + path).set('Origin', origin).set('Cookie', context.pair)
    .set('X-CSRF-Token', context.token).send(body).timeout(15000);
}
async function login(server: Server, input = { email, password }) {
  const response = await post(server, 'login', await csrf(server), input);
  expect(response.status).toBe(200);
  return csrf(server, cookie(response));
}
async function issue(server: Server, context: Context) {
  const response = await post(server, 'recovery-codes', context, { password });
  expect(response.status).toBe(200);
  expect(successEnvelopeSchema(recoveryCodesDtoSchema).safeParse(response.body).success).toBe(true);
  expect(response.headers['cache-control']).toBe('no-store');
  return recoveryCodesDtoSchema.parse(response.body.data).codes;
}

test('saved codes reset once, revoke every prior session across instances and preserve other accounts', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect();
    const { server, users } = await setup(t, connection);
    const first = await login(server);
    const second = await login(server);
    const proof = await users.credential(email);
    await connection.collection('users').insertOne({ normalizedEmail: 'other@example.test', passwordHash: proof?.passwordHash, status: 'active' });
    const other = await login(server, { email: 'other@example.test', password });
    const codes = await issue(server, first);
    expect(new Set(codes).size).toBe(5);
    const persisted = await connection.collection('users').findOne({ normalizedEmail: email });
    expect(persisted?.recoveryHashes.length).toBe(5);
    expect(codes.every(code => persisted?.recoveryHashes.includes(recoveryHash(code)))).toBe(true);
    expect(codes.some(code => JSON.stringify(persisted).includes(code))).toBe(false);
    const projected = await connection.model('User').findOne({ normalizedEmail: email });
    expect(projected?.get('recoveryHashes')).toBeUndefined();
    expect(JSON.stringify(projected).includes('recoveryHashes')).toBe(false);
    const before = await request(server).get('/api/v1/auth/me').set('Cookie', first.pair);
    expect(codes.some(code => before.text.includes(code))).toBe(false);
    const restarted = (await setup(t, await fixture.connect(), false)).server;
    const recovery = await csrf(restarted);
    const result = await post(restarted, 'recover', recovery, { email: ' RECOVERY-AUTHOR@example.test ', code: codes[0], newPassword });
    expect(result.status).toBe(200);
    expect(successEnvelopeSchema(recoveryDtoSchema).safeParse(result.body).success).toBe(true);
    expect((result.headers['set-cookie'] as unknown as string[])[0]?.startsWith('vfb_session=;')).toBe(true);
    expect(codes.some(code => result.text.includes(code))).toBe(false);
    for (const instance of [server, restarted]) for (const context of [first, second, recovery]) {
      expect((await request(instance).get('/api/v1/auth/me').set('Cookie', context.pair)).status).toBe(401);
    }
    expect((await request(server).get('/api/v1/auth/me').set('Cookie', other.pair)).status).toBe(200);
    failure(await post(restarted, 'recover', await csrf(restarted), { email, code: codes[0], newPassword }), 401);
    const pre = await csrf(restarted);
    failure(await post(restarted, 'login', pre, { email, password }), 401);
    expect((await post(restarted, 'login', pre, { email, password: newPassword })).status).toBe(200);
    const current = await connection.collection('users').findOne({ normalizedEmail: email });
    expect(current?.recoveryHashes.length).toBe(4);
    expect(current?.recoveryHashes.includes(recoveryHash(codes[0]!))).toBe(false);
  });
});

test('issuance requires password, identity, Origin and CSRF; regeneration invalidates the earlier set', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect();
    const { server } = await setup(t, connection);
    const author = await login(server);
    const old = await issue(server, author);
    failure(await post(server, 'recovery-codes', author, { password: 'wrong' }), 401);
    for (const path of ['recover', 'recovery-codes']) {
      failure(await request(server).post('/api/v1/auth/' + path).set('Cookie', author.pair).send({}), 403);
      failure(await request(server).post('/api/v1/auth/' + path).set('Origin', origin).set('Cookie', author.pair).send({}), 403);
      failure(await request(server).post('/api/v1/auth/' + path).set('Origin', 'https://evil.example.test')
        .set('Cookie', author.pair).set('X-CSRF-Token', author.token).send({}), 403);
    }
    failure(await post(server, 'recovery-codes', await csrf(server), { password }), 401);
    const codes = await issue(server, author);
    const stored = await connection.collection('users').findOne({ normalizedEmail: email });
    expect(old.some(code => stored?.recoveryHashes.includes(recoveryHash(code)))).toBe(false);
    const pre = await csrf(server);
    const bad = await post(server, 'recover', pre, { email, code: old[0], newPassword });
    const missing = await post(server, 'recover', pre, { email: 'missing@example.test', code: codes[0], newPassword });
    const random = await post(server, 'recover', pre, { email, code: 'z'.repeat(43), newPassword });
    await connection.collection('users').updateOne({ normalizedEmail: email }, { $set: { status: 'disabled' } });
    const disabled = await post(server, 'recover', pre, { email, code: codes[0], newPassword });
    for (const response of [bad, missing, random, disabled]) { failure(response, 401); expect(response.body.error).toEqual(bad.body.error); }
    await connection.collection('users').updateOne({ normalizedEmail: email }, { $set: { status: 'active' } });
    expect((await request(server).get('/api/v1/auth/me').set('Cookie', author.pair)).status).toBe(200);
    failure(await post(server, 'recover', pre, { email, code: codes[0], newPassword, extra: true }), 400);
    failure(await post(server, 'recover', pre, { email, code: codes[0], newPassword: 'short' }), 400);
    expect((await connection.collection('users').findOne({ normalizedEmail: email }))?.recoveryHashes.length).toBe(5);
  });
});

test('failed late revocation rolls back code and password; two API instances consume the same code once', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect();
    const { server } = await setup(t, connection);
    const author = await login(server);
    const codes = await issue(server, author);
    const before = await connection.collection('users').findOne({ normalizedEmail: email });
    const pre = await csrf(server);
    // Anonymous context revocation succeeds first; author-session revocation then fails.
    await connection.db?.command({ collMod: 'sessions', validator: { $or: [{ userId: { $type: 'null' } }, { revokedAt: { $type: 'null' } }] } });
    failure(await post(server, 'recover', pre, { email, code: codes[0], newPassword }), 503);
    const after = await connection.collection('users').findOne({ normalizedEmail: email });
    expect(before?.passwordHash === after?.passwordHash).toBe(true);
    expect(after?.recoveryHashes.includes(recoveryHash(codes[0]!))).toBe(true);
    expect((await connection.collection('sessions').findOne({ tokenHash: hashCookie(pre.pair) }))?.revokedAt).toBeNull();
    expect((await request(server).get('/api/v1/auth/me').set('Cookie', author.pair)).status).toBe(200);
    await connection.db?.command({ collMod: 'sessions', validator: {} });
    const second = (await setup(t, await fixture.connect(), false)).server;
    const otherPre = await csrf(second);
    const results = await Promise.all([post(server, 'recover', pre, { email, code: codes[0], newPassword }),
      post(second, 'recover', otherPre, { email, code: codes[0], newPassword })]);
    expect(results.map(result => result.status).sort()).toEqual([200, 401]);
    expect((await request(second).get('/api/v1/auth/me').set('Cookie', author.pair)).status).toBe(401);
    expect((await connection.collection('users').findOne({ normalizedEmail: email }))?.recoveryHashes.length).toBe(4);
  });
});

test('a login proof captured before recovery cannot create a session afterward; dependency failures stay safe', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect();
    const { server, auth, store } = await setup(t, connection);
    const author = await login(server);
    const codes = await issue(server, author);
    const lateLogin = await csrf(server);
    const proof = await auth.loginCredential({ email, password }, 'synthetic-network');
    expect((await post(server, 'recover', await csrf(server), { email, code: codes[0], newPassword })).status).toBe(200);
    const raw = randomBytes(32).toString('base64url');
    const record = { tokenHash: tokenHash(raw), userId: new Types.ObjectId(proof.dto.id), csrfSecret: randomBytes(32).toString('base64url'),
      expiresAt: new Date(Date.now() + 86400000), revokedAt: null };
    await expect(store.rotate(hashCookie(lateLogin.pair), record, new Date(), proof.passwordHash)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await connection.collection('sessions').countDocuments({ tokenHash: tokenHash(raw) })).toBe(0);
    const pre = await csrf(server);
    await connection.close();
    failure(await post(server, 'recover', pre, { email, code: codes[1], newPassword }), 503);
  });
});
