import Link from 'next/link';
import { RecoveryForm } from '@/components/recovery-form';

export default function RecoveryPage() {
  return <div className="shell account-shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><Link className="brand" href="/">Visual Form Builder</Link><span className="preview-label">Local preview</span></header>
    <main id="main"><RecoveryForm /></main>
  </div>;
}
