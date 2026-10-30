import express from 'express';
import { successEnvelopeSchema, userDtoSchema } from '@visual-form-builder/contracts';
import { ApiError } from '../../http.js';
import type { AuthService } from './service.js';

export function createAuthRouter(service: AuthService) {
  const router = express.Router();
  const json = express.json({ limit: '8kb', strict: true, inflate: false });
  router.post('/auth/bootstrap', (req, _res, next) => {
    // Before parsing or hashing; trust the socket, never spoofed forwarding headers.
    service.authorizeBootstrap(req.get('X-Bootstrap-Token'), req.socket.remoteAddress ?? 'unknown', req.get('Origin'));
    if (!req.is('application/json')) throw new ApiError('MALFORMED_REQUEST');
    next();
  }, (req, res, next) => {
    json(req, res, (error: unknown) => {
      if (error) {
        const oversized = error instanceof Error && 'type' in error && error.type === 'entity.too.large';
        next(new ApiError(oversized ? 'PAYLOAD_TOO_LARGE' : 'MALFORMED_REQUEST'));
      } else next();
    });
  }, async (req, res) => {
    const data = await service.bootstrap(req.body);
    res.status(201).json(successEnvelopeSchema(userDtoSchema).parse({ data, correlationId: res.locals.correlationId }));
  });
  return router;
}
