import { redirect } from 'next/navigation';
import { getCurrentAccess } from '@/lib/auth/session';
import { SetupForm } from './setup-form';
export default async function SetupPage() {
  if (await getCurrentAccess()) redirect('/');
  return (
    <main className="setup-page">
      <section className="setup-brand">
        <div className="setup-logo">✓</div>
        <span>sorted</span>
        <p>Evidence-first recruiting for Indian hiring teams.</p>
        <div className="setup-promise">
          <strong>Human decisions, auditable evidence.</strong>
          <span>Build your hiring workspace and invite the panel when you’re ready.</span>
        </div>
      </section>
      <section className="setup-panel">
        <div className="setup-card">
          <span className="eyebrow">FIRST-RUN SETUP · 1 OF 2</span>
          <h1>Create your recruiting workspace</h1>
          <p>
            You’ll be the organization administrator. Workspace preferences default to India and can
            be changed later.
          </p>
          <SetupForm />
        </div>
      </section>
    </main>
  );
}
