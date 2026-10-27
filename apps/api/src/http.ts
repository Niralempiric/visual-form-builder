import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { z } from 'zod';
import {
  apiErrors, apiErrorCodeSchema, correlationIdSchema, cursorSchema, cursorPositionSchema,
  errorEnvelopeSchema, fieldErrorsSchema, paginationQuerySchema,
} from '@visual-form-builder/contracts';
import type { ApiErrorCode, CursorPosition, FieldError } from '@visual-form-builder/contracts';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly fieldErrors: FieldError[] | undefined;

  constructor(code: ApiErrorCode, fieldErrors?: FieldError[]) {
    super(apiErrors[code].message);
    this.name = 'ApiError';
    this.code = code;
    this.fieldErrors = fieldErrors === undefined ? undefined : fieldErrorsSchema.parse(fieldErrors);
    if (this.fieldErrors !== undefined && code !== 'ANSWER_INVALID') {
      throw new Error('Field errors require an answer validation error.');
    }
  }
}

export function parseContract<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiError('MALFORMED_REQUEST');
  return result.data;
}

export const correlation: RequestHandler = (request, response, next) => {
  const supplied = correlationIdSchema.safeParse(request.get('X-Correlation-ID'));
  const id = supplied.success ? supplied.data : randomUUID();
  response.locals.correlationId = id;
  response.set('X-Correlation-ID', id);
  response.set('Cache-Control', 'no-store');
  next();
};

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new ApiError('NOT_FOUND'));
};

export const apiErrorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (response.headersSent) { response.destroy(); return; }
  response.set('Cache-Control', 'no-store');
  // Never serialize raw exceptions, Zod issues, URLs, database errors or input.
  const known = error instanceof ApiError ? apiErrorCodeSchema.safeParse(error.code) : null;
  let code: ApiErrorCode = known?.success ? known.data :
    error instanceof URIError ? 'MALFORMED_REQUEST' : 'INTERNAL_ERROR';
  const candidate = errorEnvelopeSchema.safeParse({
    error: {
      code, message: apiErrors[code].message,
      ...(error instanceof ApiError && error.fieldErrors !== undefined ? { fieldErrors: error.fieldErrors } : {}),
    },
    correlationId: response.locals.correlationId,
  });
  if (candidate.success) {
    response.status(apiErrors[code].status).json(candidate.data);
  } else {
    code = 'INTERNAL_ERROR';
    // Even invalid internal error details receive a safe, bounded response.
    const id = correlationIdSchema.safeParse(response.locals.correlationId);
    const correlationId = id.success ? id.data : randomUUID();
    response.set('X-Correlation-ID', correlationId).status(apiErrors[code].status).json({
      error: { code, message: apiErrors[code].message }, correlationId,
    });
  }
};

export function encodeCursor(position: CursorPosition): string {
  const value = cursorPositionSchema.parse(position);
  return cursorSchema.parse(Buffer.from(JSON.stringify(value), 'utf8').toString('base64url'));
}

export function parsePagination(query: unknown): { limit: number; after: CursorPosition | null } {
  const value = parseContract(paginationQuerySchema, query);
  if (value.cursor === undefined) return { limit: value.limit, after: null };
  try {
    const bytes = Buffer.from(value.cursor, 'base64url');
    if (bytes.toString('base64url') !== value.cursor) throw new Error('Noncanonical token.');
    const position = cursorPositionSchema.parse(JSON.parse(bytes.toString('utf8')));
    return { limit: value.limit, after: position };
  } catch {
    throw new ApiError('MALFORMED_REQUEST');
  }
}
