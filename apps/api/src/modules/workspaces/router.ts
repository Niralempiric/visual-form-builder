import express from 'express';
import { createFormInputSchema, createWorkspaceInputSchema, formParamsSchema, initialFormDtoSchema,
  successEnvelopeSchema, workspaceDtoSchema, workspaceParamsSchema, workspacePageSchema, formPageSchema } from '@visual-form-builder/contracts';
import { parseContract, parsePagination } from '../../http.js';
import { readManagementJson } from '../../json.js';
import type { SessionManager } from '../auth/sessions.js';
import type { WorkspaceStore } from './store.js';

export function createWorkspaceRouter(store: WorkspaceStore, sessions: SessionManager) {
  const router = express.Router();
  router.get('/workspaces', async (req, res) => {
    const { user } = await sessions.author(req);
    const page = await store.listWorkspaces(user.id, parsePagination(req.query));
    res.json(workspacePageSchema.parse({ ...page, correlationId: res.locals.correlationId }));
  });
  router.get('/workspaces/:workspaceId/forms', async (req, res) => {
    const { user } = await sessions.author(req);
    const { workspaceId } = parseContract(workspaceParamsSchema, req.params);
    const page = await store.listForms(user.id, workspaceId, parsePagination(req.query));
    res.json(formPageSchema.parse({ ...page, correlationId: res.locals.correlationId }));
  });
  router.post('/workspaces', async (req, res) => {
    const { user } = await sessions.mutation(req);
    const { name } = parseContract(createWorkspaceInputSchema, await readManagementJson(req, res));
    const data = await store.createWorkspace(user.id, name);
    res.status(201).json(successEnvelopeSchema(workspaceDtoSchema).parse({ data, correlationId: res.locals.correlationId }));
  });
  router.get('/workspaces/:workspaceId', async (req, res) => {
    const { user } = await sessions.author(req);
    const { workspaceId } = parseContract(workspaceParamsSchema, req.params);
    const data = await store.workspace(user.id, workspaceId);
    res.json(successEnvelopeSchema(workspaceDtoSchema).parse({ data, correlationId: res.locals.correlationId }));
  });
  router.post('/workspaces/:workspaceId/forms', async (req, res) => {
    const { user } = await sessions.mutation(req);
    const { workspaceId } = parseContract(workspaceParamsSchema, req.params);
    const { title } = parseContract(createFormInputSchema, await readManagementJson(req, res));
    const data = await store.createForm(user.id, workspaceId, title);
    res.status(201).json(successEnvelopeSchema(initialFormDtoSchema).parse({ data, correlationId: res.locals.correlationId }));
  });
  router.get('/forms/:formId', async (req, res) => {
    const { user } = await sessions.author(req);
    const { formId } = parseContract(formParamsSchema, req.params);
    const data = await store.form(user.id, formId);
    res.json(successEnvelopeSchema(initialFormDtoSchema).parse({ data, correlationId: res.locals.correlationId }));
  });
  return router;
}
