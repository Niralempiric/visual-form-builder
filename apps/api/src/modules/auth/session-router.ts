import express from 'express';
import { csrfDtoSchema, logoutDtoSchema, logoutInputSchema, successEnvelopeSchema, userDtoSchema } from '@visual-form-builder/contracts';
import { parseContract } from '../../http.js';
import { readAuthJson } from '../../json.js';
import type { AuthService } from './service.js';
import type { SessionManager } from './sessions.js';

export function createSessionRouter(auth: AuthService, sessions: SessionManager) {
  const router = express.Router();
  router.get('/auth/csrf', async (req, res) => {
    const csrfToken = await sessions.csrf(req, res, () => auth.admitAnonymous(req.socket.remoteAddress ?? 'unknown'));
    res.json(successEnvelopeSchema(csrfDtoSchema).parse({ data: { csrfToken }, correlationId: res.locals.correlationId }));
  });
  router.get('/auth/me', async (req, res) => {
    const { user } = await sessions.author(req);
    res.json(successEnvelopeSchema(userDtoSchema).parse({ data: user, correlationId: res.locals.correlationId }));
  });
  router.post('/auth/login', async (req, res) => {
    const context = await sessions.loginContext(req);
    const user = await auth.checkCredentials(await readAuthJson(req, res), req.socket.remoteAddress ?? 'unknown');
    await sessions.signIn(res, context.tokenHash, user);
    res.json(successEnvelopeSchema(userDtoSchema).parse({ data: user, correlationId: res.locals.correlationId }));
  });
  router.post('/auth/logout', async (req, res) => {
    const context = await sessions.mutation(req);
    parseContract(logoutInputSchema, await readAuthJson(req, res));
    await sessions.signOut(res, context.tokenHash);
    res.json(successEnvelopeSchema(logoutDtoSchema).parse({ data: { signedOut: true }, correlationId: res.locals.correlationId }));
  });
  return router;
}
