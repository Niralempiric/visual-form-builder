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
No forced peer resolution or install-script permission expansion is used.

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
synthetic infrastructure records, not product forms or respondent data.

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
review, release workflow or production deployment is claimed. The unchanged
body-parser advisory remains recorded in implementation progress; these GET-only
API checks introduce no body parser and do not resolve that advisory.


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
