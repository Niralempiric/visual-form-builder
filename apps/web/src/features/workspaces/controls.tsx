"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AuthRequestError } from '@/lib/auth-api';

export function RequestFailure({ error, retry }: { error: unknown; retry: () => void }) {
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => { alert.current?.focus(); }, [error]);
  const status = error instanceof AuthRequestError ? error.status : 0;
  return <div>
    <p className="account-error" role="alert" tabIndex={-1} ref={alert}>{status === 401 ? 'Your session ended. Sign in again to continue.' :
      status === 404 ? 'This workspace or form is unavailable, or you no longer have access.' :
      'Could not load this view. Check your connection and try again.'}</p>
    {status === 401 ? <Link className="account-link" href="/login">Sign in</Link> : <button type="button" onClick={retry}>Retry loading</button>}
  </div>;
}
export function CreateEntry({ kind, submit }: { kind: 'workspace' | 'form'; submit: (value: string, signal: AbortSignal) => Promise<void> }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null), active = useRef(false);
  const alert = useRef<HTMLParagraphElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (message) alert.current?.focus(); }, [message]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (active.current) return;
    const form = event.currentTarget, value = String(new FormData(form).get('name') ?? '').trim();
    if (!value) { setMessage('Enter a ' + (kind === 'workspace' ? 'workspace name.' : 'form title.')); return; }
    active.current = true; setBusy(true); setMessage('');
    const current = new AbortController(); controller.current = current;
    try { await submit(value, current.signal); if (!current.signal.aborted) form.reset(); }
    catch (error) {
      if (current.signal.aborted) return;
      const status = error instanceof AuthRequestError ? error.status : 0;
      setMessage(status === 401 ? 'Your session ended. Sign in again.' : status === 403 ? 'Request verification failed. Reload and try again.' :
        status === 404 ? 'This workspace is unavailable or you cannot create forms here.' :
        status === 409 ? 'The workspace form limit was reached or the creation conflicted. Refresh the list.' :
        'Creation could not be confirmed. Refresh the list before retrying; it may already have been saved.');
    } finally { active.current = false; if (!current.signal.aborted) setBusy(false); }
  }
  const id = kind + '-name';
  return <div className="create-entry">
    <form onSubmit={create}>
      <fieldset disabled={busy}><legend className="sr-only">Create a {kind}</legend>
        <label htmlFor={id}>{kind === 'workspace' ? 'Workspace name' : 'Form title'}</label>
        <div className="entry-row"><input id={id} name="name" required maxLength={kind === 'workspace' ? 80 : 160} />
          <button type="submit">{busy ? 'Creating…' : kind === 'workspace' ? 'Create workspace' : 'Create form'}</button></div>
      </fieldset>
    </form>
    {message ? <p className="account-error" role="alert" tabIndex={-1} ref={alert}>{message}</p> : null}
  </div>;
}
