import { expect, test } from 'vitest';
import { recoveryCodesDtoSchema, recoveryCodesInputSchema, recoveryInputSchema } from '@visual-form-builder/contracts';
import { ApiError } from '../../apps/api/src/http.js';
import { createAuthService } from '../../apps/api/src/modules/auth/service.js';
import { createRecoveryService, recoveryHash } from '../../apps/api/src/modules/auth/recovery.js';

const email = 'recovery@example.test';
const password = 'Synthetic recovery passphrase 123!';
const code = 'a'.repeat(43);
const authStore = { async bootstrap() { throw new Error('Unexpected bootstrap.'); }, async credential() { return undefined; } };

test('recovery contracts bound secrets, passwords, keys and the intentionally one-time code DTO', () => {
  expect(recoveryInputSchema.parse({ email: ' RECOVERY@example.test ', code, newPassword: password }).email).toBe(email);
  for (const input of [
    { email: { $ne: null }, code, newPassword: password }, { email, code: 'a'.repeat(42), newPassword: password },
    { email, code: 'a'.repeat(44), newPassword: password }, { email, code: '/'.repeat(43), newPassword: password },
    { email, code, newPassword: '😀'.repeat(8) }, { email, code, newPassword: 'x'.repeat(129) },
    { email, code, newPassword: password, recoveryHashes: [] },
  ]) expect(recoveryInputSchema.safeParse(input).success).toBe(false);
  expect(recoveryCodesInputSchema.safeParse({ password, email }).success).toBe(false);
  expect(recoveryCodesDtoSchema.safeParse({ codes: Array(5).fill(code) }).success).toBe(true);
  expect(recoveryCodesDtoSchema.safeParse({ codes: Array(6).fill(code) }).success).toBe(false);
  expect(recoveryHash(code)).toMatch(/^[a-f0-9]{64}$/);
  expect(recoveryHash(code).includes(code)).toBe(false);
});

test('recovery admission is bounded before new-password hashing and missing-account results stay generic', async () => {
  let calls = 0;
  const service = await createRecoveryService({
    async replaceRecoveryCodes() { throw new Error('Unexpected issuance.'); },
    async recover(_email, codeHash, passwordHash) {
      calls++;
      expect(codeHash === recoveryHash(code)).toBe(true);
      expect(passwordHash.startsWith('$argon2id$')).toBe(true);
      throw new ApiError('UNAUTHENTICATED');
    },
  }, await createAuthService(authStore));
  for (let i = 0; i < 5; i++) await expect(service.recover({ email, code, newPassword: password }, 'private-session-hash', 'network-' + i))
    .rejects.toMatchObject({ code: 'UNAUTHENTICATED', message: 'Sign in to continue.' });
  await expect(service.recover({ email: ' RECOVERY@example.test ', code, newPassword: password }, 'private-session-hash', 'another-network'))
    .rejects.toMatchObject({ code: 'RATE_LIMITED' });
  expect(calls).toBe(5);
});
