/**
 * App-shell skeleton — matches the final chrome (220px sidebar, 48px topbar,
 * content area) so there is no layout shift when the workspace resolves.
 */
export default function AppLoading() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-page" style={{ minWidth: 1240 }}>
      {/* sidebar */}
      <div className="flex w-[220px] shrink-0 flex-col gap-1 border-r border-white/7 bg-panel p-2.5">
        <div className="mb-2 h-[42px] rounded-lg bg-white/[0.04]" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-[30px] rounded-[7px] bg-white/[0.025]" />
        ))}
      </div>
      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-white/7 px-4">
          <div className="h-4 w-32 rounded bg-white/[0.04]" />
          <div className="flex-1" />
          <div className="h-[30px] w-[220px] rounded-[7px] bg-white/[0.04]" />
        </div>
        <div className="flex-1 p-8">
          <div className="mx-auto flex max-w-[1060px] flex-col gap-4">
            <div className="h-7 w-64 rounded bg-white/[0.04]" />
            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-[92px] rounded-[11px] border border-white/7 bg-card" />
              ))}
            </div>
            <div className="h-[280px] rounded-[11px] border border-white/7 bg-card" />
          </div>
        </div>
      </div>
    </div>
  );
}
