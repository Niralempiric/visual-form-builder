import { createFormInputSchema, createWorkspaceInputSchema, errorEnvelopeSchema, formPageSchema, initialFormDtoSchema,
  objectIdSchema, successEnvelopeSchema, workspaceDtoSchema, workspacePageSchema } from '@visual-form-builder/contracts';
import { AuthRequestError, getCsrfToken } from './auth-api.ts';

export interface PrivatePage<T> { data: T[]; nextCursor: string | null }
async function call<T>(path: string, parse: (body: unknown) => T, signal: AbortSignal, init: RequestInit = {}) {
  const response = await fetch('/api/v1/' + path, { ...init, cache: 'no-store', credentials: 'same-origin',
    signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
  const body: unknown = await response.json();
  if (!response.ok) { errorEnvelopeSchema.parse(body); throw new AuthRequestError(response.status); }
  return parse(body);
}
const parseWorkspace = (body: unknown) => successEnvelopeSchema(workspaceDtoSchema).parse(body).data;
const parseForm = (body: unknown) => successEnvelopeSchema(initialFormDtoSchema).parse(body).data;
const parseWorkspaces = (body: unknown) => workspacePageSchema.parse(body);
const parseForms = (body: unknown) => formPageSchema.parse(body);
const pageQuery = (cursor: string | null) => '?limit=25' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
export const listWorkspaces = (cursor: string | null, signal: AbortSignal) => call('workspaces' + pageQuery(cursor), parseWorkspaces, signal);
export const getWorkspace = (id: string, signal: AbortSignal) => call('workspaces/' + objectIdSchema.parse(id), parseWorkspace, signal);
export const listForms = (id: string, cursor: string | null, signal: AbortSignal) =>
  call('workspaces/' + objectIdSchema.parse(id) + '/forms' + pageQuery(cursor), parseForms, signal);
export const getForm = (id: string, signal: AbortSignal) => call('forms/' + objectIdSchema.parse(id), parseForm, signal);
async function mutate<T>(path: string, body: unknown, parse: (body: unknown) => T, signal: AbortSignal) {
  const { csrfToken } = await getCsrfToken(AbortSignal.any([signal, AbortSignal.timeout(8000)]));
  if (signal.aborted) throw new DOMException('Request canceled.', 'AbortError');
  return call(path, parse, signal, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(body) });
}
export const createWorkspace = (name: string, signal: AbortSignal) =>
  mutate('workspaces', createWorkspaceInputSchema.parse({ name }), parseWorkspace, signal);
export const createForm = (id: string, title: string, signal: AbortSignal) =>
  mutate('workspaces/' + objectIdSchema.parse(id) + '/forms', createFormInputSchema.parse({ title }), parseForm, signal);
