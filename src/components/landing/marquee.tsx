"use client";

const ITEMS = [
  { glyph: "</>", name: "Website Chat", fg: "#9DB7FF" },
  { glyph: "M", name: "Gmail", fg: "#F8A0A0" },
  { glyph: "#", name: "Slack", fg: "#C4B0F8" },
  { glyph: "N", name: "Notion", fg: "#E6EAF2" },
  { glyph: "$", name: "Stripe", fg: "#C4B0F8" },
  { glyph: "L", name: "Linear", fg: "#9DB7FF" },
  { glyph: "GH", name: "GitHub", fg: "#E6EAF2" },
  { glyph: "Z", name: "Zapier", fg: "#F5B74E" },
  { glyph: "S", name: "Twilio SMS", fg: "#F5B74E" },
  { glyph: "G", name: "Google Docs", fg: "#9DB7FF" },
];

/** Infinitely scrolling integration chips — two copies, translateX 0→−50% over 30s. */
export function Marquee() {
  const doubled = [...ITEMS, ...ITEMS];
  return (
    <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-[18px] px-7 pb-[70px] pt-[30px]">
      <span className="font-mono text-[10.5px] tracking-[0.14em] text-faint">CONNECTS YOUR WHOLE SUPPORT STACK</span>
      <div
        className="w-full overflow-hidden"
        style={{
          maskImage: "linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)",
        }}
      >
        <div className="group flex w-max">
          <div className="flex w-max" style={{ animation: "plMarquee 30s linear infinite" }}>
            {doubled.map((ig, i) => (
              <div
                key={i}
                className="mr-3 flex shrink-0 items-center gap-[9px] rounded-full border border-white/7 bg-white/[0.025] py-[7px] pl-2 pr-4 hover:border-accent/40"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/8 bg-white/5 font-mono text-[10px] font-semibold" style={{ color: ig.fg }}>{ig.glyph}</span>
                <span className="whitespace-nowrap text-[12.5px] font-medium text-ink-4">{ig.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
