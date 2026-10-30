import express from 'express';
import { successEnvelopeSchema, userDtoSchema } from '@visual-form-builder/contracts';
import { readAuthJson } from '../../json.js';
import type { AuthService } from './service.js';

export function createAuthRouter(service: AuthService) {
  const router = express.Router();
  router.post('/auth/bootstrap', async (req, res) => {
    // Before parsing or hashing; trust the socket, never spoofed forwarding headers.
    service.authorizeBootstrap(req.get('X-Bootstrap-Token'), req.socket.remoteAddress ?? 'unknown', req.get('Origin'));
    const data = await service.bootstrap(await readAuthJson(req, res));
    res.status(201).json(successEnvelopeSchema(userDtoSchema).parse({ data, correlationId: res.locals.correlationId }));
  });
  return router;
}
