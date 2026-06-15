/**
 * Inbox skeleton — matches the two-panel layout:
 *   left  : w-[318px] ticket list (search bar + ticket rows)
 *   center: flex-1 conversation (header + message bubbles + composer)
 *   right : copilot panel
 */
export default function InboxLoading() {
  return (
    <div className="flex min-h-0 flex-1 animate-pulse">
      {/* ── Left: ticket list ─────────────────────────────────────── */}
      <div className="flex w-[318px] shrink-0 flex-col border-r border-white/7">
        {/* search bar */}
        <div className="px-3 pb-2 pt-3">
          <div className="h-[30px] rounded-[7px] bg-white/5" />
        </div>

        {/* filter pill row */}
        <div className="flex gap-1.5 px-3 pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[22px] w-14 rounded-full bg-white/5" />
          ))}
        </div>

        {/* ticket rows */}
        <div className="flex flex-col gap-px px-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-[8px] px-2.5 py-2.5">
              {/* subject line */}
              <div className="flex items-center gap-2">
                <div className="h-[13px] w-3 rounded bg-white/5" />
                <div
                  className="h-[13px] rounded bg-white/5"
                  style={{ width: `${55 + (i % 4) * 10}%` }}
                />
                <div className="ml-auto h-[10px] w-10 rounded bg-white/[0.04]" />
              </div>
              {/* excerpt */}
              <div className="h-[11px] w-4/5 rounded bg-white/[0.035]" />
              {/* badges */}
              <div className="flex gap-1.5">
                <div className="h-[18px] w-14 rounded-full bg-white/[0.04]" />
                <div className="h-[18px] w-10 rounded-full bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Center: conversation ───────────────────────────────────── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-page">
        {/* conversation header */}
        <div className="shrink-0 border-b border-white/7 px-5 pt-3 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-[15px] w-56 rounded bg-white/5" />
            <div className="h-[10px] w-16 rounded bg-white/[0.035]" />
            <div className="flex-1" />
            <div className="h-[22px] w-20 rounded-full bg-white/5" />
          </div>
          <div className="mt-[9px] mb-2.5 flex items-center gap-2">
            <div className="h-[22px] w-28 rounded-full bg-white/[0.04]" />
            <div className="h-[22px] w-20 rounded-full bg-white/[0.04]" />
            <div className="h-[22px] w-16 rounded-full bg-white/[0.04]" />
          </div>
          {/* SLA bar */}
          <div className="h-[3px] w-full rounded-full bg-white/[0.035]" />
        </div>

        {/* message thread */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden px-5 py-5">
          {/* customer bubble */}
          <div className="flex max-w-[640px] gap-2.5">
            <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-white/5" />
            <div className="flex flex-col gap-1.5">
              <div className="h-[11px] w-32 rounded bg-white/[0.04]" />
              <div className="h-[72px] w-72 rounded-[4px_12px_12px_12px] bg-white/5" />
            </div>
          </div>

          {/* agent bubble */}
          <div className="flex max-w-[640px] flex-row-reverse gap-2.5 self-end">
            <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-white/5" />
            <div className="flex flex-col items-end gap-1.5">
              <div className="h-[11px] w-24 rounded bg-white/[0.04]" />
              <div className="h-[54px] w-80 rounded-[12px_4px_12px_12px] bg-white/5" />
            </div>
          </div>

          {/* customer bubble 2 */}
          <div className="flex max-w-[640px] gap-2.5">
            <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-white/5" />
            <div className="flex flex-col gap-1.5">
              <div className="h-[11px] w-32 rounded bg-white/[0.04]" />
              <div className="h-[90px] w-64 rounded-[4px_12px_12px_12px] bg-white/5" />
            </div>
          </div>

          {/* agent bubble 2 */}
          <div className="flex max-w-[640px] flex-row-reverse gap-2.5 self-end">
            <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-white/5" />
            <div className="flex flex-col items-end gap-1.5">
              <div className="h-[11px] w-24 rounded bg-white/[0.04]" />
              <div className="h-[64px] w-96 rounded-[12px_4px_12px_12px] bg-white/5" />
            </div>
          </div>
        </div>

        {/* composer */}
        <div className="shrink-0 border-t border-white/7 p-3">
          <div className="h-[96px] rounded-[10px] bg-white/[0.035]" />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-2">
              <div className="h-[28px] w-20 rounded-[6px] bg-white/[0.04]" />
              <div className="h-[28px] w-16 rounded-[6px] bg-white/[0.04]" />
            </div>
            <div className="h-[28px] w-20 rounded-[6px] bg-white/5" />
          </div>
        </div>
      </div>

      {/* ── Right: copilot panel ───────────────────────────────────── */}
      <div className="flex w-[280px] shrink-0 flex-col border-l border-white/7">
        {/* panel header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-white/7 px-4 py-[13px]">
          <div className="h-[15px] w-[15px] rounded bg-white/5" />
          <div className="h-[13px] w-20 rounded bg-white/5" />
          <div className="flex-1" />
          <div className="h-[20px] w-24 rounded-[5px] bg-white/[0.04]" />
        </div>

        {/* evidence / draft cards */}
        <div className="flex flex-col gap-3 p-4">
          <div className="h-[80px] rounded-[10px] border border-white/7 bg-white/[0.03]" />
          <div className="h-[64px] rounded-[10px] border border-white/7 bg-white/[0.03]" />
          <div className="h-[96px] rounded-[10px] border border-white/7 bg-white/[0.03]" />
          <div className="h-[48px] w-full rounded-[8px] bg-white/5" />
        </div>
      </div>
    </div>
  );
}
