import Link from 'next/link';

export default function RunNotFound() {
  return (
    <div className="exec-card exec-empty-state">
      <p>
        <b>This run does not exist.</b>
      </p>
      <p className="meta">It may have been removed, or the link is out of date.</p>
      <Link className="primary exec-empty-cta" href="/workflows/runs">
        View all runs
      </Link>
    </div>
  );
}
