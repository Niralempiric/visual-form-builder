import { Schema } from 'mongoose';
import type { Connection, Model, Types } from 'mongoose';
import { initialDraftSchema } from '@visual-form-builder/form-schema';
import type { InitialDraft } from '@visual-form-builder/form-schema';
import type { MembershipRole } from '@visual-form-builder/contracts';

interface Timestamps { createdAt: Date; updatedAt: Date }
export interface WorkspaceRecord extends Timestamps {
  _id: Types.ObjectId; name: string; ownerId: Types.ObjectId; state: 'active' | 'deleting'; formSequence: number;
}
export interface MembershipRecord extends Timestamps {
  _id: Types.ObjectId; workspaceId: Types.ObjectId; userId: Types.ObjectId; role: MembershipRole;
}
export interface FormRecord extends Timestamps {
  _id: Types.ObjectId; workspaceId: Types.ObjectId; publicId: string; title: string;
  draftSchema: InitialDraft; draftRevision: number; currentVersionId: Types.ObjectId | null;
  availability: 'draft' | 'open' | 'closed' | 'deleting'; acceptedWindows: never[]; acceptedCount: number; retentionDays: number;
}
export function workspaceModels(connection: Connection) {
  const options = { strict: 'throw', timestamps: true, bufferCommands: false, versionKey: false } as const;
  const workspaceSchema = new Schema<WorkspaceRecord>({
    name: { type: String, required: true, maxlength: 80 },
    ownerId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    state: { type: String, enum: ['active', 'deleting'], default: 'active', required: true },
    // Serialize form admission/count checks without caching a drifting form count.
    formSequence: { type: Number, default: 0, min: 0, select: false },
  }, { ...options, collection: 'workspaces' });
  const membershipSchema = new Schema<MembershipRecord>({
    workspaceId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    userId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    role: { type: String, enum: ['owner', 'editor', 'viewer'], required: true },
  }, { ...options, collection: 'memberships' });
  membershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
  membershipSchema.index({ userId: 1, workspaceId: 1 });
  const formSchema = new Schema<FormRecord>({
    workspaceId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    publicId: { type: String, required: true, immutable: true },
    title: { type: String, required: true, maxlength: 160 },
    // Mixed is bounded by the same strict shared empty-schema validator, not arbitrary JSON.
    draftSchema: { type: Schema.Types.Mixed, required: true, validate: (value: unknown) => initialDraftSchema.safeParse(value).success },
    draftRevision: { type: Number, default: 0, min: 0, max: 0, required: true },
    currentVersionId: { type: Schema.Types.ObjectId, default: null, validate: (value: unknown) => value === null },
    availability: { type: String, enum: ['draft', 'open', 'closed', 'deleting'], default: 'draft', required: true },
    acceptedWindows: { type: [String], default: [], validate: (value: unknown[]) => value.length === 0 },
    acceptedCount: { type: Number, default: 0, min: 0, max: 0, required: true },
    retentionDays: { type: Number, enum: [30], default: 30, required: true },
  }, { ...options, collection: 'forms' });
  formSchema.index({ publicId: 1 }, { unique: true });
  formSchema.index({ workspaceId: 1, updatedAt: -1, _id: -1 });
  const workspaces: Model<WorkspaceRecord> = (connection.models.Workspace as Model<WorkspaceRecord> | undefined) ?? connection.model<WorkspaceRecord>('Workspace', workspaceSchema);
  const memberships: Model<MembershipRecord> = (connection.models.WorkspaceMembership as Model<MembershipRecord> | undefined) ?? connection.model<MembershipRecord>('WorkspaceMembership', membershipSchema);
  const forms: Model<FormRecord> = (connection.models.Form as Model<FormRecord> | undefined) ?? connection.model<FormRecord>('Form', formSchema);
  return { workspaces, memberships, forms };
}
