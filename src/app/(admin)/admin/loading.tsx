export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 bg-neutral-200 rounded-lg" />
      <div className="h-4 w-72 bg-neutral-100 rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-white border rounded-xl" />
        ))}
      </div>
      <div className="h-80 bg-white border rounded-xl" />
    </div>
  );
}
