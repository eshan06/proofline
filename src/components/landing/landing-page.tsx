"use client";

import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { BodyBackground } from "./body-background";
import { HeroProofCard } from "./hero-proof-card";
import { DemoStage } from "./demo-stage";
import { Marquee } from "./marquee";
import { FeatureCards } from "./feature-cards";
import { HowItWorks, Pricing, CtaFooter } from "./sections";
import { Reveal } from "./scroll-reveal";
import { useCountUp } from "./use-count-up";

export function LandingPage() {
  return (
    <div className="overflow-x-hidden font-sans text-ink" style={{ background: "#07090F" }}>
      <BodyBackground color="#07090F" />
      <Nav />
      <Hero />

      <div id="proofline-demo" className="mx-auto max-w-[1010px] px-7 pb-[30px] pt-[22px]" style={{ animation: "plUp 0.7s 0.34s ease both" }}>
        <DemoStage />
      </div>

      <Marquee />

      <div id="features" className="mx-auto max-w-[1080px] px-7 pb-20" style={{ scrollMarginTop: 70 }}>
        <Reveal className="mb-9 flex max-w-[520px] flex-col gap-3">
          <span className="font-mono text-[11px] tracking-[0.12em] text-accent">EVERYTHING IN ONE PLACE</span>
          <h2 className="text-[34px] font-bold leading-[1.15] tracking-[-0.03em] text-ink">Built for teams who refuse to send a guess.</h2>
        </Reveal>
        <FeatureCards />
      </div>

      <HowItWorks />
      <Pricing />
      <CtaFooter />
    </div>
  );
}

function Nav() {
  return (
    <div className="sticky top-0 z-50 border-b border-white/6 backdrop-blur-[12px]" style={{ background: "rgba(7,9,15,0.72)" }}>
      <div className="mx-auto flex max-w-[1080px] items-center gap-[26px] px-7 py-3.5">
        <div className="flex items-center gap-[9px]">
          <Logo size={24} />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">Proofline</span>
        </div>
        <div className="hidden gap-5 text-[13px] text-ink-4 sm:flex">
          <a href="#features" className="no-underline hover:text-ink">Product</a>
          <a href="#pricing" className="no-underline hover:text-ink">Pricing</a>
          <Link href="/docs" className="no-underline hover:text-ink">Docs</Link>
          <Link href="/changelog" className="no-underline hover:text-ink">Changelog</Link>
        </div>
        <span className="flex-1" />
        <Link href="/signin" className="text-[13px] text-ink-4 no-underline hover:text-ink">Sign in</Link>
        <Link href="/signin" className="rounded-[7px] bg-accent px-3.5 py-[7px] text-[13px] font-semibold text-white no-underline hover:bg-accent-hover" style={{ boxShadow: "0 2px 14px rgba(77,124,254,0.35)" }}>Start free</Link>
      </div>
    </div>
  );
}

function Hero() {
  const [a, b, c, d] = useCountUp([87, 4, 12, 100]);

  return (
    <div className="relative overflow-hidden px-7 pb-14 pt-[74px]">
      <div className="pointer-events-none absolute" style={{ top: -160, right: -60, width: 680, height: 520, background: "radial-gradient(ellipse at 65% 30%, rgba(77,124,254,0.15), rgba(77,124,254,0) 62%)" }} />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 90% 70% at 50% 35%, #000 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 35%, #000 30%, transparent 75%)",
        }}
      />
      <div className="relative mx-auto grid max-w-[1140px] grid-cols-1 items-center gap-[40px] lg:grid-cols-[1.04fr_0.96fr] lg:gap-[54px]">
        {/* left */}
        <div className="flex flex-col items-start gap-6">
          <h1 className="m-0 text-[clamp(34px,7vw,53px)] font-bold leading-[1.04] tracking-[-0.035em] text-ink" style={{ textWrap: "balance", animation: "plUp 0.6s 0.07s ease both" }}>
            Support that<br />
            <span className="relative whitespace-nowrap px-0.5" style={{ background: "linear-gradient(transparent 60%, rgba(77,124,254,0.32) 60%, rgba(77,124,254,0.32) 92%, transparent 92%)" }}>shows its work</span>.
          </h1>
          <p className="m-0 max-w-[430px] text-[16px] leading-[1.62] text-ink-4" style={{ animation: "plUp 0.6s 0.14s ease both" }}>
            One inbox for chat, email, and Slack. Every reply is drafted from your docs, cited, and approved by a human.
          </p>
          <div className="flex gap-[11px]" style={{ animation: "plUp 0.6s 0.21s ease both" }}>
            <Link href="/signin" className="rounded-[9px] bg-accent px-[22px] py-[11px] text-[14px] font-semibold text-white no-underline hover:-translate-y-px hover:bg-accent-hover" style={{ boxShadow: "0 6px 22px rgba(77,124,254,0.38)" }}>Start free</Link>
            <Link href="/demo" className="flex items-center gap-2 rounded-[9px] border border-white/10 bg-white/4 px-[18px] py-[11px] text-[14px] font-medium text-ink-2 no-underline hover:border-accent/40 hover:bg-white/8">
              <span>Try the demo yourself</span>
              <span className="text-muted">→</span>
            </Link>
          </div>
          <div className="mt-1 flex items-center gap-4" style={{ animation: "plUp 0.6s 0.27s ease both" }}>
            <Stat value={`${a}`} unit="%" label="drafts accepted" />
            <Divider />
            <Stat value={`${b}m`} unit={` ${c}s`} label="median first response" />
            <Divider />
            <Stat value={`${d}`} unit="%" label="claims cited" />
          </div>
        </div>

        {/* right */}
        <HeroProofCard />
      </div>
    </div>
  );
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="flex flex-col gap-px">
      <span className="font-mono text-[17px] font-semibold tracking-[-0.02em] text-ink">{value}<span className="text-[11px] text-muted">{unit}</span></span>
      <span className="text-[10.5px] text-muted">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="h-[26px] w-px bg-white/10" />;
}
