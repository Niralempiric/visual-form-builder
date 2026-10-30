import { Schema } from 'mongoose';
import type { Connection, Model, Types } from 'mongoose';
import { userDtoSchema } from '@visual-form-builder/contracts';
import { ApiError } from '../../http.js';

interface UserRecord {
  _id: Types.ObjectId;
  normalizedEmail: string;
  passwordHash: string;
  recoveryHashes: string[];
  status: 'active' | 'disabled';
}

export async function createUserStore(connection: Connection) {
  const schema = new Schema<UserRecord>({
    normalizedEmail: { type: String, required: true, immutable: true },
    passwordHash: { type: String, required: true, select: false },
    recoveryHashes: { type: [String], default: [], select: false },
    status: { type: String, enum: ['active', 'disabled'], required: true, default: 'active' },
  }, { collection: 'users', strict: 'throw', timestamps: true, bufferCommands: false });
  schema.index({ normalizedEmail: 1 }, { unique: true });
  // Defense in depth; all public paths also construct and validate explicit DTOs.
  schema.set('toJSON', { transform(_doc, value) {
    Reflect.deleteProperty(value, 'passwordHash');
    Reflect.deleteProperty(value, 'recoveryHashes');
    return value;
  } });
  const users: Model<UserRecord> = (connection.models.User as Model<UserRecord> | undefined) ?? connection.model<UserRecord>('User', schema);
  const marker = (connection.models.AuthBootstrap as Model<{ _id: string }> | undefined) ?? connection.model('AuthBootstrap',
    new Schema<{ _id: string }>({ _id: String }, { collection: 'authBootstrap', bufferCommands: false }));
  try {
    // Explicit, additive setup; never sync/drop pre-existing indexes or data.
    await users.createCollection();
    await users.createIndexes();
    await marker.createCollection();
  } catch { throw new ApiError('DEPENDENCY_UNAVAILABLE'); }
  return {
    async bootstrap(email: string, passwordHash: string) {
      try {
        return await connection.transaction(async session => {
          // Unique permanent marker serializes competing first-account attempts.
          await marker.create([{ _id: 'first-author' }], { session });
          if (await users.exists({}).session(session).maxTimeMS(1000)) throw new ApiError('CONFLICT');
          const user = await new users({ normalizedEmail: email, passwordHash }).save({ session });
          if (!user) throw new ApiError('INTERNAL_ERROR');
          return userDtoSchema.parse({ id: String(user._id), email: user.normalizedEmail, status: user.status });
        }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000 });
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof Error && 'code' in error && error.code === 11000) throw new ApiError('CONFLICT');
        throw new ApiError('DEPENDENCY_UNAVAILABLE');
      }
    },
    async credential(email: string) {
      try {
        const user = await users.findOne({ normalizedEmail: email }).select('+passwordHash').lean().maxTimeMS(1000);
        if (!user) return undefined;
        return { dto: userDtoSchema.parse({ id: String(user._id), email: user.normalizedEmail, status: user.status }),
          passwordHash: String(user.passwordHash) };
      } catch { throw new ApiError('DEPENDENCY_UNAVAILABLE'); }
    },
  };
}
export type UserStore = Awaited<ReturnType<typeof createUserStore>>;
