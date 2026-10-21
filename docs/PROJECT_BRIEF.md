# Visual Form Builder Project Brief

D01.1 product contract | 21 October 2026

This brief describes planned outcomes, not implemented capabilities or adoption.
The [project plan](PROJECT_DOCUMENTATION.md) is the detailed specification.

## Intended users and problem

The first user is a developer at a small agency who needs a workshop registration
form for their team. Other intended authors are community organizers and internal
operations teams creating surveys, interest forms and feedback questionnaires.
Respondents need to complete a shared form without creating an author account.

Hand-coding each form repeats input validation, layout and response-management
work. The planned self-hostable builder will let authors configure these visually
while retaining control of the source and hosting. Keyboard controls will provide
an alternative to dragging. Next.js/React will present the UI; a separate Express
API and MongoDB will own persistence and validation, with shared TypeScript schemas.

## First create-publish-submit journey

1. A maintainer will run a private instance, bootstrap the first author account
   and sign in. The author will create a workspace and a Workshop registration draft.
2. The author will add name, email and a session dropdown, require name and email,
   define session options, save, and preview at a narrow screen width.
3. Publishing will freeze immutable version 1 and provide a shareable `/f/:publicId`
   URL. Draft edits will not change that published version silently.
4. A respondent will open the URL without an author account, receive the schema
   and a short-lived signed render context, and submit synthetic answers with a
   stable idempotency key. Express will validate against the accepted version and
   acknowledge success only after durable storage; identical retries will return
   the existing receipt instead of creating another response.
5. The author will inspect the response with its original labels and selected
   option and export a spreadsheet-safe CSV. Later publications will preserve
   the interpretation of earlier responses. Closing the form will block new submissions.

## Scope boundaries

The core release will cover accounts, visual editing, preview, immutable publishing,
validated public submissions, an authorized response inbox and safe CSV export.
Planned collecting fields are short/long text, email, number, dropdown, checkbox,
radio groups, multiple choice, date and bounded rating; heading and description
blocks will organize content without collecting answers. Labels and help will be plain text.

Later planned releases will add conditional visibility, multi-step forms, bounded
themes, team controls, templates, schema import/export, retention, in-app notifications,
limited analytics and optional respondent drafts stored locally after opt-in.

Version 1.0 excludes file uploads, payments, electronic signatures, arbitrary
HTML/CSS/JavaScript, user-defined regex, AI form generation, external webhooks,
email delivery, enterprise SSO, custom domains, cloud respondent draft synchronization,
real-time collaborative editing and a plugin marketplace.

Public forms will use shareable URLs; workspace authorization will protect editing
and responses, not make published questions confidential. Protected surveys and
one-response-per-person guarantees are beyond v1.0. A public source repository will
not make collected responses public. Shared examples and demonstrations will use
synthetic data and will not invite passwords, payment details or real customer data.

## Four planned release outcomes

| Release | Development days | Intended outcome |
|---|---|---|
| v0.1 Core builder | 1–15 | An author can sign in, edit and preview a form, publish an immutable version, collect validated submissions, inspect the response inbox and export safe CSV. |
| v0.2 Smarter forms | 16–20 | Conditional visibility, multi-step forms, basic themes and accessible error recovery work consistently with server validation and historical response interpretation. |
| v0.3 Team beta | 21–30 | A small team can use roles, invitations, sharing/embedding, templates, schema import/export, retention, in-app notifications and bounded analytics. |
| v1.0 Public code release | 31–40 | Optional local respondent drafts and inbox search accompany hardening, tested recovery, repeatable self-hosting, documentation and verified release evidence. |

These are development-day milestones, not guaranteed calendar dates. Each release
will require the evidence gates in the plan before it is described as usable.
