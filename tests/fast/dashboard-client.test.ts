import { randomUUID } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { apiErrors } from '@visual-form-builder/contracts';
import { createWorkspace, getForm, listForms, listWorkspaces } from '../../apps/web/src/lib/dashboard-api.js';

const id = '0123456789abcdef01234567';
const signal = () => new AbortController().signal;
const envelope = (data: unknown) => JSON.stringify({ data, correlationId: randomUUID() });
const timestamp = '2026-11-03T00:00:00.000Z';
const workspace = { id, ownerId: id, name: 'Synthetic', role: 'owner', state: 'active', createdAt: timestamp, updatedAt: timestamp };

test('dashboard reads are uncached, same-origin, bounded, abortable and strictly parsed', async () => {
  const calls: { path: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (path: string, init: RequestInit) => {
    calls.push({ path, init });
    return new Response(JSON.stringify({ data: [], nextCursor: null, correlationId: randomUUID() }));
  }));
  const controller = new AbortController();
  expect((await listWorkspaces(null, controller.signal)).data).toEqual([]);
  await listForms(id, 'opaque_cursor', controller.signal);
  expect(calls.map(call => call.path)).toEqual(['/api/v1/workspaces?limit=25', '/api/v1/workspaces/' + id + '/forms?limit=25&cursor=opaque_cursor']);
  for (const call of calls) { expect(call.init.cache).toBe('no-store'); expect(call.init.credentials).toBe('same-origin'); }
  controller.abort(); expect(calls.every(call => call.init.signal?.aborted)).toBe(true);
  expect(() => getForm('../private', signal())).toThrow();
  expect(calls.length).toBe(2);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [], nextCursor: null, correlationId: randomUUID(), private: true }))));
  await expect(listWorkspaces(null, signal())).rejects.toThrow();
});

test('dashboard creation validates before networking, obtains CSRF and never posts after cancellation', async () => {
  const calls: { path: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (path: string, init: RequestInit) => {
    calls.push({ path, init });
    return new Response(envelope(path.endsWith('/csrf') ? { csrfToken: 'c'.repeat(43) } : workspace));
  }));
  expect(() => createWorkspace(' ', signal())).toThrow(); expect(calls.length).toBe(0);
  expect((await createWorkspace(' Synthetic ', signal())).id).toBe(id);
  expect(calls.map(call => call.path)).toEqual(['/api/v1/auth/csrf', '/api/v1/workspaces']);
  expect(calls[1]?.init.method).toBe('POST'); expect(JSON.parse(String(calls[1]?.init.body))).toEqual({ name: 'Synthetic' });
  expect(new Headers(calls[1]?.init.headers).get('X-CSRF-Token') === 'c'.repeat(43)).toBe(true);
  const controller = new AbortController();
  vi.stubGlobal('fetch', vi.fn(async () => { controller.abort(); return new Response(envelope({ csrfToken: 'c'.repeat(43) })); }));
  await expect(createWorkspace('Synthetic', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(vi.mocked(fetch).mock.calls.length).toBe(1);
});

test('dashboard failures expose only the safe status, never private server messages', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: apiErrors.UNAUTHENTICATED.message }, correlationId: randomUUID() }), { status: 401 })));
  await expect(listWorkspaces(null, signal())).rejects.toMatchObject({ status: 401, message: 'Account request failed.' });
});
