export default function ProductLoading() {
  return (
    <div className="ms-route-loading" aria-busy="true">
      <div className="ms-shell ms-pdp-skel">
        <div className="ms-skel ms-skel--media tall" />
        <div className="ms-pdp-skel-copy">
          <div className="ms-skel ms-skel--line short" />
          <div className="ms-skel ms-skel--title" />
          <div className="ms-skel ms-skel--line" />
          <div className="ms-skel ms-skel--line" />
          <div className="ms-skel ms-skel--btn" />
        </div>
      </div>
    </div>
  );
}
