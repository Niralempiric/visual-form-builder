import Link from 'next/link';
import { AuthPanel } from '@/components/auth-panel';

export default function LoginPage() {
  return <div className="shell account-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><Link className="brand" href="/">Visual Form Builder</Link><span className="preview-label">Local preview</span></header>
    <main id="main"><AuthPanel mode="login" /></main>
  </div>;
}
