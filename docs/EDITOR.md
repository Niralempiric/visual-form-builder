# Visual form editor

D07.1 | 12 November 2026

An owner or editor can open an existing draft from the [workspace dashboard](DASHBOARD.md),
add fields from the palette, select them in the canvas and edit their labels,
optional help text and required setting. Choice fields also let an author add,
rename and remove options; at least one option must remain. Layout-only heading
and description blocks do not have a required setting. A viewer receives a
read-only access message. The existing API independently enforces membership on
its reads; this interface does not grant permissions.

**Changes are not saved.** D07.1 keeps the working definition only in the current
page's memory. There is no save button, autosave, browser storage, API write or
published form. Leaving, signing out, session expiration or reload can discard the
work. Ordinary links and sign-out show a confirmation after an edit; refresh/tab
close use the browser's standard unload warning. Browser history navigation,
session loss and browser settings can bypass or suppress warnings. Do not rely on
this early editor for work that must be retained. Draft save/revision conflict
handling belongs to D09.

## Try it with synthetic data

Use the pinned [local setup](LOCAL_DEVELOPMENT.md), a ready replica set and an
operator-created author. Sign in, open or create a draft, then:

1. Select **Short text**. The new field appears in the canvas and its properties
   open. Change **Question label**, optional **Help text** and **Required question**.
2. Select **Dropdown**, rename the question, edit **Option 1** and **Option 2**,
   and use **Add option** or **Remove**. Select either canvas field to return to it.
3. A blank question or option label displays a correction message. A maximum of
   50 fields and 100 options per choice is allowed. The existing whole-definition
   validator also reports an invalid or oversized in-memory form.
4. The canvas shows field type and required/optional status. It is an editor
   representation, not the respondent renderer or preview. Text is rendered as
   plain React text. Field and option UUIDs are generated locally and preserved
   across edits; opening another tab reads the unchanged saved draft.

The existing initial draft endpoint supplies the starting definition. D07.1 uses
a per-draft Zustand store, immutable updates and the existing shared schema/field
registry. Transient empty text is allowed while typing but does not satisfy schema
validation. Invalid generated IDs/collisions fail safely rather than duplicating
IDs. No respondent answer data is generated or stored.

Field duplication/deletion, reordering and undo/redo are D07.2–D07.3. Actual
respondent controls/preview are D08. Persistence and optimistic conflicts are D09;
publication, submissions and release/accessibility gates remain later work. See
[testing](TESTING.md) and [implementation progress](IMPLEMENTATION_PROGRESS.md)
for verification and known limitations.
