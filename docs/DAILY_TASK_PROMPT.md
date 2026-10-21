# Reusable Daily Task Prompt

Copy the text below into the implementation chat after opening the actual Visual Form Builder repository. This documentation package is not an implemented application. No automation or schedule is created by saving this prompt.

```text
Work on the Visual Form Builder implementation repository opened for this chat.
The intended public repository belongs to Niralempiric. Inspect and record its
actual absolute path and GitHub URL; do not confuse it with Webhook Inbox or
assume a planning-artifact folder is the implementation repository.

Read applicable AGENTS.md instructions and these project-local files:
- docs/PROJECT_DOCUMENTATION.md
- docs/NIRAL_PROJECT_GROWTH_CHECKLIST.md
- docs/TASK_BOARD.md
- docs/IMPLEMENTATION_PROGRESS.md

Inspect code, current branch, remotes, recent commits and working-tree changes.
Preserve unrelated work, Git identity settings and existing remote URLs.

Complete exactly ONE individual task per run, such as D01.1, not a whole day.
Resume an unfinished task first; otherwise choose the earliest pending task
whose prerequisite is verified complete. Verify code and evidence rather than
trusting checkboxes alone. Repository initialization does not by itself finish
D01.1, but completed planning work should not be repeated. Each task has its
own completion check; do not require future release features to finish an
earlier task. D01.2 and D01.3 intentionally start real application setup.

Announce the selected ID, outcome and check, then implement it. Follow the
Next.js frontend, Express backend, shared schema, immutable-version and
transaction contracts. Keep scope focused. Add meaningful tests appropriate
to the change and verify affected UI in a browser when available. Update
documentation and examples to match the result. Do not fabricate reviews,
users, adoption, score increases or daily activity.

Read the entire growth checklist and evaluate every checkpoint. Complete
applicable items within this task's scope. Record phase statuses and changed
checkpoint evidence as completed for this run, pending, not applicable or
blocked. Preserve the previous baseline rather than duplicating a long
unchanged checklist every day. Do not create issues, PRs, releases or posts
merely for activity. No unrelated outreach or automatic deployment is implied.

Run the task's completion check and required repository verification. Review
the diff for secrets, real response data and unrelated changes. Do not mark
the task complete when required acceptance evidence is missing. If essential
access or a user decision is missing, preserve work and report the exact
blocker; do not silently skip to another dependent task.

Update IMPLEMENTATION_PROGRESS.md with task status, changed files, acceptance
evidence, commands/results, growth-checklist outcomes, limitations and next
eligible ID. Mark only the selected completed task in both the project plan
and task board. Keep their task descriptions and statuses consistent.

I authorize committing and pushing the changes made for this selected task
to this Visual Form Builder repository under Niralempiric. Verify its exact
URL before publishing and record it in the progress file. If the repository
is ambiguous or belongs to a different account, ask for the intended target.
Do not assume the remote named origin is the authorized repository.

Use the current branch when suitable or a codex/ branch when necessary.
Stage only task-related changes and use a meaningful commit containing its
ID. Push to the verified appropriate remote branch and verify it contains
the new commit. Never force-push, discard work, rewrite history, change
repository visibility or modify Git identity settings. If pushing fails,
preserve the local commit and explain the actual blocker. Avoid empty commits.

Report the selected task/status, result, checks, growth checkpoints, commit,
branch, push status and next eligible ID. Stop after this ONE task.
```
