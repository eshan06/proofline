export default function TicketsLoading() {
  return (
    <div className="flex flex-1 animate-pulse gap-3 p-6">
      {Array.from({ length: 3 }).map((_, col) => (
        <div key={col} className="flex w-[280px] shrink-0 flex-col gap-2.5">
          <div className="h-6 w-28 rounded bg-white/[0.05]" />
          {Array.from({ length: col === 1 ? 4 : 3 }).map((_, row) => (
            <div
              key={row}
              className="h-[88px] rounded-[10px] border border-white/7 bg-white/[0.04]"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
