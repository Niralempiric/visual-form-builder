"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AuthRequestError, recoverAccount } from '@/lib/auth-api';

export function RecoveryForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const active = useRef(false);
  const alert = useRef<HTMLParagraphElement>(null);
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => { if (message) alert.current?.focus(); }, [message]);
  useEffect(() => { if (done) result.current?.focus(); }, [done]);

  async function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get('newPassword') ?? '');
    setMessage('');
    if (Array.from(newPassword).length < 15 || newPassword !== data.get('confirmPassword')) {
      setMessage('Use at least 15 characters and enter the same new password twice.');
      return;
    }
    active.current = true; setBusy(true);
    const input = { email: data.get('email'), code: data.get('code'), newPassword };
    // Keep credentials out of component/browser storage and clear submitted fields.
    form.reset();
    try { await recoverAccount(input); setDone(true); }
    catch (error) {
      setMessage(error instanceof AuthRequestError && error.status === 429 ? 'Too many attempts. Try again in 15 minutes.' :
        error instanceof AuthRequestError && error.status === 401 ? 'Recovery failed. Check your email and unused recovery code.' :
        error instanceof AuthRequestError && error.status === 403 ? 'This request could not be verified. Reload the page and try again.' :
        error instanceof AuthRequestError && error.status === 400 ? 'Check the email, 43-character code and new password, then try again.' :
        'Recovery could not be confirmed. Try signing in with the new password first; a committed recovery consumes that code.');
    } finally { active.current = false; setBusy(false); }
  }

  return <section className="account-card" aria-labelledby="account-title" aria-busy={busy}>
    <p className="eyebrow">Your private instance</p><h1 id="account-title">Recover access.</h1>
    {done ? <div ref={result} tabIndex={-1} aria-live="polite">
      <h2>Password reset complete</h2>
      <p>Your code was used and all previous sessions were signed out. Sign in with your new password.</p>
      <Link className="account-link" href="/login">Sign in with your new password</Link>
    </div> : <>
      <p>Use an unused code you previously saved from your account. Recovery resets your password and signs out every session.</p>
      <form onSubmit={recover}>
        <fieldset disabled={busy}>
          <legend className="sr-only">Account recovery credentials</legend>
          <label htmlFor="recovery-email">Email address</label>
          <input id="recovery-email" name="email" type="email" autoComplete="username" maxLength={254} required />
          <label htmlFor="recovery-code">Recovery code</label>
          <input id="recovery-code" name="code" type="password" autoComplete="off" minLength={43} maxLength={43} pattern="[A-Za-z0-9_-]{43}" required />
          <label htmlFor="new-password">New password</label>
          <input id="new-password" name="newPassword" type="password" autoComplete="new-password" maxLength={128} aria-describedby="password-help" required />
          <p className="account-help" id="password-help">Use 15 or more characters, up to 128. Spaces are preserved.</p>
          <label htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" maxLength={128} required />
          <button type="submit">{busy ? 'Recovering access…' : 'Reset password and sign out all sessions'}</button>
        </fieldset>
      </form>
      <p className="account-help">No saved code? There is no email reset or public signup. If you can still sign in, generate codes from your account first.</p>
      <Link className="account-link" href="/login">Back to sign in</Link>
    </>}
    {message ? <p className="account-error" ref={alert} role="alert" tabIndex={-1}>{message}</p> : null}
  </section>;
}
