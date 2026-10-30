# Visual Form Builder Project Documentation

MERN architecture with Next.js and a forty day implementation plan

Version 1.0 | 21 October 2026 | Project owner and public account Niralempiric

Build an original, self-hostable visual form builder for small teams. An author creates a form without editing code, publishes a link, receives validated responses, and exports results. The central design rule is that a response always belongs to the exact immutable form version the respondent completed.

This document is an implementation specification and ordered backlog. It covers the product, modules, journeys, UI behaviour, contracts, persistence, quality checks, releases and task selection. All features are proposed work. Documentation creation does not mean application tasks are implemented.

Planning assumption: one developer with working MERN knowledge, 5 to 6 focused hours per development day, approximately 200 to 240 hours across 40 development days. Dependencies, testing, review and documentation are included. Beginners or expanded production requirements need additional time. A development day is not a guaranteed calendar date.

## How to use the plan

1. Read sections 1 to 4 to understand the product and architecture.
2. Use section 5 as the module reference while implementing.
3. Use sections 6 to 8 for schemas, APIs and acceptance requirements.
4. Select the next eligible task in section 9 or TASK_BOARD.md.
5. Complete its individual acceptance check before marking it done.
6. Update IMPLEMENTATION_PROGRESS.md and the task board after each run.

There are **40 day groups and 120 individual tasks**, D01.1 through D40.3. A one-task daily prompt completes one task per invocation, so three successful invocations generally finish a day group. Running that prompt once per calendar day could take 120 calendar days, not 40. Day-level release checks must not be used to block an earlier individual task on features scheduled later.

Build application code during Day 01. D01.1 is the short product contract; D01.2 sets up the workspace and D01.3 creates the initial running frontend and API. Do not turn the first week into documentation-only work.

### Contents

- [1 Product overview](#1-product-overview)
- [2 Scope and release journey](#2-scope-and-release-journey)
- [3 Stack and architecture](#3-stack-and-architecture)
- [4 User journeys and processing flows](#4-user-journeys-and-processing-flows)
- [5 Module specifications](#5-module-specifications)
- [6 Form schema and data model](#6-form-schema-and-data-model)
- [7 API and screen contracts](#7-api-and-screen-contracts)
- [8 Quality limits and operating rules](#8-quality-limits-and-operating-rules)
- [9 Forty day ordered backlog](#9-forty-day-ordered-backlog)
- [10 Development workflow and release evidence](#10-development-workflow-and-release-evidence)
- [11 Public project growth](#11-public-project-growth)
- [12 References and later opportunities](#12-references-and-later-opportunities)

## 1 Product overview

### Problem

Small teams need registration forms, product surveys, event interest forms and feedback questionnaires. Hand-coding each one repeats validation, layout and response-management work. A form builder lets a team configure these behaviours and keep control of the code and hosting.

The initial audience is developers, small agencies, community organizers and internal operations teams. Start with non-sensitive synthetic examples. The shared demo must not invite users to enter passwords, payment details or actual customer information.

### Core outcome

An author creates a workshop registration form with name, email and a session dropdown. They preview it, publish it and share the URL. A respondent submits it without creating an author account. The author sees the response with the original labels and selected option, even after publishing a revised form later.

### Product principles

- Editing is visual and keyboard-accessible; dragging is a convenience, not a requirement.
- One schema drives preview, public rendering and server validation.
- Draft changes do not silently change a published form.
- Public forms reveal their questions, never their collected responses or workspace settings.
- Required fields and conditional visibility are enforced on the server as well as in the UI.
- A successful submission means the response was durably stored.
- Historical response interpretation is preserved across form edits.
- A public source repository is separate from the privacy of deployed response data.

### Success measures

- A fresh maintainer starts a private instance from the README.
- An author publishes a useful form without modifying application code.
- A respondent completes that form using a phone or keyboard alone.
- An author can find the response and export results without mislabeling historical fields.
- Cross-workspace access, duplicate retries and version changes are covered by evidence.
- Testers' observed problems become actionable issues rather than invented activity.

## 2 Scope and release journey

### Milestones

| Release | Days | Delivered outcome |
|---|---|---|
| v0.1 Core builder | 1 to 15 | Accounts, form editing, preview, immutable publishing, validated submissions, response inbox and CSV export |
| v0.2 Smarter forms | 16 to 20 | Conditional visibility, multi-step forms, basic themes and consistent accessible behaviour |
| v0.3 Team beta | 21 to 30 | Roles, invitations, sharing, templates, data import, retention, notifications and bounded analytics |
| v1.0 Public code release | 31 to 40 | Optional local respondent drafts, inbox search, hardening, recovery, self-hosting, documentation and release evidence |

Days 20, 30 and 39 reserve integration and stabilization time. Plan changes should revise scope or estimates explicitly. Do not compensate for a delay by claiming untested features work.

### Included field types

Begin with short text, long text, email, number, single-select dropdown and checkbox. Add radio groups, multiple choice, date and a bounded rating field in the core schema work. Heading and description blocks organize the form and never collect answers. Use plain text labels and help content in v1.0.

Later tasks add conditional visibility, page sections, optional local drafts, templates and small theme presets. Fields use stable IDs; option values use stable IDs separate from display labels.

### Scope boundaries

v1.0 excludes file uploads, payment collection, electronic signatures, arbitrary HTML/CSS/JavaScript, user-defined regex, AI form generation, external webhooks, email delivery, enterprise SSO, custom domains, cloud respondent draft synchronization, real-time collaborative editing and a plugin marketplace. These are separate projects or later milestones.

Public forms use shareable URLs. Private respondent-only access, one-response-per-person guarantees and protected surveys require identity and policy work beyond v1.0. Team workspaces protect editing and response access; they do not make a published form confidential.

### Definition of the first usable release

A maintainer can run the stack, sign in, create a form, add required fields, save it, publish it, collect a synthetic response, inspect the historical version, and export a spreadsheet-safe CSV. Closing the form prevents new submissions. This complete journey matters more than a large number of partially working modules.

## 3 Stack and architecture

### Proposed stack

| Layer | Choice | Responsibility |
|---|---|---|
| Language | TypeScript | Shared contracts and maintainable application code |
| Runtime | Supported Node.js LTS baseline | Next.js server, Express and worker |
| Frontend | Next.js with React and App Router | Editor, management pages and respondent UI |
| Styling | Tailwind CSS | Responsive layouts and theme tokens |
| Editor state | Zustand | Selected field, draft edits and undo history |
| Browser server state | TanStack Query | Authorized reads, mutations and cache invalidation |
| Form controls | React Hook Form and shared validation helpers | Input state and accessible error handling |
| Reordering | Maintained dnd-kit packages plus move buttons | Pointer, touch and keyboard ordering |
| API | Express | Auth, forms, publish, submit and response management |
| Persistence | MongoDB with Mongoose | Versions, responses, memberships and sessions |
| Contract validation | Zod | Trusted input schemas and bounded import formats |
| Background work | Separate Node process using Mongo job records | Expiry, deletion and reconciliation |
| Logging | Structured logs with sensitive-value redaction | Operational investigation without answer bodies |
| Verification | Vitest, Supertest and Playwright | Schema, API and complete browser flows |
| Packaging | Docker Compose and reverse proxy | Repeatable self-hosting |
| CI | GitHub Actions | Lint, type checks, tests and production builds |

Pin compatible dependencies and the Node LTS version during D01.2. Use a committed lockfile. This document proposes tools; it does not certify compatibility of every future release. MongoDB must run as a replica set because the publish and submission contracts use multi-document transactions. A single-node replica set is acceptable for development, not a high-availability production guarantee.

### Frontend and backend boundaries

Next.js owns presentation and frontend routing. App Router layouts and pages compose the shell. Client Components contain the interactive editor, Zustand and TanStack Query providers, drag controls, response filters and multi-step respondent state. Express remains authoritative for persistence, sessions, permissions, schema validation and public submissions. Next.js UI guards do not grant backend access.

Private data must not enter shared page or data caches. For v1.0, authenticated Client Components fetch management data through the same-origin API. Public schema and render-context reads are also uncached initially so closing a form is reflected promptly. If server-side private fetching is added later, forward only the required user context and use request-specific uncached fetching.

Keep secrets server-only; NEXT_PUBLIC_ values are browser-visible. Development uses a same-origin proxy or Next.js rewrite for the API. Hosted routing sends /api/v1 and /health to Express, and pages plus /_next assets to Next.js. Run the API, Next.js server and worker as separate processes.

### Architecture flow

```text
Author browser
  -> Next.js editor and preview
  -> Express management API
  -> Mongo draft and immutable form versions

Respondent browser
  -> Next.js public form renderer
  -> Express public schema and render context
  -> Shared validation and submit endpoint
  -> Mongo response plus accepted submission record

Team response dashboard
  -> Express authorized response API
  -> Historical version lookup and bounded CSV stream

Node worker
  -> Mongo cleanup jobs and retention expiry
```

### Repository structure

```text
apps/web/src/app/           Next.js pages layouts and route states
apps/web/src/features/      Builder renderer responses and workspace UI
apps/web/src/components/    Shared accessible controls
apps/web/src/lib/           API client browser providers and safe helpers
apps/api/src/modules/       Auth forms publish submit responses and teams
apps/worker/src/            Cleanup jobs and reconciliation
packages/form-schema/      Schema types rules and visibility evaluation
packages/form-renderer/    Shared preview and public rendering components
packages/contracts/       API input and response contracts
packages/test-fixtures/    Synthetic versions answers and import examples
tests/e2e/                Browser journeys
infra/                    Compose replica set and proxy configuration
docs/                     Documentation progress and task board
.github/                  CI issue and PR templates
```

### Persistence decisions

MongoDB documents single-document atomic updates and recommends matching the expected current value when preventing concurrent-update conflicts. Use a draft revision in save predicates. Multi-document publication and submission updates use transactions rather than assuming independent writes are atomic together. Source: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/

Draft autosave uses optimistic concurrency. Publishing creates an immutable version and changes the live pointer in one transaction. Submission checks the accepted version and form state, reserves capacity and inserts the response plus idempotency outcome in one transaction. These boundaries are product decisions described below, not guarantees supplied automatically by Mongoose.

## 4 User journeys and processing flows

### Journey A First form and response

1. A maintainer bootstraps the first author account and signs in.
2. They create a workspace and a draft form named Workshop registration.
3. They add name, email and session fields, make the first two required and define session options.
4. They save, preview on a narrow screen, and fix validation issues.
5. Publishing freezes version 1 and provides /f/:publicId.
6. A respondent opens that URL and receives the schema plus a signed short-lived render context.
7. The respondent supplies answers and submits with a stable idempotency key.
8. Express validates against version 1 and stores one response before acknowledging success.
9. The author opens the response and exports results.

### Journey B Change a published form

1. The author edits the draft; version 1 stays public until another publication.
2. Autosave includes expectedDraftRevision. A stale revision returns 409 and preserves unsaved local changes for recovery.
3. The author reviews a diff of draft versus live schema and publishes version 2.
4. New page loads use version 2. A valid context issued for version 1 can submit during its grace period unless the form is closed or that version is explicitly revoked.
5. Older responses continue to resolve labels, option names and rules from version 1. They are never reinterpreted using version 2.

### Journey C Conditional multi-step form

1. An author asks whether the respondent needs accommodation, followed by an optional detail field.
2. A forward-only rule shows the detail field when the earlier answer is yes.
3. The renderer evaluates visibility, clears answers that become hidden, and validates visible required fields.
4. Step navigation announces progress and moves focus to errors or the next heading.
5. Final submission recomputes visibility on the server, discards hidden answers and validates all visible answers.

Conditional visibility improves the experience but does not hide confidential questions: the public schema includes all configured fields and rules.

### Journey D Failed request and retry

1. The browser generates a cryptographically random idempotency key before sending a valid submission and retains it until the outcome is known.
2. If the request times out, retry the same payload with the same key and render context while it remains valid.
3. A committed identical submission returns its existing receipt rather than creating another response.
4. Reusing a key for different canonical input returns 409.
5. A new form load or expired context may start a new submission. v1.0 does not promise one response per human or deduplication across unrelated visits.

### Journey E Close or delete a form

1. An owner closes the form, invalidating admission for new submissions even if an old render context exists.
2. A racing submission and close operation serialize through the form admission write inside transactions: the operation that commits first defines whether that response is accepted.
3. Authorized team members can still inspect existing responses while the form is closed.
4. Deletion marks the form deleting, blocks public access and queues batched removal of versions, responses and related notifications.
5. Closing is reversible. Deletion is an explicit destructive user action in the product and has a confirmation screen.

### Journey F Share a template or embed

1. An author copies a shipped example or imports a bounded template JSON file.
2. The importer validates its format, regenerates IDs and shows a preview before creating an unpublished draft.
3. A published form can be embedded as an iframe when its embed setting allows it.
4. The embedded respondent view has no author management controls, displays provenance and keeps normal submission validation.
5. No cross-origin resize bridge or arbitrary script injection is required in v1.0.

### Flow states

```text
Form availability: draft -> open <-> closed -> deleting
Draft edits: clean -> dirty -> saving -> saved
                              +-> conflict or failed
Version: immutable snapshot; current or superseded or revoked
Response: accepted -> reviewed or archived -> deleting or expired
Submission UI: editing -> validating -> submitting -> accepted
                                             +-> failed or outcome unknown
```

Publishing a revised version preserves availability if the form is open and does not reopen a closed form. The owner must explicitly reopen it. Response review/archive states do not change historical answers or retention deadlines.

## 5 Module specifications

Each module states its responsibility, key features, important edge cases and completion evidence. The day references locate related tasks in the ordered backlog.

### M01 Workspace foundation

**Work window:** D01 to D03.

Make the project runnable and verifiable from a clean checkout.

**Features:** TypeScript workspaces, Next.js shell, Express startup, replica-set Compose, contracts and CI.

**Rules and edge cases:** Start coding by D01.3. Validate environment variables and distinguish liveness from database readiness.

**Completion evidence:** A fresh checkout builds and starts both services; readiness fails when Mongo is unavailable.

### M02 Author accounts and sessions

**Work window:** D04.

Protect management access without a paid auth dependency.

**Features:** Operator bootstrap, login, logout, current user, one-time recovery codes and revocable cookie sessions.

**Rules and edge cases:** Use a maintained password-hashing library, hashed opaque session tokens, HttpOnly Secure SameSite cookies, CSRF and origin checks. Keep initial public signup closed.

**Completion evidence:** Logout and recovery invalidate sessions; generic credential errors reveal no account existence.

### M03 Workspaces and ownership

**Work window:** D05.

Group forms and enforce tenant boundaries.

**Features:** Workspace creation, form dashboard, membership records and owner-only settings.

**Rules and edge cases:** All management lookups scope by verified workspace membership. Public IDs never grant access to responses.

**Completion evidence:** A second user cannot read or modify the first workspace using guessed IDs.

### M04 Schema and field registry

**Work window:** D06.

Define a shared allowlisted contract for every form.

**Features:** Ten input types plus heading and description blocks, stable field/option IDs, constraints and serialization.

**Rules and edge cases:** Unknown types and unsafe keys are rejected. Changing a field type generates a new field ID. Labels are plain text; no user code or regex executes.

**Completion evidence:** The same valid and invalid fixtures behave consistently in preview and server validation.

### M05 Visual editor and ordering

**Work window:** D07.

Let authors assemble forms without writing JSON.

**Features:** Field palette, add/select/delete/duplicate, properties panel, drag ordering, move buttons and undo/redo.

**Rules and edge cases:** Duplicating generates new IDs. Deleting a source used by rules prompts the author and removes or repairs dependent rules before publication.

**Completion evidence:** A form can be built and reordered using keyboard controls alone; undo restores the expected draft.

### M06 Author draft persistence

**Work window:** D09.

Save edits without losing concurrent work.

**Features:** Debounced autosave, explicit save, save indicators, revision checks and conflict recovery.

**Rules and edge cases:** Persist the whole bounded draft with expected revision; stale saves fail with 409. Never overwrite a newer draft automatically.

**Completion evidence:** Two editor tabs produce a visible recoverable conflict rather than a silent overwrite.

### M07 Shared renderer and preview

**Work window:** D08.

Preview the actual public-form controls.

**Features:** Desktop/mobile preview, shared control components and accessible validation messages.

**Rules and edge cases:** Preview submission is a simulation and never writes to the response collection. Selection overlays belong only to the editor.

**Completion evidence:** Preview and public rendering show matching labels, options and validation for the same schema.

### M08 Publishing and version history

**Work window:** D10 and D14.

Freeze what respondents saw and preserve history.

**Features:** Publish validation, schema snapshots, draft/live diff, close/reopen, old-version grace and explicit revocation.

**Rules and edge cases:** Use transactions and expected draft revisions. Responses refer to immutable versions. Never delete referenced versions during normal form editing.

**Completion evidence:** A renamed question does not change an earlier response display or its export labels.

### M09 Public form runtime

**Work window:** D11.

Render published questions without exposing management data.

**Features:** Public share route, public schema DTO, signed render context, closed and missing-form states.

**Rules and edge cases:** The context expires after 30 minutes and binds form, version and random context ID. Public DTOs omit workspace IDs, account details and internal settings.

**Completion evidence:** A respondent sees only published form content and cannot request response data.

### M10 Submission validation and receipts

**Work window:** D12.

Store valid answers once per idempotent retry.

**Features:** Server validation, hidden-answer pruning, transactional admission, response storage and non-sensitive receipt.

**Rules and edge cases:** Use a stable key per attempt. A receipt contains no answers. Apply quotas, context expiry and closed-form checks on the server.

**Completion evidence:** Identical concurrent retries create one response; mismatched reuse returns 409.

### M11 Response management

**Work window:** D13 and D32.

Help authors find and review answers.

**Features:** Cursor inbox, historical detail, reviewed/archive flags, notes, filtering and bounded text search.

**Rules and edge cases:** Answers are immutable in v1.0. Review metadata is separate. Viewer access does not include export or deletion.

**Completion evidence:** Pagination is stable and filters cannot escape workspace or form scope.

### M12 CSV export

**Work window:** D15.

Produce usable exports without losing schema context.

**Features:** Version-aware column headers, field IDs, submission metadata and streaming CSV.

**Rules and edge cases:** Quote/escape CSV correctly and neutralize spreadsheet formula cells. Use historical labels and a fixed creation-time cutoff; recheck access while streaming.

**Completion evidence:** Mixed-version fixtures export with interpretable columns and hostile strings do not become formulas.

### M13 Conditional visibility

**Work window:** D16 to D17.

Show relevant follow-up questions.

**Features:** Allowlisted equals, not-equals, contains-option and is-answered rules, all/any grouping and rule diagnostics.

**Rules and edge cases:** Sources must appear before targets. No cycles, arbitrary expressions or user regex. Hidden fields are not required and hidden answers are discarded.

**Completion evidence:** Preview, public UI and server agree on nested visibility fixtures and reject cyclic rules.

### M14 Multi-step forms

**Work window:** D18.

Split longer forms into manageable steps.

**Features:** Step grouping, progress, back/next, visible-field validation and final review.

**Rules and edge cases:** No arbitrary jump/branch rules in v1.0. Back preserves visible answers; hidden fields clear; final server validation covers every visible step.

**Completion evidence:** A keyboard user can correct a first-step error after reaching the final step.

### M15 Themes and accessible interaction

**Work window:** D19 and D33.

Make the editor and respondent experience usable.

**Features:** Theme presets, bounded color tokens, responsive widths, labels, descriptions, error summary and focus rules.

**Rules and edge cases:** No arbitrary CSS. Themes need contrast checks; placeholders are not labels. Provide non-drag ordering and non-color status indicators.

**Completion evidence:** All core flows are usable without a mouse and error messages identify the relevant field.

### M16 Templates and schema portability

**Work window:** D24 to D25.

Reuse form structure safely.

**Features:** Shipped synthetic templates, duplicate form, validated JSON export/import and preview.

**Rules and edge cases:** Templates exclude responses, account details and private workspace IDs. Import regenerates IDs and remaps references. Import never publishes automatically.

**Completion evidence:** A template round trip preserves meaning without copying identities or collected data.

### M17 Team membership and roles

**Work window:** D21 to D22.

Let small teams share responsibility.

**Features:** Owner, editor and viewer roles, invitation links, membership removal and owner transfer.

**Rules and edge cases:** Invitation tokens are hashed, one-time, address-bound and expire after 24 hours. No email sending. Last owner cannot be removed.

**Completion evidence:** Role tests deny privileged actions and removing a member blocks subsequent access.

### M18 Links and iframe embedding

**Work window:** D23.

Publish a usable form link or embed snippet.

**Features:** Copy link, embed toggle, iframe preview, explicit dimensions and public provenance.

**Rules and edge cases:** Author pages disallow framing. Respondent pages allow framing only when enabled; CSP is set deliberately. Avoid cross-origin messaging in v1.0.

**Completion evidence:** An enabled embed submits correctly while an author page cannot be framed.

### M19 Retention deletion and audit

**Work window:** D26 to D27.

Control the lifetime of collected data.

**Features:** Response retention, expiry filtering, owner deletion, form cleanup jobs and safe audit history.

**Rules and edge cases:** Defaults are documented. TTL is physical cleanup, not permission enforcement. Audit entries contain IDs/actions, never answers or secrets.

**Completion evidence:** Expired answers are inaccessible before TTL and a restarted cleanup worker completes deletion.

### M20 In-app notifications

**Work window:** D28.

Help team members notice new responses.

**Features:** Unread count, submission notification, mark read and links to authorized response pages.

**Rules and edge cases:** No email or external webhook delivery. Create one workspace notification per committed response and scope reads to membership. Expired response data never appears in notification text.

**Completion evidence:** A duplicate submission retry produces one notification and a removed member cannot open it.

### M21 Basic analytics

**Work window:** D29.

Show useful form activity without promising visitor identity.

**Features:** Accepted response counts, review totals, daily submissions and accepted-answer summaries for finite-choice fields.

**Rules and edge cases:** v1.0 does not track views, completion rate, unique visitors or IP-based identity. Version and retention scope must be visible on every chart.

**Completion evidence:** Analytics match stored eligible fixture responses and never combine differently identified fields as one.

### M22 Optional local respondent drafts

**Work window:** D31.

Let a respondent resume an unfinished non-sensitive form.

**Features:** Opt-in save-on-device, version-bound browser draft, expiry, restore/discard and clear-on-success.

**Rules and edge cases:** Off by default; form author may disable it. Do not persist signed contexts. Store answers by version, issue a fresh context on restore and reject incompatible versions.

**Completion evidence:** An opted-in draft restores on the same browser/version and clears after accepted submission or expiry.

### M23 Operations and self hosting

**Work window:** D34 to D36.

Run, observe and recover the application.

**Features:** Load tests, limits, cleanup lag, Compose, backups, restore, migration and rollback notes.

**Rules and edge cases:** Replica-set transactions are required; startup readiness checks them. Keep signing keys out of backups shared for demos. Disable workers during restore reconciliation.

**Completion evidence:** A clean install and isolated backup restore reproduce the documented synthetic dataset.

### M24 Public documentation and releases

**Work window:** D15 D20 D30 and D37 to D40.

Make the repository useful to maintainers and contributors.

**Features:** README, task board, API reference, release notes, contribution guide, sample forms and synthetic demo.

**Rules and edge cases:** Document actual capability and known limitations. Keep framework changes aligned across plan, task board and context.

**Completion evidence:** A fresh tester builds a form and collects a response using only public instructions.

### Permission matrix

| Operation | Owner | Editor | Viewer | Anonymous respondent |
|---|---|---|---|---|
| Read workspace form settings and responses | Yes | Yes | Yes | No |
| Edit drafts and publish versions | Yes | Yes | No | No |
| Close reopen or revoke a published version | Yes | No | No | No |
| Review archive or annotate responses | Yes | Yes | No | No |
| Export responses | Yes | Yes | No | No |
| Delete responses or forms | Yes | No | No | No |
| Manage retention themes templates and embed settings | Yes | Editor may manage form theme/template only | No | No |
| Manage team and transfer ownership | Yes | No | No | No |
| View published public schema and submit | Yes as respondent | Yes as respondent | Yes as respondent | Yes while form is open |

Responding to a public form does not require author membership. The public submission API ignores author cookies for authorization and uses its dedicated render-context contract. No public endpoint lists or reads response bodies.

## 6 Form schema and data model

### Shared schema contract

Use schemaFormatVersion to version the portable JSON format. Each form contains title, description, field definitions, step definitions, visibility rules and a bounded theme preset. Every field has a stable UUID, an allowlisted type, plain-text label, help text, required flag and type-specific constraints. Options have their own stable UUIDs and labels. Rules reference IDs, never question text or array positions.

```json
{
  "schemaFormatVersion": 1,
  "title": "Workshop registration",
  "description": "Synthetic example",
  "steps": [{"id": "step-uuid", "title": "Your details"}],
  "fields": [
    {
      "id": "field-uuid",
      "type": "shortText",
      "stepId": "step-uuid",
      "label": "Name",
      "required": true,
      "constraints": {"maxLength": 200}
    }
  ],
  "visibilityRules": [],
  "theme": {"preset": "neutral"}
}
```

UUID strings above are explanatory placeholders. Generate real UUIDs in implementation and fixtures. Unknown properties are rejected on writes; bound array counts, text lengths and nesting depth before expensive processing.

### Field semantics

| Type | Stored answer | Validation |
|---|---|---|
| shortText | String | Maximum 2000 characters with lower per-field limit allowed |
| longText | String | Maximum 10000 characters |
| email | String | Bounded syntactic validation; does not prove ownership |
| number | JSON number | Finite value within configured min/max and absolute limit 10^12 |
| dropdown or radio | Option ID | Must exist in the submitted immutable version |
| multipleChoice | Array of unique option IDs | Allowed IDs and min/max choice count |
| checkbox | Boolean | Required confirmation means true; optional means true or false |
| date | YYYY-MM-DD string | Real calendar date with optional bounds; no timezone conversion |
| rating | Integer | Within fixed published range, default 1 to 5 |
| heading or description | No answer | Layout-only blocks reject supplied values |

Empty optional answers are omitted from canonical storage. Required text must contain a non-whitespace character but preserve the accepted original string. Numeric zero and boolean false are not treated as missing except for an explicitly required confirmation checkbox. Reject unknown field IDs and option IDs; discard known fields whose visibility is false. Password fields are unsupported.

### Draft and publication consistency

An empty draft is allowed while editing, but publication requires a non-empty title and at least one input field. A draft lives with its form record and has draftRevision. Save uses an expected revision predicate and increments it atomically. Autosave only marks Saved after the server acknowledges. While saving, newer local edits remain dirty and schedule another save. A network failure retains local editor state; a revision conflict presents Reload server version and Copy local JSON options without automatic overwrite.

Publishing accepts expectedDraftRevision. In a transaction, validate the draft, insert an immutable FormVersion, update currentVersionId and update the list of accepted superseded versions. A publish from a stale revision returns 409. Stable field IDs permit related-version analysis; changing a field type or meaning creates a new ID. A rollback is a new publication copied from an earlier snapshot, never mutation of historical records.

New contexts are issued only for the current version of an open form. When a version is superseded, keep its admission window for at most 30 minutes so already-open forms can finish. Contexts themselves expire after 30 minutes. The form admission record tracks at most eight live grace windows; prune expired ones before publication and block further publication with a clear conflict if the bound is reached. An owner may explicitly revoke an older version. Closing or deleting the form blocks every version immediately.

### Signed render context

The server signs a bounded token containing public form ID, version ID, random context ID, issued time, expiry and key ID. Use an established token library with a fixed allowed algorithm or a small audited HMAC implementation; never trust a caller-selected algorithm. Keep signing keys server-only and verify expiry, audience and form/version binding on submission.

The token is not respondent identity, CSRF authorization for management, or a secret link to responses. Do not put answers inside it or persist it in local respondent drafts. All schema reads, context creation and submit responses return Cache-Control no-store in v1.0. Context creation returns the matching schema and token from one version snapshot; the respondent renderer uses that pair rather than mixing a separately fetched schema with a newer context.

### Response transaction and idempotency

Within a transaction: find an existing idempotency outcome; otherwise perform a guarded form admission write checking open state, accepted version and capacity; insert the validated response; store its idempotency outcome; and insert one response notification. Retry transaction conflicts using the Mongo driver contract with bounded retries. Use a unique compound key on formId, contextId and the hashed idempotency key.

Canonical hashing includes form/version and normalized validated answers after hidden-answer pruning. Identical retries return the original receipt while the render context is valid. Reusing a key with a different canonical body returns 409. The receipt contains only an opaque receipt ID and accepted timestamp. No answers or response-reading capability are returned publicly. Disable repeat submits while in flight but do not rely on that UI control for deduplication.

MongoDB transactions do not make an HTTP response reach the browser. A timeout after commit is resolved by retrying the same operation, not by inventing success or blindly creating a new context. This contract covers repeated submissions in one context; one-response-per-person detection is outside scope.

### Collections

| Collection | Main fields | Key indexes and lifetime |
|---|---|---|
| users | normalizedEmail passwordHash recoveryHashes status | Unique email; no password material in API DTOs |
| sessions | tokenHash userId csrfSecret expiresAt revokedAt | Unique token hash; expiry check plus TTL cleanup |
| workspaces | name ownerId state | Membership-controlled management |
| memberships | workspaceId userId role | Unique workspace and user |
| invitations | tokenHash workspaceId invitedEmail role expiresAt consumedAt | Unique token; one-time acceptance; TTL |
| forms | workspaceId publicId title draftSchema draftRevision currentVersionId availability acceptedWindows acceptedCount retentionDays | Unique publicId; workspace updatedAt list; guarded admission writes |
| formVersions | formId workspaceId versionNumber schema schemaHash createdBy createdAt | Unique form and versionNumber; immutable schema |
| responses | formId workspaceId versionId contextId answers acceptedAt expiresAt deletedAt | Form acceptedAt ID cursor; separate expiresAt TTL index |
| responseReviews | workspaceId responseId reviewed archived note updatedBy | Unique responseId; expiry follows response |
| submissionOutcomes | formId contextId keyHash canonicalHash receiptId acceptedAt expiresAt | Unique form context key; short retry lifetime |
| templates | workspaceId name portableSchema createdAt | Workspace name lookup; shipped examples are code fixtures |
| notifications | workspaceId responseId kind createdAt expiresAt | Unique response and kind; per-user read cursors avoid copying answer content |
| notificationReads | workspaceId userId lastReadAt | Unique workspace and user |
| auditEntries | workspaceId actorId action targetId result createdAt expiresAt | Workspace date; default 30 day TTL |
| cleanupJobs | workspaceId targetType targetId state lease retries cursor | Atomic claim; idempotent cleanup steps |

Store dates in UTC and serialize ISO 8601 timestamps. Responses and versions are joined by versionId; never join answers to the current draft. Retain a version while eligible responses or active admission windows reference it. Do not remove schemas merely because a form is closed.

### Expiry and deletion rules

Default response retention is 30 days with owner options 7, 30 or 90 days. Every read, export, analytic query and notification link checks response expiry and deletedAt, even before physical cleanup. Reducing retention applies a stricter effective cutoff immediately and schedules batches to update stored expiry times. Increasing retention applies to new responses only and does not resurrect expired data.

Do not store answer bodies in audit records or notification previews. Cleanup removes review metadata and dependent references idempotently. An export already downloaded to a user's device cannot be retracted; document that limit. Backups have a separately documented expiry schedule and may retain deleted data until backup expiration.

## 7 API and screen contracts

### API conventions

Authenticated routes use /api/v1 and session cookies. State-changing browser requests require a valid CSRF token and allowed Origin. The public form APIs use /api/v1/public, rate limits and the dedicated render context; they do not acquire author permissions from browser cookies. Return only explicitly allowlisted DTO fields.

List responses use data and nextCursor; clients cannot supply Mongo operators or executable query fragments. Enforce bounds before schema evaluation. Use 400 for malformed structure, 401 for missing management identity, 403 for a known forbidden action, 404 for inaccessible objects, 409 for revision/idempotency conflicts, 410 for closed or revoked public forms, 413 for large bodies, 422 for answer errors, 429 for configured limits and 503 for unavailable dependencies.

An expired render context returns 409 with code CONTEXT_EXPIRED and offers to reload. A closed form returns 410 FORM_CLOSED and keeps entered answers in memory for optional copying without persisting them automatically. Public error messages contain no stack traces, workspace details or captured answers.

### Endpoint inventory

| Method and path after /api/v1 | Purpose |
|---|---|
| POST /auth/bootstrap | Operator-controlled first account creation |
| POST /auth/login and /auth/logout | Create or revoke browser session |
| GET /auth/me and /auth/csrf | Current identity and CSRF token |
| POST /auth/recover | Consume a one-time code and revoke prior sessions |
| GET POST /workspaces | List memberships or create workspace |
| GET PATCH /workspaces/:id | Read allowed settings; owner changes name/policy |
| GET POST /workspaces/:id/forms | Cursor form list or new draft |
| GET /forms/:id | Authorized draft and publication metadata |
| PUT /forms/:id/draft | Save schema with expectedDraftRevision |
| POST /forms/:id/publish | Validate and atomically publish expected revision |
| GET /forms/:id/versions | Read immutable version list |
| GET /forms/:id/versions/:versionId | Read authorized historical schema |
| POST /forms/:id/restore-version | Copy old schema into a new draft revision |
| POST /forms/:id/close and /forms/:id/reopen | Owner changes admission state |
| POST /forms/:id/versions/:versionId/revoke | Owner revokes an old admission window |
| DELETE /forms/:id | Owner marks deleting and queues cleanup |
| GET /public/forms/:publicId | Current public schema without management data |
| POST /public/forms/:publicId/context | Issue schema-bound signed render context |
| POST /public/forms/:publicId/submissions | Validate and store using Idempotency-Key |
| GET /forms/:id/responses | Authorized cursor inbox with bounded filters |
| GET /responses/:id | Historical answer detail and permitted review metadata |
| PATCH /responses/:id/review | Owner/editor sets reviewed archive flags or note |
| DELETE /responses/:id | Owner hides response and schedules cleanup |
| POST /forms/:id/export | Owner/editor streams version-aware CSV |
| GET POST /workspaces/:id/invitations | Owner lists/creates one-time links |
| POST /invitations/register | Create intended user's account from valid invitation |
| POST /invitations/accept | Signed-in matching address accepts invitation |
| PATCH DELETE /workspaces/:id/members/:userId | Owner changes role/removes member |
| POST /workspaces/:id/transfer-owner | Atomic owner transfer to existing member |
| POST /forms/:id/duplicate | New draft with regenerated identities |
| GET POST /workspaces/:id/templates | List/create structure-only template |
| POST /templates/:id/use | Create new unpublished draft |
| POST /forms/import and /forms/:id/schema-export | Bounded portable JSON import/export |
| PATCH /forms/:id/settings | Owner policy or allowed editor appearance changes |
| GET /workspaces/:id/audit | Owner-only safe audit history |
| GET /workspaces/:id/notifications | Current member's accessible notifications |
| POST /workspaces/:id/notifications/read | Set current user's read cursor |
| GET /forms/:id/analytics | Authorized eligible-response summaries |
| GET /health/live and /health/ready | Unprefixed operational endpoints |

Response writes require JSON. Field errors return an array of fieldId and message plus a safe error code. Unknown field IDs fail validation; hidden known answers are removed. The backend returns 201 for a new stored response and 200 for an identical committed retry. API health paths are /health/live and /health/ready, not under /api/v1.

### Example submission contract

```json
{
  "renderContext": "signed-token",
  "versionId": "published-version-id",
  "answers": {
    "name-field-uuid": "Example participant",
    "session-field-uuid": "option-uuid"
  }
}
```

Send Idempotency-Key as a random per-attempt header. The server verifies versionId against the signed context, not against an untrusted client claim. A successful public response contains data.receiptId and data.acceptedAt. The response is not publicly fetchable using that receipt.

### Screen inventory

| Route | Main content and states |
|---|---|
| /login and /recover | Credentials, safe errors, expired-session redirect |
| /app | Workspace chooser and forms dashboard |
| /app/forms/new | Name and starter-template choice |
| /app/forms/:id/edit | Palette, canvas, field properties, autosave and undo |
| /app/forms/:id/preview | Renderer simulation and device-width controls |
| /app/forms/:id/publish | Draft/live diff, validation and publish confirmation |
| /app/forms/:id/responses | Inbox, filters, review state and CSV export |
| /app/forms/:id/responses/:responseId | Historical labels and answer details |
| /app/forms/:id/versions | Version list, admission status and restore-to-draft |
| /app/forms/:id/settings | Close/reopen, retention, theme, embed and deletion |
| /app/workspace/members | Roles, invitations and owner transfer |
| /app/notifications | Unread list with authorized deep links |
| /f/:publicId | Responsive public form, closed state and acceptance receipt |
| /f/:publicId/embed | Embedded respondent-only view when allowed |

The actual Next.js route folders use bracket segments such as [formId]; colon notation above describes URLs. Include loading, not-found, unauthorized, no-results, network-failure, validation-error, revision-conflict and closed-form states where relevant. Do not expose author navigation within the embedded form.

## 8 Quality limits and operating rules

### Initial configurable limits

These are proposed defaults to verify during implementation, not measured production capacity.

| Item | Starting limit |
|---|---|
| Fields per form | 50 input/layout blocks combined |
| Steps per form | 5 |
| Options per choice field | 100 |
| Visibility rules per form | 100 with bounded all/any depth |
| Draft/import schema | 256 KiB JSON |
| Submission body | 128 KiB JSON |
| Author forms per workspace | 25 active forms |
| Accepted responses per form | 10000 lifetime accepts in v1.0 |
| Public response retention | Default 30 days; owner chooses 7 30 or 90 |
| Render context lifetime | 30 minutes |
| Public schema/context request rate | Starting ceiling 60 per minute per client/form |
| Submission request rate | Starting ceiling 10 per minute per client/form |
| Inbox page size | 25 default, 100 maximum |
| Session lifetime | 24 hours absolute with explicit revocation |
| Local respondent draft | Opt-in, 24 hour expiry, at most 64 KiB |

Do not collect IPs or fingerprints as analytics identity. A rate limiter may use short-lived pseudonymous network keys without writing raw addresses or answer bodies to application logs. Configure trusted proxy hops explicitly. Single-process limits reset on restart and need proxy-wide ceilings before public deployment. Rate limits and honeypots reduce abuse; they do not prove a visitor is human.

### Shared rule evaluator

Validate conditions during editing and again on publication. Evaluate them in published field order. A target can reference only an earlier input field. If its source is hidden or unanswered, use the documented false/empty semantics. Support at most two bounded grouping levels; never evaluate JavaScript or arbitrary expressions. Server and browser must use the same deterministic evaluator and fixtures.

Required validation applies only to visible input fields. Changing an earlier answer clears now-hidden values locally; the server independently prunes them. Heading blocks cannot be required. Multi-step navigation skips steps with no visible inputs and makes the final review consistent with server visibility.

### Autosave and local-draft boundaries

Author autosave writes the authenticated server draft with revision control. Respondent local draft saving is a different, optional feature added on D31. It stores a version-bound answer map only after explicit opt-in, clears on success/discard/expiry, and has no cross-device recovery promise. Form authors can disable it for their public form. Do not silently persist answers on shared devices.

### CSV and import rules

For CSV, use a tested serializer to quote separators, quotes and line endings. Prefix cells that could be interpreted as formulas, including dangerous leading characters after whitespace, and explain the spreadsheet-safe mode. Return UTF-8 CSV as a download; never embed answers into an HTML table response. Automated checks must include formulas, leading whitespace, quotes, multiline strings and mixed versions. CSV is not a lossless substitute for the versioned JSON response model. There is no universal protection across all spreadsheet tools or save-and-reopen behaviours; document the tested spreadsheet applications and exact export mode, and keep the stored structured records authoritative. Reference: https://community.owasp.org/attacks/CSV_Injection

Template imports are schema-only JSON, not CSV response imports. Reject unknown schema versions, excessive nesting, unsafe object keys and invalid references. Remap IDs, recompute rules and run publication-equivalent structure checks before saving an unpublished draft. Imported response data is outside v1.0 scope.

### Test strategy

- Unit: field serialization, visible/hidden rules, required semantics, canonical hashes, cursors and CSV escaping.
- API: session/CSRF, ownership, cross-workspace reads, draft conflicts, publication transactions, closed-form races and duplicate retries.
- Renderer: preview/public parity, conditional field clearing, multi-step focus and historical labels.
- Browser: create-publish-submit-inspect-export, edit-and-republish, invite-role changes, close-form and draft recovery.
- Operational: replica-set readiness, rollback of a failed transaction, cleanup restart, clean install and backup restore.
- Accessibility: actual labels, grouped choices, keyboard order, error summaries, contrast and non-drag alternatives.

W3C's forms guidance covers labeling, grouping, instructions, validation, notifications and multi-page forms. Use it as an implementation reference; this project does not claim accessibility conformance merely because it follows a checklist. Source: https://www.w3.org/WAI/tutorials/forms/

### Performance goals

In a recorded small-instance test with a 50-field schema and 10000 eligible responses, target schema reads and inbox reads p95 below 400 ms, submissions p95 below 800 ms, and responsive editing without visible typing delays. Record hardware, Mongo location, concurrency, dataset and results. These are proposed test goals. Improve indexes and bound queries before raising limits.

### Deployment and backup

Self-host with a reverse proxy, Next.js frontend service, Express API, cleanup worker and Mongo replica set. HTTPS is required for hosted session cookies. Use persistent volumes, server-only session/signing secrets, startup config validation and production builds. Never put production secrets or real response exports in the public repository.

Back up Mongo using a consistent method appropriate to the replica set and preserve schema/migration versions. Test restore in an isolated instance before claiming recoverability. Disable public submissions and cleanup during restore validation, reconcile jobs and counters, then reopen deliberately. Restoring older backups may require versioned signing keys or simply invalidating old render contexts; browser sessions can be invalidated safely. Document backup retention and how it differs from live response retention.

### Logs and data handling

Record request ID, route template, duration, status and safe object IDs. Do not log answer bodies, invitation links, passwords, cookies, recovery codes or signed contexts. Author-defined content is untrusted plain text. Use allowlisted DTOs, reject Mongo query operators in input and render strings without raw HTML. Validate data on the server; browser validation is an experience improvement, not the trust boundary. Source: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html

## 9 Forty day ordered backlog

All tasks are initially pending. Each task has an ID, prerequisite, module reference and individual completion check. The strict sequence below makes one-task selection unambiguous; later teams can revise the dependency graph when there is a concrete reason. A task's check does not require unimplemented later features.

Plan each day group for 5 to 6 focused hours including verification and documentation. Some tasks will take longer than their estimate. Preserve correctness and carry unfinished work forward rather than stretching or inventing daily commits.

### Days 1 to 15 Build the complete core

#### Day 01 Product contract and first running application

Modules: M01 M24. Day-group estimate: 5 to 6 hours.

- [x] **D01.1** Write a short project brief naming the first user, first form journey, boundaries and four release outcomes.

  Prerequisite: None. **Individual completion check:** The brief matches this plan and makes no implementation or adoption claims.

- [x] **D01.2** Create the TypeScript workspace folders, root scripts, compatible package selections, runtime pin, lockfile and README skeleton.

  Prerequisite: D01.1. **Individual completion check:** A clean dependency installation succeeds and the chosen versions are recorded.

- [x] **D01.3** Build the first Next.js App Router page and Express liveness route with development scripts.

  Prerequisite: D01.2. **Individual completion check:** Both services start and the page plus /health/live are reachable.

#### Day 02 Mongo replica set and local setup

Modules: M01 M23. Day-group estimate: 5 to 6 hours.

- [x] **D02.1** Add Compose Mongo replica-set initialization, application connection configuration and a bounded readiness check.

  Prerequisite: D01.3. **Individual completion check:** A clean local replica set starts and API readiness reflects its availability.

- [x] **D02.2** Verify transactional persistence with a disposable integration fixture and intentional rollback.

  Prerequisite: D02.1. **Individual completion check:** The rollback leaves no partial fixture records in Mongo.

- [x] **D02.3** Document exact local start, stop and reset commands with safe placeholder environment values.

  Prerequisite: D02.2. **Individual completion check:** A fresh shell follows the documented setup without missing configuration.

#### Day 03 Shared contracts and CI

Modules: M01. Day-group estimate: 5 to 6 hours.

- [x] **D03.1** Define shared API success/error envelopes, ID validation, pagination and correlation ID handling.

  Prerequisite: D02.3. **Individual completion check:** Malformed contracts fail with a stable safe error format.

- [x] **D03.2** Configure lint, type checks, Vitest, Supertest and disposable database fixtures.

  Prerequisite: D03.1. **Individual completion check:** A deliberate failing fixture is detected and passes after correction.

- [x] **D03.3** Add CI for dependency installation, lint, types, fast tests and Next.js/backend builds.

  Prerequisite: D03.2. **Individual completion check:** The same verification commands run locally and in CI.

#### Day 04 Author authentication

Modules: M02. Day-group estimate: 5 to 6 hours.

- [x] **D04.1** Implement user records, operator bootstrap, password hashing and throttled credential checks.

  Prerequisite: D03.3. **Individual completion check:** Bootstrap cannot be repeated unrestrictedly and hashes never appear in responses.

- [x] **D04.2** Add opaque sessions, cookie flags, login/logout UI, origin validation and CSRF handling.

  Prerequisite: D04.1. **Individual completion check:** Login survives refresh, logout revokes access and missing CSRF fails a mutation.

- [ ] **D04.3** Implement one-time recovery codes and session revocation with generic failure messages.

  Prerequisite: D04.2. **Individual completion check:** A recovery code works once and prior sessions fail after recovery.

#### Day 05 Workspace and draft form ownership

Modules: M03. Day-group estimate: 5 to 6 hours.

- [ ] **D05.1** Implement workspaces, owner memberships and scoped form records with an empty initial draft.

  Prerequisite: D04.3. **Individual completion check:** A signed-in owner creates a workspace and its first draft form.

- [ ] **D05.2** Build the dashboard with form creation, workspace switching and loading/empty/error states.

  Prerequisite: D05.1. **Individual completion check:** The owner opens the correct form from its workspace dashboard.

- [ ] **D05.3** Apply tenant scoping to all management endpoints and add two-workspace denial tests.

  Prerequisite: D05.2. **Individual completion check:** Guessed object IDs cannot read or mutate another workspace.

#### Day 06 Field schema and validators

Modules: M04. Day-group estimate: 5 to 6 hours.

- [ ] **D06.1** Define allowlisted field types, stable UUIDs, option IDs, constraints and schema size bounds.

  Prerequisite: D05.3. **Individual completion check:** Valid fixture schemas parse and unsupported or oversized structures fail.

- [ ] **D06.2** Implement shared answer validation including false, zero, empty optional values and layout-only blocks.

  Prerequisite: D06.1. **Individual completion check:** Browser-independent fixtures demonstrate consistent field semantics.

- [ ] **D06.3** Build field registry mappings and synthetic fixtures for every supported input type.

  Prerequisite: D06.2. **Individual completion check:** Every allowed input type has a renderer contract and matching validation fixture.

#### Day 07 Visual editing and history

Modules: M05. Day-group estimate: 5 to 6 hours.

- [ ] **D07.1** Build the palette, canvas, selection state and field property editor with immutable state updates.

  Prerequisite: D06.3. **Individual completion check:** An author adds fields and edits labels/options without hand-writing JSON.

- [ ] **D07.2** Implement duplicate/delete and pointer ordering plus explicit move-up/move-down controls.

  Prerequisite: D07.1. **Individual completion check:** Duplicated fields get fresh IDs and ordering works without dragging.

- [ ] **D07.3** Add bounded undo/redo and tests for field changes, deletes, duplication and ordering.

  Prerequisite: D07.2. **Individual completion check:** Undo/redo restores the expected schema without ID collisions.

#### Day 08 Shared form renderer and preview

Modules: M07. Day-group estimate: 5 to 6 hours.

- [ ] **D08.1** Create the shared respondent renderer with labels, help text and grouped-choice controls.

  Prerequisite: D07.3. **Individual completion check:** All core fields render from schema with correct accessible names.

- [ ] **D08.2** Add desktop/mobile preview and a simulated submit path that returns validation feedback only.

  Prerequisite: D08.1. **Individual completion check:** Preview uses the same components and never inserts a stored response.

- [ ] **D08.3** Test narrow layout, keyboard order, required errors and plain-text handling for hostile content.

  Prerequisite: D08.2. **Individual completion check:** Preview remains usable on a narrow viewport and HTML-like labels do not execute.

#### Day 09 Autosave and conflicting drafts

Modules: M06. Day-group estimate: 5 to 6 hours.

- [ ] **D09.1** Implement draft save using expectedDraftRevision, bounded schemas and atomic revision increments.

  Prerequisite: D08.3. **Individual completion check:** A stale revision returns 409 without replacing the stored draft.

- [ ] **D09.2** Connect debounced autosave and explicit save with dirty/saving/saved/failed indicators.

  Prerequisite: D09.1. **Individual completion check:** New edits made during a save remain dirty until their own acknowledged save.

- [ ] **D09.3** Build conflict recovery and unsaved-navigation handling with two-tab regression tests.

  Prerequisite: D09.2. **Individual completion check:** The UI preserves recoverable local work and never silently overwrites another tab.

#### Day 10 Immutable publication

Modules: M08. Day-group estimate: 5 to 6 hours.

- [ ] **D10.1** Implement full publish validation and a transaction that inserts a version and changes the live pointer.

  Prerequisite: D09.3. **Individual completion check:** A failed transaction leaves no orphan published version or changed live pointer.

- [ ] **D10.2** Build draft-versus-live summary, publish action and initial public URL display.

  Prerequisite: D10.1. **Individual completion check:** Only a successfully published snapshot is presented as live.

- [ ] **D10.3** Add owner close/reopen controls and admission-state tests around publish and close.

  Prerequisite: D10.2. **Individual completion check:** Publishing does not silently reopen a closed form.

#### Day 11 Public form and render contexts

Modules: M09. Day-group estimate: 5 to 6 hours.

- [ ] **D11.1** Expose a bounded public schema DTO and Next.js /f route with open/closed/missing states.

  Prerequisite: D10.3. **Individual completion check:** A public visitor sees published questions but no management or response data.

- [ ] **D11.2** Issue and verify signed 30-minute form/version contexts with no-store responses.

  Prerequisite: D11.1. **Individual completion check:** Expired, wrong-form, wrong-version and invalid-signature contexts are rejected.

- [ ] **D11.3** Connect the public renderer and synthetic fixtures with explicit error and retry UI states.

  Prerequisite: D11.2. **Individual completion check:** A published form loads from a new browser session without author authentication.

#### Day 12 Transactional responses and retries

Modules: M10. Day-group estimate: 5 to 6 hours.

- [ ] **D12.1** Validate public answers server-side and guard open state, accepted version and lifetime capacity.

  Prerequisite: D11.3. **Individual completion check:** Forged field IDs, invalid choices and closed-form submissions fail without a response insert.

- [ ] **D12.2** Persist response, idempotency outcome and one notification record in a transaction with unique keys.

  Prerequisite: D12.1. **Individual completion check:** Concurrent identical retries create one response and one notification record.

- [ ] **D12.3** Show a minimal receipt and preserve the retry key on timeouts; test conflicting key reuse.

  Prerequisite: D12.2. **Individual completion check:** A committed retry returns its original receipt and altered input with that key returns 409.

#### Day 13 Response inbox and historical detail

Modules: M11. Day-group estimate: 5 to 6 hours.

- [ ] **D13.1** Build scoped cursor list and response detail endpoints using the submitted version schema.

  Prerequisite: D12.3. **Individual completion check:** Labels and option names come from the correct immutable version.

- [ ] **D13.2** Create the inbox and detail UI with readable typed answers and pagination states.

  Prerequisite: D13.1. **Individual completion check:** A synthetic response can be found and inspected from the dashboard.

- [ ] **D13.3** Add reviewed/archive flags and bounded internal notes separate from immutable answers.

  Prerequisite: D13.2. **Individual completion check:** Review metadata changes without modifying the submitted answer record.

#### Day 14 Version history and existing visitors

Modules: M08. Day-group estimate: 5 to 6 hours.

- [ ] **D14.1** Implement accepted old-version windows, expiry pruning, publication bounds and owner revocation.

  Prerequisite: D13.3. **Individual completion check:** An unexpired eligible old context works, but expired or revoked versions fail.

- [ ] **D14.2** Build version history, schema diff and restore-as-new-draft actions.

  Prerequisite: D14.1. **Individual completion check:** Restoring preserves old versions and produces a new editable draft revision.

- [ ] **D14.3** Test renamed/deleted questions, changed types, close-versus-submit races and rollback.

  Prerequisite: D14.2. **Individual completion check:** Old responses remain interpretable and close/admission transactions produce a defined outcome.

#### Day 15 Safe CSV and core release

Modules: M12 M24. Day-group estimate: 5 to 6 hours.

- [ ] **D15.1** Implement bounded streaming CSV with version-aware field IDs/labels and correct cell serialization.

  Prerequisite: D14.3. **Individual completion check:** Mixed-version rows retain understandable headers and valid CSV quoting.

- [ ] **D15.2** Neutralize formula-like cells and test whitespace, quotes, line breaks and permission revocation.

  Prerequisite: D15.1. **Individual completion check:** Spreadsheet-safe export does not turn fixture values into executable formulas.

- [ ] **D15.3** Run create-publish-submit-inspect-export, fix blockers and publish v0.1 instructions and release evidence.

  Prerequisite: D15.2. **Individual completion check:** A fresh tester completes the core journey using the current README.

### Days 16 to 20 Add conditional multi step forms

#### Day 16 Visibility rules engine

Modules: M13. Day-group estimate: 5 to 6 hours.

- [ ] **D16.1** Define bounded allowlisted condition operators and all/any groups in the schema.

  Prerequisite: D15.3. **Individual completion check:** Unsupported expressions, excessive depth and invalid references fail validation.

- [ ] **D16.2** Implement deterministic forward-only evaluation with explicit empty/hidden-source semantics.

  Prerequisite: D16.1. **Individual completion check:** Cycle, source-order and visibility fixtures produce predictable results.

- [ ] **D16.3** Integrate the evaluator into server answer pruning and visible-required validation.

  Prerequisite: D16.2. **Individual completion check:** Hidden answers are removed and hidden required fields never block a valid response.

#### Day 17 Conditional editor and respondent behaviour

Modules: M13. Day-group estimate: 5 to 6 hours.

- [ ] **D17.1** Build visual rule editing with eligible source-field and operator selectors.

  Prerequisite: D16.3. **Individual completion check:** An author creates a follow-up rule without entering an expression.

- [ ] **D17.2** Apply rules in preview/public rendering and clear values when fields become hidden.

  Prerequisite: D17.1. **Individual completion check:** Switching a controlling answer hides and clears the dependent answer.

- [ ] **D17.3** Add source-deletion diagnostics and renderer/server parity tests.

  Prerequisite: D17.2. **Individual completion check:** A broken rule cannot publish and the same fixture validates consistently in all paths.

#### Day 18 Multi-step forms

Modules: M14. Day-group estimate: 5 to 6 hours.

- [ ] **D18.1** Add bounded steps, field grouping and editor controls for moving fields between steps.

  Prerequisite: D17.3. **Individual completion check:** A three-step schema saves with valid order and references.

- [ ] **D18.2** Build back/next, visible-step progress and final review with focused error navigation.

  Prerequisite: D18.1. **Individual completion check:** A keyboard user can correct an earlier answer without losing valid visible answers.

- [ ] **D18.3** Test empty steps, conditional hidden fields and full final server validation.

  Prerequisite: D18.2. **Individual completion check:** Skipped invisible steps do not bypass any visible required-field checks.

#### Day 19 Themes and accessible errors

Modules: M15. Day-group estimate: 5 to 6 hours.

- [ ] **D19.1** Implement small theme presets and bounded color/spacing tokens with no arbitrary CSS.

  Prerequisite: D18.3. **Individual completion check:** A selected preset renders consistently in preview and public form.

- [ ] **D19.2** Add error summary, field associations, focus management and submit-state announcements.

  Prerequisite: D19.1. **Individual completion check:** A tester can identify and reach invalid fields without relying on color.

- [ ] **D19.3** Review contrast, mobile layout, grouped controls and multi-step navigation; fix defects.

  Prerequisite: D19.2. **Individual completion check:** Core respondent paths remain readable and keyboard-operable under supported themes.

#### Day 20 Smarter forms beta and buffer

Modules: M13 M14 M15 M24. Day-group estimate: 5 to 6 hours.

- [ ] **D20.1** Run end-to-end rule, multi-step, version and export journeys with synthetic data.

  Prerequisite: D19.3. **Individual completion check:** The integrated suites pass against published forms rather than preview alone.

- [ ] **D20.2** Use stabilization time for observed defects and update feature limitations and examples.

  Prerequisite: D20.1. **Individual completion check:** No blocker remains in visibility, version interpretation or submission correctness.

- [ ] **D20.3** Publish v0.2 notes and a reproducible demonstration of conditional multi-step forms.

  Prerequisite: D20.2. **Individual completion check:** A new tester reproduces the demonstrated workflow from documentation.

### Days 21 to 30 Add team and data controls

#### Day 21 Team roles

Modules: M17. Day-group estimate: 5 to 6 hours.

- [ ] **D21.1** Extend authorization to owner/editor/viewer using a central permission policy.

  Prerequisite: D20.3. **Individual completion check:** Role-unit fixtures match the documented permission matrix.

- [ ] **D21.2** Apply permissions to every management route including publish, CSV and response review.

  Prerequisite: D21.1. **Individual completion check:** Viewer write/export and editor deletion/retention attempts are rejected.

- [ ] **D21.3** Add role-aware UI and cross-workspace browser/API regression checks.

  Prerequisite: D21.2. **Individual completion check:** Hidden UI controls are backed by server denial tests.

#### Day 22 Invitations and ownership

Modules: M17. Day-group estimate: 5 to 6 hours.

- [ ] **D22.1** Implement hashed one-time invitation links and invited-account registration/acceptance.

  Prerequisite: D21.3. **Individual completion check:** Only the intended address with a valid unexpired token can accept once.

- [ ] **D22.2** Build member management, invitation revocation and atomic ownership transfer.

  Prerequisite: D22.1. **Individual completion check:** The workspace always retains an owner through concurrent transfer/removal attempts.

- [ ] **D22.3** Test role changes and member revocation against open dashboard sessions.

  Prerequisite: D22.2. **Individual completion check:** A removed member loses subsequent API/export/notification access.

#### Day 23 Sharing and iframe embedding

Modules: M18. Day-group estimate: 5 to 6 hours.

- [ ] **D23.1** Add share-link controls and owner-managed embed policy to form settings.

  Prerequisite: D22.3. **Individual completion check:** An author can copy the exact published URL and see embed availability.

- [ ] **D23.2** Create respondent-only embed routes and copyable iframe markup with deliberate framing headers.

  Prerequisite: D23.1. **Individual completion check:** An enabled iframe renders while author pages cannot be framed.

- [ ] **D23.3** Test embedded submission, closed forms, disabled embed and small viewport behaviour.

  Prerequisite: D23.2. **Individual completion check:** Embed policy cannot bypass public admission or reveal management navigation.

#### Day 24 Starter templates and duplication

Modules: M16. Day-group estimate: 5 to 6 hours.

- [ ] **D24.1** Create synthetic contact, workshop, product feedback and volunteer-interest templates.

  Prerequisite: D23.3. **Individual completion check:** Each shipped template validates and contains no real personal data.

- [ ] **D24.2** Implement form/template duplication with fresh field/option/step identities and remapped rules.

  Prerequisite: D24.1. **Individual completion check:** Duplicating preserves meaning without references back to the source form.

- [ ] **D24.3** Build the template chooser and save-as-template flow with workspace checks.

  Prerequisite: D24.2. **Individual completion check:** Using a template creates an unpublished owned draft, never a live form automatically.

#### Day 25 Schema import and export

Modules: M16. Day-group estimate: 5 to 6 hours.

- [ ] **D25.1** Define a portable versioned schema-only JSON format and export endpoint.

  Prerequisite: D24.3. **Individual completion check:** Export excludes responses, workspace internals and author credentials.

- [ ] **D25.2** Implement bounded import parsing, reference remapping and preview-before-save UI.

  Prerequisite: D25.1. **Individual completion check:** Malformed, oversized, unknown-version and invalid-rule imports fail safely.

- [ ] **D25.3** Add round-trip fixtures covering rules, steps, options and themes.

  Prerequisite: D25.2. **Individual completion check:** Export/import retains form behaviour while regenerating identity fields.

#### Day 26 Retention and expiry

Modules: M19. Day-group estimate: 5 to 6 hours.

- [ ] **D26.1** Add response retention configuration, expiry timestamps and appropriate indexes.

  Prerequisite: D25.3. **Individual completion check:** New responses receive the documented deadline for the chosen policy.

- [ ] **D26.2** Apply effective expiry to inbox, details, exports, notifications and analytics queries.

  Prerequisite: D26.1. **Individual completion check:** Expired data is hidden before physical TTL cleanup runs.

- [ ] **D26.3** Implement shortening-policy batches and explicit non-resurrection semantics for increases.

  Prerequisite: D26.2. **Individual completion check:** Reducing retention hides old data immediately and increasing it does not restore expired answers.

#### Day 27 Deletion cleanup and audit

Modules: M19. Day-group estimate: 5 to 6 hours.

- [ ] **D27.1** Implement owner response/form deletion with immediate hiding and durable cleanup jobs.

  Prerequisite: D26.3. **Individual completion check:** Deleting a form blocks public context creation and submissions immediately.

- [ ] **D27.2** Add a cleanup worker with atomic leases, idempotent batches and restart recovery.

  Prerequisite: D27.1. **Individual completion check:** A worker interruption resumes removal without restoring deleted data.

- [ ] **D27.3** Record safe audit actions for publish, close, export, roles and deletion with an owner audit view.

  Prerequisite: D27.2. **Individual completion check:** Audit entries identify actions and IDs without answers, credentials or signed tokens.

#### Day 28 In-app notifications

Modules: M20. Day-group estimate: 5 to 6 hours.

- [ ] **D28.1** Expose membership-scoped notifications and per-user unread cursors using response notification records.

  Prerequisite: D27.3. **Individual completion check:** Two users can independently read the same workspace notification without duplicate response events.

- [ ] **D28.2** Build unread indicator, notification list and authorized response deep links.

  Prerequisite: D28.1. **Individual completion check:** A notification reaches only a currently authorized response page.

- [ ] **D28.3** Test deleted/expired response references, duplicate retries and membership removal.

  Prerequisite: D28.2. **Individual completion check:** Notification content exposes no deleted answer data and retries produce one event.

#### Day 29 Response analytics

Modules: M21. Day-group estimate: 5 to 6 hours.

- [ ] **D29.1** Implement bounded accepted-count, review-total and daily-response aggregation queries.

  Prerequisite: D28.3. **Individual completion check:** Fixture summaries match the same eligibility and retention filters as the inbox.

- [ ] **D29.2** Build charts for finite-choice answers with explicit version/field identifiers and date scope.

  Prerequisite: D29.1. **Individual completion check:** Renamed labels are contextualized and changed field identities are not silently merged.

- [ ] **D29.3** Document the absence of visitor identity, view counts and completion-rate claims.

  Prerequisite: D29.2. **Individual completion check:** Every displayed metric has a defined numerator, filter and time/version scope.

#### Day 30 Team beta and stabilization

Modules: M17 M18 M19 M20 M21 M24. Day-group estimate: 5 to 6 hours.

- [ ] **D30.1** Run a two-workspace owner/editor/viewer journey across templates, embeds, export and notifications.

  Prerequisite: D29.3. **Individual completion check:** No role or tenant-boundary regression appears in the integrated suite.

- [ ] **D30.2** Fix observed blockers using buffer time and update operational/default-setting notes.

  Prerequisite: D30.1. **Individual completion check:** Published beta capabilities and limitations match checked behaviour.

- [ ] **D30.3** Tag v0.3 with self-hosted beta instructions and synthetic team demonstration.

  Prerequisite: D30.2. **Individual completion check:** A small invited team can create and process a form without undocumented setup.

### Days 31 to 40 Harden and release

#### Day 31 Optional local respondent drafts

Modules: M22. Day-group estimate: 5 to 6 hours.

- [ ] **D31.1** Add explicit opt-in local drafts with form/version keys, expiry and bounded browser storage.

  Prerequisite: D30.3. **Individual completion check:** No answer persists locally before opt-in and no signed context is stored.

- [ ] **D31.2** Build restore/discard flow, fresh-context acquisition and clear-on-success behaviour.

  Prerequisite: D31.1. **Individual completion check:** A compatible draft restores on the same browser and clears after acceptance.

- [ ] **D31.3** Test version mismatch, closed form, author-disabled drafts, expiry and unavailable storage.

  Prerequisite: D31.2. **Individual completion check:** Incompatible or expired drafts cannot silently submit against another schema.

#### Day 32 Inbox filtering and search

Modules: M11. Day-group estimate: 5 to 6 hours.

- [ ] **D32.1** Add cursor-compatible date, version and reviewed/archive filters with URL state.

  Prerequisite: D31.3. **Individual completion check:** Reloading an authorized inbox restores its filters correctly.

- [ ] **D32.2** Implement bounded text search over approved answer previews with indexes and no user regex.

  Prerequisite: D32.1. **Individual completion check:** Search honours form/tenant/expiry scope and returns predictable limited results.

- [ ] **D32.3** Test pagination changes, empty results, stale cursors and historical detail links.

  Prerequisite: D32.2. **Individual completion check:** Filtering never leaks another workspace or mislabels an older response.

#### Day 33 Editor accessibility and interaction polish

Modules: M05 M15. Day-group estimate: 5 to 6 hours.

- [ ] **D33.1** Audit palette, properties, rule controls and move buttons for keyboard and screen-reader use.

  Prerequisite: D32.3. **Individual completion check:** All editing actions have labeled non-drag alternatives.

- [ ] **D33.2** Improve announcements, focus restoration after delete/reorder and unsaved conflict recovery.

  Prerequisite: D33.1. **Individual completion check:** A keyboard user edits, previews and publishes without losing focus or work.

- [ ] **D33.3** Test touch/narrow layouts and measured large-schema rendering; fix observed interaction defects.

  Prerequisite: D33.2. **Individual completion check:** A maximum-size allowed form remains usable on the recorded test devices.

#### Day 34 Limits performance and service health

Modules: M23. Day-group estimate: 5 to 6 hours.

- [ ] **D34.1** Verify schema/submission size bounds, per-client/form rates and atomic lifetime response capacity.

  Prerequisite: D33.3. **Individual completion check:** Concurrent submissions cannot exceed capacity and excessive requests return documented errors.

- [ ] **D34.2** Measure documented p95 goals on fixed datasets and improve proven query/render bottlenecks.

  Prerequisite: D34.1. **Individual completion check:** The performance report records environment, load and actual measured results.

- [ ] **D34.3** Add dependency readiness, safe logs and cleanup-lag visibility with failure simulations.

  Prerequisite: D34.2. **Individual completion check:** Mongo loss changes readiness without exposing secrets or answer bodies.

#### Day 35 Backup restore and migrations

Modules: M23. Day-group estimate: 5 to 6 hours.

- [ ] **D35.1** Define consistent Mongo backup, schema-version and key recovery procedures.

  Prerequisite: D34.3. **Individual completion check:** Backup instructions specify what is retained and what secrets require separate protection.

- [ ] **D35.2** Restore synthetic data into an isolated instance with admission and cleanup disabled initially.

  Prerequisite: D35.1. **Individual completion check:** Versions, responses and ownership relationships remain interpretable after restore.

- [ ] **D35.3** Exercise a compatible schema upgrade, rollback and counter/job reconciliation.

  Prerequisite: D35.2. **Individual completion check:** The recovery report demonstrates the steps and states any limitations observed.

#### Day 36 Repeatable self hosting

Modules: M23. Day-group estimate: 5 to 6 hours.

- [ ] **D36.1** Complete production Compose services, replica-set initialization, persistent volumes and proxy routes.

  Prerequisite: D35.3. **Individual completion check:** A clean environment starts Next.js, API, worker and transaction-capable Mongo.

- [ ] **D36.2** Document runtime/build configuration, first-owner creation, secrets and HTTPS session behaviour.

  Prerequisite: D36.1. **Individual completion check:** The operator can identify required settings without copying real credentials into source.

- [ ] **D36.3** Run clean install and publish-submit-inspect smoke checks through the production proxy.

  Prerequisite: D36.2. **Individual completion check:** The documented self-hosting path works with the actual routed services.

#### Day 37 Maintainer and API documentation

Modules: M24. Day-group estimate: 5 to 6 hours.

- [ ] **D37.1** Complete README, architecture, module references, public API examples and OpenAPI schemas.

  Prerequisite: D36.3. **Individual completion check:** Examples match the shipped endpoints and exact setup commands.

- [ ] **D37.2** Add CONTRIBUTING, issue/PR templates, license notices, troubleshooting and migration notes.

  Prerequisite: D37.1. **Individual completion check:** A contributor can find checks, task IDs and review expectations.

- [ ] **D37.3** Build a synthetic sample gallery and a safe demonstration reset procedure.

  Prerequisite: D37.2. **Individual completion check:** Demo reset never operates on non-demo workspaces and example answers are fabricated clearly.

#### Day 38 Complete journey verification

Modules: M24. Day-group estimate: 5 to 6 hours.

- [ ] **D38.1** Run clean-author create/publish, anonymous submit, inbox/export and republish-history browser journeys.

  Prerequisite: D37.3. **Individual completion check:** All core journeys pass on an actual running stack.

- [ ] **D38.2** Run conditional, multi-step, roles, embeds, import, expiry and local-draft regression suites.

  Prerequisite: D38.1. **Individual completion check:** The added features respect the same schema and authorization contracts.

- [ ] **D38.3** Ask a fresh tester to follow setup and first-form instructions and fix observed failures.

  Prerequisite: D38.2. **Individual completion check:** The tester reaches the documented first-response outcome without private steps.

#### Day 39 Release candidate and buffer

Modules: M23 M24. Day-group estimate: 5 to 6 hours.

- [ ] **D39.1** Freeze scope and run production builds, lint, types, database/API and browser suites.

  Prerequisite: D38.3. **Individual completion check:** The release candidate has recorded passing checks or explicit blocking failures.

- [ ] **D39.2** Review final diffs, default limits, framing/caching settings and repository/demo data hygiene.

  Prerequisite: D39.1. **Individual completion check:** No release blocker remains in auth, response interpretation, admission or data deletion.

- [ ] **D39.3** Use stabilization time to fix blockers and prepare candidate notes with known limitations.

  Prerequisite: D39.2. **Individual completion check:** A candidate is traceable to a verified commit and reproducible installation.

#### Day 40 Public version one release

Modules: M24. Day-group estimate: 5 to 6 hours.

- [ ] **D40.1** Publish the approved v1.0 code release and installation/migration notes to the verified authorized repository.

  Prerequisite: D39.3. **Individual completion check:** The release points to the checked commit and its installation instructions.

- [ ] **D40.2** Demonstrate the synthetic author-to-response journey and invite initial users to try that workflow.

  Prerequisite: D40.1. **Individual completion check:** Feedback records actual observations; no adoption numbers are invented.

- [ ] **D40.3** Record remaining issues, release evidence and a fresh GHFind comparison when available.

  Prerequisite: D40.2. **Individual completion check:** Maintenance priorities are actionable and score claims are separated from engineering completion.

## 10 Development workflow and release evidence

### Select and complete one task

Read applicable repository instructions, the plan, the growth checklist, the task board and progress record. Inspect the working tree and verify claimed completion against code and tests. Resume unfinished work before selecting the next eligible task. Announce the exact ID and expected outcome, implement it, verify its individual check, then update progress. Do not skip D01.1 because a repository exists, or repeat it once its actual planning evidence exists.

Use a branch when appropriate, a meaningful issue when it helps coordination, and a PR when it provides a real review path. A solo contributor may document self-verification honestly. Do not manufacture reviewers, acceptance or activity. Publication actions follow the user's actual authorization and the verified repository URL, never an assumption about a remote called origin.

### Definition of done

- The selected task's individual completion check passes with recorded evidence.
- Relevant tests and required repository checks pass.
- New failures, permission boundaries and important edge cases are handled.
- Examples, contracts and task status agree with changed behaviour.
- The final diff contains only intended task work and no secrets or real response exports.
- Progress preserves history and states the next eligible task.
- If commit/push is authorized, the exact task changes are committed and the remote commit is verified.

Checking in documentation is not proof that the application is implemented. A planning task can complete with documents; a runnable-feature task needs behaviour evidence. Never require the whole release gate for an early setup task.

### Release gates

| Release | Required observed evidence |
|---|---|
| v0.1 | Clean setup, owner login, create/preview/publish, anonymous valid/invalid submissions, retry deduplication, historical inbox and safe CSV |
| v0.2 | Rule parity, hidden-value pruning, multi-step required checks, accessible error recovery and unchanged old-response interpretation |
| v0.3 | Role matrix, invitation races, iframe policy, template round trip, expiry/deletion, notification scope and accurate analytics |
| v1.0 | Full browser suites, optional draft boundaries, load results, isolated restore, fresh-user setup and versioned public documentation |

### Suggested developer commands

```text
dev               Start Next.js and Express development services
dev:worker        Start cleanup and reconciliation process
db:up             Start and initialize local Mongo replica set
db:down           Stop local database without deleting its volume
build             Build Next.js and backend applications
lint              Run ESLint explicitly
typecheck         Check all TypeScript packages
test              Run fast logic and API suites
test:e2e          Run real-browser journeys
test:transactions Run replica-set publish/submit concurrency checks
seed:demo         Insert clearly synthetic sample workspace/forms
```

These are proposed command names to implement, not a claim that runnable scripts exist in this documentation package.

### Progress entry template

```text
Task ID and title
Status completed in progress or blocked
Implementation and files changed
Individual acceptance evidence
Verification commands and outcomes
Applicable growth checklist results
Known limitations or blocker
Commit branch and push result when applicable
Next eligible task ID
```

### Issue and pull request content

Each issue should identify the actual user problem, task/module IDs, scope and observable check. Each PR should explain the resulting behaviour, verification, relevant schema/permission changes and limitations. Do not open 120 issues automatically just to mirror a checklist. Keep task tracking useful for the current work.

## 11 Public project growth

The public repository should belong to the intended Niral account and contain original implementation, tests, examples and documentation. No repository was created or published as part of producing this plan. Confirm the actual repository URL and account spelling before a later commit/push workflow.

GHFind reads public GitHub evidence and describes six scoring dimensions. Treat its score as a separate measurement, not the product specification or an outcome guaranteed by this backlog. Source: https://ghfind.com/en/methodology

| Category | Useful evidence from this project | Limit |
|---|---|---|
| Original and led projects | Working form builder, clear code, maintained examples and attributable ownership | Creating many empty repositories is not useful |
| Contribution quality | Real issue investigation, useful accepted changes and relevant upstream fixes | Authorship and acceptance must be genuine |
| Activity authenticity | Sustained implementation, verification and maintenance | Do not create empty daily commits |
| Ecosystem impact | Adoption, maintenance and qualifying work in established dependencies | A new small project may have little reach initially |
| Community influence | Helpful tutorials and genuine interested followers | Audience growth is not guaranteed |
| Account maturity | Continued activity using the existing account across years | Cannot be finished in forty days |

GitHub attributes actions to the user performing them. Preserve actual author identity; a company affiliation or repository owner does not automatically receive all team contribution credit. Source: https://docs.github.com/en/get-started/learning-about-github/types-of-github-accounts

For each milestone, demonstrate an actual workflow using synthetic data, ask testers for actionable feedback and record the problems they encounter. Extract a reusable schema/renderer library only when the implementation reveals a stable useful boundary; do not split repositories merely to increase counts. Compare fresh scoring snapshots with compatible releases and explain incomplete data or changed rules.

## 12 References and later opportunities

### Later features

After v1.0, evaluate file uploads with private storage, reliable email delivery, signed outbound integrations, additional locales, protected respondent identity, scheduled opening/closing, advanced survey logic, integration SDKs and real-time editor collaboration. Each needs its own design, tests and operational scope. Payments and legal signatures should not be quietly added as ordinary field types.

### Open decisions to resolve at implementation

- Actual project folder and GitHub repository URL under the intended Niral account.
- Public name and license choice based on code ownership and project goals.
- Compatible package versions and maintained reorder-library API.
- Hosted provider, backup destination and production retention configuration.
- Test devices, target browser support and whether an invited demo is needed.

These are ordinary implementation decisions unless they require credentials, a legal commitment, paid spending or expanded access. The documentation itself neither creates a cloud service nor accepts terms.

### Primary references

Architecture and task sequencing are proposed decisions. The following sources support specific platform facts and implementation guidance; recheck current releases when starting.

- Next.js Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js self-hosting and environment variables: https://nextjs.org/docs/app/guides/self-hosting
- MongoDB atomicity and transactions: https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
- W3C accessible forms tutorial: https://www.w3.org/WAI/tutorials/forms/
- OWASP input validation: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP CSV injection behaviour and mitigation limits: https://community.owasp.org/attacks/CSV_Injection
- GHFind methodology: https://ghfind.com/en/methodology
- GitHub account attribution: https://docs.github.com/en/get-started/learning-about-github/types-of-github-accounts

Research date: 21 October 2026. No project adoption, score increase or application completion is asserted by these documents.
