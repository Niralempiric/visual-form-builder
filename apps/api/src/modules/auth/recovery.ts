import { createHash, randomBytes } from 'node:crypto';
import { recoveryCodesInputSchema, recoveryInputSchema } from '@visual-form-builder/contracts';
import type { UserDto } from '@visual-form-builder/contracts';
import { ApiError, parseContract } from '../../http.js';
import { createPasswords } from './passwords.js';
import { createAuthThrottle } from './throttle.js';
import type { AuthService } from './service.js';
import type { UserStore } from './store.js';

export const recoveryHash = (code: string) => createHash('sha256').update('vfb-recovery\0').update(code).digest('hex');

export async function createRecoveryService(store: Pick<UserStore, 'replaceRecoveryCodes' | 'recover'>, auth: AuthService,
  throttle = createAuthThrottle(), now: () => Date = () => new Date()) {
  const passwords = await createPasswords();
  return {
    async issue(user: UserDto, sessionHash: string, input: unknown, network: string) {
      const value = parseContract(recoveryCodesInputSchema, input);
      const proof = await auth.loginCredential({ email: user.email, password: value.password }, network);
      if (proof.dto.id !== user.id) throw new ApiError('UNAUTHENTICATED');
      const codes = Array.from({ length: 5 }, () => randomBytes(32).toString('base64url'));
      await store.replaceRecoveryCodes(user.id, proof.passwordHash, codes.map(recoveryHash), sessionHash, now());
      return { codes };
    },
    async recover(input: unknown, sessionHash: string, network: string) {
      throttle.network(network);
      const value = parseContract(recoveryInputSchema, input);
      throttle.account(value.email);
      // All well-formed attempts hash a new password before the guarded lookup;
      // missing/disabled accounts and wrong/used codes share the same safe error.
      const hash = await passwords.hash(value.newPassword);
      await store.recover(value.email, recoveryHash(value.code), hash, sessionHash, now());
      return { recovered: true as const };
    },
  };
}
export type RecoveryService = Awaited<ReturnType<typeof createRecoveryService>>;
