# Local database foundation

D02.1 | 22 October 2026

The API now connects through Mongoose 9.11.3 to a local MongoDB 8.0.32 single-node
replica set named `vfb-rs`. This is local development infrastructure; it has no
database authentication or high-availability guarantee. Docker publishes its port
only on 127.0.0.1. Use synthetic data. Full production provisioning remains later work.

## Start and check

From the repository root, with Docker Compose and the pinned Node/npm pair available:

```bash
npm ci
npm run db:up
export MONGODB_URI='mongodb://127.0.0.1:27019/visual_form_builder?replicaSet=vfb-rs&directConnection=true'
npm run dev
```

In another terminal:

```bash
curl -i http://127.0.0.1:4000/health/live
curl -i http://127.0.0.1:4000/health/ready
curl -i http://127.0.0.1:3000/health/ready
```

Use the matching API_PORT/PORT if overridden. The existing Next.js rewrite forwards
health requests; the existing page button still checks process liveness only.
No frontend component receives the database URL.

`db:up` starts Mongo, runs the bounded initializer, and waits for health. Repeating
it preserves the existing set configuration and data. The initializer refuses to
replace an incompatible configuration. Images are pinned by version and SHA-256.
The Compose project defaults to `visual-form-builder-local`, with separate named
data/config volumes. `COMPOSE_PROJECT_NAME` may isolate another local instance.

The replica advertises `mongo:27017` inside the Compose network. Host processes use
the published loopback port with `directConnection=true` to avoid discovering an
unresolvable container hostname. `MONGO_PORT` defaults to 27019. If occupied, use
`MONGO_PORT=27029 npm run db:up`, and set the URI port to 27029 as well. Do not stop
an unrelated process to free the default port.

Stop the application with Ctrl+C. `npm run db:down` stops this Compose project
without deleting its volumes. Full fresh-shell start/stop/reset documentation and
placeholder environment files are D02.3; no reset command is provided in this task.

## API configuration and failure behavior

| Setting | Contract |
|---|---|
| MONGODB_URI | Required server-only `mongodb://` or `mongodb+srv://` value; never use NEXT_PUBLIC_ |
| MONGODB_REPLICA_SET | Expected set name, defaults to `vfb-rs`; supplied to the driver and checked by readiness |
| API_PORT | Decimal integer 1–65535, defaults to 4000; bind stays on 127.0.0.1 |

The API reads process variables; it does not automatically load an env file.
Missing/invalid settings exit 1 with field names only. Initial Mongo connection
failure exits 1 without binding HTTP or printing URI, credentials, topology or
driver error details. Standalone Mongo and a different replica-set name are rejected.
After connection, driver reconnection supports transient outages.

`GET /health/live` remains 200 while the HTTP process runs. `GET /health/ready`
uses an actual `hello` operation with a 1000ms driver operation deadline, requires
the expected set name, writable primary, sessions and transaction-capable wire
protocol, and returns 200/ready or 503/not_ready. Both return the existing service
name and Cache-Control: no-store. No database address or data is returned.
This capability check does not perform a transaction or prove write permissions;
the intentional persistence/rollback fixture is D02.2.

Initial server selection and socket connection each have a 5000ms budget.
Model buffering, automatic collections and automatic index creation are disabled.
Graceful shutdown drains HTTP and closes the Mongo pool within one 5-second budget.

## Verification

```bash
npm run check
npm run build
npm run test:readiness
```

The focused Node test suite builds the API, allocates free loopback ports and
creates uniquely named Docker fixtures. It checks empty-volume startup, repeated
initialization, live/ready HTTP contracts, a stalled Mongo deadline, stop/restart
recovery, safe invalid/unreachable configuration, standalone rejection, bind
failure cleanup and graceful shutdown. Its cleanup removes only its own fixture
containers/volumes. It never uses the normal development database or real responses.
The broader Vitest/Supertest fixture harness remains D03.2.

References: [MongoDB development replica sets](https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set-for-testing/)
and [Mongoose connection options and errors](https://mongoosejs.com/docs/connections.html).
