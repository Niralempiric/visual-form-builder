"use client";

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AuthRequestError, issueRecoveryCodes } from '@/lib/auth-api';

export function RecoveryCodes() {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const active = useRef(false);
  const alert = useRef<HTMLParagraphElement>(null);
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => { if (message) alert.current?.focus(); }, [message]);
  useEffect(() => { if (codes) result.current?.focus(); }, [codes]);
  // Codes exist only in this mounted view; never persist or recover them on reload.
  useEffect(() => {
    const hide = () => setCodes(null);
    window.addEventListener('pagehide', hide);
    return () => window.removeEventListener('pagehide', hide);
  }, []);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    active.current = true;
    setBusy(true); setMessage(''); setCodes(null);
    const form = event.currentTarget;
    const password = String(new FormData(form).get('currentPassword') ?? '');
    form.reset();
    try { setCodes((await issueRecoveryCodes(password)).codes); }
    catch (error) {
      setMessage(error instanceof AuthRequestError && error.status === 429 ? 'Too many attempts. Try again in 15 minutes.' :
        error instanceof AuthRequestError && error.status === 401 ? 'Could not generate codes. Check your password and session.' :
        error instanceof AuthRequestError && error.status === 403 ? 'This request could not be verified. Reload the page and try again.' :
        'Code generation could not be confirmed. Check your connection, then generate a new set; only the latest set will work.');
    } finally { active.current = false; setBusy(false); }
  }

  return <section className="recovery-settings" aria-labelledby="recovery-title" aria-busy={busy}>
    <h2 id="recovery-title">Recovery codes</h2>
    <p className="account-help">Save codes before you lose access. Generating a new set immediately replaces every previous unused code.</p>
    <form onSubmit={generate}>
      <fieldset disabled={busy}>
        <legend className="sr-only">Confirm your password for a new recovery set</legend>
        <label htmlFor="current-password">Current password</label>
        <input id="current-password" name="currentPassword" type="password" autoComplete="current-password" maxLength={128} required />
        <button type="submit">{busy ? 'Generating codes…' : 'Generate new recovery codes'}</button>
      </fieldset>
    </form>
    {message ? <p className="account-error" role="alert" tabIndex={-1} ref={alert}>{message}</p> : null}
    {codes ? <div className="recovery-result" ref={result} tabIndex={-1} aria-labelledby="codes-title">
      <h3 id="codes-title">Save these five codes now</h3>
      <p className="account-help">Each code resets your password once and signs out every session. Keep them in a password manager or another safe offline place. They cannot be displayed again. Never share them in screenshots or reports.</p>
      <ol className="recovery-list">{codes.map((code, index) => <li key={index}>
        <label htmlFor={'recovery-code-' + index}>Code {index + 1}</label>
        <input id={'recovery-code-' + index} data-recovery-code="true" type="text" autoComplete="off" readOnly value={code} spellCheck={false}
          onFocus={event => event.currentTarget.select()} />
      </li>)}</ol>
      <button type="button" onClick={() => setCodes(null)}>I saved my codes — hide them</button>
    </div> : null}
  </section>;
}
