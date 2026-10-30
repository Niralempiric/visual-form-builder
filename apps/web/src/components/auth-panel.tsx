"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { UserDto } from '@visual-form-builder/contracts';
import { AuthRequestError, authMutation, getAuthor } from '@/lib/auth-api';

type State = { kind: 'loading' | 'signedOut' | 'unavailable' } | { kind: 'signedIn'; user: UserDto };

export function AuthPanel({ mode }: { mode: 'login' | 'account' }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const active = useRef(false);
  const alert = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let controller: AbortController | undefined;
    function refresh() {
      if (active.current) return;
      controller?.abort();
      const current = new AbortController();
      controller = current;
      const signal = AbortSignal.any([current.signal, AbortSignal.timeout(8000)]);
      void getAuthor(signal).then(user => {
        if (!current.signal.aborted) { setState({ kind: 'signedIn', user }); setMessage(''); }
      }).catch((error: unknown) => {
        if (current.signal.aborted) return;
        setState({ kind: error instanceof AuthRequestError && error.status === 401 ? 'signedOut' : 'unavailable' });
      });
    }
    refresh();
    // Revalidate on returning to a tab or a restored browser page; API is authoritative.
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      controller?.abort();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, [retry]);

  useEffect(() => { if (message) alert.current?.focus(); }, [message]);

  async function mutate(action: 'login' | 'logout', input: unknown) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setMessage('');
    try {
      await authMutation(action, input);
      setState({ kind: action === 'logout' ? 'signedOut' : 'loading' });
      router.replace(action === 'login' ? '/app' : '/login');
    } catch (error) {
      if (action === 'logout' && error instanceof AuthRequestError && error.status === 401) {
        setState({ kind: 'signedOut' });
        router.replace('/login');
      } else if (error instanceof AuthRequestError && error.status === 429) {
        setMessage('Too many attempts. Try again in 15 minutes.');
      } else if (action === 'login' && error instanceof AuthRequestError && error.status === 401) {
        setMessage('Sign-in failed. Check your email and password, then try again.');
      } else if (error instanceof AuthRequestError && error.status === 403) {
        setMessage('This request could not be verified. Reload the page and try again.');
      } else {
        setMessage(action === 'logout' ? 'Sign-out could not be confirmed. Check the connection and try again.' :
          'The account service is unavailable. Check the connection and try again.');
      }
    } finally { active.current = false; setBusy(false); }
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const form = event.currentTarget;
    const input = new FormData(form);
    const password = form.elements.namedItem('password');
    if (password instanceof HTMLInputElement) password.value = '';
    void mutate('login', { email: input.get('email'), password: input.get('password') });
  }

  return (
    <section className="account-card" aria-labelledby="account-title" aria-busy={busy}>
      <p className="eyebrow">Your private instance</p>
      <h1 id="account-title">{mode === 'login' ? 'Welcome back.' : 'Your account.'}</h1>
      {state.kind === 'loading' ? <output>Checking your session…</output> : null}
      {state.kind === 'unavailable' ? <>
        <p role="alert">The account service is unavailable. Check your connection and try again.</p>
        <button type="button" onClick={() => { setState({ kind: 'loading' }); setRetry(value => value + 1); }}>Retry connection</button>
      </> : null}
      {state.kind === 'signedOut' && mode === 'account' ? <>
        <p>Your session has ended or you are signed out.</p><Link className="account-link" href="/login">Sign in</Link>
      </> : null}
      {state.kind === 'signedOut' && mode === 'login' ? <>
        <p>Sign in with the account created by your instance operator.</p>
        <form onSubmit={signIn}>
          <fieldset disabled={busy}>
            <legend className="sr-only">Account credentials</legend>
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="username" maxLength={254} required />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" maxLength={128} required />
            <button type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
          </fieldset>
        </form>
        <p className="account-help">Accounts are managed by your instance operator. Public signup is closed.</p>
      </> : null}
      {state.kind === 'signedIn' ? <>
        <output>Signed in as <strong className="account-email">{state.user.email}</strong>.</output>
        {mode === 'login' ? <Link className="account-link" href="/app">Open your account</Link> :
          <div className="account-empty"><h2>You’re ready for what’s next.</h2>
            <p>Workspace creation and form editing are still being built.</p></div>}
        <button type="button" onClick={() => { void mutate('logout', {}); }} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </> : null}
      {message ? <p className="account-error" ref={alert} role="alert" tabIndex={-1}>{message}</p> : null}
    </section>
  );
}
