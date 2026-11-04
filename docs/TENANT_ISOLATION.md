# Management tenant isolation

D05.3 | 4 November 2026

This contract covers the six shipped workspace/form endpoints below. Express is
responsible for authorization; hiding a link or knowing an ObjectId/public UUID
never grants access. Use [workspace usage](WORKSPACES.md) and [sessions](SESSIONS.md)
for setup and protected requests. All examples/tests use synthetic metadata.

## Current endpoint inventory

Paths are relative to `/api/v1`. Every request resolves its current active author
from the opaque session cookie. Roles/actor/workspace headers never select identity.

| Endpoint | Authoritative scope and positive control | Denial evidence |
|---|---|---|
| `GET /workspaces` | Current owner/editor/viewer memberships joined to active workspaces | Each independent owner sees only their own workspace; removed/unknown membership and inactive workspaces are excluded |
| `POST /workspaces` | Active author becomes server-assigned owner plus owner member atomically | Caller-supplied ownerId is rejected; anonymous/invalid author contexts cannot write |
| `GET /workspaces/:workspaceId` | Current membership in that active workspace | Foreign, absent, removed-member and inactive scopes return the same safe 404 |
| `GET /workspaces/:workspaceId/forms` | Current membership in that active workspace; scoped non-deleting form query | Foreign scope and even a genuine cursor obtained from it grant no access |
| `POST /workspaces/:workspaceId/forms` | Matching owner membership and active workspace ownerId inside the existing transaction | Ownership elsewhere, viewer/editor membership here, ownerId without membership and foreign/missing/inactive scope cannot create a form |
| `GET /forms/:formId` | Form query joins current workspace membership and active workspace; excludes deleting forms | Guessed foreign IDs, workspace IDs used as form IDs, removed membership and orphaned/deleting scope expose no draft |

Membership and scope are read from Mongo for each request, including across API
instances with already-valid sessions. No tenant permission is cached in a browser
or session role claim. Authorization changes do not promise cancellation of a
request already authorized in flight; future role/state mutations must preserve
their transaction contracts. The broader role-policy implementation remains D21.
The current create-form contract is owner-only; these tests do not enable editor
creation, invitations or role-management endpoints.

All GETs and errors remain `Cache-Control: no-store`, with the shared safe error
and correlation-ID contracts. Missing/expired/revoked/disabled identity is 401;
Origin/CSRF rejection is 403 before JSON/persistence work. Inaccessible valid
object IDs return 404 with the same code/message as an absent object; malformed
IDs/input return 400. Unknown owner/workspace body keys and Mongo operators are
rejected by strict contracts. CSRF from the other author does not match this
session. Cursors are pagination positions, never capabilities.

D05.3 adds the missing non-deleting predicate to direct form reads. Previously a
form already marked deleting reached the initial-draft DTO parser and returned a
safe 503; it now returns 404, consistent with lists. This corrects unavailable-object
handling; it is not evidence that foreign draft content was exposed before the fix.
No deletion, editing, public-response or publication endpoint is added here.

## Reproduce the checks

Use the pinned toolchain and Docker as in [testing](TESTING.md), then run:

```bash
npm test -- tests/fast/tenant-guards.test.ts
npm run test:db -- tests/integration/tenant-isolation.test.ts
```

The fast test exercises all six route guards before malformed input or persistence,
with positive controls proving only the session's verified actor reaches the store.
The Mongo suite creates two independent synthetic accounts/workspaces and two
forms per workspace through the real authenticated API. It checks reads and
creation denial in both directions, forged actor/scope hints, real foreign cursors,
wrong-session CSRF and unauthenticated access. Independent-reader state hashes
cover forms, workspaces, timestamps/private admission counters and memberships
before/after denied requests. Then both owners successfully create their own form.

Other scenarios check existing membership roles in the correct workspace, invalid/
removed memberships, ownerId without membership, deleting/missing workspaces,
deleting forms, disabled users, explicit session expiry and actual logout/replay.
A second API instance observes membership/lifecycle changes without restarting or
issuing a new cookie. Only isolated generated fixture namespaces are modified and
removed, with cleanup verified. No normal development seed/reset or actual
respondent data is used. Tests never print session cookies, CSRF or password hashes.

The individual D05.3 completion check is that guessed object IDs cannot read or
mutate another workspace. See [implementation progress](IMPLEMENTATION_PROGRESS.md)
for observed results, including the failing-before/passing-after lifecycle check.
Future save/publish/response/export/team endpoints must extend this inventory and
denial coverage when they ship; their absence is not a passing permission test.
