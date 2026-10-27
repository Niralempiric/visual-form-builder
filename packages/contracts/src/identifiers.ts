import { z } from 'zod';

// Validate wire strings before any database lookup; never coerce objects/arrays.
export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/)
  .transform(value => value.toLowerCase());
export const fieldIdSchema = z.uuid();
export const correlationIdSchema = z.uuid({ version: 'v4' });
