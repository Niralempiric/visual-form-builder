import Link from 'next/link';
import { Suspense } from 'react';
import { AuthPanel } from '@/components/auth-panel';
import { Dashboard } from '@/features/workspaces/dashboard';

export default function DashboardPage() {
  return <div className="shell account-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><Link className="brand" href="/">Visual Form Builder</Link><span className="preview-label">Local preview</span></header>
    <main id="main"><AuthPanel mode="account"><Suspense fallback={<output>Loading dashboard…</output>}><Dashboard /></Suspense></AuthPanel></main>
  </div>;
}
