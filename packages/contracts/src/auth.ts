import { z } from 'zod';
import { objectIdSchema } from './identifiers.js';

export const normalizedEmailSchema = z.string().max(254).trim().toLowerCase().pipe(z.email().max(254));
// Never trim, lowercase or silently truncate passwords. Bound bytes before hashing.
export const bootstrapInputSchema = z.strictObject({
  email: normalizedEmailSchema,
  password: z.string().max(128).refine(value => Array.from(value).length >= 15),
});
export const credentialInputSchema = z.strictObject({
  email: normalizedEmailSchema,
  password: z.string().min(1).max(128),
});
export const userDtoSchema = z.strictObject({
  id: objectIdSchema,
  email: normalizedEmailSchema,
  status: z.enum(['active', 'disabled']),
});
export type UserDto = z.infer<typeof userDtoSchema>;
