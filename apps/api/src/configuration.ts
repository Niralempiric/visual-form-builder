import { z } from 'zod';

export function validAppOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === value && !url.username && !url.password &&
      (url.protocol === 'https:' || (url.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)));
  } catch { return false; }
}

const configurationSchema = z.object({
  APP_ORIGIN: z.string().max(256).refine(validAppOrigin).default('http://127.0.0.1:3000'),
  AUTH_BOOTSTRAP_TOKEN: z.preprocess(value => value === '' ? undefined : value,
    z.string().min(32).max(256).optional()),
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
    APP_ORIGIN: source.APP_ORIGIN,
    AUTH_BOOTSTRAP_TOKEN: source.AUTH_BOOTSTRAP_TOKEN,
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
