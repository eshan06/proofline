export default function KbLoading() {
  return (
    <div className="flex flex-1 animate-pulse gap-4 p-6">
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-8 w-full rounded-[8px] bg-white/[0.05]" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 w-full rounded-[8px] border border-white/7 bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-full w-[300px] shrink-0 rounded-[11px] border border-white/7 bg-white/[0.04]" />
    </div>
  );
}
