import { expect, test } from 'vitest';
import type { TestContext } from 'vitest';
import request from 'supertest';
import type { Response } from 'supertest';
import type { Server } from 'node:http';
import type { Connection } from 'mongoose';
import { errorEnvelopeSchema, initialFormDtoSchema, successEnvelopeSchema, workspaceDtoSchema } from '@visual-form-builder/contracts';
import { createApp } from '../../apps/api/src/app.js';
import { createUserStore } from '../../apps/api/src/modules/auth/store.js';
import { createAuthService } from '../../apps/api/src/modules/auth/service.js';
import { createSessionStore } from '../../apps/api/src/modules/auth/session-store.js';
import { createSessionManager } from '../../apps/api/src/modules/auth/sessions.js';
import { createSessionRouter } from '../../apps/api/src/modules/auth/session-router.js';
import { createWorkspaceStore } from '../../apps/api/src/modules/workspaces/store.js';
import { createWorkspaceRouter } from '../../apps/api/src/modules/workspaces/router.js';
import { withMongoFixture } from '../helpers/mongo.js';
import { listen } from '../helpers/http.js';

const origin = 'http://127.0.0.1:3000';
const email = 'owner@example.test';
const password = 'Synthetic workspace passphrase 123!';
function cookie(response: Response) {
  const pair = (response.headers['set-cookie'] as unknown as string[] | undefined)?.[0]?.split(';')[0];
  expect(Boolean(pair)).toBe(true); return pair ?? '';
}
function failure(response: Response, status: number) {
  expect(response.status).toBe(status); expect(errorEnvelopeSchema.safeParse(response.body).success).toBe(true);
  expect(/passwordHash|recoveryHashes|formSequence|Mongo|ValidationError|stack/.test(response.text)).toBe(false);
  expect(response.headers['cache-control']).toBe('no-store');
}
async function setup(t: TestContext, connection: Connection, seed = true) {
  const users = await createUserStore(connection); const auth = await createAuthService(users);
  if (seed) await auth.bootstrap({ email, password });
  const sessions = createSessionManager(await createSessionStore(connection), users, origin);
  const store = await createWorkspaceStore(connection); const router = createSessionRouter(auth, sessions);
  router.use(createWorkspaceRouter(store, sessions));
  return { server: await listen(t, createApp(async () => true, router)), users, store };
}
async function csrf(server: Server, pair?: string) {
  let call = request(server).get('/api/v1/auth/csrf').timeout(5000);
  if (pair) call = call.set('Cookie', pair);
  const response = await call; expect(response.status).toBe(200);
  return { pair: response.headers['set-cookie'] ? cookie(response) : pair ?? '', token: String(response.body.data.csrfToken) };
}
type Context = Awaited<ReturnType<typeof csrf>>;
function post(server: Server, path: string, context: Context, body: object) {
  return request(server).post('/api/v1' + path).set('Origin', origin).set('Cookie', context.pair)
    .set('X-CSRF-Token', context.token).send(body).timeout(15000);
}
async function login(server: Server, address = email) {
  const response = await post(server, '/auth/login', await csrf(server), { email: address, password });
  expect(response.status).toBe(200); return csrf(server, cookie(response));
}
async function workspace(server: Server, context: Context) {
  const response = await post(server, '/workspaces', context, { name: ' Synthetic workspace ' });
  expect(response.status).toBe(201); expect(successEnvelopeSchema(workspaceDtoSchema).safeParse(response.body).success).toBe(true);
  return workspaceDtoSchema.parse(response.body.data);
}

test('signed-in owner creates a workspace, owner membership and first empty draft with independent-reader persistence', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect(), reader = await fixture.connect();
    const { server } = await setup(t, connection); const owner = await login(server);
    const created = await workspace(server, owner);
    expect(created.name).toBe('Synthetic workspace'); expect(created.role).toBe('owner');
    const memberships = await reader.collection('memberships').find({}).toArray();
    expect(memberships.length).toBe(1); expect(String(memberships[0]?.userId)).toBe(created.ownerId);
    expect(String(memberships[0]?.workspaceId)).toBe(created.id); expect(memberships[0]?.role).toBe('owner');
    await expect(reader.collection('memberships').insertOne({ workspaceId: memberships[0]?.workspaceId, userId: memberships[0]?.userId, role: 'viewer' }))
      .rejects.toMatchObject({ code: 11000 });
    const response = await post(server, '/workspaces/' + created.id + '/forms', owner, { title: ' Workshop registration ' });
    expect(response.status).toBe(201); expect(successEnvelopeSchema(initialFormDtoSchema).safeParse(response.body).success).toBe(true);
    const form = initialFormDtoSchema.parse(response.body.data);
    expect(form.workspaceId).toBe(created.id); expect(form.title).toBe('Workshop registration');
    expect(form.draftSchema).toEqual({ schemaFormatVersion: 1, title: form.title, description: '', steps: [], fields: [], visibilityRules: [], theme: { preset: 'neutral' } });
    expect(form.draftRevision).toBe(0); expect(form.availability).toBe('draft'); expect(form.currentVersionId).toBeNull();
    expect(form.acceptedCount).toBe(0); expect(form.acceptedWindows).toEqual([]); expect(form.retentionDays).toBe(30);
    const stored = await reader.collection('forms').findOne({ publicId: form.publicId });
    expect(String(stored?.workspaceId)).toBe(created.id); expect(stored?.draftSchema).toEqual(form.draftSchema);
    expect(await reader.collection('formVersions').countDocuments({})).toBe(0);
    const restarted = (await setup(t, await fixture.connect(), false)).server;
    const read = await request(restarted).get('/api/v1/forms/' + form.id).set('Cookie', owner.pair);
    expect(read.status).toBe(200); expect(read.body.data).toEqual(form); expect(read.headers['cache-control']).toBe('no-store');
    const readWorkspace = await request(restarted).get('/api/v1/workspaces/' + created.id).set('Cookie', owner.pair);
    expect(readWorkspace.status).toBe(200); expect(readWorkspace.body.data.ownerId).toBe(created.ownerId);
    expect(readWorkspace.text.includes('formSequence')).toBe(false);
    const indexes = await reader.collection('forms').indexes();
    expect(indexes.some(index => index.key.publicId === 1 && index.unique === true)).toBe(true);
    expect(indexes.some(index => index.key.workspaceId === 1 && index.key.updatedAt === -1 && index.key._id === -1)).toBe(true);
  });
});

test('creation/read endpoints require current identity and scope; caller IDs, missing CSRF and another account grant no ownership', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect(); const { server, users } = await setup(t, connection);
    const owner = await login(server); const created = await workspace(server, owner);
    const result = await post(server, '/workspaces/' + created.id + '/forms', owner, { title: 'Synthetic form' });
    expect(result.status).toBe(201); const form = initialFormDtoSchema.parse(result.body.data);
    const proof = await users.credential(email);
    await connection.collection('users').insertOne({ normalizedEmail: 'other@example.test', passwordHash: proof?.passwordHash, status: 'active' });
    const other = await login(server, 'other@example.test');
    for (const path of ['/workspaces/' + created.id, '/forms/' + form.id]) {
      failure(await request(server).get('/api/v1' + path), 401);
      failure(await request(server).get('/api/v1' + path).set('Cookie', other.pair), 404);
    }
    const denied = await post(server, '/workspaces/' + created.id + '/forms', other, { title: 'Forbidden form' });
    const missing = await post(server, '/workspaces/0123456789abcdef01234567/forms', other, { title: 'Forbidden form' });
    failure(denied, 404); failure(missing, 404); expect(denied.body.error).toEqual(missing.body.error);
    const otherUser = await users.credential('other@example.test');
    const ownerMembership = await connection.collection('memberships').findOne({ role: 'owner' });
    if (!otherUser || !ownerMembership) throw new Error('Fixture identities missing.');
    const { Types } = await import('mongoose');
    const viewer = { workspaceId: ownerMembership.workspaceId, userId: new Types.ObjectId(otherUser.dto.id), role: 'viewer' };
    const inserted = await connection.collection('memberships').insertOne(viewer);
    expect((await request(server).get('/api/v1/forms/' + form.id).set('Cookie', other.pair)).status).toBe(200);
    failure(await post(server, '/workspaces/' + created.id + '/forms', other, { title: 'Viewer cannot create' }), 404);
    await connection.collection('memberships').deleteOne({ _id: inserted.insertedId });
    failure(await post(server, '/workspaces', owner, { name: 'Spoof', ownerId: form.id }), 400);
    failure(await post(server, '/workspaces/' + created.id + '/forms', owner, { title: 'Spoof', workspaceId: form.id, availability: 'open' }), 400);
    for (const path of ['/workspaces', '/workspaces/' + created.id + '/forms']) {
      failure(await request(server).post('/api/v1' + path).set('Cookie', owner.pair).set('Origin', origin).send({}), 403);
      failure(await request(server).post('/api/v1' + path).set('Cookie', owner.pair).set('X-CSRF-Token', owner.token).send({}), 403);
    }
    const membership = await connection.collection('memberships').findOne({ role: 'owner' });
    if (!membership) throw new Error('Fixture membership missing.');
    await connection.collection('memberships').deleteOne({ _id: membership._id });
    failure(await request(server).get('/api/v1/forms/' + form.id).set('Cookie', owner.pair), 404);
    failure(await post(server, '/workspaces/' + created.id + '/forms', owner, { title: 'No membership' }), 404);
    if (!membership) throw new Error('Fixture membership missing.');
    await connection.collection('memberships').insertOne(membership);
    await connection.collection('workspaces').updateOne({ _id: membership.workspaceId }, { $set: { state: 'deleting' } });
    failure(await request(server).get('/api/v1/forms/' + form.id).set('Cookie', owner.pair), 404);
    expect(await connection.collection('forms').countDocuments({})).toBe(1);
    await connection.collection('users').updateOne({ normalizedEmail: email }, { $set: { status: 'disabled' } });
    failure(await post(server, '/workspaces', owner, { name: 'Disabled' }), 401);
  });
});

test('membership insertion and form insertion failures roll back all related writes before corrected requests succeed', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect(); const { server } = await setup(t, connection); const owner = await login(server);
    await connection.db?.command({ collMod: 'memberships', validator: { role: 'viewer' } });
    failure(await post(server, '/workspaces', owner, { name: 'Rollback workspace' }), 503);
    expect(await connection.collection('workspaces').countDocuments({})).toBe(0);
    expect(await connection.collection('memberships').countDocuments({})).toBe(0);
    await connection.db?.command({ collMod: 'memberships', validator: {} });
    const created = await workspace(server, owner);
    const before = await connection.collection('workspaces').findOne({ name: created.name });
    await connection.db?.command({ collMod: 'forms', validator: { draftRevision: 999 } });
    failure(await post(server, '/workspaces/' + created.id + '/forms', owner, { title: 'Rollback form' }), 503);
    const after = await connection.collection('workspaces').findOne({ name: created.name });
    expect(after?.formSequence).toBe(0); expect(before?.updatedAt.getTime() === after?.updatedAt.getTime()).toBe(true);
    expect(await connection.collection('forms').countDocuments({})).toBe(0);
    await connection.db?.command({ collMod: 'forms', validator: {} });
    expect((await post(server, '/workspaces/' + created.id + '/forms', owner, { title: 'Corrected form' })).status).toBe(201);
  });
});

test('two API instances cannot exceed the 25-form ceiling and dependency errors remain private', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect(); const { server } = await setup(t, connection);
    const owner = await login(server); const created = await workspace(server, owner);
    const path = '/workspaces/' + created.id + '/forms';
    for (let i = 0; i < 24; i++) expect((await post(server, path, owner, { title: 'Synthetic form ' + i })).status).toBe(201);
    const secondConnection = await fixture.connect(); const second = (await setup(t, secondConnection, false)).server;
    const results = await Promise.all([post(server, path, owner, { title: 'Contender A' }), post(second, path, owner, { title: 'Contender B' })]);
    expect(results.map(result => result.status).sort()).toEqual([201, 409]);
    expect(await connection.collection('forms').countDocuments({})).toBe(25);
    const storedWorkspace = await connection.collection('workspaces').findOne({ name: created.name });
    expect(storedWorkspace?.formSequence).toBe(25);
    const forms = await connection.collection('forms').find({}).toArray();
    expect(new Set(forms.map(form => form.publicId)).size).toBe(25);
    await secondConnection.close();
    failure(await request(second).get('/api/v1/workspaces/' + created.id).set('Cookie', owner.pair), 503);
  });
});
