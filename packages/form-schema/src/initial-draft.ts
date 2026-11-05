import { z } from 'zod';

export const draftTitleSchema = z.string().trim().min(1).max(160);
// Canonical empty creation contract; general structure is validated separately.
export const initialDraftSchema = z.strictObject({
  schemaFormatVersion: z.literal(1),
  title: draftTitleSchema,
  description: z.literal(''),
  steps: z.tuple([]),
  fields: z.tuple([]),
  visibilityRules: z.tuple([]),
  theme: z.strictObject({ preset: z.literal('neutral') }),
});
export type InitialDraft = z.infer<typeof initialDraftSchema>;
export function createInitialDraft(title: string): InitialDraft {
  return initialDraftSchema.parse({ schemaFormatVersion: 1, title, description: '',
    steps: [], fields: [], visibilityRules: [], theme: { preset: 'neutral' } });
}
