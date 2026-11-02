import { randomUUID } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { AuthRequestError, issueRecoveryCodes, recoverAccount } from '../../apps/web/src/lib/auth-api.js';
import { apiErrors } from '@visual-form-builder/contracts';

const csrfToken = 'c'.repeat(43);
const code = 'a'.repeat(43);
const password = 'Synthetic client passphrase 123!';
const envelope = (data: unknown) => JSON.stringify({ data, correlationId: randomUUID() });

test('recovery browser client obtains CSRF, posts same-origin uncached JSON and validates the one-time response', async () => {
  const calls: { path: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (path: string, init: RequestInit) => {
    calls.push({ path, init });
    const data = path.endsWith('/csrf') ? { csrfToken } : path.endsWith('/recovery-codes') ? { codes: Array(5).fill(code) } : { recovered: true };
    return new Response(envelope(data), { status: 200 });
  }));
  expect((await issueRecoveryCodes(password)).codes.length).toBe(5);
  expect((await recoverAccount({ email: 'client@example.test', code, newPassword: password })).recovered).toBe(true);
  expect(calls.map(call => call.path)).toEqual(['/api/v1/auth/csrf', '/api/v1/auth/recovery-codes', '/api/v1/auth/csrf', '/api/v1/auth/recover']);
  for (const call of calls) {
    expect(call.init.cache).toBe('no-store'); expect(call.init.credentials).toBe('same-origin');
    expect(Boolean(call.init.signal)).toBe(true);
    expect(call.path.includes(code) || call.path.includes(password)).toBe(false);
  }
  for (const index of [1, 3]) {
    const call = calls[index]!;
    expect(call.init.method).toBe('POST');
    expect(new Headers(call.init.headers).get('X-CSRF-Token') === csrfToken).toBe(true);
  }
  expect(JSON.parse(String(calls[1]?.init.body)).password === password).toBe(true);
  expect(JSON.parse(String(calls[3]?.init.body)).code === code).toBe(true);
});

test('recovery client rejects credential failures and malformed success without returning private server text', async () => {
  vi.stubGlobal('fetch', vi.fn(async (path: string) => path.endsWith('/csrf') ? new Response(envelope({ csrfToken })) :
    new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: apiErrors.UNAUTHENTICATED.message }, correlationId: randomUUID() }), { status: 401 })));
  await expect(recoverAccount({})).rejects.toBeInstanceOf(AuthRequestError);
  await expect(issueRecoveryCodes(password)).rejects.toMatchObject({ status: 401, message: 'Account request failed.' });
  vi.stubGlobal('fetch', vi.fn(async (path: string) => new Response(envelope(path.endsWith('/csrf') ? { csrfToken } : { recovered: true, private: 'never-render' }))));
  await expect(recoverAccount({})).rejects.toThrow();
});
