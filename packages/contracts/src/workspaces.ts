import { z } from 'zod';
import { draftTitleSchema, initialDraftSchema } from '@visual-form-builder/form-schema';
import { objectIdSchema } from './identifiers.js';

export const MAX_FORMS_PER_WORKSPACE = 25;
export const membershipRoleSchema = z.enum(['owner', 'editor', 'viewer']);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export const createWorkspaceInputSchema = z.strictObject({ name: z.string().trim().min(1).max(80) });
export const createFormInputSchema = z.strictObject({ title: draftTitleSchema });
export const workspaceParamsSchema = z.strictObject({ workspaceId: objectIdSchema });
export const formParamsSchema = z.strictObject({ formId: objectIdSchema });
export const workspaceDtoSchema = z.strictObject({
  id: objectIdSchema, name: createWorkspaceInputSchema.shape.name,
  ownerId: objectIdSchema, state: z.literal('active'), role: membershipRoleSchema,
  createdAt: z.iso.datetime({ precision: 3 }), updatedAt: z.iso.datetime({ precision: 3 }),
});
export const initialFormDtoSchema = z.strictObject({
  id: objectIdSchema, workspaceId: objectIdSchema, publicId: z.uuid({ version: 'v4' }),
  title: draftTitleSchema, draftSchema: initialDraftSchema, draftRevision: z.literal(0),
  currentVersionId: z.null(), availability: z.literal('draft'),
  acceptedWindows: z.tuple([]), acceptedCount: z.literal(0), retentionDays: z.literal(30),
  createdAt: z.iso.datetime({ precision: 3 }), updatedAt: z.iso.datetime({ precision: 3 }),
});
export type WorkspaceDto = z.infer<typeof workspaceDtoSchema>;
export type InitialFormDto = z.infer<typeof initialFormDtoSchema>;
