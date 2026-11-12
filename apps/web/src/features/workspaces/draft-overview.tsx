"use client";

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthRequestError } from '@/lib/auth-api';
import { getForm, getWorkspace } from '@/lib/dashboard-api';
import { FormEditor } from '@/features/editor/form-editor';
import { createEditorStore } from '@/features/editor/store';
import type { EditorStore } from '@/features/editor/store';
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
  const storeRef = useRef<EditorStore | null>(null);
  const [store, setStore] = useState<EditorStore | null>(null);
  useEffect(() => { if (current) title.current?.focus(); }, [current]);
  useEffect(() => {
    if (current && current.workspace.role !== 'viewer' && !storeRef.current) {
      storeRef.current = createEditorStore(current.form.draftSchema);
      setStore(storeRef.current);
    }
    const denied = draft.kind === 'error' && draft.error instanceof AuthRequestError && [401, 404].includes(draft.error.status);
    if ((current?.workspace.role === 'viewer' || denied) && storeRef.current) { storeRef.current = null; setStore(null); }
  }, [current, draft.kind, draft.error]);
  if (draft.kind === 'loading') return <output>Loading saved draft…</output>;
  if (draft.kind === 'error') return <RequestFailure error={draft.error} retry={draft.refresh} />;
  if (!current) return null;
  return <section className="draft-overview" aria-labelledby="draft-title">
    <p><Link className="account-link" href={'/app?workspace=' + current.workspace.id}>Back to {current.workspace.name}</Link></p>
    <p className="eyebrow">Draft · Not published</p>
    <h2 id="draft-title" ref={title} tabIndex={-1}>{current.form.title}</h2>
    <p>Workspace: <strong>{current.workspace.name}</strong></p>
    {current.workspace.role === 'viewer' ? <div className="account-empty"><h3>View-only access</h3><p>Your workspace role can view this draft. An owner or editor can make changes.</p></div> :
      store ? <FormEditor store={store} /> : <output>Preparing editor…</output>}
  </section>;
}
