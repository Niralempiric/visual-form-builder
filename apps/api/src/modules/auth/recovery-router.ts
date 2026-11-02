import express from 'express';
import { recoveryCodesDtoSchema, recoveryDtoSchema, successEnvelopeSchema } from '@visual-form-builder/contracts';
import { readAuthJson } from '../../json.js';
import type { RecoveryService } from './recovery.js';
import type { SessionManager } from './sessions.js';

export function createRecoveryRouter(recovery: RecoveryService, sessions: SessionManager) {
  const router = express.Router();
  router.post('/auth/recovery-codes', async (req, res) => {
    const context = await sessions.mutation(req);
    const data = await recovery.issue(context.user, context.tokenHash, await readAuthJson(req, res), req.socket.remoteAddress ?? 'unknown');
    res.json(successEnvelopeSchema(recoveryCodesDtoSchema).parse({ data, correlationId: res.locals.correlationId }));
  });
  router.post('/auth/recover', async (req, res) => {
    const context = await sessions.loginContext(req);
    const data = await recovery.recover(await readAuthJson(req, res), context.tokenHash, req.socket.remoteAddress ?? 'unknown');
    sessions.clearCookie(res);
    res.json(successEnvelopeSchema(recoveryDtoSchema).parse({ data, correlationId: res.locals.correlationId }));
  });
  return router;
}
