import { createHash, timingSafeEqual } from 'node:crypto';
import { bootstrapInputSchema, credentialInputSchema } from '@visual-form-builder/contracts';
import { ApiError, parseContract } from '../../http.js';
import { createPasswords } from './passwords.js';
import { createAuthThrottle } from './throttle.js';
import type { UserStore } from './store.js';

export async function createAuthService(store: Pick<UserStore, 'bootstrap' | 'credential'>, bootstrapToken?: string,
  throttle = createAuthThrottle()) {
  const passwords = await createPasswords();
  const digest = (value: string) => createHash('sha256').update(value).digest();
  const expected = bootstrapToken === undefined ? undefined : digest(bootstrapToken);
  return {
    admitAnonymous(network: string) { throttle.network(network); },
    authorizeBootstrap(token: string | undefined, network: string, origin: string | undefined) {
      throttle.network(network);
      // Operator-only request, disabled by default. No browser/CORS signup surface.
      if (!expected || origin !== undefined || !token || token.length > 256 ||
        !timingSafeEqual(expected, digest(token))) throw new ApiError('FORBIDDEN');
    },
    async bootstrap(input: unknown) {
      const value = parseContract(bootstrapInputSchema, input);
      return store.bootstrap(value.email, await passwords.hash(value.password));
    },
    // A credential result alone grants no management access; the HTTP login
    // route must rotate its CSRF-protected pre-session into a stored session.
    async checkCredentials(input: unknown, network: string) {
      throttle.network(network);
      const value = parseContract(credentialInputSchema, input);
      throttle.account(value.email);
      const record = await store.credential(value.email);
      const valid = await passwords.verify(record?.passwordHash, value.password);
      if (!record || !valid || record.dto.status !== 'active') throw new ApiError('UNAUTHENTICATED');
      return record.dto;
    },
  };
}
export type AuthService = Awaited<ReturnType<typeof createAuthService>>;
