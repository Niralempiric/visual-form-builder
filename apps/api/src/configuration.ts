import { z } from 'zod';

const configurationSchema = z.object({
  API_PORT: z.string().regex(/^\d+$/).default('4000').transform(Number)
    .pipe(z.number().int().min(1).max(65535)),
  MONGODB_URI: z.string().max(4096).regex(/^mongodb(?:\+srv)?:\/\/[^\s]+$/),
  MONGODB_REPLICA_SET: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).default('vfb-rs'),
});

export class ConfigurationError extends Error {
  constructor(fields: string[]) {
    super(`Invalid configuration: ${fields.join(', ')}.`);
    this.name = 'ConfigurationError';
  }
}

export function readConfiguration(source = process.env) {
  const result = configurationSchema.safeParse({
    API_PORT: source.API_PORT,
    MONGODB_URI: source.MONGODB_URI,
    MONGODB_REPLICA_SET: source.MONGODB_REPLICA_SET,
  });
  if (!result.success) {
    // Validation messages and raw values can contain credentials. Report field names only.
    throw new ConfigurationError([...new Set(result.error.issues.map(issue => String(issue.path[0])))].sort());
  }
  return result.data;
}

export type Configuration = ReturnType<typeof readConfiguration>;
