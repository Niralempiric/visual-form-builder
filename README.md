# Visual Form Builder

A planned self-hostable visual form builder for small teams, with a Next.js/React
frontend, a separate Express API, and MongoDB. See the [project brief](docs/PROJECT_BRIEF.md)
for intended users and the first workshop registration journey.

## Current status

D01.1 defines the product contract. D01.2 adds the installable TypeScript workspace
and pinned dependencies. Application pages, API routes and service startup are
scheduled for D01.3; this checkout does not yet run a form builder.

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
No database, environment file or credentials are required for the current checks.

## Workspace and commands

| Location | Responsibility |
|---|---|
| `apps/web` | Next.js App Router frontend; page entry points pending D01.3 |
| `apps/api` | Express API; startup and liveness route pending D01.3 |
| `apps/worker` | Separate Node cleanup/reconciliation worker scaffold |
| `packages/form-schema` | Shared form definitions and validation scaffold |
| `packages/form-renderer` | Shared preview/public React renderer scaffold |
| `packages/contracts` | Shared API contracts scaffold |
| `packages/test-fixtures` | Future synthetic schema/answer fixtures |
| `tests/e2e`, `infra`, `.github` | Placeholders for browser suites, hosting setup and CI |

| Command | Current behaviour |
|---|---|
| `npm ci` | Install exact dependencies from the committed root lockfile |
| `npm run check:runtime` | Check the runtime pins and current Node/npm versions |
| `npm run build:packages` | Emit the four shared packages' JavaScript and declarations |
| `npm run typecheck` | Build shared package declarations, then check all seven workspaces |
| `npm run check` | Run the runtime and workspace TypeScript checks |

The shared package entry points currently export no product behaviour. Passing
these checks proves the workspace/toolchain works, not that forms or services work.
Development/start, full application builds, lint and test commands will be added
with their executable implementations in the corresponding tasks.

## Dependency selections

Exact direct versions are pinned in manifests; `package-lock.json` fixes the full
dependency graph. Registry engine and peer constraints were checked during D01.2.

| Selection | Version |
|---|---|
| Node.js / npm | 24.21.0 / 11.19.0 |
| TypeScript / tsx | 7.0.2 / 4.23.15 |
| Next.js | 16.4.2 |
| React / React DOM | 19.3.1 / 19.3.1 |
| Express / Express types | 5.3.0 / 5.0.6 |
| Zod | 4.6.7 |
| Tailwind CSS / Tailwind PostCSS | 4.3.3 / 4.3.3 |
| Node types (24.x) | 24.19.2 |
| React / React DOM types | 19.3.0 / 19.3.0 |

Node 24 is an LTS baseline; the selected Next.js package requires Node >=20.9
and accepts React 19. React DOM's peer requirement matches React 19.3.1.
See [Node release status](https://nodejs.org/en/about/previous-releases),
[Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
and the package manifests for requirements. Other planned tools such as Mongoose,
Zustand, TanStack Query, React Hook Form, dnd-kit and test runners remain for the
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

Next eligible task after D01.2: **D01.3**, the first Next.js page and Express
liveness route. No application has been deployed and no usable release is claimed.
