import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Types } from 'mongoose';
import type { CookieOptions, Request, Response } from 'express';
import { opaqueTokenSchema } from '@visual-form-builder/contracts';
import type { UserDto } from '@visual-form-builder/contracts';
import { validAppOrigin } from '../../configuration.js';
import { ApiError } from '../../http.js';
import type { SessionRecord, SessionStore } from './session-store.js';
import type { UserStore } from './store.js';

export const sessionLifetime = 24 * 60 * 60 * 1000;
export const preSessionLifetime = 10 * 60 * 1000;
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export function readSessionCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  if (header.length > 8192) throw new ApiError('MALFORMED_REQUEST');
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  if (matches.length > 1) throw new ApiError('MALFORMED_REQUEST');
  const value = matches[0]?.slice(name.length + 1);
  return opaqueTokenSchema.safeParse(value).success ? value : undefined;
}

export function createSessionManager(store: SessionStore, users: Pick<UserStore, 'active'>,
  origin: string, now: () => Date = () => new Date()) {
  if (!validAppOrigin(origin)) throw new Error('Invalid application origin.');
  const secure = new URL(origin).protocol === 'https:';
  const cookieName = secure ? '__Host-vfb_session' : 'vfb_session';
  const cookieOptions: CookieOptions = { httpOnly: true, secure, sameSite: 'strict', path: '/' };
  function fresh(userId: string | null) {
    const token = randomBytes(32).toString('base64url');
    const record: SessionRecord = { tokenHash: tokenHash(token),
      userId: userId === null ? null : new Types.ObjectId(userId),
      csrfSecret: randomBytes(32).toString('base64url'), revokedAt: null,
      expiresAt: new Date(now().getTime() + (userId === null ? preSessionLifetime : sessionLifetime)) };
    return { token, record };
  }
  function setCookie(response: Response, token: string, expires: Date) {
    response.cookie(cookieName, token, { ...cookieOptions, expires });
  }
  function checkReadOrigin(request: Request) {
    const supplied = request.get('Origin');
    if ((supplied !== undefined && supplied !== origin) || request.get('Sec-Fetch-Site') === 'cross-site') {
      throw new ApiError('FORBIDDEN');
    }
  }
  function requireOrigin(request: Request) {
    checkReadOrigin(request);
    if (request.get('Origin') !== origin) throw new ApiError('FORBIDDEN');
  }
  async function resolve(request: Request) {
    const token = readSessionCookie(request.get('Cookie'), cookieName);
    if (!token) return null;
    const hash = tokenHash(token);
    const record = await store.find(hash, now());
    if (!record) return null;
    const user = record.userId === null ? null : await users.active(String(record.userId));
    if (record.userId !== null && !user) return null;
    return { tokenHash: hash, csrfSecret: record.csrfSecret, user };
  }
  function requireCsrf(request: Request, secret: string) {
    const candidate = request.get('X-CSRF-Token');
    if (!opaqueTokenSchema.safeParse(candidate).success || !candidate ||
      !timingSafeEqual(Buffer.from(tokenHash(candidate), 'hex'), Buffer.from(tokenHash(secret), 'hex'))) {
      throw new ApiError('FORBIDDEN');
    }
  }
  async function author(request: Request) {
    checkReadOrigin(request);
    const context = await resolve(request);
    if (!context?.user) throw new ApiError('UNAUTHENTICATED');
    return { ...context, user: context.user };
  }
  return {
    // Reuse these guards on subsequent management modules; UI guards grant no access.
    author,
    async mutation(request: Request) {
      requireOrigin(request);
      const context = await author(request);
      requireCsrf(request, context.csrfSecret);
      return context;
    },
    async csrf(request: Request, response: Response, admit: () => void) {
      checkReadOrigin(request);
      const context = await resolve(request);
      if (context) return context.csrfSecret;
      admit();
      const { token, record } = fresh(null);
      await store.insert(record);
      setCookie(response, token, record.expiresAt);
      return record.csrfSecret;
    },
    async loginContext(request: Request) {
      requireOrigin(request);
      const context = await resolve(request);
      if (!context) throw new ApiError('FORBIDDEN');
      requireCsrf(request, context.csrfSecret);
      return context;
    },
    async signIn(response: Response, oldHash: string, user: UserDto) {
      const { token, record } = fresh(user.id);
      await store.rotate(oldHash, record, now());
      setCookie(response, token, record.expiresAt);
    },
    async signOut(response: Response, hash: string) {
      await store.revoke(hash, now());
      response.clearCookie(cookieName, cookieOptions);
    },
  };
}
export type SessionManager = ReturnType<typeof createSessionManager>;
