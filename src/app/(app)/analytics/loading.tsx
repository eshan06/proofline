export default function AnalyticsLoading() {
  return (
    <div className="flex flex-1 animate-pulse flex-col gap-4 p-6">
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[92px] rounded-[11px] border border-white/7 bg-white/[0.04]" />
        ))}
      </div>
      <div className="flex-1 rounded-[11px] border border-white/7 bg-white/[0.04]" />
    </div>
  );
}
