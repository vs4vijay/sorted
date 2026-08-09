export default function RunsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading workflow runs">
      <div className="exec-skeleton exec-skeleton-title" />
      <div className="exec-skeleton exec-skeleton-chips" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="exec-skeleton exec-skeleton-row" />
      ))}
    </div>
  );
}
