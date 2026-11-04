import { createHash } from 'node:crypto';
import type { Server } from 'node:http';
import { Types } from 'mongoose';
import type { Connection } from 'mongoose';
import request from 'supertest';
import type { Response } from 'supertest';
import { expect, test } from 'vitest';
import type { TestContext } from 'vitest';
import { errorEnvelopeSchema, formPageSchema, initialFormDtoSchema, workspaceDtoSchema, workspacePageSchema } from '@visual-form-builder/contracts';
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
const password = 'Synthetic tenant passphrase 123!';
const missingId = '0123456789abcdef01234567';
type Context = { pair: string; csrf: string };
function cookie(response: Response) {
  const pair = (response.headers['set-cookie'] as unknown as string[] | undefined)?.[0]?.split(';')[0];
  if (!pair) throw new Error('Synthetic session cookie missing.');
  return pair;
}
function get(server: Server, path: string, context?: Context) {
  const call = request(server).get('/api/v1' + path).timeout(5000);
  return context ? call.set('Cookie', context.pair) : call;
}
function post(server: Server, path: string, context: Context | undefined, body: object) {
  const call = request(server).post('/api/v1' + path).set('Origin', origin).send(body).timeout(15000);
  return context ? call.set('Cookie', context.pair).set('X-CSRF-Token', context.csrf) : call;
}
function denied(response: Response, status: number) {
  expect(response.status).toBe(status);
  const envelope = errorEnvelopeSchema.parse(response.body);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['x-correlation-id']).toBe(envelope.correlationId);
  expect(/passwordHash|recoveryHashes|csrfSecret|formSequence|Mongo|ValidationError|stack/.test(response.text)).toBe(false);
  return envelope.error;
}
async function api(t: TestContext, connection: Connection) {
  const users = await createUserStore(connection), auth = await createAuthService(users);
  const sessions = createSessionManager(await createSessionStore(connection), users, origin);
  const router = createSessionRouter(auth, sessions);
  router.use(createWorkspaceRouter(await createWorkspaceStore(connection), sessions));
  return { users, auth, server: await listen(t, createApp(async () => true, router)) };
}
async function signIn(server: Server, email: string): Promise<Context> {
  const pre = await get(server, '/auth/csrf'); expect(pre.status).toBe(200);
  const login = await post(server, '/auth/login', { pair: cookie(pre), csrf: String(pre.body.data.csrfToken) }, { email, password });
  expect(login.status).toBe(200);
  const pair = cookie(login);
  const csrf = await get(server, '/auth/csrf', { pair, csrf: '' }); expect(csrf.status).toBe(200);
  return { pair, csrf: String(csrf.body.data.csrfToken) };
}
async function seed(t: TestContext, connection: Connection) {
  const app = await api(t, connection);
  await app.auth.bootstrap({ email: 'tenant-a@example.test', password });
  const proof = await app.users.credential('tenant-a@example.test');
  if (!proof) throw new Error('Synthetic credential missing.');
  await connection.collection('users').insertOne({ normalizedEmail: 'tenant-b@example.test', passwordHash: proof.passwordHash, status: 'active' });
  const tenants = [];
  for (const [letter, email] of [['A', 'tenant-a@example.test'], ['B', 'tenant-b@example.test']] as const) {
    const context = await signIn(app.server, email);
    const workspaceResponse = await post(app.server, '/workspaces', context, { name: 'Synthetic tenant ' + letter });
    expect(workspaceResponse.status).toBe(201);
    const workspace = workspaceDtoSchema.parse(workspaceResponse.body.data);
    const forms = [];
    for (let i = 0; i < 2; i++) {
      const response = await post(app.server, '/workspaces/' + workspace.id + '/forms', context, { title: 'Synthetic ' + letter + ' form ' + i });
      expect(response.status).toBe(201); forms.push(initialFormDtoSchema.parse(response.body.data));
    }
    tenants.push({ context, workspace, form: forms[0]!, forms, email });
  }
  return { ...app, a: tenants[0]!, b: tenants[1]! };
}
async function tenantState(connection: Connection) {
  // Compare hashes so a failing assertion cannot dump stored metadata or private counters.
  const state = [];
  for (const name of ['workspaces', 'memberships', 'forms']) state.push(await connection.collection(name).find({}).sort({ _id: 1 }).toArray());
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

test('two independent owners cannot read or mutate each other through any shipped workspace/form endpoint', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect(), reader = await fixture.connect();
    const { server, a, b } = await seed(t, connection);
    const before = await tenantState(reader);
    for (const [actor, foreign] of [[a, b], [b, a]] as const) {
      const list = workspacePageSchema.parse((await get(server, '/workspaces', actor.context)).body);
      expect(list.data.map(item => item.id)).toEqual([actor.workspace.id]);
      const own = await get(server, '/forms/' + actor.form.id, actor.context);
      expect(own.status).toBe(200); expect(initialFormDtoSchema.parse(own.body.data).workspaceId).toBe(actor.workspace.id);
      const foreignPage = formPageSchema.parse((await get(server, '/workspaces/' + foreign.workspace.id + '/forms?limit=1', foreign.context)).body);
      expect(foreignPage.nextCursor !== null).toBe(true);
      for (const [foreignPath, missingPath] of [
        ['/workspaces/' + foreign.workspace.id, '/workspaces/' + missingId],
        ['/workspaces/' + foreign.workspace.id + '/forms', '/workspaces/' + missingId + '/forms'],
        ['/forms/' + foreign.form.id, '/forms/' + missingId],
      ]) {
        const known = await get(server, foreignPath!, actor.context);
        const absent = await get(server, missingPath!, actor.context);
        expect(denied(known, 404)).toEqual(denied(absent, 404));
      }
      denied(await get(server, '/workspaces/' + foreign.workspace.id + '/forms?cursor=' + foreignPage.nextCursor, actor.context), 404);
      denied(await get(server, '/forms/' + foreign.form.id + '?workspaceId=' + actor.workspace.id, actor.context)
        .set('X-Workspace-Id', actor.workspace.id).set('X-User-Id', foreign.workspace.ownerId).set('X-Role', 'owner'), 404);
      denied(await get(server, '/forms/' + foreign.form.publicId, actor.context), 400);
      denied(await get(server, '/forms/' + actor.workspace.id, actor.context), 404);
      const foreignWrite = await post(server, '/workspaces/' + foreign.workspace.id + '/forms', actor.context, { title: 'Denied write' });
      const missingWrite = await post(server, '/workspaces/' + missingId + '/forms', actor.context, { title: 'Denied write' });
      expect(denied(foreignWrite, 404)).toEqual(denied(missingWrite, 404));
      denied(await post(server, '/workspaces', actor.context, { name: 'Spoof owner', ownerId: foreign.workspace.ownerId }), 400);
      denied(await post(server, '/workspaces/' + actor.workspace.id + '/forms', actor.context,
        { title: 'Spoof scope', workspaceId: foreign.workspace.id }), 400);
      denied(await post(server, '/workspaces/' + foreign.workspace.id + '/forms', actor.context, { title: 'Wrong CSRF' })
        .set('X-CSRF-Token', foreign.context.csrf), 403);
    }
    for (const path of ['/workspaces', '/workspaces/' + a.workspace.id, '/workspaces/' + a.workspace.id + '/forms', '/forms/' + a.form.id]) {
      denied(await get(server, path), 401);
    }
    denied(await post(server, '/workspaces', undefined, { name: 'Anonymous' }), 401);
    denied(await post(server, '/workspaces/' + a.workspace.id + '/forms', undefined, { title: 'Anonymous' }), 401);
    expect(await tenantState(reader)).toBe(before);
    // Positive write controls prove denial is scoped, not a blanket outage.
    for (const actor of [a, b]) {
      const response = await post(server, '/workspaces/' + actor.workspace.id.toUpperCase() + '/forms', actor.context, { title: 'Allowed own form' });
      expect(response.status).toBe(201); expect(initialFormDtoSchema.parse(response.body.data).workspaceId).toBe(actor.workspace.id);
    }
    expect(await reader.collection('forms').countDocuments({})).toBe(6);
  });
});

test('membership and lifecycle scope are checked afresh across API instances, not inherited from ownership elsewhere', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect(); const { server, a, b } = await seed(t, connection);
    const second = (await api(t, await fixture.connect())).server;
    const workspaceId = new Types.ObjectId(b.workspace.id), userId = new Types.ObjectId(a.workspace.ownerId);
    const inserted = await connection.collection('memberships').insertOne({ workspaceId, userId, role: 'viewer' });
    for (const role of ['viewer', 'editor']) {
      await connection.collection('memberships').updateOne({ _id: inserted.insertedId }, { $set: { role } });
      for (const instance of [server, second]) {
        expect((await get(instance, '/workspaces/' + b.workspace.id, a.context)).body.data.role).toBe(role);
        expect((await get(instance, '/forms/' + b.form.id, a.context)).status).toBe(200);
        expect(formPageSchema.parse((await get(instance, '/workspaces/' + b.workspace.id + '/forms', a.context)).body).data.length).toBe(2);
        denied(await post(instance, '/workspaces/' + b.workspace.id + '/forms', a.context, { title: 'Not owner here' }), 404);
      }
    }
    await connection.collection('memberships').updateOne({ _id: inserted.insertedId }, { $set: { role: 'unknown-role' } });
    denied(await get(server, '/forms/' + b.form.id, a.context), 404);
    expect(workspacePageSchema.parse((await get(server, '/workspaces', a.context)).body).data.map(item => item.id)).toEqual([a.workspace.id]);
    await connection.collection('memberships').deleteOne({ _id: inserted.insertedId });
    for (const instance of [server, second]) {
      for (const path of ['/workspaces/' + b.workspace.id, '/workspaces/' + b.workspace.id + '/forms', '/forms/' + b.form.id]) denied(await get(instance, path, a.context), 404);
      denied(await post(instance, '/workspaces/' + b.workspace.id + '/forms', a.context, { title: 'Removed member' }), 404);
      expect((await get(instance, '/forms/' + a.form.id, a.context)).status).toBe(200);
    }
    const ownerMembership = await connection.collection('memberships').findOne({ workspaceId, userId: new Types.ObjectId(b.workspace.ownerId) });
    if (!ownerMembership) throw new Error('Synthetic owner membership missing.');
    await connection.collection('memberships').deleteOne({ _id: ownerMembership._id });
    denied(await get(server, '/forms/' + b.form.id, b.context), 404);
    denied(await post(server, '/workspaces/' + b.workspace.id + '/forms', b.context, { title: 'Owner ID alone' }), 404);
    await connection.collection('memberships').insertOne(ownerMembership);
    await connection.collection('workspaces').updateOne({ _id: workspaceId }, { $set: { state: 'deleting' } });
    for (const instance of [server, second]) {
      for (const path of ['/workspaces/' + b.workspace.id, '/workspaces/' + b.workspace.id + '/forms', '/forms/' + b.form.id]) denied(await get(instance, path, b.context), 404);
      denied(await post(instance, '/workspaces/' + b.workspace.id + '/forms', b.context, { title: 'Inactive workspace' }), 404);
    }
    expect(workspacePageSchema.parse((await get(server, '/workspaces', b.context)).body).data).toEqual([]);
    await connection.collection('workspaces').updateOne({ _id: workspaceId }, { $set: { state: 'active' } });
    await connection.collection('forms').updateOne({ _id: new Types.ObjectId(b.form.id) }, { $set: { availability: 'deleting' } });
    for (const instance of [server, second]) denied(await get(instance, '/forms/' + b.form.id, b.context), 404);
    const remaining = formPageSchema.parse((await get(server, '/workspaces/' + b.workspace.id + '/forms', b.context)).body);
    expect(remaining.data.map(item => item.id)).toEqual([b.forms[1]!.id]);
    await connection.collection('workspaces').deleteOne({ _id: workspaceId });
    denied(await get(server, '/forms/' + b.forms[1]!.id, b.context), 404);
    denied(await post(server, '/workspaces/' + b.workspace.id + '/forms', b.context, { title: 'Orphaned scope' }), 404);
  });
});

test('disabled, expired and revoked author contexts fail every shipped workspace/form route while the other owner retains access', async t => {
  await withMongoFixture(async fixture => {
    const connection = await fixture.connect(); const { server, a, b } = await seed(t, connection);
    async function deniedInventory(context: Context) {
      for (const path of ['/workspaces', '/workspaces/' + a.workspace.id, '/workspaces/' + a.workspace.id + '/forms', '/forms/' + a.form.id]) denied(await get(server, path, context), 401);
      denied(await post(server, '/workspaces', context, { name: 'No identity' }), 401);
      denied(await post(server, '/workspaces/' + a.workspace.id + '/forms', context, { title: 'No identity' }), 401);
      expect((await get(server, '/forms/' + b.form.id, b.context)).status).toBe(200);
    }
    const before = await tenantState(connection);
    await connection.collection('users').updateOne({ _id: new Types.ObjectId(a.workspace.ownerId) }, { $set: { status: 'disabled' } });
    await deniedInventory(a.context);
    await connection.collection('users').updateOne({ _id: new Types.ObjectId(a.workspace.ownerId) }, { $set: { status: 'active' } });
    await connection.collection('sessions').updateMany({ userId: new Types.ObjectId(a.workspace.ownerId) }, { $set: { expiresAt: new Date(0) } });
    await deniedInventory(a.context);
    const renewed = await signIn(server, a.email);
    expect((await post(server, '/auth/logout', renewed, {})).status).toBe(200);
    await deniedInventory(renewed);
    expect(await tenantState(connection)).toBe(before);
  });
});
