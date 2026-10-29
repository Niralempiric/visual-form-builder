import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import express from 'express';
import request from 'supertest';
import type { Response } from 'supertest';
import { test } from 'vitest';
import type { TestContext } from 'vitest';
import { z } from 'zod';
import {
  apiErrors, apiErrorCodeSchema, correlationIdSchema, cursorSchema, cursorPositionSchema, errorEnvelopeSchema,
  fieldIdSchema, objectIdSchema, pageEnvelopeSchema, paginationQuerySchema, successEnvelopeSchema,
} from '@visual-form-builder/contracts';
import type { ApiErrorCode } from '@visual-form-builder/contracts';
import { createApp } from '../../apps/api/src/app.js';
import { ApiError, encodeCursor, parseContract, parsePagination } from '../../apps/api/src/http.js';

const id = '0123456789abcdef01234567';
const fieldId = '123e4567-e89b-42d3-a456-426614174000';
const correlationId = '123e4567-e89b-42d3-a456-426614174001';
const position = { v: 1, at: '2026-10-27T01:02:03.000Z', id } as const;
const dto = z.strictObject({ id: objectIdSchema });

function malformed(operation: () => unknown) {
  assert.throws(operation, error => error instanceof ApiError && error.code === 'MALFORMED_REQUEST' &&
    error.message === apiErrors.MALFORMED_REQUEST.message);
}

test('wire IDs reject coercion, malformed strings and operator objects', () => {
  assert.equal(objectIdSchema.parse(id.toUpperCase()), id);
  for (const value of [null, undefined, 123, { $ne: null }, [id], '', 'a'.repeat(23), 'g'.repeat(24), id + ' ']) {
    assert.equal(objectIdSchema.safeParse(value).success, false);
    malformed(() => parseContract(objectIdSchema, value));
  }
  assert.equal(fieldIdSchema.safeParse(fieldId).success, true);
  assert.equal(fieldIdSchema.safeParse(id).success, false);
  assert.equal(fieldIdSchema.safeParse('field-uuid').success, false);
});

test('strict success, list and error envelopes allow only the documented DTO and safe messages', () => {
  assert.deepEqual(successEnvelopeSchema(dto).parse({ data: { id }, correlationId }), { data: { id }, correlationId });
  const page = { data: [{ id }], nextCursor: encodeCursor(position), correlationId };
  assert.deepEqual(pageEnvelopeSchema(dto).parse(page), page);
  assert.equal(pageEnvelopeSchema(dto).safeParse({ ...page, nextCursor: null }).success, true);
  for (const value of [
    { data: { id, passwordHash: 'synthetic-private' }, correlationId },
    { data: { id }, correlationId, debug: 'synthetic-private' },
    { data: { id } },
    { data: { id }, correlationId: 'unbounded-client-text' },
  ]) assert.equal(successEnvelopeSchema(dto).safeParse(value).success, false);
  assert.equal(pageEnvelopeSchema(dto).safeParse({ ...page, data: Array(101).fill({ id }) }).success, false);
  assert.equal(pageEnvelopeSchema(dto).safeParse({ data: [], correlationId }).success, false);
  const answer = { error: { code: 'ANSWER_INVALID', message: apiErrors.ANSWER_INVALID.message,
    fieldErrors: [{ fieldId, message: 'This answer is required.' }] }, correlationId };
  assert.deepEqual(errorEnvelopeSchema.parse(answer), answer);
  for (const value of [
    { ...answer, debug: 'synthetic-private' },
    { ...answer, error: { ...answer.error, stack: 'synthetic-private' } },
    { ...answer, error: { ...answer.error, message: 'synthetic-private' } },
    { ...answer, error: { ...answer.error, code: 'MALFORMED_REQUEST', message: apiErrors.MALFORMED_REQUEST.message } },
    { ...answer, error: { ...answer.error, fieldErrors: [{ fieldId, message: 'synthetic-entered-answer' }] } },
    { ...answer, error: { ...answer.error, fieldErrors: [{ fieldId: 'bad', message: 'This answer is invalid.' }] } },
  ]) assert.equal(errorEnvelopeSchema.safeParse(value).success, false);
});

test('pagination bounds, defaults and malformed cursor payloads are enforced before lookup', () => {
  assert.deepEqual(parsePagination({}), { limit: 25, after: null });
  assert.deepEqual(paginationQuerySchema.parse({ limit: '100' }), { limit: 100 });
  const token = encodeCursor(position);
  assert.equal(cursorSchema.safeParse(token).success, true);
  assert.deepEqual(parsePagination({ limit: '1', cursor: token }), { limit: 1, after: position });
  for (const query of [null, [], { limit: 25 }, { limit: ['25'] }, { limit: { $gt: 0 } },
    { limit: '0' }, { limit: '101' }, { limit: '-1' }, { limit: '1.5' }, { limit: '1e2' },
    { limit: ' 1' }, { limit: '01' }, { limit: '9'.repeat(1000) }, { $where: 'synthetic-script' },
    { cursor: '' }, { cursor: ['a'] }, { cursor: 'a'.repeat(257) }, { cursor: 'a=' },
    { cursor: Buffer.from('not json').toString('base64url') }, { cursor: 'AB' },
  ]) malformed(() => parsePagination(query));
  for (const value of [null, [], { ...position, v: 2 }, { ...position, at: '2026-02-30T00:00:00.000Z' },
    { ...position, at: '2026-10-27T00:00:00+00:00' }, { ...position, id: { $ne: null } },
    { ...position, workspaceId: id }, { ...position, answers: 'synthetic-answer' }]) {
    malformed(() => parsePagination({ cursor: Buffer.from(JSON.stringify(value)).toString('base64url') }));
    assert.equal(cursorPositionSchema.safeParse(value).success, false);
  }
});

async function listen(t: TestContext, app: express.Express) {
  const server = app.listen(0, '127.0.0.1');
  t.onTestFinished(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  }));
  await once(server, 'listening');
  return server;
}

async function fixture(t: TestContext) {
  const router = express.Router();
  router.get('/items/:id', (req, res) => {
    const value = parseContract(objectIdSchema, req.params.id);
    res.json(successEnvelopeSchema(dto).parse({ data: { id: value }, correlationId: res.locals.correlationId }));
  });
  router.get('/items', (req, res) => {
    const page = parsePagination(req.query);
    res.json(pageEnvelopeSchema(dto).parse({ data: [{ id }],
      nextCursor: page.after === null ? encodeCursor(position) : null, correlationId: res.locals.correlationId }));
  });
  router.get('/errors/:code', (req, _res, next) => {
    const code = parseContract(apiErrorCodeSchema, req.params.code);
    next(new ApiError(code, code === 'ANSWER_INVALID' ?
      [{ fieldId, message: 'This answer is required.' }] : undefined));
  });
  router.get('/bad-internal-code', () => {
    const error = new ApiError('CONFLICT');
    Object.assign(error, { code: 'synthetic-private' });
    throw error;
  });
  router.get('/failure', async () => { throw new Error('synthetic-secret mongodb://private.invalid synthetic-answer'); });
  router.get('/bad-internal-detail', () => {
    // Exercise a malformed runtime caller even though TS rejects this message.
    throw Reflect.construct(ApiError, ['ANSWER_INVALID', [{ fieldId, message: 'synthetic-answer' }]]);
  });
  return listen(t, createApp(async () => true, router));
}

function get(server: Server, path: string) {
  return request(server).get(path).timeout({ response: 2000, deadline: 3000 });
}

function errorBody(response: Response, code: ApiErrorCode) {
  assert.equal(response.status, apiErrors[code].status);
  assert.match(response.headers['content-type'] ?? '', /^application\/json/);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(response.headers['x-powered-by'], undefined);
  const body = errorEnvelopeSchema.parse(response.body);
  assert.equal(body.error.code, code);
  assert.equal(body.correlationId, response.headers['x-correlation-id']);
  return body;
}

test('HTTP malformed contracts share one safe 400 envelope, independent of the invalid input', async t => {
  const server = await fixture(t);
  const paths = ['/items/bad', '/items/%7B%22%24ne%22%3Anull%7D', '/items/%E0%A4%A',
    '/items?limit=101', '/items?limit=1&limit=2', '/items?limit[$gt]=1',
    '/items?cursor=synthetic-secret', '/items?$where=synthetic-answer', '/items?limit=1.5'];
  for (const path of paths) {
    const body = errorBody(await get(server, '/api/v1' + path).set('X-Correlation-ID', correlationId), 'MALFORMED_REQUEST');
    assert.deepEqual(body, { error: { code: 'MALFORMED_REQUEST', message: apiErrors.MALFORMED_REQUEST.message }, correlationId });
  }
});

test('HTTP success and final page use shared envelopes; correlation is bounded per request', async t => {
  const server = await fixture(t);
  const one = await get(server, '/api/v1/items/' + id.toUpperCase()).set('X-Correlation-ID', correlationId);
  assert.equal(one.status, 200);
  assert.deepEqual(successEnvelopeSchema(dto).parse(one.body), { data: { id }, correlationId });
  const first = await get(server, '/api/v1/items');
  const page = pageEnvelopeSchema(dto).parse(first.body);
  assert.equal(first.status, 200);
  assert.equal(first.headers['x-correlation-id'], page.correlationId);
  const last = await get(server, '/api/v1/items?cursor=' + page.nextCursor);
  assert.equal(pageEnvelopeSchema(dto).parse(last.body).nextCursor, null);
  const responses = await Promise.all(Array.from({ length: 5 }, () =>
    get(server, '/missing').set('X-Correlation-ID', 'synthetic-secret,not-a-uuid')));
  const ids = responses.map(response => errorBody(response, 'NOT_FOUND').correlationId);
  assert.equal(new Set(ids).size, ids.length);
  for (const value of ids) assert.equal(correlationIdSchema.safeParse(value).success, true);
});

test('all public error codes use their fixed status and safe catalog; unknown exceptions never escape', async t => {
  const server = await fixture(t);
  for (const code of apiErrorCodeSchema.options) {
    const body = errorBody(await get(server, '/api/v1/errors/' + code), code);
    assert.deepEqual(body.error, { code, message: apiErrors[code].message,
      ...(code === 'ANSWER_INVALID' ? { fieldErrors: [{ fieldId, message: 'This answer is required.' }] } : {}) });
  }
  for (const path of ['/failure', '/bad-internal-detail', '/bad-internal-code']) {
    const body = errorBody(await get(server, '/api/v1' + path), 'INTERNAL_ERROR');
    assert.deepEqual(body.error, { code: 'INTERNAL_ERROR', message: apiErrors.INTERNAL_ERROR.message });
  }
});

test('production app fallback is JSON and operational health payloads remain compatible', async t => {
  const server = await listen(t, createApp(async () => false));
  errorBody(await get(server, '/api/v1/does-not-exist?answer=synthetic-private'), 'NOT_FOUND');
  for (const [path, status, value] of [['live', 200, 'ok'], ['ready', 503, 'not_ready']] as const) {
    const response = await get(server, '/health/' + path);
    assert.equal(response.status, status);
    assert.equal(correlationIdSchema.safeParse(response.headers['x-correlation-id']).success, true);
    assert.deepEqual(response.body, { status: value, service: 'visual-form-builder-api' });
  }
});
