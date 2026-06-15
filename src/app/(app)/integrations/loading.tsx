/**
 * Integrations page skeleton — 3x3 grid matching integrations-view.tsx.
 * Each card has: icon + name/desc, status row, and button row.
 */
export default function IntegrationsLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-8 pb-10 pt-[26px]">
        {/* heading */}
        <div className="flex flex-col gap-[6px]">
          <div className="h-[19px] w-36 rounded bg-white/[0.05]" />
          <div className="h-[12px] w-56 rounded bg-white/[0.035]" />
        </div>

        {/* 3×3 card grid */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2.5 rounded-[11px] border border-white/7 bg-card px-[15px] py-3.5"
            >
              {/* icon + name/desc row */}
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 shrink-0 rounded-[8px] bg-white/[0.05]" />
                <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                  <div className="h-[11px] w-3/4 rounded bg-white/[0.055]" />
                  <div className="h-[9px] w-full rounded bg-white/[0.035]" />
                </div>
                {/* status dot */}
                <div className="h-[7px] w-[7px] shrink-0 rounded-full bg-white/[0.06]" />
              </div>

              {/* permissions / last-sync row */}
              <div className="flex items-center gap-[7px]">
                <div className="h-[9px] flex-1 rounded bg-white/[0.035]" />
                <div className="h-[9px] w-16 rounded bg-white/[0.03]" />
              </div>

              {/* button row */}
              <div className="flex gap-[7px]">
                <div className="h-[30px] flex-1 rounded-[7px] bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
