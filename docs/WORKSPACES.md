# Workspace and empty-draft foundation

D05.1–D05.3 | 4 November 2026

A signed-in author can create a workspace, become its owner, and create/read its
first empty draft through Express. D05.2 adds scoped lists and the protected
[dashboard](DASHBOARD.md) at `/app`, including workspace switching and saved-draft
opening. D05.3 verifies the complete shipped endpoint inventory with
[two-workspace tenant denial checks](TENANT_ISOLATION.md), including current
membership/lifecycle boundaries and state preservation after denied writes.

## Protected API

All paths follow `/api/v1`. Use [local setup](LOCAL_DEVELOPMENT.md), an existing
[bootstrapped author](AUTHENTICATION.md), and the [session flow](SESSIONS.md).
Responses use strict shared envelopes, correlation IDs and `Cache-Control: no-store`.
No management request is authorized by a private/public form ID alone.

| Method/path | Input and permission | Result |
|---|---|---|
| `GET /workspaces` | Active author; bounded cursor/limit query | 200 page of active workspaces with current membership |
| `GET /workspaces/:workspaceId/forms` | Active author with membership in the active workspace; bounded cursor/limit query | 200 page of form summaries |
| `POST /workspaces` | Active author; JSON `{ name }` | 201 workspace with server-assigned owner membership |
| `GET /workspaces/:workspaceId` | Active author with membership in an active workspace | 200 workspace and the caller's actual role |
| `POST /workspaces/:workspaceId/forms` | Active workspace owner with its matching owner membership; JSON `{ title }` | 201 server-generated initial form/draft |
| `GET /forms/:formId` | Active author with owner/editor/viewer membership in the form's active workspace | 200 allowlisted initial form/draft |

POSTs require the exact configured Origin, session cookie and matching
`X-CSRF-Token` before parsing. JSON is limited to 8 KiB, with no compression.
Names are trimmed plain text of 1–80 UTF-16 code units; initial form titles are
trimmed plain text of 1–160. HTML-looking titles remain literal text. Unknown keys,
Mongo operators, arrays, invalid IDs and caller-selected owner/role/workspace/draft/
publication fields are rejected. IDs come only from validated route parameters
and authenticated user context. No signup, invitation or membership-edit endpoint
is introduced here. Only the owner creates forms in this initial foundation;
existing owner/editor/viewer memberships can read the records as in the plan.

Missing identity is 401, Origin/CSRF mismatch 403, and malformed input 400 (oversize
413). A missing workspace/form, deleting form, inactive workspace or insufficient
membership is indistinguishable as 404. The 25-active-form ceiling or uniqueness
conflict returns 409. Dependency failures return the safe 503 envelope without raw errors, query
objects, credentials or validation details. Mutation success means its transaction
committed; a lost response can still leave a committed record. Creation has no
idempotency key/automatic retry contract: inspect the result before retrying, or
you may create another workspace/form. Duplicate names are intentionally allowed.

## A local synthetic example

Load the pinned runtime/private local configuration as in the local guide, start
Mongo and Express, and bootstrap an account if none exists. Run this from another
configured terminal. It prompts for the existing password without echoing it,
keeps cookies/CSRF only in memory, writes to fixed loopback Express, prints only
workspace/form DTOs, and signs out its own new session. Never put passwords,
cookies or CSRF values on a command line or in a bug report. This example creates
clearly synthetic metadata; it does not collect answers or publish a form.

```bash
python3 - <<'PYCLIENT'
import getpass, http.cookiejar, json, os, urllib.error, urllib.request
port = int(os.environ.get('API_PORT', '4000'))
origin = os.environ.get('APP_ORIGIN', 'http://127.0.0.1:3000')
base = f'http://127.0.0.1:{port}/api/v1/'
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(path, body=None):
    headers = {}
    if body is not None:
        csrf = call('auth/csrf')['data']['csrfToken']
        headers = {'Content-Type': 'application/json', 'Origin': origin, 'X-CSRF-Token': csrf}
    request = urllib.request.Request(base + path,
        data=None if body is None else json.dumps(body).encode(), headers=headers)
    with client.open(request, timeout=20) as response:
        return json.load(response)
signed_in = False
try:
    call('auth/login', {'email': input('Existing author email: '), 'password': getpass.getpass('Existing password: ')})
    signed_in = True
    workspace = call('workspaces', {'name': 'Synthetic workshop workspace'})['data']
    form = call('workspaces/' + workspace['id'] + '/forms', {'title': 'Synthetic workshop registration'})['data']
    observed = call('forms/' + form['id'])['data']
    print(json.dumps({'workspace': workspace, 'form': observed}, indent=2))
except urllib.error.HTTPError as error:
    print('Request failed with HTTP status', error.code)
except (urllib.error.URLError, TimeoutError):
    print('Connection failed; a creation may already have committed. Check before retrying.')
finally:
    if signed_in:
        try:
            call('auth/logout', {})
        except (urllib.error.URLError, TimeoutError):
            print('Sign-out could not be confirmed; the session still has its fixed expiry.')
PYCLIENT
```

## Storage and shared schema

Workspace creation transactionally inserts `workspaces` and its one owner
`memberships` record, using the authenticated user ID. A unique compound index on
(workspaceId, userId) prevents duplicate membership. The transaction also checks
that the user is still active. It uses snapshot reads, majority writes and the
existing five-second maximum commit time. All transaction operations are awaited
sequentially. No independent writes masquerade as atomic creation.

Form creation rechecks the owner membership and active workspace in a transaction.
A private workspace `formSequence` write serializes count checks and creation.
The query counts records not marked deleting; at most 25 active records may be
created per workspace, including concurrent API instances. Failed admission or
insert rolls back the sequence/timestamp changes. Future membership/state/delete
operations must preserve their own transaction/authorization contracts; this task
does not claim to cancel an already-authorized in-flight request.

Each form has its own immutable workspace binding, random UUID publicId and
unique publicId index. The workspace/updatedAt/ID index supports scoped form lists. A second membership
index on (userId, workspaceId) supports current-author workspace discovery.
The public ID currently exposes no public endpoint or response-reading capability.
The record starts with:

- `draftSchema`: schemaFormatVersion 1, matching title, empty description, steps,
  fields and visibilityRules, and neutral theme.
- `draftRevision: 0`, `currentVersionId: null`, `availability: "draft"`.
- Empty acceptedWindows, acceptedCount 0, retentionDays 30, server UTC timestamps.

`packages/form-schema` owns the strict initialDraftSchema and factory; API and
contracts use that same definition. This validates **only the canonical empty
creation shape**, not arbitrary fields/rules. D06.1 adds separate
[structural definition validation](FORM_DEFINITIONS.md); it does not widen these
creation endpoints. Answer validation/renderer mappings, draft editing/revision
increments and immutable publication belong to later tasks. No placeholder field
IDs, answers, versions or signed contexts are created. Root Mongo schemas are strict; the draft's Mixed storage is constrained
by the strict shared validator. Defaults are server-generated, not client-supplied.
Every response is explicitly allowlisted; Mongo internal fields and private
formSequence are not returned. Startup creates collections/indexes additively,
without resetting data, syncing/dropping indexes or running a normal-data seed.

## Verification and limits

Fast tests cover bounded/strict contracts, separate mutable initial objects,
server-owned fields, parser/ID failures and guard ordering before persistence.
Actual isolated Mongo/API tests cover the signed-in owner journey, independent
reader/API-instance persistence, unique membership/public indexes, generic scope
and identity failures, and rollback of workspace/member and workspace/form writes.
At the capacity boundary, two API instances produce one 201 and one 409, leaving
exactly 25 forms. Fixture cleanup verifies only its generated namespace is removed.

Run `npm run check`, `npm test`, `npm run test:db`, `npm run build`,
`npm run test:readiness` and `npm run test:transactions` with the pinned toolchain.
D05.1 was backend-only; D05.2 browser acceptance and reproduction are described
in [dashboard usage](DASHBOARD.md). Field editing, publishing, submission, retention
execution, role management, and the complete create-publish-submit-inspect-export
release journey remain pending. Existing authentication deployment limits and the
separate development-only audit finding remain recorded in progress. No new
production dependency, deployment, release or adoption is implied.

References: [Mongoose transactions](https://mongoosejs.com/docs/transactions.html),
[MongoDB unique indexes](https://www.mongodb.com/docs/manual/core/index-unique/).


## List contracts (D05.2)

Both list GETs return `{ data: [...], nextCursor: string | null, correlationId }`.
They use the shared pagination contract: default 25, maximum 100; strict unknown,
repeated or malformed query parameters fail with safe 400. Pass `nextCursor`
unchanged as `cursor`. Ordering is updatedAt descending, then ObjectId descending;
equal timestamps do not duplicate/skip records on a static dataset. This is a
live keyset list, not a snapshot: concurrent changes can move records, and Refresh
starts again. Cursors contain no authority; the current user/workspace predicates
apply independently of the cursor. No totals or arbitrary filtering are exposed.

Workspace lists join current owner/editor/viewer memberships with active
workspaces. Form lists require current membership in the requested active
workspace and exclude deleting records. Each form summary contains only id,
workspaceId, title, availability, draftRevision and updatedAt; no draft content,
public ID, internal counter, user credential or answer data. Existing initial
forms have draft availability and revision zero. Queries have a bounded execution
time and limit+1 lookahead. Expired identity is 401, unavailable scope 404 and
dependency failure 503, using the existing safe errors and no-store policy.
