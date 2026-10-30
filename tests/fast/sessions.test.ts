import { expect, test } from 'vitest';
import request from 'supertest';
import { csrfDtoSchema, successEnvelopeSchema } from '@visual-form-builder/contracts';
import { createApp } from '../../apps/api/src/app.js';
import { readConfiguration, validAppOrigin } from '../../apps/api/src/configuration.js';
import { createSessionManager, readSessionCookie, tokenHash } from '../../apps/api/src/modules/auth/sessions.js';
import type { SessionRecord, SessionStore } from '../../apps/api/src/modules/auth/session-store.js';
import { createSessionRouter } from '../../apps/api/src/modules/auth/session-router.js';
import type { AuthService } from '../../apps/api/src/modules/auth/service.js';
import { listen } from '../helpers/http.js';

const dto = { id: '0123456789abcdef01234567', email: 'synthetic@example.test', status: 'active' } as const;

test('application Origin is one canonical origin; insecure remote hosts, paths, credentials and null fail closed', () => {
  for (const value of ['https://forms.example.test', 'http://127.0.0.1:3000', 'http://localhost:3000', 'http://[::1]:3000']) {
    expect(validAppOrigin(value)).toBe(true);
  }
  for (const value of ['null', '*', 'http://example.test', 'https://forms.example.test/', 'https://forms.example.test/path',
    'https://forms.example.test?secret=private', 'https://' + 'name:private' + '@forms.example.test', 'https://forms.example.test#hash',
    'https://forms.example.test,https://evil.test']) {
    expect(validAppOrigin(value)).toBe(false);
    expect(() => readConfiguration({ MONGODB_URI: 'mongodb://localhost/test', APP_ORIGIN: value }))
      .toThrow('Invalid configuration: APP_ORIGIN.');
  }
});

test('only one exact, bounded opaque cookie is accepted; duplicates and oversized headers are rejected', () => {
  const token = 'a'.repeat(43);
  expect(Boolean(readSessionCookie('other=1; vfb_session=' + token, 'vfb_session') === token)).toBe(true);
  for (const input of [undefined, 'other=' + token, 'vfb_session=' + token + 'x', 'vfb_session=%00', '__Host-vfb_session=' + token]) {
    expect(readSessionCookie(input, 'vfb_session')).toBeUndefined();
  }
  expect(() => readSessionCookie('vfb_session=' + token + '; vfb_session=' + token, 'vfb_session')).toThrow();
  expect(() => readSessionCookie('x'.repeat(8193), 'vfb_session')).toThrow();
  expect(tokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
  expect(tokenHash(token).includes(token)).toBe(false);
});

test('HTTPS pre-session cookie is host-only Secure/HttpOnly/SameSite=Strict and stored only as a hash', async t => {
  let stored: SessionRecord | undefined;
  const store: SessionStore = {
    async find() { return null; },
    async insert(record) { stored = record; },
    async rotate() { throw new Error('Unexpected rotation.'); },
    async revoke() { throw new Error('Unexpected revocation.'); },
  };
  const auth: AuthService = {
    admitAnonymous() {}, authorizeBootstrap() {},
    async bootstrap() { return dto; }, async checkCredentials() { return dto; },
  };
  const sessions = createSessionManager(store, { async active() { return dto; } }, 'https://forms.example.test');
  const server = await listen(t, createApp(async () => true, createSessionRouter(auth, sessions)));
  for (const [header, value] of [['Origin', 'https://evil.test'], ['Origin', 'null'], ['Sec-Fetch-Site', 'cross-site']]) {
    expect((await request(server).get('/api/v1/auth/csrf').set(header!, value!)).status).toBe(403);
  }
  expect(stored).toBeUndefined();
  const response = await request(server).get('/api/v1/auth/csrf');
  expect(response.status).toBe(200);
  expect(successEnvelopeSchema(csrfDtoSchema).safeParse(response.body).success).toBe(true);
  expect(response.headers['cache-control']).toBe('no-store');
  const cookies = response.headers['set-cookie'] as unknown as string[];
  const cookie = cookies[0] ?? '';
  expect(cookie.startsWith('__Host-vfb_session=')).toBe(true);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) expect(cookie.includes(flag)).toBe(true);
  expect(cookie.includes('Domain=')).toBe(false);
  const value = cookie.split(';')[0]?.split('=')[1] ?? '';
  expect(Boolean(stored && stored.tokenHash === tokenHash(value))).toBe(true);
  expect(Boolean(stored && stored.csrfSecret === response.body.data.csrfToken)).toBe(true);
  expect(JSON.stringify(stored).includes(value)).toBe(false);
  expect(stored?.userId).toBeNull();
});
