# Repository checks and test fixtures

D03.2–D03.3 | 29 October 2026

Use Node **24.21.0** and npm **11.19.0**, installed from the repository pins. Run
`npm ci` before starting a preview; replacing node_modules under a running Next.js
watcher can cause transient module-resolution errors. Stop/restart the preview
after an installation. No private env file, Mongo URI or credentials are needed
for lint, type checks or fast tests.

## Commands

Run from the repository root:

```bash
npm run check
npm test
npm run build
```

| Command | Scope |
|---|---|
| `npm run check` | Runtime pins, both lint engines, seven workspace typechecks and strict test/config types |
| `npm run lint` | ESLint recommended checks for JS/MJS/CJS; Oxlint correctness checks for source, tests and TS configs; warnings fail |
| `npm run typecheck` | Shared declarations, all workspaces, Next generated types and test/config TypeScript |
| `npm run typecheck:tests` | Strict no-emit check of tests/helpers/fixtures/configs; shared packages must already be built |
| `npm test` | Build shared packages, then run fast Vitest logic and Supertest API checks once |
| `npm run test:contracts` | Compatibility alias selecting the migrated contract suite |
| `npm run test:watch` | Build shared packages, then watch fast tests during development |
| `npm run test:db` | Explicit Docker-backed Vitest integration fixtures; not part of the fast command |
| `npm run test:readiness` | Existing Node-runner operational outages/readiness regression |
| `npm run test:transactions` | Existing Node-runner multi-collection commit/rollback regression |

The fast configuration discovers only `tests/fast/**/*.test.ts`; database tests
have a separate config for `tests/integration/**/*.test.ts`, one worker and a
longer timeout. Vitest imports APIs explicitly, fails empty discovery, rejects
`.only`, uses no retries, and restores mocked globals/environment. It does not
read the application's `.env`. `tsconfig.tests.json` includes all TypeScript
fixtures/helpers and both Vitest configs because Vitest transpilation alone does
not typecheck tests. Existing Node-runner `.mjs` database suites remain explicit
commands and are not accidentally collected by Vitest.

## Lint compatibility and boundaries

Exact new development pins: ESLint 10.13.0, @eslint/js 10.0.1, globals 17.13.0,
Oxlint 1.90.0, Vitest 5.0.5, Vite 8.3.5, Supertest 7.3.1 and its types 7.2.1.
The existing runtime/compiler pins and existing dependency versions are preserved.
No forced peer resolution is used. D04.1 additionally approves only the pinned
`argon2@0.45.1` native install check; other new scripts are not authorized.

The current [typescript-eslint support range](https://typescript-eslint.io/users/dependency-versions/)
excludes TypeScript 7, so this setup keeps ESLint for JavaScript and uses
[Oxlint](https://oxc.rs/docs/guide/usage/linter.html) for TypeScript/TSX correctness,
with TypeScript, React, React Hooks, Next.js and accessibility plugins. Strict
TypeScript 7 compiler checks remain separate; type-aware ESLint rules are not
claimed. ESLint's mongosh globals apply only to the replica initializer. Build
output, generated Next types and dependency folders are ignored, not source/tests.
No rules were disabled to hide the initial lint findings.

The lint-required home link uses Next's `Link`. The connection status uses native
`output` with polite announcements. Rendering, event state and health contracts
otherwise retain their previous behavior. These small markup corrections were
verified through keyboard navigation/activation and a narrow browser viewport.

## Fast API and logic tests

`tests/fast/contracts.test.ts` migrates all seven D03.1 checks to typed Vitest and
Supertest without duplicating the old Node suite. It tests the actual Express app
and contract code: valid/invalid IDs, strict envelopes, cursor/page bounds, fixed
safe errors, unexpected exceptions, correlation IDs, JSON 404s and health payloads.
Requests use disposable loopback listeners and bounded Supertest request timeouts.
Listener cleanup is registered with `onTestFinished`; no debug endpoint ships.
See [API contracts](API_CONTRACTS.md) for public shapes and current limitations.

[Vitest configuration](https://vitest.dev/config/) and
[Supertest usage](https://github.com/forwardemail/supertest) are the primary tool
references. D03.2 added no browser automation dependencies. The D03.3 CI workflow is described
below; full browser suites require later product features.

## Disposable Mongo fixtures

With Docker/Compose access and the pinned Mongo image available:

```bash
npm run test:db
```

`tests/helpers/mongo.ts` exports `withMongoFixture(async fixture => { ... })`.
Every invocation generates its own `vfb-d032-*` Compose project, random database
name and free loopback port, using the API's installed Mongoose driver. It accepts
no caller-supplied URI/project, ignores inherited Compose settings, and passes an
empty Compose env file. Development `.env`, MONGODB_URI, replica name and port
settings cannot redirect it to the normal database. Tests only write explicitly
synthetic infrastructure records and fabricated account credentials, never real
accounts, customer forms or respondent data. D05.1 also creates explicitly synthetic
workspace/form records in these isolated namespaces.

`fixture.connect()` creates independent clients with buffering and automatic
indexes/collections disabled and bounded connection/socket waits. Tests create
needed collections explicitly. Startup/driver errors omit raw connection/config
values. On success, ordinary startup errors or assertion failure, the wrapper
closes its connections and removes only its generated containers, network and
volumes. It verifies no resources remain with that exact Compose project label.
If both the test and cleanup fail, both errors are retained in an AggregateError.
A cleanup error fails verification instead of being silently ignored.

The two integration tests cover committed synthetic persistence observed through
an independent client, cleanup after an intentional assertion-body failure, and
an empty subsequent fixture. Existing D02.2 tests retain the detailed rollback
checks; readiness alone is not used as transaction evidence.

Abrupt process/host termination cannot guarantee JavaScript cleanup. A fixture
failure names its generated project for inspection; inspect that exact namespace
before manually removing it. Never use a broad Docker prune or reset the normal
Compose database to recover tests. A port race or Docker access/startup failure
is a test failure, not a skipped/pass result.

## D03.2 failure/correction evidence

The run temporarily changed the synthetic record's label, then ran:

```bash
npm run test:db -- --testNamePattern='commits the expected synthetic record' --reporter=verbose
```

The stored-record assertion failed with exit 1. Connections and fixture resources
were removed before the runner exited. Restoring the record and running the full
`npm run test:db -- --reporter=verbose` passed both tests. This also ran with
synthetic, deliberately unusable inherited Mongo/Compose settings; fixtures still
used their generated namespaces and cleaned them up. No failing variant is left
in the repository. Temporary debugger and type-mismatch probes also caused the
respective gates to fail, and were removed before the final passing checks.

Local verifier/log evidence is outside Git under `/tmp/vfb-d032-acceptance*`;
the committed suites and commands above reproduce the behavior. No external
review, release workflow or production deployment is claimed. These original GET-only
checks introduced no parser. D04.1 now resolves the recorded advisory with a
2.4.0 override before enabling route-local bootstrap JSON parsing.


## GitHub Actions verification (D03.3)

[The CI workflow](../.github/workflows/ci.yml) runs on pushes and pull requests,
with one Ubuntu 24.04 job. It selects Node from `.nvmrc`, installs the pinned npm
11.19.0 on the disposable runner, then runs these exact repository commands:

```bash
npm ci
npm run check
npm test
npm run build
```

Use the same commands locally after selecting Node 24.21.0/npm 11.19.0. `check`
already includes runtime, ESLint/Oxlint and workspace/test/config type checks;
`test` is the fast Vitest/Supertest suite; `build` compiles shared packages,
Express and Next.js. No application services or database are started. The separate
Docker/operational suites remain explicit local commands, not a passing CI claim.

`CI=true` and `NEXT_TELEMETRY_DISABLED=1` are non-secret job settings. No private env
file, application secret or deployment credential is needed. The job has a 15-minute
budget and cancels superseded runs for the same ref. Steps fail normally; no
continue-on-error, test skip, deployment, artifact upload or write-back step exists.

Official actions are pinned to reviewed immutable commits: checkout v7.0.1 at
`3d3c42e5aac5ba805825da76410c181273ba90b1`, setup-node v7.1.0 at
`949feb2413d6458794dcd2491c4babbbce0c15c1`. Their pinned action manifests use Node 24.
The job token has only `contents: read`; checkout does not persist credentials.
No dependency cache is used, so each run performs an actual locked install.
These choices follow [GitHub's workflow security guidance](https://docs.github.com/en/actions/reference/security/secure-use).

When updating runtime pins, keep `.nvmrc`, `.node-version`, the manifest and the
workflow's npm bootstrap version aligned. Review official action releases and
resolve their tags to exact SHAs before updating pins. Repository scripts remain
the single source for verification behavior; CI does not duplicate lint/type logic.

The source workflow passed actionlint 1.7.12. A clean local source copy ran the
four commands extracted from that actual workflow successfully without private
application configuration or changing the lockfile. Hosted acceptance passed on
[workflow commit e56a2e2](https://github.com/Niralempiric/visual-form-builder/actions/runs/40833070245):
all install/check/test/build steps succeeded. See implementation progress for the
exact commit and execution receipt. CI is verification evidence, not deployment
or a complete form-release gate.


## D04.1 authentication checks

`tests/fast/auth.test.ts` adds real Argon2id salts/cost/verification, strict input
and safe configuration errors, generic credential failures, admission/concurrency
ceilings, expiry, token gates and bounded uncompressed JSON tests. It verifies
login/signup/recovery remain absent on the bootstrap-only router instead of
treating credential success as a session. The composed API adds login and recovery
through separate routers. `tests/integration/auth.test.ts` uses separate disposable replicas and
independent clients to check concurrent first-account creation, persistent
bootstrap lockout, unique email, private hash projections/DTOs and intentional
transaction rollback. Closed-pool failure returns safe errors. All accounts and
passwords in these suites are explicitly synthetic. No normal development account
is created. See [authentication](AUTHENTICATION.md) for scope and operator setup.


## D04.2 session and browser checks

`tests/fast/sessions.test.ts` verifies exact/canonical origin configuration, opaque
cookie parsing and HTTPS cookie attributes. `tests/integration/sessions.test.ts`
adds four isolated Mongo scenarios: identity persistence across API instances,
revocation/replay and CSRF/Origin denial, expiry/disabled/deleted users, failed
rotation rollback plus competing logins, anonymous-session throttling and safe
closed-pool failure. All credentials and account records are synthetic. Existing
bootstrap-only tests now check signup/recovery absence; the composed application
ships the separate login/session router.

`withMongoFixture` exposes its internally generated configuration to allow actual
compiled API processes in isolated verification; it still accepts no caller URI
or project. It preserves normal development data and verifies cleanup of only its
own namespace. An abrupt preview interruption can leave its Docker resources;
inspect the exact generated project before cleanup, never prune/reset broadly.

Manual browser evidence for D04.2 covers keyboard login, password/error states,
refresh, actual API restart and retry, logout, signed-out access, and a 390×844
viewport. The preview uses actual Next.js and compiled Express with a disposable
synthetic account. Viewport override and temporary preview services are removed
after verification. No Playwright dependency, fake external review or hosted TLS
claim is introduced. See [session contracts](SESSIONS.md) and implementation
progress for this run's commands/results and evidence limits.


## D04.3 recovery verification

`tests/fast/recovery.test.ts` checks strict code/password bounds and independent
recovery admission limits; `tests/fast/auth-client.test.ts` checks the actual web
API helper's same-origin/no-store requests, CSRF sequence, allowlisted response
parsing and safe error mapping. No frontend testing dependency was added.

`tests/integration/recovery.test.ts` adds four real disposable-replica scenarios:
code issuance/hash-only storage, one-time use across fresh API instances, all
prior sessions revoked while another account remains signed in, password replacement,
regeneration, Origin/CSRF/password gates, generic unknown/wrong/disabled/reused
failures, rollback after author-session revocation fails, competing redemptions,
a stale pre-recovery login proof and safe database unavailability. No mocked
transaction substitutes for these tests. Existing session/bootstrap suites also
run after the login serialization change. See [recovery](RECOVERY.md).

Browser evidence covers new screen rendering, keyboard/native validation, masked
inputs, negative confirmation/outage handling and 390×844 layout against actual
Next.js/compiled Express on an isolated account. Successful credential-changing
browser submission and code disclosure are not claimed: those UI actions require
user handoff. Positive protocol and persistence behavior is tested through API/
Mongo fixtures. This does not block D04.3's individual API/session completion check,
and is recorded as a browser coverage limitation. No real credentials were changed.


## D05.1 workspace and initial-draft checks

`tests/fast/workspaces.test.ts` checks name/title bounds, strict server-owned input
rejection, canonical empty drafts with separate mutable arrays, ID parsing, guarded
HTTP parser behavior and success envelopes. It does not define the future field
registry. `tests/integration/workspaces.test.ts` adds four actual Mongo scenarios:
owner workspace/member/first-form persistence across independent readers/API
instances, identity/scope/CSRF failures, late membership/form insertion rollback,
and two-instance admission at the 25-form limit. Unique indexes, private DTOs,
viewer read/creation denial, inactive workspace and safe dependency failure are
also checked. No normal development records are used or reset.

The affected endpoints are backend-only; no browser UI changed. Dashboard browser
checks belong to D05.2, and the broader two-workspace management regression matrix
remains D05.3. See the reproducible synthetic client in [workspace usage](WORKSPACES.md).


## D05.2 dashboard checks

`tests/fast/dashboard-client.test.ts` checks strict page parsing, same-origin
no-store reads, cancellation propagation, input validation before networking,
CSRF-before-POST, cancellation before POST, and safe status-only failures.
The fifth scenario in `tests/integration/workspaces.test.ts` verifies real list
HTTP contracts, empty states, equal-timestamp ObjectId pagination, summary
allowlists, workspace switching, cross-scope cursors, anonymous/foreign access,
viewer reads, current membership removal, inactive workspaces and strict queries.
These checks protect the new behavior; D05.3's broader endpoint matrix is pending.

For the browser check, follow [the synthetic dashboard walkthrough](DASHBOARD.md)
against actual Next.js, Express and a disposable Mongo replica set. Check loading,
empty, failure/retry, correct workspace/form identity, refresh persistence,
keyboard use and a 390px viewport. Never use real answers, capture credentials or
reset an actual user's password. Test-only latency/failure injection belongs to a
local forwarding harness, not a production API flag or debug route. Record each
observed result in progress; a successful build alone is not browser acceptance.


## D05.3 tenant-denial checks

`tests/fast/tenant-guards.test.ts` covers identity/Origin/CSRF guard ordering across
all six current workspace/form routes, before input parsing or persistence, and
positive controls prove caller headers cannot select the actor.
`tests/integration/tenant-isolation.test.ts` adds three isolated real Mongo/API
scenarios: symmetric two-owner read/write denials with unchanged state hashes;
current workspace-specific membership/lifecycle checks across two API instances;
and disabled/expired/revoked identity rejection across the endpoint inventory.
Every denial scenario has legitimate access controls. Full contracts, reproduction
commands and limitations are in [tenant isolation](TENANT_ISOLATION.md).

The deleting-form check initially failed (503 instead of safe 404). The form-read
query now excludes deleting records, matching list behavior. Future endpoint/role
policies remain their own tasks; no non-existent PATCH/publish/response route is
counted as authorization coverage. No frontend changed in D05.3, so browser
verification is not applicable; the acceptance evidence comes from actual HTTP,
Mongo persistence and guard tests, not prior dashboard screenshots.


## D06.1 definition-schema checks

`tests/fast/form-definition.test.ts` exercises the compiled shared package's twelve
structural field variants, UUIDv4 identity/collisions, defaults, type-specific
bounds, real Gregorian date ranges, choice cardinalities and strict unknown keys.
It verifies unchanged empty creation, non-mutating stable-ID round trips, the
inclusive 256 KiB UTF-8 boundary on input and canonical output, and rejected unsafe
keys, cycles, accessors/hooks, depth/visit/array limits and non-JSON values.
The documented synthetic JSON is parsed by the same package. Use the exact example
and test commands in [form definitions](FORM_DEFINITIONS.md).

No browser UI or management write contract changed. D06.2 answer semantics,
D06.3 renderer mappings/fixtures and future save/publish APIs are not counted as
passing this structural task. Full repository/operational checks still protect
compatibility of existing API creation and tenant/transaction contracts.


## D06.2 shared-answer checks

`npm test -- tests/fast/answers.test.ts tests/fast/form-definition.test.ts`
builds the shared package and runs browser-independent fixtures in Node. The
answer suite covers every input and both layout types; required/optional empty
values; numeric zero and boolean false; literal preserved text; exact option IDs,
choice cardinalities/order; email/calendar/rating bounds; snapshot-specific
validation; nonmutation; safe static failures and the inclusive 128 KiB UTF-8 map
budget. The same exported validator parses the documented synthetic example.

The original ten structure tests also protect the reused calendar/JSON guards and
unchanged empty creation. No UI, renderer mapping, HTTP submission, version write
or database persistence is added. Those future flows need their own acceptance;
current local/CI package checks are not end-to-end response acceptance. See
[answer validation](ANSWER_VALIDATION.md) for contracts and exact example commands.
