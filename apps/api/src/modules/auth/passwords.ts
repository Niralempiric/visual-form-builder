import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
import { ApiError } from '../../http.js';

// OWASP Argon2id minimum: 19 MiB, two iterations, one lane; library supplies salts.
export const passwordOptions = { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export async function createPasswords() {
  const dummy = await hash(randomBytes(32), passwordOptions);
  let active = 0;
  async function bounded<T>(operation: () => Promise<T>): Promise<T> {
    // Reject excess work instead of building an unbounded native-worker queue.
    if (active >= 4) throw new ApiError('RATE_LIMITED');
    active++;
    try { return await operation(); } finally { active--; }
  }
  return {
    hash(password: string) { return bounded(() => hash(password, passwordOptions)); },
    verify(passwordHash: string | undefined, password: string) {
      return bounded(async () => {
        // Missing accounts still perform the same expensive algorithm.
        try { return await verify(passwordHash ?? dummy, password); }
        catch { throw new ApiError('DEPENDENCY_UNAVAILABLE'); }
      });
    },
  };
}
