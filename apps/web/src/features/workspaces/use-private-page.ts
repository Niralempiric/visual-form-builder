"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PrivatePage } from '@/lib/dashboard-api';

type PageState<T> = { scope: string; kind: 'loading' | 'ready' | 'more' | 'error'; items: T[]; nextCursor: string | null; error?: unknown };
export function usePrivatePage<T extends { id: string }>(scope: string,
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<PrivatePage<T>>) {
  const empty: PageState<T> = { scope, kind: 'loading', items: [], nextCursor: null };
  const [state, setState] = useState<PageState<T>>(empty);
  const latest = useRef(state);
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const load = useCallback(async (append = false) => {
    if (append && pending.current) return;
    const before = latest.current;
    const cursor = append && before.scope === scope ? before.nextCursor : null;
    if (append && !cursor) return;
    controller.current?.abort();
    const current = new AbortController(); controller.current = current; pending.current = true;
    const write = (value: PageState<T>) => { latest.current = value; setState(value); };
    write({ scope, kind: append ? 'more' : 'loading', items: append ? before.items : [], nextCursor: cursor });
    try {
      const page = await fetchPage(cursor, current.signal);
      if (current.signal.aborted) return;
      // No private global cache. Ignore late responses after scope change/unmount.
      const items = append ? [...new Map([...before.items, ...page.data].map(item => [item.id, item])).values()] : page.data;
      write({ scope, kind: 'ready', items, nextCursor: page.nextCursor });
    } catch (error) {
      if (!current.signal.aborted) write({ scope, kind: 'error', items: [], nextCursor: null, error });
    } finally { if (controller.current === current) pending.current = false; }
  }, [scope, fetchPage]);
  useEffect(() => {
    const refresh = () => { void load(); };
    refresh(); window.addEventListener('focus', refresh); window.addEventListener('pageshow', refresh);
    return () => { controller.current?.abort(); window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh); };
  }, [load]);
  return { ...(state.scope === scope ? state : empty), refresh: () => { void load(); }, more: () => { void load(true); } };
}
