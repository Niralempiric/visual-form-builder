# Visual Form Builder

A planned self-hostable visual form builder for small teams, with a Next.js/React
frontend, a separate Express API, and MongoDB. See the [project brief](docs/PROJECT_BRIEF.md)
for intended users and the first workshop registration journey.

## Current status

D01.1 defines the product contract and D01.2 provides the pinned TypeScript
workspace. D01.3 adds the first running Next.js page, a real API connection check
and Express process liveness. D02.1 adds local Mongo replica-set initialization,
application connectivity and bounded database readiness. D02.2 verifies committed
and intentionally rolled-back synthetic writes across collections. D02.3 documents
fresh-shell setup, stop/reset and safe local configuration. Form editing,
accounts, publishing and responses are not implemented yet.

## Repository and setup

Public repository: [Niralempiric/visual-form-builder](https://github.com/Niralempiric/visual-form-builder).
The verified local folder is `/home/empiric-60/Public/project/ghfind-score/visual-form-builder`.

Required toolchain: **Node.js 24.21.0 and npm 11.19.0**. With
[nvm](https://github.com/nvm-sh/nvm) installed, run:

```bash
git clone https://github.com/Niralempiric/visual-form-builder.git
cd visual-form-builder
. "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
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

With Docker running and the pinned toolchain installed, create the local config
once, preserving any existing file:

```bash
cp -n .env.example .env
```

Review/edit that private file locally. In **every new terminal** at the checkout
root, load the runtime and configuration before running project commands:

```bash
. "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
nvm use
set -a
. ./.env
set +a
```

Then start the local replica set and foreground application processes:

```bash
npm run db:up
npm run dev
```

Open [the local app](http://127.0.0.1:3000) with the template ports and select
**Check API connection**. The button checks Express liveness through Next.js.
`/health/ready` separately returns 200/ready only when the expected writable Mongo
replica-set primary is available; database loss returns 503/not_ready.

In a second terminal, repeat the runtime/configuration loader above, then run
`npm run test:smoke`. Stop the applications with **Ctrl+C** and run `npm run db:down`
to stop Mongo while keeping its data.

[Local development](docs/LOCAL_DEVELOPMENT.md) contains the exact fresh-shell
install, start, stop, destructive local reset and compiled-mode commands, port
overrides and troubleshooting. The template uses no credentials; actual `.env`
files stay ignored. Express and the database scripts do not auto-load the root
file. Keep Mongo configuration server-only. Use the same API_PORT during build
and start because Next.js compiles rewrites into its output.

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
- [Local development](docs/LOCAL_DEVELOPMENT.md)
- [Reusable one-task prompt](docs/DAILY_TASK_PROMPT.md)

The plan has 40 development-day groups and 24 modules. One invocation completes
one individual task, not all three tasks in a day group. Estimates and future
release outcomes are planning targets, not implemented features or adoption claims.

Next eligible task after D02.3: **D03.1**, shared API success/error envelopes, ID
validation, pagination and correlation IDs. No application has been deployed and no usable form-builder release is claimed.
