import Link from 'next/link';

export default function WorkflowRunsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="exec-page">
      <div className="exec-topbar">
        <Link href="/" className="brand exec-brand">
          <span className="brand-mark">✓</span>
          <span>sorted</span>
        </Link>
        <Link href="/?view=workflows" className="secondary">
          ← Back to app
        </Link>
      </div>
      <main className="exec-main">{children}</main>
    </div>
  );
}
