# Author-account foundation

D04.1–D04.2 | 30 October 2026

The separate Express API owns users, password checks and revocable sessions in
MongoDB. Initial public signup is closed. Operator bootstrap creates the first
account without issuing a session. D04.2 adds `/auth/csrf`, `/auth/login`,
`/auth/logout`, `/auth/me` and the `/login` and `/app` views. See [sessions](SESSIONS.md)
for their exact cookie, Origin, CSRF and expiry contracts. Recovery codes remain
D04.3. No user account is created automatically.

## Optional operator bootstrap

Follow [local setup](LOCAL_DEVELOPMENT.md) first. Keep all credentials private and
use synthetic accounts on the unauthenticated local development database. The API
binds to loopback. Hosted use requires TLS, database access controls and deployment
rate limits; this foundation is not a production auth release.

1. Create a cryptographically random token of at least 32 random bytes using your
   password manager. In the **private**, ignored root `.env`, set
   `AUTH_BOOTSTRAP_TOKEN` to that value (32–256 characters). Blank/unset disables
   bootstrap. Never use a NEXT_PUBLIC_ variable, commit the value, or share the file.
2. Reload the environment using the local guide and restart Express. Configuration
   is read at startup. Startup explicitly creates the users/marker collections
   and the unique normalized-email index; it never drops indexes or existing data.
3. In another terminal with pinned Node/npm and the local configuration loaded,
   run the Python client below. It prompts without echoing the token or password,
   sends JSON directly to loopback Express, and prints only the allowlisted
   response. Enter the same private operator token as in the server configuration.

```bash
python3 - <<'PYCLIENT'
import getpass, json, os, urllib.error, urllib.request
port = int(os.environ.get('API_PORT', '4000'))
email = input('Initial author email: ')
token = getpass.getpass('Operator bootstrap token: ')
password = getpass.getpass('Initial author password: ')
body = json.dumps({'email': email, 'password': password}).encode()
req = urllib.request.Request(f'http://127.0.0.1:{port}/api/v1/auth/bootstrap',
    data=body, headers={'Content-Type': 'application/json', 'X-Bootstrap-Token': token})
try:
    with urllib.request.urlopen(req, timeout=20) as response:
        print(response.status, response.read().decode())
except urllib.error.HTTPError as error:
    print(error.code, error.read().decode())
except (urllib.error.URLError, TimeoutError):
    print('Bootstrap request failed; check local API availability.')
PYCLIENT
```

4. After successful creation, remove/blank `AUTH_BOOTSTRAP_TOKEN` in the private
   file, unset it in API launch shells, reload configuration and restart Express.
   The permanent marker still prevents another bootstrap if the token is later
   re-enabled. Keep the author password in secure storage. There is no recovery
   operation yet; do not create a real production account for this foundation.

Do not send secrets on a command line, in a URL, screenshot, bug report or shell
history. The client does not create or modify any configuration. Do not run it
against another person's instance. Resetting the explicitly disposable local
Mongo volume deletes **all** its accounts and marker, as described in local setup;
removing only a user never re-enables bootstrap. This is not a recovery procedure.

## Input, persistence and safe responses

- Requests require `application/json`, at most 8 KiB, no compressed bodies. Token
  and socket-based admission checks run before parsing. Any Origin header is
  rejected for this operator-only endpoint; no browser signup/CORS is enabled.
- Email is bounded to 254 characters, trimmed and lowercased consistently for
  storage and lookup, then syntax checked. No provider-specific dot/plus rewrites
  occur and ownership of the email is not verified. Mongo operators, unknown input
  keys, arrays and malformed JSON fail with the shared safe 400 envelope.
- Initial passwords require at least 15 Unicode code points and at most 128 UTF-16
  code units (therefore bounded UTF-8 work). Spaces and Unicode remain unchanged;
  no composition rules, trimming or truncation. Credential checks accept bounded
  nonempty passwords so wrong short passwords receive the same generic failure.
- `argon2@0.45.1` generates random salts and Argon2id hashes with 19 MiB memory,
  two iterations and one lane. At most four concurrent hash/verify jobs are admitted
  per service instance, with no unbounded queue. Missing accounts verify against
  a startup-generated dummy hash; wrong-password, missing and disabled accounts
  return the same `UNAUTHENTICATED` code/message. This reduces timing differences;
  it is not a claim of constant-time whole-request behavior.
- `users` stores normalizedEmail, passwordHash, empty recoveryHashes, active/disabled
  status and timestamps. Secret fields are excluded from normal model queries and
  JSON serialization. Internal credential lookup explicitly selects the hash;
  API output constructs and validates only `{ id, email, status }` in the shared
  `{ data, correlationId }` envelope, with `Cache-Control: no-store`.
- A transaction inserts the unique `authBootstrap` first-author marker, checks
  that no user exists, and creates the first account. Snapshot reads and majority
  write concern bind both writes. Concurrent/repeated initialization returns 409;
  failure rolls back both writes. The marker is permanent even if users are deleted.
- Responses: 201 created; 403 missing/wrong/disabled token or browser Origin;
  400 invalid input/encoding; 413 oversized JSON; 409 bootstrap already used or
  an existing user; 429 ceiling exceeded; 503 unavailable database/hash dependency.
  Fixed catalog messages omit submitted input, hashes, driver errors and stacks.
  No password, token, raw network address or credential body is logged.

## Credential throttle and deployment limits

Bootstrap admission, login credential checks and newly issued anonymous sessions
share per-process ceilings of
120 attempts globally and 30 per socket address per 15 minutes. Credential checks
also allow five attempts per normalized email in that window across addresses;
**successful attempts count too**. Attempts already rejected by the network ceiling
still count against the global ceiling. Checks consume admission before expensive
hashing; no success reset or user-existence distinction is exposed.

Buckets retain only HMAC keys using a random process-local key, counters and expiry.
Expired buckets are removed on access, and the map is capped at 10,000 keys (full
maps fail closed). Counters reset on process restart and are not shared between
instances. Forwarding headers are ignored; no proxy hop is trusted. Configure a
shared/proxy-wide ceiling and a deliberate proxy/network policy before public
hosting, including IPv6 address rotation and shared-NAT effects. These starting
limits can temporarily block legitimate users; they do not prove human identity.

## Verification and dependency evidence

Run `npm run check`, `npm test`, `npm run test:db`, `npm run test:readiness`,
`npm run test:transactions` and `npm run build` with the pinned toolchain.
Fast checks cover input/configuration, real hashes/salts, generic failures,
ceilings/expiry, token gates, parser limits and closed public signup/recovery.
D04.2 adds session policy and real-database/browser verification described in [sessions](SESSIONS.md).
Disposable replica sets verify a two-instance bootstrap race, independent-reader
persistence, secret projections/DTOs, email uniqueness, restart/deletion lockout,
pre-existing accounts, intentional insert rollback and safe database failure.

The body-parser override pins patched 2.4.0 before introducing parsing; inflate is
also disabled. Argon2's MIT and reference implementation licenses remain in its
package; no third-party source/assets are copied. Main project license selection
remains pending.

Sources: [node-argon2](https://github.com/ranisalt/node-argon2),
[OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html),
[OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html),
[patched parser advisory](https://github.com/advisories/GHSA-27r3-jxmh-p828).
