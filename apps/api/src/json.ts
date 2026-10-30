import express from 'express';
import type { Request, Response } from 'express';
import { ApiError } from './http.js';

const parser = express.json({ limit: '8kb', strict: true, inflate: false });
export async function readAuthJson(request: Request, response: Response): Promise<unknown> {
  if (!request.is('application/json')) throw new ApiError('MALFORMED_REQUEST');
  await new Promise<void>((resolve, reject) => parser(request, response, (error: unknown) => {
    if (!error) { resolve(); return; }
    const oversized = error instanceof Error && 'type' in error && error.type === 'entity.too.large';
    reject(new ApiError(oversized ? 'PAYLOAD_TOO_LARGE' : 'MALFORMED_REQUEST'));
  }));
  return request.body;
}
