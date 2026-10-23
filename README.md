# Visual Form Builder

A planned self-hostable visual form builder for small teams, with a Next.js/React
frontend, a separate Express API, and MongoDB. See the [project brief](docs/PROJECT_BRIEF.md)
for intended users and the first workshop registration journey.

## Current status

D01.1 defines the product contract and D01.2 provides the pinned TypeScript
workspace. D01.3 adds the first running Next.js page, a real API connection check
and Express process liveness. D02.1 adds local Mongo replica-set initialization,
application connectivity and bounded database readiness. D02.2 verifies committed
and intentionally rolled-back synthetic writes across collections. Form editing,
accounts, publishing and responses are not implemented yet.

## Repository and setup

Public repository: [Niralempiric/visual-form-builder](https://github.com/Niralempiric/visual-form-builder).
The verified local folder is `/home/empiric-60/Public/project/ghfind-score/visual-form-builder`.

Required toolchain: **Node.js 24.21.0 and npm 11.19.0**. With
[nvm](https://github.com/nvm-sh/nvm) installed, run:

```bash
git clone https://github.com/Niralempiric/visual-form-builder.git
cd visual-form-builder
nvm install
nvm use
node --version
npm --version
npm ci
npm run check
```

For an existing checkout, start at `nvm install` from its repository root.
The version commands must print `v24.21.0` and `11.19.0`. If your installation's
npm differs, select npm 11.19.0 before `npm ci` (for example, `npm install --global npm@11.19.0`
under the selected nvm runtime). Engine checks reject mismatched versions.
Typechecking needs no database or credentials. Running the API now requires the
local replica set and server-only MONGODB_URI configuration below.

## Run locally

Start Docker, then run:

```bash
npm run db:up
export MONGODB_URI='mongodb://127.0.0.1:27019/visual_form_builder?replicaSet=vfb-rs&directConnection=true'
npm run dev
```

Open [the local app](http://127.0.0.1:3000) and select **Check API connection**.
The browser requests `/health/live` on the same origin; Next.js proxies it to the
Express process at `http://127.0.0.1:4000/health/live`. A successful response is:

```json
{ "status": "ok", "service": "visual-form-builder-api" }
```

This means the API process is alive. `/health/ready` separately returns 200 with
`{ "status": "ready", "service": "visual-form-builder-api" }` only when Mongo
responds as the configured writable replica-set primary with session support.
It returns 503 with `status: "not_ready"` on dependency loss; liveness stays 200.
Readiness does not establish that later publish/submit transactions work.
The response uses `Cache-Control: no-store`. If the API is stopped, the page shows
**API unavailable** and allows another attempt. The request times out after five seconds.

In another terminal, with both services running:

```bash
npm run test:smoke
```

This verifies the page, direct/proxied Express liveness and replica-set readiness over HTTP.
Stop the development processes with **Ctrl+C**. Both listeners are local-only.
`npm run db:down` stops this project's database and preserves its volumes.

To run the compiled local applications:

```bash
npm run build
npm run start
```

If default ports are occupied, set `PORT` (Next.js) and `API_PORT` (Express and the
proxy) in the launching shell. For example:

```bash
PORT=3103 API_PORT=4103 npm run dev
# In the smoke-test terminal, use those same ports:
PORT=3103 API_PORT=4103 npm run test:smoke
```

`API_PORT` must be an integer from 1 to 65535. For compiled applications, use the
same `API_PORT` during **both build and start**, because Next.js records rewrites
in its build output. Defaults are 3000/4000. Use shell variables for shared overrides;
the API uses the exported MONGODB_URI and does not auto-load Next.js environment
files. MONGODB_REPLICA_SET defaults to `vfb-rs`. Database port overrides and exact
readiness/failure behavior are documented in [Database foundation](docs/DATABASE.md).
Production hosting/proxy configuration belongs to later tasks.

## Workspace and commands

| Location | Responsibility |
|---|---|
| `apps/web` | Next.js App Router preview page and API connection control |
| `apps/api` | Express liveness/readiness, validated configuration and Mongo connection lifecycle |
| `apps/worker` | Separate Node cleanup/reconciliation worker scaffold |
| `packages/form-schema` | Shared form definitions and validation scaffold |
| `packages/form-renderer` | Shared preview/public React renderer scaffold |
| `packages/contracts` | Shared API contracts scaffold |
| `packages/test-fixtures` | Future synthetic schema/answer fixtures |
| `infra` | Local single-node Mongo replica-set Compose and idempotent initialization |
| `tests` | Focused readiness regression checks; full harnesses remain future work |
| `tests/e2e`, `.github` | Placeholders for browser suites and CI |

| Command | Current behaviour |
|---|---|
| `npm ci` | Install exact dependencies from the committed root lockfile |
| `npm run check:runtime` | Check the runtime pins and current Node/npm versions |
| `npm run build:packages` | Emit the four shared packages' JavaScript and declarations |
| `npm run typecheck` | Build shared declarations, generate Next.js types, then check all seven workspaces |
| `npm run check` | Run the runtime and workspace TypeScript checks |
| `npm run dev` | Start Next.js and Express development watchers together |
| `npm run dev:web` / `npm run dev:api` | Run one development service separately |
| `npm run build` | Compile shared packages, Express and the Next.js application |
| `npm run start` | Start both previously built local applications |
| `npm run test:smoke` | Verify the running page and direct/proxied live/ready health |
| `npm run db:up` / `npm run db:down` | Initialize/wait for local replica set; stop without deleting volumes |
| `npm run test:readiness` | Build API and test isolated Docker replica-set readiness/failure/recovery |
| `npm run test:transactions` | Build API and verify isolated multi-collection commit, rollback and persistence |

The shared packages still export no form behaviour. The smoke script checks the
initial page and direct/proxied health. The readiness suite verifies local replica-set
availability. The transaction suite creates a separate disposable replica set,
checks cross-collection commit/rollback with independent readers, and removes only
its own fixture data/volumes. It does not test future publish/submit routes or form
journeys. See [database verification](docs/DATABASE.md#transactional-persistence-fixture).
Lint and broader unit/API/browser suites are scheduled later.

Next.js generates `next-env.d.ts` and `.next` route types locally; they are ignored
by Git and regenerated by `next typegen` before web typechecking. The generated
`apps/web/AGENTS.md` is tracked so future work follows the installed Next.js guides.

## Dependency selections

Exact direct versions are pinned in manifests; `package-lock.json` fixes the full
dependency graph. Registry engine and peer constraints were checked when each
dependency was introduced.

| Selection | Version |
|---|---|
| Node.js / npm | 24.21.0 / 11.19.0 |
| TypeScript / tsx | 7.0.2 / 4.23.15 |
| Next.js | 16.4.2 |
| React / React DOM | 19.3.1 / 19.3.1 |
| Express / Express types | 5.3.0 / 5.0.6 |
| Mongoose | 9.11.3 |
| Local MongoDB | 8.0.32, image digest pinned in infra/compose.yaml |
| concurrently | 10.0.6 |
| Zod | 4.6.7 |
| Tailwind CSS / Tailwind PostCSS | 4.3.3 / 4.3.3 |
| Node types (24.x) | 24.19.2 |
| React / React DOM types | 19.3.0 / 19.3.0 |

Node 24 is an LTS baseline; the selected Next.js package requires Node >=20.9
and accepts React 19. React DOM's peer requirement matches React 19.3.1.
See [Node release status](https://nodejs.org/en/about/previous-releases),
[Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
and the package manifests for requirements. Mongoose requires Node >=20.19.0
and is MIT licensed. Other planned tools such as Zustand, TanStack Query, React Hook Form, dnd-kit and test runners remain for the
tasks that introduce their behaviour and configuration.

Private workspace packages are linked locally using `*`; these links are not
unbounded external dependencies. External direct packages use exact versions. The npm install-script approval is
limited to the locked `esbuild@0.28.2` used by tsx.
Keep real environment files, credentials and respondent data out of Git; generated
dependencies, build output and local environment files are ignored.

## Project documents and next task

- [Project brief](docs/PROJECT_BRIEF.md)
- [Architecture, contracts and 120-task plan](docs/PROJECT_DOCUMENTATION.md)
- [Task board](docs/TASK_BOARD.md)
- [Growth checklist](docs/NIRAL_PROJECT_GROWTH_CHECKLIST.md)
- [Implementation evidence](docs/IMPLEMENTATION_PROGRESS.md)
- [Reusable one-task prompt](docs/DAILY_TASK_PROMPT.md)

The plan has 40 development-day groups and 24 modules. One invocation completes
one individual task, not all three tasks in a day group. Estimates and future
release outcomes are planning targets, not implemented features or adoption claims.

Next eligible task after D02.2: **D02.3**, exact local start/stop/reset commands
and safe placeholder environment configuration. No application has been deployed and no usable form-builder release is claimed.
