# Workspace dashboard

D05.2 | 3 November 2026

Use the pinned [local setup](LOCAL_DEVELOPMENT.md), a ready Mongo replica set and
an existing [operator-created account](AUTHENTICATION.md). Start both services
with the documented `npm run dev` command, then visit `/login` at the exact
APP_ORIGIN and sign in. No public signup or deployment is implied.

## Synthetic walkthrough

1. At `/app`, a new account sees **No workspaces yet**. Enter **Synthetic workshop**
   in **Workspace name** and select **Create workspace**.
2. The selected workspace shows its name and role, plus **No forms yet**. Enter
   **Synthetic workshop registration** in **Form title** and select **Create form**.
3. The editor opens at `/app/forms/<formId>/edit`. Check the title, workspace,
   **Draft · Not published** and the empty canvas. The saved draft is read through
   the protected API. D07.1 allows adding fields and editing their properties in
   memory only; its unsaved notice and [editor guide](EDITOR.md) explain the limits.
4. Select **Back to Synthetic workshop**. Its dashboard lists that form. Select
   its title or **Open form** and check the same title/workspace again. If you
   added fields locally, a leave warning appears and those edits are not saved.
5. Create a second **Synthetic volunteer** workspace and an empty **Synthetic
   volunteer interest** form. Return to the dashboard and use **Current workspace**
   to switch between them. Each list and opened overview must belong to that
   workspace. Reload: both workspaces/forms persist in Mongo.
6. **Account and recovery** opens `/app/account`; **Workspace dashboard** returns
   to `/app`. **Sign out** ends this session. Do not generate recovery credentials
   merely to test dashboard navigation.

Use synthetic names only. Existing local data is preserved; there is no automatic
seed or reset. The workspace query parameter preserves the selected scope when
returning from a draft. A malformed workspace link shows a local error; missing
or unauthorized records show the same unavailable message. Only an owner sees
form creation; all supported membership roles can read their workspace forms.

## Loading, failures and accessibility

Workspace discovery, workspace details, form lists and draft reads show loading
states and safe retry controls. Empty results are distinct from failed reads.
Refresh restarts a list; **Load more workspaces/forms** follows bounded cursors.
Workspace changes/unmount abort old reads and suppress late results/navigation.
Private data lives in the mounted client view, not a shared server/browser-storage
cache. Reads are same-origin/no-store with eight-second timeouts and revalidate
on focus/pageshow. Every API request independently checks identity and scope.

Creation uses bounded required labels, a disabled pending form and a synchronous
duplicate-submit guard. It obtains CSRF before POST and does not automatically
retry writes. A lost response may already have committed: refresh before retrying.
The API enforces the 25-form ceiling. Names/titles render as literal React text.
Keyboard controls use native input/button/select/link semantics; loaded headings
and errors receive focus. The layout stacks at narrow widths. Expired identity
hides protected content and offers sign-in; sign-out unmounts private views.

For a failed-read check, interrupt only a disposable test API/list request, use
Refresh, observe the safe error, restore the dependency and retry. A local test
proxy can delay genuine list responses to observe loading and rapid workspace
switching without fake data. Never add production debug endpoints or change
normal development data for this check.

The individual D05.2 check is opening the correct form from its workspace
dashboard. D05.3 provides tenant-denial coverage and D07.1 adds local field
editing. Saving, immutable publication, submissions, export and release
accessibility/deployment gates remain pending. See [workspace API contracts](WORKSPACES.md) and
[verification commands](TESTING.md).
