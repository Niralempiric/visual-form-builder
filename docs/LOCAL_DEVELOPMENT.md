# Local development

D02.3 | 26 October 2026

These instructions run the current Next.js shell, separate Express API and local
Mongo replica set. Form editing, accounts, publishing and responses are future
work. Use Bash on Linux, Docker Engine with Docker Compose v2 or later, curl and
the pinned Node/npm pair. Start Docker first. Commands below run from the checkout
root; use the [README](../README.md#repository-and-setup) to obtain the source.

## Install the pinned toolchain and dependencies

With nvm already installed, open a shell in the checkout root:

```bash
. "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
nvm install
nvm use
node --version
npm --version
npm ci
npm run check
```

The versions must be Node **24.21.0** and npm **11.19.0**. If npm differs, select
11.19.0 under that nvm runtime before installation. Other version managers may use
`.node-version` with the same pair. The lockfile and engine checks must stay intact.
Docker requires permission to access its daemon; resolve local Docker access if
`docker compose version` or `docker info` fails.

## Create local configuration

Copy the tracked non-secret template once. This preserves an existing `.env`:

```bash
cp -n .env.example .env
```

Review/edit `.env` locally before loading it. Its assignments are shell-compatible;
keep the Mongo URI quoted because it contains `&`. Only source trusted local
configuration. `.env` is ignored by Git; `.env.example` is the shareable template.
No account password or signing secret is needed for this foundation.

| Variable | Meaning / template default |
|---|---|
| COMPOSE_PROJECT_NAME | Local containers/volumes namespace: `visual-form-builder-local` |
| PORT | Next.js loopback port: 3000 |
| API_PORT | Express loopback port and Next rewrite destination: 4000 |
| MONGO_PORT | Host loopback Mongo port: 27019 |
| MONGODB_REPLICA_SET | Keep `vfb-rs` for the supplied Compose definition |
| MONGODB_URI | Server-only local URI from the template; its port must match MONGO_PORT |

For a second checkout/instance, choose a distinct COMPOSE_PROJECT_NAME and unused
ports in its `.env`. If MONGO_PORT changes, change the URI's port too. Do not stop
unrelated services to free a port. API_PORT must be 1–65535. Mongo advertises its
container hostname internally; the host URI needs `directConnection=true`.

## Every fresh terminal

In **each** terminal opened at the checkout root, run this before any start, check,
stop or reset command below:

```bash
. "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
nvm use
set -a
. ./.env
set +a
```

The exports apply only to that shell and its children. The separate Express
process and database script do not automatically load the root `.env`; Next.js's
own env-file behavior does not configure them. Do not put Mongo settings or other
private values in NEXT_PUBLIC_ variables. Do not print configuration to debug it.

## Start development

After loading the terminal configuration:

```bash
npm run db:up
npm run dev
```

`db:up` initializes `vfb-rs` idempotently and waits for a writable primary. `dev`
keeps the frontend/API in the foreground. Open http://127.0.0.1:3000 with template
ports (use your PORT override otherwise), then select **Check API connection**.
The button checks process liveness. Readiness separately checks Mongo capability.
No worker is started yet.

## Check a running stack

Open a second terminal, run **Every fresh terminal**, then:

```bash
npm run test:smoke
curl --fail --silent --show-error "http://127.0.0.1:${API_PORT}/health/ready"
curl --fail --silent --show-error "http://127.0.0.1:${PORT}/health/ready"
```

The smoke check verifies the page and direct/proxied live/ready endpoints. Healthy
readiness returns `status: "ready"` and service `visual-form-builder-api` with
Cache-Control: no-store. Mongo loss returns 503/not_ready; liveness stays 200 while
the API runs. These checks do not establish a working form journey.

For schema and API-contract checks independent of Mongo or the running stack,
run `npm run test:contracts`. See [API contracts](API_CONTRACTS.md) for current
JSON errors, correlation headers, identifiers and bounded pagination helpers.

## Stop without deleting data

Press **Ctrl+C** in the terminal running `npm run dev` (or `npm run start`) to stop
both application listeners. In a configured terminal at the same checkout root:

```bash
npm run db:down
```

This removes this Compose project's containers/network and preserves its Mongo
volumes. To resume with the same data, follow **Every fresh terminal** and **Start
development** again. Keep the same COMPOSE_PROJECT_NAME to use the same volumes.

## Reset this local database

Stop the application with Ctrl+C first. Load **Every fresh terminal** from the
checkout whose local data you intend to erase. The following command deletes that
COMPOSE_PROJECT_NAME's Mongo data/config volumes, including all its local records.
Use it only for disposable development data; retain a backup if the data matters.
It preserves source and `.env` and does not target other Compose project names.

```bash
docker compose -f infra/compose.yaml down --volumes
npm run db:up
npm run dev
```

The new volume starts an empty replica set. Re-run **Check a running stack** in a
separately configured terminal. Nothing automatically seeds forms or creates users.

## Build and run the compiled applications

Stop development listeners first. In a configured terminal:

```bash
npm run db:up
npm run build
npm run start
```

Keep the same API_PORT at build and start: Next.js compiles the proxy destination
into its build. After changing that port, rebuild before starting. Run the same
second-terminal smoke commands to check this mode. Stop with Ctrl+C and
`npm run db:down` as above. This is a local compiled run, not a production deployment.

## Additional repository checks

From a configured terminal, with dependencies installed:

```bash
npm run check
npm run test:readiness
npm run test:transactions
```

The database suites allocate their own ports, containers and synthetic data and
remove only their own fixtures. They do not need the normal development database
or running application. [Database details](DATABASE.md) describe their boundaries.
Lint and general test harnesses are D03.2; CI is D03.3 and is not configured yet.

## Troubleshooting

- **Invalid configuration: MONGODB_URI:** reload **Every fresh terminal** in the
  failing shell. Standalone Express does not load the root file automatically.
- **Port in use / EADDRINUSE:** choose unused ports in `.env`, reload every terminal
  and restart. Update both MONGO_PORT and the URI port; rebuild if API_PORT changed
  for compiled mode. A different Next port may be reported when its preferred port
  is busy; choose a fixed unused PORT so smoke checks match it.
- **Mongo connection failure / 503 readiness:** run `npm run db:up`; check Docker
  access and matching URI port/set name. The supplied single-node replica set is
  local-only and unauthenticated; hosted provisioning remains a later task.
- **Incompatible replica configuration:** initialization refuses to replace it.
  Check the intended project namespace; use the reset procedure only if that
  namespace's data is disposable.

Report reproducible setup problems in the [repository issues](https://github.com/Niralempiric/visual-form-builder/issues)
with tool versions, command names and sanitized errors. Keep `.env`, authenticated
Git URLs, credentials and real answers out of reports.
