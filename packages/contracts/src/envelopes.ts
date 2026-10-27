import { z } from 'zod';
import { correlationIdSchema, fieldIdSchema } from './identifiers.js';

// Public messages are selected by code, never copied from exceptions or inputs.
export const apiErrors = {
  MALFORMED_REQUEST: { status: 400, message: 'The request is malformed.' },
  UNAUTHENTICATED: { status: 401, message: 'Sign in to continue.' },
  FORBIDDEN: { status: 403, message: 'This action is not allowed.' },
  NOT_FOUND: { status: 404, message: 'The requested resource was not found.' },
  CONFLICT: { status: 409, message: 'The request conflicts with the current state.' },
  CONTEXT_EXPIRED: { status: 409, message: 'This form context expired. Reload the form.' },
  FORM_CLOSED: { status: 410, message: 'This form is closed.' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'The request is too large.' },
  ANSWER_INVALID: { status: 422, message: 'Check the indicated answers.' },
  RATE_LIMITED: { status: 429, message: 'Too many requests. Try again later.' },
  DEPENDENCY_UNAVAILABLE: { status: 503, message: 'The service is temporarily unavailable.' },
  INTERNAL_ERROR: { status: 500, message: 'An unexpected error occurred.' },
} as const;
export type ApiErrorCode = keyof typeof apiErrors;
export const apiErrorCodeSchema = z.enum(Object.keys(apiErrors) as [ApiErrorCode, ...ApiErrorCode[]]);
export const fieldErrorSchema = z.strictObject({
  fieldId: fieldIdSchema,
  message: z.enum(['This answer is required.', 'This answer is invalid.', 'Select an allowed option.']),
});
export const fieldErrorsSchema = z.array(fieldErrorSchema).min(1).max(50);
export type FieldError = z.infer<typeof fieldErrorSchema>;

export const errorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string(),
    fieldErrors: fieldErrorsSchema.optional(),
  }),
  correlationId: correlationIdSchema,
}).superRefine((value, context) => {
  if (value.error.message !== apiErrors[value.error.code].message ||
      (value.error.fieldErrors !== undefined && value.error.code !== 'ANSWER_INVALID')) {
    context.addIssue({ code: 'custom', message: 'Invalid error contract.' });
  }
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

// Endpoint-specific allowlisted DTO schemas supply the payload contract.
export function successEnvelopeSchema<T extends z.ZodType>(data: T) {
  return z.strictObject({ data, correlationId: correlationIdSchema });
}
