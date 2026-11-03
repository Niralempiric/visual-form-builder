import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { gzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import request from 'supertest';
import { createFormInputSchema, createWorkspaceInputSchema, errorEnvelopeSchema, initialFormDtoSchema,
  formParamsSchema, workspaceDtoSchema, workspaceParamsSchema } from '@visual-form-builder/contracts';
import { createInitialDraft, initialDraftSchema } from '@visual-form-builder/form-schema';
import { createApp } from '../../apps/api/src/app.js';
import { createSessionManager } from '../../apps/api/src/modules/auth/sessions.js';
import { createWorkspaceRouter } from '../../apps/api/src/modules/workspaces/router.js';
import type { SessionStore } from '../../apps/api/src/modules/auth/session-store.js';
import { listen } from '../helpers/http.js';

const id = '0123456789abcdef01234567';
const origin = 'http://127.0.0.1:3000';
const timestamp = '2026-11-03T00:00:00.000Z';
const user = { id, email: 'workspace@example.test', status: 'active' } as const;
const workspace = { id, name: 'Synthetic workspace', ownerId: id, state: 'active', role: 'owner', createdAt: timestamp, updatedAt: timestamp } as const;
const form = { id, workspaceId: id, publicId: randomUUID(), title: 'Synthetic form', draftSchema: createInitialDraft('Synthetic form'),
  draftRevision: 0, currentVersionId: null, availability: 'draft', acceptedWindows: [], acceptedCount: 0, retentionDays: 30,
  createdAt: timestamp, updatedAt: timestamp };

test('workspace/form creation accepts bounded plain text but rejects ownership, draft, operator and extra input', () => {
  expect(createWorkspaceInputSchema.parse({ name: ' Synthetic workspace ' }).name).toBe(workspace.name);
  expect(createFormInputSchema.parse({ title: ' <script>plain text</script> ' }).title).toBe('<script>plain text</script>');
  for (const value of ['', '   ', 'x'.repeat(81), null, { $ne: null }]) expect(createWorkspaceInputSchema.safeParse({ name: value }).success).toBe(false);
  for (const value of ['', '   ', 'x'.repeat(161), ['title'], { $gt: '' }]) expect(createFormInputSchema.safeParse({ title: value }).success).toBe(false);
  for (const extra of [{ ownerId: id }, { role: 'owner' }, { state: 'active' }, { userId: id }]) {
    expect(createWorkspaceInputSchema.safeParse({ name: 'name', ...extra }).success).toBe(false);
  }
  for (const extra of [{ workspaceId: id }, { draftSchema: {} }, { currentVersionId: id }, { publicId: randomUUID() }, { availability: 'open' }]) {
    expect(createFormInputSchema.safeParse({ title: 'title', ...extra }).success).toBe(false);
  }
  expect(workspaceParamsSchema.parse({ workspaceId: id.toUpperCase() }).workspaceId).toBe(id);
  expect(formParamsSchema.safeParse({ formId: { $ne: null } }).success).toBe(false);
});

test('initial drafts have no fields, steps, rules, answers or publication and never share mutable arrays', () => {
  const first = createInitialDraft('Synthetic form'); const second = createInitialDraft('Another form');
  expect(initialDraftSchema.safeParse(first).success).toBe(true);
  expect(first.fields).toEqual([]); expect(first.steps).toEqual([]); expect(first.visibilityRules).toEqual([]);
  expect(first.fields === second.fields || first.theme === second.theme).toBe(false);
  for (const extra of [{ fields: [{}] }, { steps: [{}] }, { visibilityRules: [{}] }, { answers: {} }, { theme: { preset: 'script' } }, { extra: true }]) {
    expect(initialDraftSchema.safeParse({ ...first, ...extra }).success).toBe(false);
  }
  expect(initialFormDtoSchema.safeParse(form).success).toBe(true);
  expect(initialFormDtoSchema.safeParse({ ...form, currentVersionId: id }).success).toBe(false);
  expect(workspaceDtoSchema.safeParse({ ...workspace, formSequence: 1 }).success).toBe(false);
});

test('management HTTP guards precede JSON work; strict parser and IDs fail before any persistence call', async t => {
  let writes = 0;
  const token = 'a'.repeat(43); const csrf = 'b'.repeat(43);
  const store: SessionStore = {
    async find() { return { userId: new Types.ObjectId(id), csrfSecret: csrf, expiresAt: new Date(Date.now() + 60000), revokedAt: null }; },
    async insert() { throw new Error('Unexpected insertion.'); }, async rotate() { throw new Error('Unexpected rotation.'); }, async revoke() {},
  };
  const sessions = createSessionManager(store, { async active() { return user; } }, origin);
  const router = createWorkspaceRouter({
    async createWorkspace(userId, name) { writes++; expect(userId).toBe(id); return { ...workspace, name }; },
    async workspace() { return workspace; }, async createForm() { writes++; return initialFormDtoSchema.parse(form); }, async form() { return initialFormDtoSchema.parse(form); },
  }, sessions);
  const server = await listen(t, createApp(async () => true, router));
  const post = () => request(server).post('/api/v1/workspaces').set('Origin', origin).set('Cookie', 'vfb_session=' + token)
    .set('X-CSRF-Token', csrf).set('Content-Type', 'application/json');
  expect((await post().unset('Origin').send('{')).status).toBe(403);
  expect((await post().unset('X-CSRF-Token').send('{')).status).toBe(403);
  expect((await post().unset('Cookie').send('{}')).status).toBe(401);
  for (const [body, status] of [['{', 400], [JSON.stringify({ name: { $ne: null } }), 400], [JSON.stringify({ name: 'x'.repeat(9000) }), 413]] as const) {
    const response = await post().send(body); expect(response.status).toBe(status);
    expect(errorEnvelopeSchema.safeParse(response.body).success).toBe(true);
  }
  expect((await post().set('Content-Encoding', 'gzip').send(gzipSync('{}'))).status).toBe(400);
  expect((await post().set('Content-Type', 'text/plain').send('name')).status).toBe(400);
  expect((await request(server).get('/api/v1/forms/bad-id').set('Cookie', 'vfb_session=' + token)).status).toBe(400);
  expect(writes).toBe(0);
  const response = await post().send({ name: ' Synthetic workspace ' });
  expect(response.status).toBe(201); expect(response.body.data).toEqual(workspace);
  expect(response.headers['cache-control']).toBe('no-store'); expect(response.headers['x-correlation-id']).toBe(response.body.correlationId);
  expect(writes).toBe(1);
});
