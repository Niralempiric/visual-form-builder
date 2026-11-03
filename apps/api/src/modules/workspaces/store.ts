import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import type { Connection } from 'mongoose';
import { MAX_FORMS_PER_WORKSPACE, formSummaryDtoSchema, initialFormDtoSchema, workspaceDtoSchema } from '@visual-form-builder/contracts';
import type { CursorPosition, MembershipRole } from '@visual-form-builder/contracts';
import { createInitialDraft } from '@visual-form-builder/form-schema';
import { ApiError, encodeCursor } from '../../http.js';
import { workspaceModels } from './models.js';
import type { FormRecord, WorkspaceRecord } from './models.js';

const transactionOptions = { readConcern: { level: 'snapshot' as const }, writeConcern: { w: 'majority' as const }, maxCommitTimeMS: 5000 };
function workspaceDto(record: Pick<WorkspaceRecord, '_id' | 'name' | 'ownerId' | 'state' | 'createdAt' | 'updatedAt'>, role: MembershipRole) {
  return workspaceDtoSchema.parse({ id: String(record._id), name: record.name, ownerId: String(record.ownerId),
    state: record.state, role, createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() });
}
function formDto(record: FormRecord) {
  return initialFormDtoSchema.parse({ id: String(record._id), workspaceId: String(record.workspaceId), publicId: record.publicId,
    title: record.title, draftSchema: record.draftSchema, draftRevision: record.draftRevision,
    currentVersionId: record.currentVersionId, availability: record.availability, acceptedWindows: record.acceptedWindows,
    acceptedCount: record.acceptedCount, retentionDays: record.retentionDays,
    createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString() });
}
async function safe<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && 'code' in error && error.code === 11000) throw new ApiError('CONFLICT');
    throw new ApiError('DEPENDENCY_UNAVAILABLE');
  }
}
export async function createWorkspaceStore(connection: Connection) {
  const { workspaces, memberships, forms } = workspaceModels(connection);
  // Additive startup only: never synchronize/drop existing indexes or records.
  await safe(async () => {
    for (const model of [workspaces, memberships, forms]) {
      await model.createCollection(); await model.createIndexes();
    }
  });
  return {
    async listWorkspaces(userId: string, { limit, after }: { limit: number; after: CursorPosition | null }) {
      return safe(async () => {
        const records = await memberships.aggregate<WorkspaceRecord & { role: MembershipRole }>([
          { $match: { userId: new Types.ObjectId(userId), role: { $in: ['owner', 'editor', 'viewer'] } } },
          { $lookup: { from: 'workspaces', localField: 'workspaceId', foreignField: '_id', as: 'workspace' } },
          { $unwind: '$workspace' },
          { $match: { 'workspace.state': 'active', ...(after ? { $or: [
            { 'workspace.updatedAt': { $lt: new Date(after.at) } },
            { 'workspace.updatedAt': new Date(after.at), 'workspace._id': { $lt: new Types.ObjectId(after.id) } },
          ] } : {}) } },
          { $sort: { 'workspace.updatedAt': -1, 'workspace._id': -1 } },
          { $limit: limit + 1 },
          { $project: { _id: '$workspace._id', name: '$workspace.name', ownerId: '$workspace.ownerId',
            state: '$workspace.state', role: 1, createdAt: '$workspace.createdAt', updatedAt: '$workspace.updatedAt' } },
        ]).option({ maxTimeMS: 1000 });
        const page = records.slice(0, limit), last = page.at(-1);
        return { data: page.map(record => workspaceDto(record, record.role)),
          nextCursor: records.length > limit && last ? encodeCursor({ v: 1, at: last.updatedAt.toISOString(), id: String(last._id) }) : null };
      });
    },
    async listForms(userId: string, workspaceId: string, { limit, after }: { limit: number; after: CursorPosition | null }) {
      return safe(async () => {
        const member = await memberships.findOne({ userId, workspaceId, role: { $in: ['owner', 'editor', 'viewer'] } }).lean().maxTimeMS(1000);
        if (!member || !await workspaces.exists({ _id: workspaceId, state: 'active' }).maxTimeMS(1000)) throw new ApiError('NOT_FOUND');
        const records = await forms.find({ workspaceId, availability: { $ne: 'deleting' }, ...(after ? { $or: [
          { updatedAt: { $lt: new Date(after.at) } },
          { updatedAt: new Date(after.at), _id: { $lt: new Types.ObjectId(after.id) } },
        ] } : {}) }).select('_id workspaceId title availability draftRevision updatedAt').sort({ updatedAt: -1, _id: -1 })
          .limit(limit + 1).lean().maxTimeMS(1000);
        const page = records.slice(0, limit), last = page.at(-1);
        return { data: page.map(record => formSummaryDtoSchema.parse({ id: String(record._id), workspaceId: String(record.workspaceId),
          title: record.title, availability: record.availability, draftRevision: record.draftRevision, updatedAt: record.updatedAt.toISOString() })),
          nextCursor: records.length > limit && last ? encodeCursor({ v: 1, at: last.updatedAt.toISOString(), id: String(last._id) }) : null };
      });
    },
    async createWorkspace(userId: string, name: string) {
      return safe(() => connection.transaction(async session => {
        const active = await connection.collection('users').findOne({ _id: new Types.ObjectId(userId), status: 'active' },
          { session, maxTimeMS: 1000, projection: { _id: 1 } });
        if (!active) throw new ApiError('UNAUTHENTICATED');
        const workspace = await new workspaces({ name, ownerId: userId }).save({ session });
        await new memberships({ workspaceId: workspace._id, userId, role: 'owner' }).save({ session });
        return workspaceDto(workspace, 'owner');
      }, transactionOptions));
    },
    async workspace(userId: string, workspaceId: string) {
      return safe(async () => {
        const member = await memberships.findOne({ userId, workspaceId, role: { $in: ['owner', 'editor', 'viewer'] } }).lean().maxTimeMS(1000);
        if (!member) throw new ApiError('NOT_FOUND');
        const workspace = await workspaces.findOne({ _id: workspaceId, state: 'active' }).lean().maxTimeMS(1000);
        if (!workspace) throw new ApiError('NOT_FOUND');
        return workspaceDto(workspace, member.role);
      });
    },
    async createForm(userId: string, workspaceId: string, title: string) {
      return safe(() => connection.transaction(async session => {
        const member = await memberships.findOne({ userId, workspaceId, role: 'owner' }).session(session).lean().maxTimeMS(1000);
        if (!member) throw new ApiError('NOT_FOUND');
        // The write serializes concurrent create/count checks for this workspace.
        const workspace = await workspaces.findOneAndUpdate({ _id: workspaceId, ownerId: userId, state: 'active' },
          { $inc: { formSequence: 1 } }, { session, returnDocument: 'after', maxTimeMS: 1000 });
        if (!workspace) throw new ApiError('NOT_FOUND');
        const count = await forms.countDocuments({ workspaceId, availability: { $ne: 'deleting' } }).session(session).maxTimeMS(1000);
        if (count >= MAX_FORMS_PER_WORKSPACE) throw new ApiError('CONFLICT');
        const form = await new forms({ workspaceId, publicId: randomUUID(), title, draftSchema: createInitialDraft(title) }).save({ session });
        return formDto(form);
      }, transactionOptions));
    },
    async form(userId: string, formId: string) {
      return safe(async () => {
        // Tenant membership and active-workspace predicates are part of this read.
        // A private/public form ID alone never grants author access.
        const records = await forms.aggregate<FormRecord>([
          { $match: { _id: new Types.ObjectId(formId) } },
          { $lookup: { from: 'memberships', localField: 'workspaceId', foreignField: 'workspaceId',
            pipeline: [{ $match: { userId: new Types.ObjectId(userId), role: { $in: ['owner', 'editor', 'viewer'] } } },
              { $project: { _id: 1 } }, { $limit: 1 }], as: 'membershipAccess' } },
          { $match: { 'membershipAccess.0': { $exists: true } } },
          { $lookup: { from: 'workspaces', localField: 'workspaceId', foreignField: '_id',
            pipeline: [{ $match: { state: 'active' } }, { $project: { _id: 1 } }], as: 'workspaceAccess' } },
          { $match: { 'workspaceAccess.0': { $exists: true } } },
          { $project: { membershipAccess: 0, workspaceAccess: 0 } },
        ]).option({ maxTimeMS: 1000 });
        const record = records[0];
        if (!record) throw new ApiError('NOT_FOUND');
        return formDto(record);
      });
    },
  };
}
export type WorkspaceStore = Awaited<ReturnType<typeof createWorkspaceStore>>;
