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
This capability check does not perform a transaction or prove write permissions.
The separate D02.2 fixture below verifies writes/rollback using disposable local
connections; it does not certify another deployment's credentials or future routes.

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

## Transactional persistence fixture

D02.2 | 23 October 2026

With Docker Compose and the pinned toolchain available, run from the repository root:

```bash
npm run test:transactions
```

This builds the API and runs a focused Node test using the API's existing exact
Mongoose dependency, validated configuration and Compose initializer. It generates
its own free loopback port, `vfb-d022-...` Compose project and unique database URL.
It never uses the launching shell's MONGODB_URI or the normal development volume.
No frontend/API listeners or pre-existing database are needed for this command.

Two explicitly created collections, `fixture_heads` and `fixture_values`, contain
only fabricated infrastructure records. They are not production form/version
models. Operations run sequentially through Mongoose's `Connection#transaction`,
with the same session explicitly passed to each operation, snapshot reads,
primary read preference and majority write concern. An independent client checks:

1. Both records remain invisible before commit and become visible after success.
2. Throwing an intentional error after an acknowledged value insert removes that
   pending record and preserves the previously committed pair.
3. Throwing after both insertion and a head-pointer update removes the new record
   and restores the original pointer. Exact record counts and contents are checked
   before any cleanup, so deleting the fixture cannot conceal a failed rollback.
4. A subsequent transaction commits successfully. After the writer closes, a fresh
   connection reads the new pointer, both committed values and zero rolled-back values.

The test closes its connections and removes only its uniquely named containers and
volumes, including on failure. Docker/connection/transaction operations have finite
timeouts; a failed assertion or setup/cleanup failure exits nonzero. Existing runtime
pins, dependency versions, application routes and product models are unchanged.

This demonstrates local persistence and rollback primitives. It does not establish
publish/submit race handling, idempotency, authorization, domain-model validation,
high availability or HTTP exactly-once delivery. Those require their own later tasks.
Full fresh-shell start/stop/reset instructions and sample env files remain D02.3.

References: [Mongoose transactions](https://mongoosejs.com/docs/transactions.html)
and [MongoDB Node driver transactions](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/).

References: [MongoDB development replica sets](https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set-for-testing/)
and [Mongoose connection options and errors](https://mongoosejs.com/docs/connections.html).
