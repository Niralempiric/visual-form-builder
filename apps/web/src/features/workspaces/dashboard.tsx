"use client";

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { objectIdSchema } from '@visual-form-builder/contracts';
import type { WorkspaceDto } from '@visual-form-builder/contracts';
import { createForm, createWorkspace, getWorkspace, listForms, listWorkspaces } from '@/lib/dashboard-api';
import { usePrivatePage } from './use-private-page';
import { CreateEntry, RequestFailure } from './controls';

function chooseWorkspace(id: string) { window.history.replaceState(null, '', '/app?workspace=' + objectIdSchema.parse(id)); }
function WorkspaceView({ id, options }: { id: string; options: WorkspaceDto[] }) {
  const router = useRouter();
  const fetchWorkspace = useCallback(async (_cursor: string | null, signal: AbortSignal) =>
    ({ data: [await getWorkspace(id, signal)], nextCursor: null }), [id]);
  const fetchForms = useCallback((cursor: string | null, signal: AbortSignal) => listForms(id, cursor, signal), [id]);
  const workspace = usePrivatePage('workspace:' + id, fetchWorkspace);
  const forms = usePrivatePage('forms:' + id, fetchForms);
  const title = useRef<HTMLHeadingElement>(null);
  const current = workspace.items[0];
  useEffect(() => { if (current) title.current?.focus(); }, [current]);
  if (workspace.kind === 'error') return <RequestFailure error={workspace.error} retry={workspace.refresh} />;
  if (!current) return <output>Loading workspace…</output>;
  const choices = options.some(option => option.id === current.id) ? options : [current, ...options];
  return <section className="workspace-view" aria-labelledby="workspace-title">
    <label htmlFor="workspace-choice">Current workspace</label>
    <select id="workspace-choice" value={current.id} onChange={event => chooseWorkspace(event.target.value)}>
      {choices.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
    <div className="dashboard-heading"><h2 id="workspace-title" ref={title} tabIndex={-1}>{current.name}</h2>
      <button type="button" onClick={forms.refresh}>Refresh forms</button></div>
    <p className="account-help">Your role: {current.role}. Forms stay private until published.</p>
    {current.role === 'owner' ? <CreateEntry kind="form" submit={async (value, signal) => {
      const form = await createForm(current.id, value, signal);
      if (!signal.aborted) router.push('/app/forms/' + form.id + '/edit');
    }} /> : <p>Only the workspace owner can create forms here.</p>}
    {forms.kind === 'loading' ? <output>Loading forms…</output> : null}
    {forms.kind === 'error' ? <RequestFailure error={forms.error} retry={forms.refresh} /> : null}
    {forms.kind === 'ready' && forms.items.length === 0 ? <div className="account-empty"><h3>No forms yet</h3><p>Create your first empty draft in this workspace.</p></div> : null}
    {forms.items.length > 0 ? <ul className="form-list">{forms.items.map(form => <li key={form.id}>
      <div><Link className="account-link" href={'/app/forms/' + form.id + '/edit'}>{form.title}</Link>
        <p className="account-help">Draft · Not published</p></div>
      <Link className="account-link" href={'/app/forms/' + form.id + '/edit'} aria-label={'Open ' + form.title}>Open form</Link>
    </li>)}</ul> : null}
    {forms.nextCursor ? <button type="button" disabled={forms.kind === 'more'} onClick={forms.more}>{forms.kind === 'more' ? 'Loading more forms…' : 'Load more forms'}</button> : null}
  </section>;
}
export function Dashboard() {
  const params = useSearchParams();
  const workspaces = usePrivatePage('workspaces', listWorkspaces);
  const requested = params.get('workspace');
  const valid = requested === null || objectIdSchema.safeParse(requested).success;
  const id = valid ? requested ?? workspaces.items[0]?.id : undefined;
  return <div className="dashboard-content">
    <section aria-labelledby="new-workspace-title"><h2 id="new-workspace-title">New workspace</h2>
      <p className="account-help">Group forms for a project or team.</p>
      <CreateEntry kind="workspace" submit={async (value, signal) => {
        const workspace = await createWorkspace(value, signal);
        if (!signal.aborted) { chooseWorkspace(workspace.id); workspaces.refresh(); }
      }} /></section>
    <div className="dashboard-heading"><h2>Your workspaces</h2><button type="button" onClick={workspaces.refresh}>Refresh workspaces</button></div>
    {workspaces.kind === 'loading' ? <output>Loading workspaces…</output> : null}
    {workspaces.kind === 'error' ? <RequestFailure error={workspaces.error} retry={workspaces.refresh} /> : null}
    {workspaces.kind === 'ready' || workspaces.kind === 'more' ? <>
      {!valid ? <p role="alert">This workspace link is invalid. <Link href="/app">Open your dashboard</Link></p> :
        id ? <WorkspaceView key={id} id={id} options={workspaces.items} /> :
          <div className="account-empty"><h2>No workspaces yet</h2><p>Create a workspace above to start your first form.</p></div>}
      {workspaces.nextCursor ? <button type="button" disabled={workspaces.kind === 'more'} onClick={workspaces.more}>
        {workspaces.kind === 'more' ? 'Loading more workspaces…' : 'Load more workspaces'}</button> : null}
    </> : null}
  </div>;
}
