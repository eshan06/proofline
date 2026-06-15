export default function SettingsLoading() {
  return (
    <div className="flex flex-1 animate-pulse flex-col gap-5 p-6">
      <div className="flex gap-2 border-b border-white/7 pb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-7 w-20 rounded-[7px] bg-white/[0.05]" />
        ))}
      </div>
      <div className="h-[320px] rounded-[11px] border border-white/7 bg-white/[0.04]" />
    </div>
  );
}
