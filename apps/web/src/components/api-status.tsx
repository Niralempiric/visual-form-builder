"use client";

import { useState } from 'react';

type Status = 'idle' | 'checking' | 'online' | 'offline';
const labels: Record<Status, string> = {
  idle: 'Not checked', checking: 'Checking connection…', online: 'API online', offline: 'API unavailable',
};

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('idle');

  async function checkConnection() {
    setStatus('checking');
    try {
      const response = await fetch('/health/live', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Liveness request failed.');
      const result: unknown = await response.json();
      if (typeof result !== 'object' || result === null || !('status' in result)
        || !('service' in result) || result.status !== 'ok' || result.service !== 'visual-form-builder-api') {
        throw new Error('Unexpected liveness response.');
      }
      setStatus('online');
    } catch {
      setStatus('offline');
    }
  }

  return (
    <section className="connection" aria-labelledby="connection-title">
      <div>
        <p className="eyebrow">Local connection</p>
        <h2 id="connection-title">A small check. A working foundation.</h2>
        <p>This checks the API process through the app. Database readiness is not checked.</p>
      </div>
      <div className="connection-actions">
        <output aria-live="polite" className={`connection-status ${status}`}>
          <span className="status-dot" aria-hidden="true" />{labels[status]}
        </output>
        <button type="button" onClick={checkConnection} disabled={status === 'checking'}>
          {status === 'checking' ? 'Checking…' : 'Check API connection'}
        </button>
        {status === 'offline' ? <p className="connection-help">Start the API, then try again.</p> : null}
      </div>
    </section>
  );
}
