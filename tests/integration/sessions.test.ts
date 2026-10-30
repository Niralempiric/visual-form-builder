import { expect, test } from 'vitest';
import request from 'supertest';
import type { Server } from 'node:http';
import type { Response } from 'supertest';
import { csrfDtoSchema, errorEnvelopeSchema, successEnvelopeSchema, userDtoSchema } from '@visual-form-builder/contracts';
import { createApp } from '../../apps/api/src/app.js';
import { createUserStore } from '../../apps/api/src/modules/auth/store.js';
import { createAuthService } from '../../apps/api/src/modules/auth/service.js';
import { createAuthRouter } from '../../apps/api/src/modules/auth/router.js';
import { createSessionStore } from '../../apps/api/src/modules/auth/session-store.js';
import { createSessionManager, tokenHash } from '../../apps/api/src/modules/auth/sessions.js';
import { createSessionRouter } from '../../apps/api/src/modules/auth/session-router.js';
import { withMongoFixture } from '../helpers/mongo.js';
import { listen } from '../helpers/http.js';
import type { TestContext } from 'vitest';
import type { Connection } from 'mongoose';

const origin = 'http://127.0.0.1:3000';
const email = 'session-author@example.test';
const password = 'Synthetic session passphrase 123!';

function cookie(response: Response) {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  const pair = cookies?.[0]?.split(';')[0];
  expect(Boolean(pair)).toBe(true);
  return pair ?? '';
}
function value(pair: string) { return pair.slice(pair.indexOf('=') + 1); }
function safeFailure(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(errorEnvelopeSchema.safeParse(response.body).success).toBe(true);
  expect(response.text.includes('passwordHash') || response.text.includes('csrfSecret') || response.text.includes('tokenHash')).toBe(false);
  expect(response.headers['cache-control']).toBe('no-store');
}
async function setup(t: TestContext, connection: Connection, seed = true) {
  const users = await createUserStore(connection);
  const auth = await createAuthService(users);
  if (seed) await auth.bootstrap({ email, password });
  const sessions = createSessionManager(await createSessionStore(connection), users, origin);
  const router = createAuthRouter(auth);
  router.use(createSessionRouter(auth, sessions));
  return listen(t, createApp(async () => true, router));
}
async function csrf(server: Server, existing?: string) {
  const call = request(server).get('/api/v1/auth/csrf').timeout(5000);
  if (existing) call.set('Cookie', existing);
  const response = await call;
  expect(response.status).toBe(200);
  expect(successEnvelopeSchema(csrfDtoSchema).safeParse(response.body).success).toBe(true);
  return { pair: response.headers['set-cookie'] ? cookie(response) : existing ?? '', token: String(response.body.data.csrfToken) };
}
function login(server: Server, pair: string, token: string, input = { email, password }) {
  return request(server).post('/api/v1/auth/login').set('Origin', origin).set('Cookie', pair)
    .set('X-CSRF-Token', token).send(input).timeout(15000);
}

test('login survives independent API instances; old pre-session and CSRF fail; logout revokes replayed cookies', async t => {
  await withMongoFixture(async fixture => {
    const writer = await fixture.connect();
    const observer = await fixture.connect();
    const server = await setup(t, writer);
    safeFailure(await request(server).get('/api/v1/auth/me'), 401);
    const pre = await csrf(server);
    safeFailure(await request(server).post('/api/v1/auth/login').set('Origin', origin).send({ email, password }), 403);
    const missing = await login(server, pre.pair, pre.token, { email: 'missing@example.test', password });
    const wrong = await login(server, pre.pair, pre.token, { email, password: 'wrong' });
    safeFailure(missing, 401); safeFailure(wrong, 401);
    expect(missing.body.error).toEqual(wrong.body.error);
    const signedIn = await login(server, pre.pair, pre.token);
    expect(signedIn.status).toBe(200);
    expect(successEnvelopeSchema(userDtoSchema).safeParse(signedIn.body).success).toBe(true);
    expect(signedIn.text.includes(value(cookie(signedIn)))).toBe(false);
    const pair = cookie(signedIn);
    expect(pair !== pre.pair).toBe(true);
    safeFailure(await request(server).get('/api/v1/auth/me').set('Cookie', pre.pair), 401);
    const session = await observer.collection('sessions').findOne({ tokenHash: tokenHash(value(pair)) });
    expect(Boolean(session && session.expiresAt.getTime() - Date.now() > 23.9 * 60 * 60 * 1000)).toBe(true);
    expect(JSON.stringify(await observer.collection('sessions').find({}).toArray()).includes(value(pair))).toBe(false);
    const restarted = await setup(t, await fixture.connect(), false);
    for (const instance of [server, restarted, restarted]) {
      const me = await request(instance).get('/api/v1/auth/me').set('Cookie', pair);
      expect(me.status).toBe(200);
      expect(me.body.data.email).toBe(email);
      expect(me.headers['cache-control']).toBe('no-store');
      expect(me.headers['set-cookie']).toBeUndefined();
    }
    const current = await csrf(restarted, pair);
    expect(current.pair === pair).toBe(true);
    expect(current.token !== pre.token).toBe(true);
    for (const requestOrigin of [undefined, 'null', origin + '.evil.test', 'http://localhost:3000']) {
      let call = request(restarted).post('/api/v1/auth/logout').set('Cookie', pair).set('X-CSRF-Token', current.token).send({});
      if (requestOrigin) call = call.set('Origin', requestOrigin);
      safeFailure(await call, 403);
    }
    for (const token of [undefined, pre.token, 'x'.repeat(43)]) {
      let call = request(restarted).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', pair).send({});
      if (token) call = call.set('X-CSRF-Token', token);
      safeFailure(await call, 403);
    }
    expect((await observer.collection('sessions').findOne({ tokenHash: tokenHash(value(pair)) }))?.revokedAt).toBeNull();
    const out = await request(restarted).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', pair)
      .set('X-CSRF-Token', current.token).send({});
    expect(out.status).toBe(200);
    expect(out.body.data).toEqual({ signedOut: true });
    const clear = (out.headers['set-cookie'] as unknown as string[])[0] ?? '';
    expect(clear.includes('vfb_session=;')).toBe(true);
    expect(clear.includes('HttpOnly') && clear.includes('SameSite=Strict') && clear.includes('Path=/')).toBe(true);
    expect(clear.includes('Secure')).toBe(false);
    safeFailure(await request(server).get('/api/v1/auth/me').set('Cookie', pair), 401);
    safeFailure(await request(server).post('/api/v1/auth/logout').set('Origin', origin).set('Cookie', pair)
      .set('X-CSRF-Token', current.token).send({}), 401);
    const indexes = await observer.collection('sessions').indexes();
    expect(indexes.some(index => index.key.tokenHash === 1 && index.unique === true)).toBe(true);
    expect(indexes.some(index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0)).toBe(true);
  });
});

test('pre-session and author expiry are enforced before TTL cleanup; disabled users lose access', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect();
    const server = await setup(t, connection);
    const pre = await csrf(server);
    const old = new Date(Date.now() - 1000);
    await connection.collection('sessions').updateOne({ tokenHash: tokenHash(value(pre.pair)) }, { $set: { expiresAt: old } });
    safeFailure(await login(server, pre.pair, pre.token), 403);
    const next = await csrf(server, pre.pair);
    const signedIn = await login(server, next.pair, next.token);
    expect(signedIn.status).toBe(200);
    const pair = cookie(signedIn);
    await connection.collection('sessions').updateOne({ tokenHash: tokenHash(value(pair)) }, { $set: { expiresAt: old } });
    safeFailure(await request(server).get('/api/v1/auth/me').set('Cookie', pair), 401);
    const renewed = await csrf(server, pair);
    const again = await login(server, renewed.pair, renewed.token);
    expect(again.status).toBe(200);
    await connection.collection('users').updateOne({ normalizedEmail: email }, { $set: { status: 'disabled' } });
    safeFailure(await request(server).get('/api/v1/auth/me').set('Cookie', cookie(again)), 401);
    await connection.collection('users').deleteOne({ normalizedEmail: email });
    safeFailure(await request(server).get('/api/v1/auth/me').set('Cookie', cookie(again)), 401);
  });
});

test('failed rotation rolls back revocation; competing logins consume a pre-session once', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect();
    const server = await setup(t, connection);
    const pre = await csrf(server);
    await connection.db?.command({ collMod: 'sessions', validator: { userId: { $type: 'null' } } });
    const failed = await login(server, pre.pair, pre.token);
    safeFailure(failed, 503);
    expect(failed.headers['set-cookie']).toBeUndefined();
    const stored = await connection.collection('sessions').findOne({ tokenHash: tokenHash(value(pre.pair)) });
    expect(stored?.revokedAt).toBeNull();
    expect(await connection.collection('sessions').countDocuments({ userId: { $ne: null } })).toBe(0);
    await connection.db?.command({ collMod: 'sessions', validator: {} });
    const responses = await Promise.all([login(server, pre.pair, pre.token), login(server, pre.pair, pre.token)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 401]);
    expect(await connection.collection('sessions').countDocuments({ userId: { $ne: null }, revokedAt: null })).toBe(1);
  });
});

test('new anonymous sessions are throttled and closed database fails without exposing cookies or driver errors', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect();
    const server = await setup(t, connection);
    let last;
    for (let i = 0; i < 31; i++) last = await request(server).get('/api/v1/auth/csrf');
    expect(last?.status).toBe(429);
    expect(await connection.collection('sessions').countDocuments({})).toBeLessThanOrEqual(30);
    const first = await connection.collection('sessions').findOne({});
    expect(first).not.toBeNull();
    await connection.close();
    const failed = await request(server).get('/api/v1/auth/me').set('Cookie', 'vfb_session=' + 'a'.repeat(43));
    safeFailure(failed, 503);
    expect(failed.text.includes('Mongo') || failed.text.includes('Client') || failed.text.includes('closed')).toBe(false);
  });
});
