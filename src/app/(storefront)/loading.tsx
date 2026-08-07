export default function StorefrontLoading() {
  return (
    <div className="ms-route-loading" aria-busy="true" aria-live="polite">
      <div className="ms-shell ms-route-loading-inner">
        <div className="ms-skel ms-skel--title" />
        <div className="ms-skel ms-skel--line" />
        <div className="ms-skel-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ms-skel-card">
              <div className="ms-skel ms-skel--media" />
              <div className="ms-skel ms-skel--line short" />
              <div className="ms-skel ms-skel--line" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
