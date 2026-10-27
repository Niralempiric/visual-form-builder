import { z } from 'zod';
import { correlationIdSchema, objectIdSchema } from './identifiers.js';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
// Opaque, non-secret base64url token. The server also validates its decoded shape.
export const cursorSchema = z.string().min(1).max(256).regex(/^[A-Za-z0-9_-]+$/);
export const cursorPositionSchema = z.strictObject({
  v: z.literal(1),
  at: z.iso.datetime({ precision: 3 }),
  id: objectIdSchema,
});
export type CursorPosition = z.infer<typeof cursorPositionSchema>;

export const paginationQuerySchema = z.strictObject({
  limit: z.string().regex(/^[1-9][0-9]{0,2}$/).transform(Number)
    .pipe(z.number().int().min(1).max(MAX_PAGE_SIZE)).default(DEFAULT_PAGE_SIZE),
  cursor: cursorSchema.optional(),
});

export function pageEnvelopeSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({
    data: z.array(item).max(MAX_PAGE_SIZE),
    nextCursor: cursorSchema.nullable(),
    correlationId: correlationIdSchema,
  });
}
