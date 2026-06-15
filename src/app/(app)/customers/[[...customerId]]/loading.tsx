/**
 * Customers page skeleton — two-column layout matching customers-view.tsx.
 * Left: 300px list panel (search bar + 5 customer rows).
 * Right: detail panel (header card, 3-col stat grid, ticket list).
 */
export default function CustomersLoading() {
  return (
    <div className="flex min-h-0 flex-1">
      {/* list panel */}
      <div className="flex w-[300px] shrink-0 flex-col border-r border-white/7">
        {/* search bar skeleton */}
        <div className="px-3 pb-2 pt-3">
          <div className="h-[34px] rounded-[7px] bg-white/[0.04]" />
        </div>
        {/* customer row skeletons */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 border-b border-white/[0.045] py-[11px] pl-2.5 pr-3"
          >
            {/* avatar */}
            <div className="h-[30px] w-[30px] shrink-0 rounded-full bg-white/[0.06]" />
            {/* name + company */}
            <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
              <div className="h-[10px] w-3/4 rounded bg-white/[0.05]" />
              <div className="h-[9px] w-1/2 rounded bg-white/[0.035]" />
            </div>
            {/* sentiment dot + conv count */}
            <div className="flex flex-col items-end gap-[5px]">
              <div className="h-[7px] w-[7px] rounded-full bg-white/[0.06]" />
              <div className="h-[9px] w-[28px] rounded bg-white/[0.035]" />
            </div>
          </div>
        ))}
      </div>

      {/* detail panel */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[760px] px-8 pb-10 pt-[26px]">
          {/* header card: avatar + name/email + sentiment badge + email button */}
          <div className="flex items-center gap-3.5">
            <div className="h-[46px] w-[46px] shrink-0 rounded-full bg-white/[0.06]" />
            <div className="flex flex-col gap-[6px]">
              <div className="h-[14px] w-36 rounded bg-white/[0.05]" />
              <div className="h-[10px] w-48 rounded bg-white/[0.035]" />
            </div>
            <span className="flex-1" />
            <div className="h-[24px] w-20 rounded-full bg-white/[0.04]" />
            <div className="h-[30px] w-[60px] rounded-[7px] bg-white/[0.04]" />
          </div>

          {/* 3-col stat grid (matches the 6-cell 3-col meta grid — 2 rows) */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col gap-[6px] rounded-[9px] border border-white/7 bg-card px-[13px] py-2.5"
              >
                <div className="h-[9px] w-1/2 rounded bg-white/[0.04]" />
                <div className="h-[11px] w-3/4 rounded bg-white/[0.055]" />
              </div>
            ))}
          </div>

          {/* ticket list skeleton */}
          <div className="mt-3.5 overflow-hidden rounded-[11px] border border-white/7 bg-card">
            {/* list header */}
            <div className="flex items-center border-b border-white/6 px-4 py-3">
              <div className="h-[12px] w-28 rounded bg-white/[0.05]" />
            </div>
            {/* ticket rows */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 border-b border-white/[0.04] px-4 py-2.5"
              >
                <div className="h-[14px] w-[14px] shrink-0 rounded bg-white/[0.04]" />
                <div className="h-[10px] flex-1 rounded bg-white/[0.05]" />
                <div className="h-[10px] w-16 rounded bg-white/[0.04]" />
                <div className="h-[9px] w-12 rounded bg-white/[0.03]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
