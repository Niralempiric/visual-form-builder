# Author sign-in, sessions and request protection

D04.2 | 30 October 2026

Use [local setup](LOCAL_DEVELOPMENT.md) and [operator bootstrap](AUTHENTICATION.md),
then open `/login`. Enter the existing author's credentials. Successful sign-in
opens `/app`, displays the signed-in address and offers sign-out. Refresh and API
restart preserve the session. This screen is an account preview; workspaces and
forms are not implemented. Recovery codes remain D04.3; public signup stays closed.

## Configuration and cookies

`APP_ORIGIN` is the **one exact browser origin**, default
`http://127.0.0.1:3000`. It contains scheme, hostname and optional nondefault port,
with no trailing slash, path, query, fragment or credentials. Change it when the
browser port/hostname changes and restart Express. It is server-only, not a
NEXT_PUBLIC_ setting. The API never derives trusted origins from Host or forwarded
headers. `http://localhost:3000` differs from `http://127.0.0.1:3000`.

Only HTTPS origins or HTTP loopback (`127.0.0.1`, `localhost`, `[::1]`) are valid;
other HTTP origins fail startup with the configuration field name only. Cookie
security is derived from that configured origin, with no disable-secure switch:

| Setting | HTTPS origin | Explicit local HTTP loopback |
|---|---|---|
| Name | `__Host-vfb_session` | `vfb_session` |
| Flags | Secure, HttpOnly, SameSite=Strict, Path=/ | HttpOnly, SameSite=Strict, Path=/ |
| Domain | Omitted (host-only) | Omitted (host-only) |
| Expiry | Fixed expiry timestamp | Fixed expiry timestamp |

The HTTP exception permits local testing; hosted sessions require TLS. HTTPS
cookie attributes were verified through HTTP response headers in tests, not a
production TLS deployment. Cookies are host-scoped, not port-scoped: separate
local instances need separate browser profiles/hostnames to avoid collisions.
Use isolated databases for different environments. No automatic deployment is
provided and no proxy hop is trusted. Existing single-process admission limits
still require shared/proxy-wide ceilings before public hosting.

## Shipped API flow

All paths below follow `/api/v1`. All results use strict shared success/error
contracts, `X-Correlation-ID`, and `Cache-Control: no-store`. No endpoint returns a
password hash, raw session cookie value, token hash or session record.

1. `GET /auth/csrf` returns `{ data: { csrfToken }, correlationId }`. With a valid
   cookie it returns that session's synchronizer token. Otherwise it creates a
   throttled anonymous **10-minute pre-session** and sets its HttpOnly cookie.
   This pre-session grants no author access. No CORS policy allows another site
   to read the token; cross-site Fetch Metadata or a supplied wrong Origin fails.
2. `POST /auth/login` requires the exact Origin, the pre-session cookie and its
   `X-CSRF-Token`, plus JSON `{ email, password }`. Checks precede body parsing and
   password work. Valid credentials atomically revoke that pre-session and insert
   a new **24-hour author session**, issuing a fresh cookie and CSRF secret. Response
   data is only `{ id, email, status }`. No caller-supplied redirect is accepted.
3. `GET /auth/me` requires a valid, unrevoked, unexpired author session and a user
   that still exists and is active. It returns the same allowlisted user DTO. It
   does not extend expiry, reissue a cookie or create an anonymous session.
4. Before a management mutation, retrieve the current token from `GET /auth/csrf`.
   `POST /auth/logout` requires Origin, cookie, matching `X-CSRF-Token` and JSON `{}`.
   It marks the session revoked, then clears the cookie with the same name/path/
   security attributes. Replaying the old cookie fails, including on another API
   instance. A failed database write does not claim successful logout.

POST login without a valid pre-session/token is 403. Anonymous/expired/revoked
`me` or authenticated mutations are 401. Missing, null, different-host, different-
port, suffixed or otherwise mismatched Origins fail mutations with 403. A matching
Origin does not replace CSRF validation. Missing/stale/wrong-session CSRF is 403.
The Origin check also rejects `Sec-Fetch-Site: cross-site`; forwarded-host headers
cannot change the target. Reads reject an explicitly wrong Origin or cross-site
Fetch Metadata but allow same-origin browser GETs that omit Origin. Public form
APIs remain separate and unimplemented, not implicitly authorized by this cookie.

Bodies require JSON, at most 8 KiB, no compression; unknown credential/logout keys
fail. Generic wrong-password/missing/disabled credential errors are identical.
Malformed contracts, oversized bodies, configured ceilings and dependency failures
retain the safe 400/413/429/503 catalog. Strict cookie parsing accepts only one
bounded opaque value; duplicate session cookies fail safely. There are no session
credentials in URLs, logs, JSON user DTOs, page props or browser storage.

## Storage and future management routes

Each cookie token is 32 random bytes (base64url). Mongo `sessions` stores only its
SHA-256 hash, optional user ID, random session-bound `csrfSecret`, fixed `expiresAt`
and nullable `revokedAt`. Anonymous and author records share this schema. Secret
fields are excluded by default from model reads and JSON serialization; internal
lookup explicitly selects the CSRF secret. The CSRF endpoint is its intentional,
same-origin delivery path. A unique hash index prevents duplicate token records;
an expiresAt TTL index eventually removes old rows. Every authorization lookup
checks expiry and revocation **before** TTL deletion, then rechecks active user
status. Repeated reads never slide the 24-hour deadline.

Login rotation uses snapshot reads/majority writes in one transaction, guarding
the old unexpired/unrevoked record before revocation and insert. Competing logins
consume a pre-session once; insertion failure rolls back its revocation. Logout
uses one guarded majority-write update. An already authorized in-flight request
is not canceled by a later logout; subsequent lookups reject the revoked cookie.
Future sensitive mutations must apply their own transaction/authorization contract.

`createSessionManager` exposes `author(request)` and `mutation(request)` guards.
Use them for subsequent management modules: `mutation` enforces Origin, a current
author and CSRF. Browser UI guards grant no API access. No workspace role or tenant
permission is inferred by this task, and no recovery-code operation is implemented.

## Browser behavior and verification

The server-rendered pages contain no private user data; Client Components fetch
uncached same-origin DTOs with bounded timeouts. Page load, focus and page restore
recheck identity. Passwords stay out of React/browser storage and the password
field clears when submitted. Busy controls prevent duplicate actions. Errors use
safe local copy, live announcements and a focusable alert. Connection failure has
a retry action; an anonymous account view has a sign-in link. Labels, native
controls, keyboard submission, a skip link and narrow layouts are supported.

Run the pinned commands in [testing](TESTING.md). Fast tests check canonical
origins, cookie ambiguity/bounds, host-only Secure/HttpOnly/SameSite flags and hash-
only persistence. Disposable replica sets check credential failures, persistence
across fresh API instances, expiry, disabled/deleted users, old-token/CSRF replay,
missing/wrong Origin/CSRF, logout, login races, rollback, throttling and dependency
failure. The browser was tested against actual Next.js plus the compiled API on
an isolated synthetic database: keyboard sign-in, refresh, restart recovery,
logout, anonymous access, 390px layout, loading/error/empty states. No real account
or response data was used. Complete form journeys and hosted deployment are later
release gates; this evidence does not complete M02 recovery or a form release.

References: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[Express response cookies](https://expressjs.com/en/5x/api/response/).
