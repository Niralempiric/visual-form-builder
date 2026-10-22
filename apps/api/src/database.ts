import mongoose from 'mongoose';
import type { Configuration } from './configuration.js';

export class DatabaseConnectionError extends Error {
  constructor() { super('MongoDB connection failed.'); this.name = 'DatabaseConnectionError'; }
}

export async function connectDatabase(configuration: Configuration) {
  const connection = mongoose.createConnection();
  // Driver error messages/topology may contain credentials. Readiness exposes only a boolean.
  connection.on('error', () => {});
  try {
    await connection.openUri(configuration.MONGODB_URI, {
      replicaSet: configuration.MONGODB_REPLICA_SET,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      heartbeatFrequencyMS: 1000,
      maxPoolSize: 10,
      minPoolSize: 0,
      bufferCommands: false,
      autoIndex: false,
      autoCreate: false,
    });
  } catch {
    await connection.close().catch(() => {});
    throw new DatabaseConnectionError();
  }

  let closing = false;
  const database = {
    async isReady(): Promise<boolean> {
      if (closing || connection.readyState !== 1 || !connection.db) return false;
      try {
        // A ping alone also succeeds on standalone Mongo, which cannot run our transactions.
        const hello = await connection.db.command({ hello: 1 }, { timeoutMS: 1000 });
        return !closing && hello.ok === 1 && hello.isWritablePrimary === true &&
          hello.setName === configuration.MONGODB_REPLICA_SET &&
          typeof hello.logicalSessionTimeoutMinutes === 'number' && hello.maxWireVersion >= 7;
      } catch { return false; }
    },
    async close() { closing = true; await connection.close(); },
  };
  if (!await database.isReady()) {
    await database.close().catch(() => {});
    throw new DatabaseConnectionError();
  }
  return database;
}
