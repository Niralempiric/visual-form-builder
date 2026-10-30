import { csrfDtoSchema, errorEnvelopeSchema, logoutDtoSchema, successEnvelopeSchema, userDtoSchema } from '@visual-form-builder/contracts';

export class AuthRequestError extends Error {
  constructor(readonly status: number) { super('Account request failed.'); }
}

async function call<T>(path: string, parse: (body: unknown) => T, init: RequestInit = {}) {
  const response = await fetch('/api/v1/auth/' + path, { ...init, cache: 'no-store', credentials: 'same-origin',
    signal: init.signal ?? AbortSignal.timeout(8000) });
  const body: unknown = await response.json();
  if (!response.ok) {
    // Validate the public error contract; never render arbitrary server text.
    errorEnvelopeSchema.parse(body);
    throw new AuthRequestError(response.status);
  }
  return parse(body);
}
const parseUser = (body: unknown) => successEnvelopeSchema(userDtoSchema).parse(body).data;
const parseCsrf = (body: unknown) => successEnvelopeSchema(csrfDtoSchema).parse(body).data;
const parseLogout = (body: unknown) => successEnvelopeSchema(logoutDtoSchema).parse(body).data;

export const getAuthor = (signal?: AbortSignal) => call('me', parseUser, signal ? { signal } : {});
export async function authMutation(action: 'login' | 'logout', body: unknown) {
  const { csrfToken } = await call('csrf', parseCsrf);
  const init = { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(body) };
  if (action === 'login') return call('login', parseUser, init);
  return call('logout', parseLogout, init);
}
