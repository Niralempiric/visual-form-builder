"use client";

import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';
import { getForm, getWorkspace } from '@/lib/dashboard-api';
import { usePrivatePage } from './use-private-page';
import { RequestFailure } from './controls';

export function DraftOverview({ formId }: { formId: string }) {
  const fetchDraft = useCallback(async (_cursor: string | null, signal: AbortSignal) => {
    const form = await getForm(formId, signal);
    const workspace = await getWorkspace(form.workspaceId, signal);
    return { data: [{ id: form.id, form, workspace }], nextCursor: null };
  }, [formId]);
  const draft = usePrivatePage('draft:' + formId, fetchDraft);
  const title = useRef<HTMLHeadingElement>(null), current = draft.items[0];
  useEffect(() => { if (current) title.current?.focus(); }, [current]);
  if (draft.kind === 'loading') return <output>Loading saved draft…</output>;
  if (draft.kind === 'error') return <RequestFailure error={draft.error} retry={draft.refresh} />;
  if (!current) return null;
  return <section className="draft-overview" aria-labelledby="draft-title">
    <p><Link className="account-link" href={'/app?workspace=' + current.workspace.id}>Back to {current.workspace.name}</Link></p>
    <p className="eyebrow">Saved draft · Not published</p>
    <h2 id="draft-title" ref={title} tabIndex={-1}>{current.form.title}</h2>
    <p>Workspace: <strong>{current.workspace.name}</strong></p>
    <div className="account-empty"><h3>No questions yet</h3><p>Your empty draft is saved. Adding questions and publishing are not available yet.</p></div>
    <button type="button" onClick={draft.refresh}>Refresh saved draft</button>
  </section>;
}
