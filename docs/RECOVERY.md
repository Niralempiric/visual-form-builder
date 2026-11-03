# Saved recovery codes

D04.3 | 2 November 2026

Use [operator bootstrap](AUTHENTICATION.md) and [sign in](SESSIONS.md) first.
Public signup remains closed. Existing accounts start with no recovery codes;
no migration, reset, real account or normal development data is changed by installation.

## Save codes before losing access

1. Open **Account and recovery** from the dashboard (`/app/account`) while signed in.
   Under **Recovery codes**, enter your current
   password and select **Generate new recovery codes**. This immediately replaces
   all previous unused codes, so save the new set before closing the view.
2. Five independent, cryptographically random 32-byte codes appear in read-only
   fields. Each is exactly 43 base64url characters. Focus a field to select it,
   then copy it to a password manager or another safe offline place. Do not put
   codes in screenshots, issue reports, source code, chat messages or logs.
3. Select **I saved my codes — hide them**. Codes are held only in the mounted
   client view and are cleared on hiding, unmounting, page exit or reload. There
   is no GET endpoint to retrieve an issued set. If delivery was interrupted,
   generate a new set; the previous committed set will stop working.

These are long-lived **offline recovery secrets**, not emailed reset links or
short-lived OTPs. They remain valid until used or replaced by a newly generated
set; there is no time-based expiry. Protect them like passwords. They do not
provide MFA or prove ownership of an email address.

## Recover access

Open `/recover` using **Use a recovery code** on `/login`. Supply the normalized
account email, one unused code, a new password and its confirmation. New passwords
use the same policy as bootstrap: at least 15 Unicode code points and at most
128 UTF-16 code units, with spaces/Unicode preserved. The browser checks matching
confirmation; the API independently enforces the password and input bounds.

Success consumes that code, stores a fresh Argon2id password hash, revokes every
prior session for that account and clears the current browser cookie. It does
**not** sign you in automatically. Follow the success link and sign in normally
with the new password. Other accounts keep their own sessions. Remaining unused
codes still work individually; generate a replacement set if you suspect the old
set was disclosed. Logout/recovery cannot cancel a request already authorized
before revocation; subsequent authorization lookups reject those sessions.

Unknown email, disabled account and wrong, replaced or already-used well-formed
codes receive the same generic 401 error. No account data changes on failure.
Malformed input is 400; Origin/CSRF denial is 403; admission limits are 429;
dependency failures are 503. Errors never return submitted values or raw database
exceptions. No lockout, notification or email is sent to an address being tried.

If a network response is lost after commit, the code is already consumed. First
try signing in with the new password. If that fails, another saved unused code
can be used. There is no idempotent replay receipt or automatic retry that could
reset the password twice. If all codes and the password are lost, no public
self-service or email reset exists; database deletion/re-bootstrap is not an
account-recovery procedure. Do not reset a normal volume to test this feature.

## API contracts and transaction boundary

All paths follow `/api/v1`. Responses use shared strict envelopes, correlation
IDs and `Cache-Control: no-store`. Secrets travel only in HTTPS request/response
bodies (HTTP loopback is the development exception), never URLs or user DTOs.
Use same-origin cookies and exact `APP_ORIGIN` as described in [sessions](SESSIONS.md).

| Endpoint | Required context | JSON input | Allowlisted success data |
|---|---|---|---|
| `POST /auth/recovery-codes` | Active author cookie, exact Origin, matching CSRF and current password | `{ password }` | `{ codes: string[5] }`, delivered once |
| `POST /auth/recover` | Valid anonymous pre-session or author cookie, exact Origin, matching CSRF | `{ email, code, newPassword }` | `{ recovered: true }` |

Retrieve the current synchronizer token from `GET /auth/csrf` before each POST;
this creates a ten-minute anonymous pre-session when needed. Origin/context/CSRF
checks precede the shared bounded 8 KiB uncompressed JSON parser. Unknown keys,
Mongo operators, missing fields and invalid code lengths/alphabet fail safely.
Only code issuance intentionally returns raw codes; normal identity, login,
bootstrap and recovery success return no code or hash material.

Issuance rechecks the signed-in user's current password using the existing
throttled credential service. Its transaction replaces only that active user's
hash set, checking the verified password hash and still-valid session. The API
never accepts a caller-selected user/email for issuance. No outstanding code set
is read or returned. The database stores only domain-separated SHA-256 digests
of 256-bit codes in the existing private `users.recoveryHashes` array. These
high-entropy random values do not use the password hash's small-entropy threat
model; actual passwords continue using salted Argon2id.

Recovery hashes the new password for every admitted well-formed attempt before
its guarded database lookup, including missing/disabled accounts and invalid
codes. There is no constant-time whole-request claim. A snapshot/majority
transaction matches active email plus the specific code digest, removes that
digest, updates the password, revokes its request context, and revokes all
unrevoked sessions for the recovered user. A failure in any write rolls all of
this back. The account/session revocation index is added without dropping data
or existing indexes. TTL cleanup remains eventual; authorization checks actual
expiry/revocation before cleanup.

Login also performs a guarded modifying write on the same user document before
session rotation. Its predicate includes the password hash actually verified.
The private `sessionSequence` counter supplies that write, including for existing
records where it was absent. Transactions serialize login and recovery: a login
that commits first is included in recovery's revocation; if recovery commits
first, an old credential proof cannot create a session afterward. Two uses of
the same code serialize so only one succeeds. The counter grants no permissions
and is excluded from ordinary model reads/JSON and every public DTO.

## Limits and evidence

Code issuance shares login's process-local limits: five credential attempts per
normalized email, 30 per socket and 120 globally per 15 minutes, successes included.
Recovery redemption has its own limiter with those same bounds; anonymous context
issuance still uses the existing auth-service network limit. Each password service
admits at most four expensive native jobs, without an unbounded queue (login/
issuance and recovery use separate service instances). Limits reset on restart,
are not shared across replicas, and ignore forwarded addresses. Shared/proxy-wide
limits, deliberate proxy/network policy, TLS and database controls remain hosting
requirements, as documented for authentication. No dependency or runtime upgrade
was needed for this task.

Run the commands in [testing](TESTING.md). Focused fast tests validate the recovery
contracts, admission, client CSRF/request/response boundary and safe errors. Actual
disposable Mongo tests verify one-time replay, cross-instance revocation, old/new
passwords, other-account isolation, regeneration, generic unknown/wrong/disabled
failures, guarded issuance, rollback after a late revocation failure, competing
redemptions and an old login proof presented after recovery. Tests never use
normal development or respondent data; fixture cleanup is verified.

Manual browser coverage includes real Next.js/compiled Express sign-in, the new
settings/recovery views, failed password confirmation, outage handling, cleared
submitted password, error focus, native required fields, keyboard order, masked
inputs and 390px layout. Positive code disclosure and credential-changing browser
submission were not exercised because browser credential changes require user
handoff; their persistence/protocol outcomes are verified in API/database tests.
This is a recorded coverage limit, not a claim of a full browser recovery test.
Hosted TLS, production hardening and the complete form release remain later gates.

References: [OWASP forgot-password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
(random secrets, consistent failures, normal sign-in after reset and session
invalidation), [OWASP recovery factors](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html#resetting-mfa)
and [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/).
