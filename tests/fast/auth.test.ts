import { gzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import request from 'supertest';
import { bootstrapInputSchema, credentialInputSchema, errorEnvelopeSchema, userDtoSchema } from '@visual-form-builder/contracts';
import { createApp } from '../../apps/api/src/app.js';
import { readConfiguration } from '../../apps/api/src/configuration.js';
import { ApiError } from '../../apps/api/src/http.js';
import { createPasswords } from '../../apps/api/src/modules/auth/passwords.js';
import { createAuthService } from '../../apps/api/src/modules/auth/service.js';
import { createAuthRouter } from '../../apps/api/src/modules/auth/router.js';
import { createAuthThrottle } from '../../apps/api/src/modules/auth/throttle.js';
import { listen } from '../helpers/http.js';

const password = 'Synthetic passphrase 123!';
const token = 'synthetic-bootstrap-token-for-tests-only';
const dto = { id: '0123456789abcdef01234567', email: 'author@example.test', status: 'active' } as const;
const unusedStore = {
  async bootstrap() { throw new Error('Store must not be called for invalid requests.'); },
  async credential() { return undefined; },
};

test('auth contracts reject operators/unknown fields and preserve password bytes', () => {
  expect(bootstrapInputSchema.parse({ email: ' AUTHOR@example.test ', password })).toEqual({ email: dto.email, password });
  for (const input of [{ email: { $ne: null }, password }, { email: dto.email, password: 'short' }, { email: dto.email, password: '😀'.repeat(8) },
    { email: dto.email, password: 'x'.repeat(129) }, { email: dto.email, password, status: 'active' },
    { email: dto.email, password, passwordHash: 'private' }]) {
    expect(bootstrapInputSchema.safeParse(input).success).toBe(false);
  }
  expect(credentialInputSchema.parse({ email: dto.email, password: '  unchanged  ' }).password).toBe('  unchanged  ');
  expect(userDtoSchema.safeParse({ ...dto, passwordHash: 'private' }).success).toBe(false);
  expect(readConfiguration({ MONGODB_URI: 'mongodb://localhost/test' }).AUTH_BOOTSTRAP_TOKEN).toBeUndefined();
  expect(readConfiguration({ MONGODB_URI: 'mongodb://localhost/test', AUTH_BOOTSTRAP_TOKEN: '' }).AUTH_BOOTSTRAP_TOKEN).toBeUndefined();
  expect(() => readConfiguration({ MONGODB_URI: 'mongodb://localhost/test', AUTH_BOOTSTRAP_TOKEN: 'short-private' }))
    .toThrow('Invalid configuration: AUTH_BOOTSTRAP_TOKEN.');
});

test('Argon2id uses unique salts and the configured cost; unknown credentials do comparable hashing work', async () => {
  const passwords = await createPasswords();
  const first = await passwords.hash(password);
  const second = await passwords.hash(password);
  expect(first).not.toBe(second);
  expect(first).toMatch(/^\$argon2id\$v=19\$m=19456,(?:t=2,p=1|p=1,t=2)\$/);
  expect(await passwords.verify(first, password)).toBe(true);
  expect(await passwords.verify(first, password + ' ')).toBe(false);
  expect(await passwords.verify(undefined, password)).toBe(false);
  await expect(passwords.verify('corrupt-private-hash', password)).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => passwords.hash(password)));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(4);
  expect(results[4]).toMatchObject({ status: 'rejected', reason: { code: 'RATE_LIMITED' } });
});

test('credential failures are generic for unknown, wrong-password and disabled users; successful DTO is allowlisted', async () => {
  const passwords = await createPasswords();
  const passwordHash = await passwords.hash(password);
  const service = await createAuthService({ ...unusedStore, async credential(email: string) {
    if (email === 'missing@example.test') return undefined;
    return { dto: { ...dto, status: email === 'disabled@example.test' ? 'disabled' as const : 'active' as const }, passwordHash };
  } });
  expect(await service.checkCredentials({ email: 'AUTHOR@example.test', password }, 'network-a')).toEqual(dto);
  for (const input of [{ email: 'missing@example.test', password }, { email: dto.email, password: 'wrong' },
    { email: 'disabled@example.test', password }]) {
    await expect(service.checkCredentials(input, 'network-a')).rejects.toMatchObject({ code: 'UNAUTHENTICATED', message: 'Sign in to continue.' });
  }
  for (let i = 0; i < 3; i++) await expect(service.checkCredentials({ email: dto.email, password: 'wrong' }, 'other-' + i))
    .rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  await expect(service.checkCredentials({ email: ' AUTHOR@example.test ', password }, 'different-network'))
    .rejects.toMatchObject({ code: 'RATE_LIMITED' });
});

test('throttle accounts, networks, global work and window expiry are bounded independently', () => {
  let now = 0;
  const throttle = createAuthThrottle(() => now);
  for (let i = 0; i < 5; i++) throttle.account(dto.email);
  expect(() => throttle.account(dto.email)).toThrow(ApiError);
  for (let i = 0; i < 30; i++) throttle.network('same-network');
  expect(() => throttle.network('same-network')).toThrow(ApiError);
  // Rejected network attempts also consume the global ceiling.
  for (let i = 31; i < 120; i++) throttle.network('different-' + i);
  expect(() => throttle.network('new-network')).toThrow(ApiError);
  now += 15 * 60 * 1000;
  expect(() => { throttle.account(dto.email); throttle.network('same-network'); }).not.toThrow();
});

test('bootstrap is disabled by default; token gate rejects missing/wrong/long tokens and browser origins', async () => {
  const disabled = await createAuthService(unusedStore);
  expect(() => disabled.authorizeBootstrap(token, 'a', undefined)).toThrow(ApiError);
  const service = await createAuthService(unusedStore, token);
  for (const supplied of [undefined, 'wrong', 'x'.repeat(257)]) {
    expect(() => service.authorizeBootstrap(supplied, 'a', undefined)).toThrow(ApiError);
  }
  expect(() => service.authorizeBootstrap(token, 'a', 'https://example.test')).toThrow(ApiError);
  expect(() => service.authorizeBootstrap(token, 'a', undefined)).not.toThrow();
});

test('HTTP bootstrap safely rejects malformed/large/compressed input and keeps public signup/recovery closed', async t => {
  const service = await createAuthService(unusedStore, token);
  const server = await listen(t, createApp(async () => true, createAuthRouter(service)));
  const post = () => request(server).post('/api/v1/auth/bootstrap').set('X-Bootstrap-Token', token)
    .set('Content-Type', 'application/json').timeout(3000);
  for (const [body, status, code] of [
    ['{"password":"synthetic-private",', 400, 'MALFORMED_REQUEST'],
    [JSON.stringify({ email: { $ne: null }, password }), 400, 'MALFORMED_REQUEST'],
    [JSON.stringify({ email: dto.email, password, extra: 'synthetic-private' }), 400, 'MALFORMED_REQUEST'],
    [JSON.stringify({ password: 'x'.repeat(9000) }), 413, 'PAYLOAD_TOO_LARGE'],
  ] as const) {
    const result = await post().send(body);
    expect(result.status).toBe(status);
    expect(errorEnvelopeSchema.parse(result.body).error.code).toBe(code);
    expect(result.text).not.toMatch(/synthetic-private|password|stack|SyntaxError/);
    expect(result.headers['cache-control']).toBe('no-store');
  }
  const compressed = await post().set('Content-Encoding', 'gzip').send(Buffer.concat([gzipSync('{}'), Buffer.from('trailing')]));
  expect(compressed.status).toBe(400);
  expect(errorEnvelopeSchema.parse(compressed.body).error.code).toBe('MALFORMED_REQUEST');
  expect((await request(server).get('/health/live')).status).toBe(200);
  expect((await post().set('Content-Type', 'text/plain').send('private')).status).toBe(400);
  expect((await post().set('Origin', 'https://example.test').send({ email: dto.email, password })).status).toBe(403);
  const denied = await post().unset('X-Bootstrap-Token').send({ email: dto.email, password });
  expect(denied.status).toBe(403);
  for (const path of ['/auth/signup', '/auth/recover']) {
    expect((await request(server).post('/api/v1' + path).send({ email: dto.email, password })).status).toBe(404);
  }
  // Spoofing a new proxy address cannot reset socket-based admission limits.
  let last;
  for (let i = 0; i < 31; i++) last = await post().unset('X-Bootstrap-Token').set('X-Forwarded-For', '192.0.2.' + i).send('{}');
  expect(last?.status).toBe(429);
});
