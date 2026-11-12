import Link from 'next/link';
import { notFound } from 'next/navigation';
import { objectIdSchema } from '@visual-form-builder/contracts';
import { AuthPanel } from '@/components/auth-panel';
import { DraftOverview } from '@/features/workspaces/draft-overview';
export default async function FormPage({ params }: { params: Promise<{ formId: string }> }) {
  const value = objectIdSchema.safeParse((await params).formId);
  if (!value.success) notFound();
  return <div className="shell account-shell"><a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><Link className="brand" href="/">Visual Form Builder</Link><span className="preview-label">Local preview</span></header>
    <main id="main"><AuthPanel mode="account" heading="Form editor."><DraftOverview key={value.data} formId={value.data} /></AuthPanel></main></div>;
}
