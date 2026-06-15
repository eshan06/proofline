export default function AutomationsLoading() {
  return (
    <div className="flex flex-1 animate-pulse flex-col gap-2.5 p-6">
      <div className="mb-2 h-7 w-40 rounded bg-white/[0.05]" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex h-14 items-center rounded-[10px] border border-white/7 bg-white/[0.04] px-4 gap-3"
        >
          <div className="h-4 w-4 rounded-full bg-white/[0.07]" />
          <div className="h-3.5 w-48 rounded bg-white/[0.07]" />
          <div className="ml-auto h-3 w-20 rounded bg-white/[0.05]" />
        </div>
      ))}
    </div>
  );
}
