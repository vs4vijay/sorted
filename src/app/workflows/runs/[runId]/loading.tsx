export default function RunLoading() {
  return (
    <div aria-busy="true" aria-label="Loading run">
      <div className="exec-skeleton exec-skeleton-title" />
      <div className="exec-skeleton exec-skeleton-banner" />
      <div className="exec-grid">
        <div className="exec-skeleton exec-skeleton-timeline" />
        <div className="exec-side">
          <div className="exec-skeleton exec-skeleton-panel" />
          <div className="exec-skeleton exec-skeleton-panel" />
        </div>
      </div>
    </div>
  );
}
