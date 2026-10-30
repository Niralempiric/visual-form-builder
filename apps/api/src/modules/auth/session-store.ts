import { Schema, Types } from 'mongoose';
import type { Connection, Model } from 'mongoose';
import { ApiError } from '../../http.js';

export interface SessionRecord {
  tokenHash: string;
  userId: Types.ObjectId | null;
  csrfSecret: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export async function createSessionStore(connection: Connection) {
  const schema = new Schema<SessionRecord>({
    tokenHash: { type: String, required: true, select: false, match: /^[a-f0-9]{64}$/ },
    userId: { type: Schema.Types.ObjectId, default: null },
    csrfSecret: { type: String, required: true, select: false, match: /^[A-Za-z0-9_-]{43}$/ },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  }, { collection: 'sessions', strict: 'throw', bufferCommands: false });
  schema.index({ tokenHash: 1 }, { unique: true });
  schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  schema.set('toJSON', { transform(_doc, value) {
    Reflect.deleteProperty(value, 'tokenHash');
    Reflect.deleteProperty(value, 'csrfSecret');
    return value;
  } });
  const sessions: Model<SessionRecord> = (connection.models.AuthorSession as Model<SessionRecord> | undefined) ??
    connection.model<SessionRecord>('AuthorSession', schema);
  async function safe<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('DEPENDENCY_UNAVAILABLE'); }
  }
  await safe(async () => { await sessions.createCollection(); await sessions.createIndexes(); });
  const eligible = (tokenHash: string, now: Date) => ({ tokenHash, revokedAt: null, expiresAt: { $gt: now } });
  return {
    async find(tokenHash: string, now: Date): Promise<Omit<SessionRecord, 'tokenHash'> | null> {
      return safe(() => sessions.findOne(eligible(tokenHash, now)).select('+csrfSecret').lean().maxTimeMS(1000).exec());
    },
    async insert(record: SessionRecord) {
      await safe(async () => { await new sessions(record).save({ w: 'majority' }); });
    },
    async rotate(oldHash: string, record: SessionRecord, now: Date) {
      await safe(() => connection.transaction(async session => {
        const result = await sessions.updateOne(eligible(oldHash, now), { $set: { revokedAt: now } }, { session, maxTimeMS: 1000 });
        if (result.modifiedCount !== 1) throw new ApiError('UNAUTHENTICATED');
        await new sessions(record).save({ session });
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000 }));
    },
    async revoke(tokenHash: string, now: Date) {
      await safe(async () => {
        const result = await sessions.updateOne(eligible(tokenHash, now), { $set: { revokedAt: now } },
          { writeConcern: { w: 'majority' }, maxTimeMS: 1000 });
        if (result.modifiedCount !== 1) throw new ApiError('UNAUTHENTICATED');
      });
    },
  };
}
export type SessionStore = Awaited<ReturnType<typeof createSessionStore>>;
