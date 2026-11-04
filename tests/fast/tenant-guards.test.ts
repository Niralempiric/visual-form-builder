import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import request from 'supertest';
import { expect, test } from 'vitest';
import { initialFormDtoSchema } from '@visual-form-builder/contracts';
import { createInitialDraft } from '@visual-form-builder/form-schema';
import { createApp } from '../../apps/api/src/app.js';
import { createSessionManager } from '../../apps/api/src/modules/auth/sessions.js';
import type { SessionStore } from '../../apps/api/src/modules/auth/session-store.js';
import { createWorkspaceRouter } from '../../apps/api/src/modules/workspaces/router.js';
import type { WorkspaceStore } from '../../apps/api/src/modules/workspaces/store.js';
import { listen } from '../helpers/http.js';

const id = '0123456789abcdef01234567';
const origin = 'http://127.0.0.1:3000', csrf = 'c'.repeat(43);
const at = '2026-11-04T00:00:00.000Z';
const user = { id, email: 'tenant-guards@example.test', status: 'active' } as const;
const workspace = { id, name: 'Synthetic guard workspace', ownerId: id, role: 'owner', state: 'active', createdAt: at, updatedAt: at } as const;
const form = initialFormDtoSchema.parse({ id, workspaceId: id, publicId: randomUUID(), title: 'Synthetic guard form',
  draftSchema: createInitialDraft('Synthetic guard form'), draftRevision: 0, currentVersionId: null, availability: 'draft',
  acceptedWindows: [], acceptedCount: 0, retentionDays: 30, createdAt: at, updatedAt: at });

test('all six workspace/form routes guard identity, Origin and writes before parsing or persistence; actor headers never select identity', async t => {
  const calls: string[] = [];
  function actor(userId: string, operation: string) { expect(userId).toBe(id); calls.push(operation); }
  const store: WorkspaceStore = {
    async listWorkspaces(userId) { actor(userId, 'listWorkspaces'); return { data: [workspace], nextCursor: null }; },
    async listForms(userId) { actor(userId, 'listForms'); return { data: [], nextCursor: null }; },
    async createWorkspace(userId) { actor(userId, 'createWorkspace'); return workspace; },
    async workspace(userId) { actor(userId, 'workspace'); return workspace; },
    async createForm(userId) { actor(userId, 'createForm'); return form; },
    async form(userId) { actor(userId, 'form'); return form; },
  };
  const sessions: SessionStore = {
    async find() { return { userId: new Types.ObjectId(id), csrfSecret: csrf, expiresAt: new Date(Date.now() + 60000), revokedAt: null }; },
    async insert() { throw new Error('Unexpected insertion.'); }, async rotate() { throw new Error('Unexpected rotation.'); }, async revoke() {},
  };
  const server = await listen(t, createApp(async () => true,
    createWorkspaceRouter(store, createSessionManager(sessions, { async active() { return user; } }, origin))));
  const reads = ['/workspaces', '/workspaces/' + id, '/workspaces/' + id + '/forms', '/forms/' + id];
  const writes = ['/workspaces', '/workspaces/' + id + '/forms'];
  for (const path of reads) {
    expect((await request(server).get('/api/v1' + path)).status).toBe(401);
    expect((await request(server).get('/api/v1' + path).set('Cookie', 'vfb_session=' + 'a'.repeat(43)).set('Origin', 'https://foreign.example.test')).status).toBe(403);
    expect((await request(server).get('/api/v1' + path).set('Cookie', 'vfb_session=' + 'a'.repeat(43)).set('Sec-Fetch-Site', 'cross-site')).status).toBe(403);
  }
  for (const path of writes) {
    const write = () => request(server).post('/api/v1' + path).set('Cookie', 'vfb_session=' + 'a'.repeat(43)).set('Content-Type', 'application/json');
    expect((await write().set('Origin', origin).send('{')).status).toBe(403);
    expect((await write().set('X-CSRF-Token', csrf).send('{')).status).toBe(403);
    expect((await write().set('Origin', origin).unset('Cookie').send('{')).status).toBe(401);
  }
  expect((await request(server).get('/api/v1/forms/bad-id')).status).toBe(401);
  expect((await request(server).get('/api/v1/workspaces?limit=invalid')).status).toBe(401);
  expect(calls).toEqual([]);
  for (const path of reads) {
    expect((await request(server).get('/api/v1' + path).set('Cookie', 'vfb_session=' + 'a'.repeat(43))
      .set('X-User-Id', 'f'.repeat(24)).set('X-Workspace-Id', 'f'.repeat(24)).set('X-Role', 'owner')).status).toBe(200);
  }
  for (const path of writes) {
    expect((await request(server).post('/api/v1' + path).set('Origin', origin).set('Cookie', 'vfb_session=' + 'a'.repeat(43))
      .set('X-CSRF-Token', csrf).set('X-User-Id', 'f'.repeat(24)).send(path.endsWith('/forms') ? { title: 'Synthetic' } : { name: 'Synthetic' })).status).toBe(201);
  }
  expect(calls.sort()).toEqual(['listWorkspaces', 'workspace', 'listForms', 'form', 'createWorkspace', 'createForm'].sort());
});
