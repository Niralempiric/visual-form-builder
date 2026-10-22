# Visual Form Builder Task Board

Implementation status starts pending. This board is generated from PROJECT_DOCUMENTATION.md and must remain consistent with it. Each item has an individual completion check. Planning documents alone do not mark application tasks complete.

Estimate 5 to 6 focused hours per day group. One execution selects one task, not all three tasks in a day. Three executions generally finish a day group; 120 once-daily executions would take about 120 calendar days.

## Day 01 Product contract and first running application

Modules: M01 M24.

- [x] **D01.1** Write a short project brief naming the first user, first form journey, boundaries and four release outcomes.

  Prerequisite: None. **Done when:** The brief matches this plan and makes no implementation or adoption claims.

- [x] **D01.2** Create the TypeScript workspace folders, root scripts, compatible package selections, runtime pin, lockfile and README skeleton.

  Prerequisite: D01.1. **Done when:** A clean dependency installation succeeds and the chosen versions are recorded.

- [x] **D01.3** Build the first Next.js App Router page and Express liveness route with development scripts.

  Prerequisite: D01.2. **Done when:** Both services start and the page plus /health/live are reachable.

## Day 02 Mongo replica set and local setup

Modules: M01 M23.

- [x] **D02.1** Add Compose Mongo replica-set initialization, application connection configuration and a bounded readiness check.

  Prerequisite: D01.3. **Done when:** A clean local replica set starts and API readiness reflects its availability.

- [ ] **D02.2** Verify transactional persistence with a disposable integration fixture and intentional rollback.

  Prerequisite: D02.1. **Done when:** The rollback leaves no partial fixture records in Mongo.

- [ ] **D02.3** Document exact local start, stop and reset commands with safe placeholder environment values.

  Prerequisite: D02.2. **Done when:** A fresh shell follows the documented setup without missing configuration.

## Day 03 Shared contracts and CI

Modules: M01.

- [ ] **D03.1** Define shared API success/error envelopes, ID validation, pagination and correlation ID handling.

  Prerequisite: D02.3. **Done when:** Malformed contracts fail with a stable safe error format.

- [ ] **D03.2** Configure lint, type checks, Vitest, Supertest and disposable database fixtures.

  Prerequisite: D03.1. **Done when:** A deliberate failing fixture is detected and passes after correction.

- [ ] **D03.3** Add CI for dependency installation, lint, types, fast tests and Next.js/backend builds.

  Prerequisite: D03.2. **Done when:** The same verification commands run locally and in CI.

## Day 04 Author authentication

Modules: M02.

- [ ] **D04.1** Implement user records, operator bootstrap, password hashing and throttled credential checks.

  Prerequisite: D03.3. **Done when:** Bootstrap cannot be repeated unrestrictedly and hashes never appear in responses.

- [ ] **D04.2** Add opaque sessions, cookie flags, login/logout UI, origin validation and CSRF handling.

  Prerequisite: D04.1. **Done when:** Login survives refresh, logout revokes access and missing CSRF fails a mutation.

- [ ] **D04.3** Implement one-time recovery codes and session revocation with generic failure messages.

  Prerequisite: D04.2. **Done when:** A recovery code works once and prior sessions fail after recovery.

## Day 05 Workspace and draft form ownership

Modules: M03.

- [ ] **D05.1** Implement workspaces, owner memberships and scoped form records with an empty initial draft.

  Prerequisite: D04.3. **Done when:** A signed-in owner creates a workspace and its first draft form.

- [ ] **D05.2** Build the dashboard with form creation, workspace switching and loading/empty/error states.

  Prerequisite: D05.1. **Done when:** The owner opens the correct form from its workspace dashboard.

- [ ] **D05.3** Apply tenant scoping to all management endpoints and add two-workspace denial tests.

  Prerequisite: D05.2. **Done when:** Guessed object IDs cannot read or mutate another workspace.

## Day 06 Field schema and validators

Modules: M04.

- [ ] **D06.1** Define allowlisted field types, stable UUIDs, option IDs, constraints and schema size bounds.

  Prerequisite: D05.3. **Done when:** Valid fixture schemas parse and unsupported or oversized structures fail.

- [ ] **D06.2** Implement shared answer validation including false, zero, empty optional values and layout-only blocks.

  Prerequisite: D06.1. **Done when:** Browser-independent fixtures demonstrate consistent field semantics.

- [ ] **D06.3** Build field registry mappings and synthetic fixtures for every supported input type.

  Prerequisite: D06.2. **Done when:** Every allowed input type has a renderer contract and matching validation fixture.

## Day 07 Visual editing and history

Modules: M05.

- [ ] **D07.1** Build the palette, canvas, selection state and field property editor with immutable state updates.

  Prerequisite: D06.3. **Done when:** An author adds fields and edits labels/options without hand-writing JSON.

- [ ] **D07.2** Implement duplicate/delete and pointer ordering plus explicit move-up/move-down controls.

  Prerequisite: D07.1. **Done when:** Duplicated fields get fresh IDs and ordering works without dragging.

- [ ] **D07.3** Add bounded undo/redo and tests for field changes, deletes, duplication and ordering.

  Prerequisite: D07.2. **Done when:** Undo/redo restores the expected schema without ID collisions.

## Day 08 Shared form renderer and preview

Modules: M07.

- [ ] **D08.1** Create the shared respondent renderer with labels, help text and grouped-choice controls.

  Prerequisite: D07.3. **Done when:** All core fields render from schema with correct accessible names.

- [ ] **D08.2** Add desktop/mobile preview and a simulated submit path that returns validation feedback only.

  Prerequisite: D08.1. **Done when:** Preview uses the same components and never inserts a stored response.

- [ ] **D08.3** Test narrow layout, keyboard order, required errors and plain-text handling for hostile content.

  Prerequisite: D08.2. **Done when:** Preview remains usable on a narrow viewport and HTML-like labels do not execute.

## Day 09 Autosave and conflicting drafts

Modules: M06.

- [ ] **D09.1** Implement draft save using expectedDraftRevision, bounded schemas and atomic revision increments.

  Prerequisite: D08.3. **Done when:** A stale revision returns 409 without replacing the stored draft.

- [ ] **D09.2** Connect debounced autosave and explicit save with dirty/saving/saved/failed indicators.

  Prerequisite: D09.1. **Done when:** New edits made during a save remain dirty until their own acknowledged save.

- [ ] **D09.3** Build conflict recovery and unsaved-navigation handling with two-tab regression tests.

  Prerequisite: D09.2. **Done when:** The UI preserves recoverable local work and never silently overwrites another tab.

## Day 10 Immutable publication

Modules: M08.

- [ ] **D10.1** Implement full publish validation and a transaction that inserts a version and changes the live pointer.

  Prerequisite: D09.3. **Done when:** A failed transaction leaves no orphan published version or changed live pointer.

- [ ] **D10.2** Build draft-versus-live summary, publish action and initial public URL display.

  Prerequisite: D10.1. **Done when:** Only a successfully published snapshot is presented as live.

- [ ] **D10.3** Add owner close/reopen controls and admission-state tests around publish and close.

  Prerequisite: D10.2. **Done when:** Publishing does not silently reopen a closed form.

## Day 11 Public form and render contexts

Modules: M09.

- [ ] **D11.1** Expose a bounded public schema DTO and Next.js /f route with open/closed/missing states.

  Prerequisite: D10.3. **Done when:** A public visitor sees published questions but no management or response data.

- [ ] **D11.2** Issue and verify signed 30-minute form/version contexts with no-store responses.

  Prerequisite: D11.1. **Done when:** Expired, wrong-form, wrong-version and invalid-signature contexts are rejected.

- [ ] **D11.3** Connect the public renderer and synthetic fixtures with explicit error and retry UI states.

  Prerequisite: D11.2. **Done when:** A published form loads from a new browser session without author authentication.

## Day 12 Transactional responses and retries

Modules: M10.

- [ ] **D12.1** Validate public answers server-side and guard open state, accepted version and lifetime capacity.

  Prerequisite: D11.3. **Done when:** Forged field IDs, invalid choices and closed-form submissions fail without a response insert.

- [ ] **D12.2** Persist response, idempotency outcome and one notification record in a transaction with unique keys.

  Prerequisite: D12.1. **Done when:** Concurrent identical retries create one response and one notification record.

- [ ] **D12.3** Show a minimal receipt and preserve the retry key on timeouts; test conflicting key reuse.

  Prerequisite: D12.2. **Done when:** A committed retry returns its original receipt and altered input with that key returns 409.

## Day 13 Response inbox and historical detail

Modules: M11.

- [ ] **D13.1** Build scoped cursor list and response detail endpoints using the submitted version schema.

  Prerequisite: D12.3. **Done when:** Labels and option names come from the correct immutable version.

- [ ] **D13.2** Create the inbox and detail UI with readable typed answers and pagination states.

  Prerequisite: D13.1. **Done when:** A synthetic response can be found and inspected from the dashboard.

- [ ] **D13.3** Add reviewed/archive flags and bounded internal notes separate from immutable answers.

  Prerequisite: D13.2. **Done when:** Review metadata changes without modifying the submitted answer record.

## Day 14 Version history and existing visitors

Modules: M08.

- [ ] **D14.1** Implement accepted old-version windows, expiry pruning, publication bounds and owner revocation.

  Prerequisite: D13.3. **Done when:** An unexpired eligible old context works, but expired or revoked versions fail.

- [ ] **D14.2** Build version history, schema diff and restore-as-new-draft actions.

  Prerequisite: D14.1. **Done when:** Restoring preserves old versions and produces a new editable draft revision.

- [ ] **D14.3** Test renamed/deleted questions, changed types, close-versus-submit races and rollback.

  Prerequisite: D14.2. **Done when:** Old responses remain interpretable and close/admission transactions produce a defined outcome.

## Day 15 Safe CSV and core release

Modules: M12 M24.

- [ ] **D15.1** Implement bounded streaming CSV with version-aware field IDs/labels and correct cell serialization.

  Prerequisite: D14.3. **Done when:** Mixed-version rows retain understandable headers and valid CSV quoting.

- [ ] **D15.2** Neutralize formula-like cells and test whitespace, quotes, line breaks and permission revocation.

  Prerequisite: D15.1. **Done when:** Spreadsheet-safe export does not turn fixture values into executable formulas.

- [ ] **D15.3** Run create-publish-submit-inspect-export, fix blockers and publish v0.1 instructions and release evidence.

  Prerequisite: D15.2. **Done when:** A fresh tester completes the core journey using the current README.

## Day 16 Visibility rules engine

Modules: M13.

- [ ] **D16.1** Define bounded allowlisted condition operators and all/any groups in the schema.

  Prerequisite: D15.3. **Done when:** Unsupported expressions, excessive depth and invalid references fail validation.

- [ ] **D16.2** Implement deterministic forward-only evaluation with explicit empty/hidden-source semantics.

  Prerequisite: D16.1. **Done when:** Cycle, source-order and visibility fixtures produce predictable results.

- [ ] **D16.3** Integrate the evaluator into server answer pruning and visible-required validation.

  Prerequisite: D16.2. **Done when:** Hidden answers are removed and hidden required fields never block a valid response.

## Day 17 Conditional editor and respondent behaviour

Modules: M13.

- [ ] **D17.1** Build visual rule editing with eligible source-field and operator selectors.

  Prerequisite: D16.3. **Done when:** An author creates a follow-up rule without entering an expression.

- [ ] **D17.2** Apply rules in preview/public rendering and clear values when fields become hidden.

  Prerequisite: D17.1. **Done when:** Switching a controlling answer hides and clears the dependent answer.

- [ ] **D17.3** Add source-deletion diagnostics and renderer/server parity tests.

  Prerequisite: D17.2. **Done when:** A broken rule cannot publish and the same fixture validates consistently in all paths.

## Day 18 Multi-step forms

Modules: M14.

- [ ] **D18.1** Add bounded steps, field grouping and editor controls for moving fields between steps.

  Prerequisite: D17.3. **Done when:** A three-step schema saves with valid order and references.

- [ ] **D18.2** Build back/next, visible-step progress and final review with focused error navigation.

  Prerequisite: D18.1. **Done when:** A keyboard user can correct an earlier answer without losing valid visible answers.

- [ ] **D18.3** Test empty steps, conditional hidden fields and full final server validation.

  Prerequisite: D18.2. **Done when:** Skipped invisible steps do not bypass any visible required-field checks.

## Day 19 Themes and accessible errors

Modules: M15.

- [ ] **D19.1** Implement small theme presets and bounded color/spacing tokens with no arbitrary CSS.

  Prerequisite: D18.3. **Done when:** A selected preset renders consistently in preview and public form.

- [ ] **D19.2** Add error summary, field associations, focus management and submit-state announcements.

  Prerequisite: D19.1. **Done when:** A tester can identify and reach invalid fields without relying on color.

- [ ] **D19.3** Review contrast, mobile layout, grouped controls and multi-step navigation; fix defects.

  Prerequisite: D19.2. **Done when:** Core respondent paths remain readable and keyboard-operable under supported themes.

## Day 20 Smarter forms beta and buffer

Modules: M13 M14 M15 M24.

- [ ] **D20.1** Run end-to-end rule, multi-step, version and export journeys with synthetic data.

  Prerequisite: D19.3. **Done when:** The integrated suites pass against published forms rather than preview alone.

- [ ] **D20.2** Use stabilization time for observed defects and update feature limitations and examples.

  Prerequisite: D20.1. **Done when:** No blocker remains in visibility, version interpretation or submission correctness.

- [ ] **D20.3** Publish v0.2 notes and a reproducible demonstration of conditional multi-step forms.

  Prerequisite: D20.2. **Done when:** A new tester reproduces the demonstrated workflow from documentation.

## Day 21 Team roles

Modules: M17.

- [ ] **D21.1** Extend authorization to owner/editor/viewer using a central permission policy.

  Prerequisite: D20.3. **Done when:** Role-unit fixtures match the documented permission matrix.

- [ ] **D21.2** Apply permissions to every management route including publish, CSV and response review.

  Prerequisite: D21.1. **Done when:** Viewer write/export and editor deletion/retention attempts are rejected.

- [ ] **D21.3** Add role-aware UI and cross-workspace browser/API regression checks.

  Prerequisite: D21.2. **Done when:** Hidden UI controls are backed by server denial tests.

## Day 22 Invitations and ownership

Modules: M17.

- [ ] **D22.1** Implement hashed one-time invitation links and invited-account registration/acceptance.

  Prerequisite: D21.3. **Done when:** Only the intended address with a valid unexpired token can accept once.

- [ ] **D22.2** Build member management, invitation revocation and atomic ownership transfer.

  Prerequisite: D22.1. **Done when:** The workspace always retains an owner through concurrent transfer/removal attempts.

- [ ] **D22.3** Test role changes and member revocation against open dashboard sessions.

  Prerequisite: D22.2. **Done when:** A removed member loses subsequent API/export/notification access.

## Day 23 Sharing and iframe embedding

Modules: M18.

- [ ] **D23.1** Add share-link controls and owner-managed embed policy to form settings.

  Prerequisite: D22.3. **Done when:** An author can copy the exact published URL and see embed availability.

- [ ] **D23.2** Create respondent-only embed routes and copyable iframe markup with deliberate framing headers.

  Prerequisite: D23.1. **Done when:** An enabled iframe renders while author pages cannot be framed.

- [ ] **D23.3** Test embedded submission, closed forms, disabled embed and small viewport behaviour.

  Prerequisite: D23.2. **Done when:** Embed policy cannot bypass public admission or reveal management navigation.

## Day 24 Starter templates and duplication

Modules: M16.

- [ ] **D24.1** Create synthetic contact, workshop, product feedback and volunteer-interest templates.

  Prerequisite: D23.3. **Done when:** Each shipped template validates and contains no real personal data.

- [ ] **D24.2** Implement form/template duplication with fresh field/option/step identities and remapped rules.

  Prerequisite: D24.1. **Done when:** Duplicating preserves meaning without references back to the source form.

- [ ] **D24.3** Build the template chooser and save-as-template flow with workspace checks.

  Prerequisite: D24.2. **Done when:** Using a template creates an unpublished owned draft, never a live form automatically.

## Day 25 Schema import and export

Modules: M16.

- [ ] **D25.1** Define a portable versioned schema-only JSON format and export endpoint.

  Prerequisite: D24.3. **Done when:** Export excludes responses, workspace internals and author credentials.

- [ ] **D25.2** Implement bounded import parsing, reference remapping and preview-before-save UI.

  Prerequisite: D25.1. **Done when:** Malformed, oversized, unknown-version and invalid-rule imports fail safely.

- [ ] **D25.3** Add round-trip fixtures covering rules, steps, options and themes.

  Prerequisite: D25.2. **Done when:** Export/import retains form behaviour while regenerating identity fields.

## Day 26 Retention and expiry

Modules: M19.

- [ ] **D26.1** Add response retention configuration, expiry timestamps and appropriate indexes.

  Prerequisite: D25.3. **Done when:** New responses receive the documented deadline for the chosen policy.

- [ ] **D26.2** Apply effective expiry to inbox, details, exports, notifications and analytics queries.

  Prerequisite: D26.1. **Done when:** Expired data is hidden before physical TTL cleanup runs.

- [ ] **D26.3** Implement shortening-policy batches and explicit non-resurrection semantics for increases.

  Prerequisite: D26.2. **Done when:** Reducing retention hides old data immediately and increasing it does not restore expired answers.

## Day 27 Deletion cleanup and audit

Modules: M19.

- [ ] **D27.1** Implement owner response/form deletion with immediate hiding and durable cleanup jobs.

  Prerequisite: D26.3. **Done when:** Deleting a form blocks public context creation and submissions immediately.

- [ ] **D27.2** Add a cleanup worker with atomic leases, idempotent batches and restart recovery.

  Prerequisite: D27.1. **Done when:** A worker interruption resumes removal without restoring deleted data.

- [ ] **D27.3** Record safe audit actions for publish, close, export, roles and deletion with an owner audit view.

  Prerequisite: D27.2. **Done when:** Audit entries identify actions and IDs without answers, credentials or signed tokens.

## Day 28 In-app notifications

Modules: M20.

- [ ] **D28.1** Expose membership-scoped notifications and per-user unread cursors using response notification records.

  Prerequisite: D27.3. **Done when:** Two users can independently read the same workspace notification without duplicate response events.

- [ ] **D28.2** Build unread indicator, notification list and authorized response deep links.

  Prerequisite: D28.1. **Done when:** A notification reaches only a currently authorized response page.

- [ ] **D28.3** Test deleted/expired response references, duplicate retries and membership removal.

  Prerequisite: D28.2. **Done when:** Notification content exposes no deleted answer data and retries produce one event.

## Day 29 Response analytics

Modules: M21.

- [ ] **D29.1** Implement bounded accepted-count, review-total and daily-response aggregation queries.

  Prerequisite: D28.3. **Done when:** Fixture summaries match the same eligibility and retention filters as the inbox.

- [ ] **D29.2** Build charts for finite-choice answers with explicit version/field identifiers and date scope.

  Prerequisite: D29.1. **Done when:** Renamed labels are contextualized and changed field identities are not silently merged.

- [ ] **D29.3** Document the absence of visitor identity, view counts and completion-rate claims.

  Prerequisite: D29.2. **Done when:** Every displayed metric has a defined numerator, filter and time/version scope.

## Day 30 Team beta and stabilization

Modules: M17 M18 M19 M20 M21 M24.

- [ ] **D30.1** Run a two-workspace owner/editor/viewer journey across templates, embeds, export and notifications.

  Prerequisite: D29.3. **Done when:** No role or tenant-boundary regression appears in the integrated suite.

- [ ] **D30.2** Fix observed blockers using buffer time and update operational/default-setting notes.

  Prerequisite: D30.1. **Done when:** Published beta capabilities and limitations match checked behaviour.

- [ ] **D30.3** Tag v0.3 with self-hosted beta instructions and synthetic team demonstration.

  Prerequisite: D30.2. **Done when:** A small invited team can create and process a form without undocumented setup.

## Day 31 Optional local respondent drafts

Modules: M22.

- [ ] **D31.1** Add explicit opt-in local drafts with form/version keys, expiry and bounded browser storage.

  Prerequisite: D30.3. **Done when:** No answer persists locally before opt-in and no signed context is stored.

- [ ] **D31.2** Build restore/discard flow, fresh-context acquisition and clear-on-success behaviour.

  Prerequisite: D31.1. **Done when:** A compatible draft restores on the same browser and clears after acceptance.

- [ ] **D31.3** Test version mismatch, closed form, author-disabled drafts, expiry and unavailable storage.

  Prerequisite: D31.2. **Done when:** Incompatible or expired drafts cannot silently submit against another schema.

## Day 32 Inbox filtering and search

Modules: M11.

- [ ] **D32.1** Add cursor-compatible date, version and reviewed/archive filters with URL state.

  Prerequisite: D31.3. **Done when:** Reloading an authorized inbox restores its filters correctly.

- [ ] **D32.2** Implement bounded text search over approved answer previews with indexes and no user regex.

  Prerequisite: D32.1. **Done when:** Search honours form/tenant/expiry scope and returns predictable limited results.

- [ ] **D32.3** Test pagination changes, empty results, stale cursors and historical detail links.

  Prerequisite: D32.2. **Done when:** Filtering never leaks another workspace or mislabels an older response.

## Day 33 Editor accessibility and interaction polish

Modules: M05 M15.

- [ ] **D33.1** Audit palette, properties, rule controls and move buttons for keyboard and screen-reader use.

  Prerequisite: D32.3. **Done when:** All editing actions have labeled non-drag alternatives.

- [ ] **D33.2** Improve announcements, focus restoration after delete/reorder and unsaved conflict recovery.

  Prerequisite: D33.1. **Done when:** A keyboard user edits, previews and publishes without losing focus or work.

- [ ] **D33.3** Test touch/narrow layouts and measured large-schema rendering; fix observed interaction defects.

  Prerequisite: D33.2. **Done when:** A maximum-size allowed form remains usable on the recorded test devices.

## Day 34 Limits performance and service health

Modules: M23.

- [ ] **D34.1** Verify schema/submission size bounds, per-client/form rates and atomic lifetime response capacity.

  Prerequisite: D33.3. **Done when:** Concurrent submissions cannot exceed capacity and excessive requests return documented errors.

- [ ] **D34.2** Measure documented p95 goals on fixed datasets and improve proven query/render bottlenecks.

  Prerequisite: D34.1. **Done when:** The performance report records environment, load and actual measured results.

- [ ] **D34.3** Add dependency readiness, safe logs and cleanup-lag visibility with failure simulations.

  Prerequisite: D34.2. **Done when:** Mongo loss changes readiness without exposing secrets or answer bodies.

## Day 35 Backup restore and migrations

Modules: M23.

- [ ] **D35.1** Define consistent Mongo backup, schema-version and key recovery procedures.

  Prerequisite: D34.3. **Done when:** Backup instructions specify what is retained and what secrets require separate protection.

- [ ] **D35.2** Restore synthetic data into an isolated instance with admission and cleanup disabled initially.

  Prerequisite: D35.1. **Done when:** Versions, responses and ownership relationships remain interpretable after restore.

- [ ] **D35.3** Exercise a compatible schema upgrade, rollback and counter/job reconciliation.

  Prerequisite: D35.2. **Done when:** The recovery report demonstrates the steps and states any limitations observed.

## Day 36 Repeatable self hosting

Modules: M23.

- [ ] **D36.1** Complete production Compose services, replica-set initialization, persistent volumes and proxy routes.

  Prerequisite: D35.3. **Done when:** A clean environment starts Next.js, API, worker and transaction-capable Mongo.

- [ ] **D36.2** Document runtime/build configuration, first-owner creation, secrets and HTTPS session behaviour.

  Prerequisite: D36.1. **Done when:** The operator can identify required settings without copying real credentials into source.

- [ ] **D36.3** Run clean install and publish-submit-inspect smoke checks through the production proxy.

  Prerequisite: D36.2. **Done when:** The documented self-hosting path works with the actual routed services.

## Day 37 Maintainer and API documentation

Modules: M24.

- [ ] **D37.1** Complete README, architecture, module references, public API examples and OpenAPI schemas.

  Prerequisite: D36.3. **Done when:** Examples match the shipped endpoints and exact setup commands.

- [ ] **D37.2** Add CONTRIBUTING, issue/PR templates, license notices, troubleshooting and migration notes.

  Prerequisite: D37.1. **Done when:** A contributor can find checks, task IDs and review expectations.

- [ ] **D37.3** Build a synthetic sample gallery and a safe demonstration reset procedure.

  Prerequisite: D37.2. **Done when:** Demo reset never operates on non-demo workspaces and example answers are fabricated clearly.

## Day 38 Complete journey verification

Modules: M24.

- [ ] **D38.1** Run clean-author create/publish, anonymous submit, inbox/export and republish-history browser journeys.

  Prerequisite: D37.3. **Done when:** All core journeys pass on an actual running stack.

- [ ] **D38.2** Run conditional, multi-step, roles, embeds, import, expiry and local-draft regression suites.

  Prerequisite: D38.1. **Done when:** The added features respect the same schema and authorization contracts.

- [ ] **D38.3** Ask a fresh tester to follow setup and first-form instructions and fix observed failures.

  Prerequisite: D38.2. **Done when:** The tester reaches the documented first-response outcome without private steps.

## Day 39 Release candidate and buffer

Modules: M23 M24.

- [ ] **D39.1** Freeze scope and run production builds, lint, types, database/API and browser suites.

  Prerequisite: D38.3. **Done when:** The release candidate has recorded passing checks or explicit blocking failures.

- [ ] **D39.2** Review final diffs, default limits, framing/caching settings and repository/demo data hygiene.

  Prerequisite: D39.1. **Done when:** No release blocker remains in auth, response interpretation, admission or data deletion.

- [ ] **D39.3** Use stabilization time to fix blockers and prepare candidate notes with known limitations.

  Prerequisite: D39.2. **Done when:** A candidate is traceable to a verified commit and reproducible installation.

## Day 40 Public version one release

Modules: M24.

- [ ] **D40.1** Publish the approved v1.0 code release and installation/migration notes to the verified authorized repository.

  Prerequisite: D39.3. **Done when:** The release points to the checked commit and its installation instructions.

- [ ] **D40.2** Demonstrate the synthetic author-to-response journey and invite initial users to try that workflow.

  Prerequisite: D40.1. **Done when:** Feedback records actual observations; no adoption numbers are invented.

- [ ] **D40.3** Record remaining issues, release evidence and a fresh GHFind comparison when available.

  Prerequisite: D40.2. **Done when:** Maintenance priorities are actionable and score claims are separated from engineering completion.
