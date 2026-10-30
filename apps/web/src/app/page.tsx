import Link from 'next/link';
import { ApiStatus } from '@/components/api-status';

const journey = [
  { number: '01', title: 'Create a draft', description: 'Shape the questions your team needs to ask.' },
  { number: '02', title: 'Publish a version', description: 'Share a form while preserving its original meaning.' },
  { number: '03', title: 'Collect a response', description: 'Keep each answer connected to the form it came from.' },
];

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="shell">
        <header className="site-header">
          <Link className="brand" href="/" aria-label="Visual Form Builder home">
            <span className="brand-mark" aria-hidden="true">vf</span>
            <span>Visual Form Builder</span>
          </Link>
          <Link className="account-link" href="/login">Sign in</Link>
        </header>
        <main id="main">
          <section className="hero" aria-labelledby="page-title">
            <p className="eyebrow">Your forms. Your workspace.</p>
            <h1 id="page-title">Good questions.<br /><span>Thoughtful forms.</span></h1>
            <p className="intro">A self-hostable form builder for small teams is taking shape.
              This first preview connects the app and API. Form editing, publishing and responses are still ahead.</p>
          </section>
          <section className="journey-section" aria-labelledby="journey-title">
            <div className="section-heading">
              <h2 id="journey-title">The journey we’re building</h2>
              <span>Planned workflow</span>
            </div>
            <ol className="journey">
              {journey.map((step) => <li key={step.number}>
                <span className="step-number" aria-hidden="true">{step.number}</span>
                <h3>{step.title}</h3><p>{step.description}</p>
              </li>)}
            </ol>
          </section>
          <ApiStatus />
        </main>
        <footer><span>Built to be self-hosted.</span><span>Preview · No forms or responses yet.</span></footer>
      </div>
    </>
  );
}
