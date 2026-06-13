"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sections below the fold start at opacity 0 / translateY(26px) and reveal at
 * 12% intersection with a per-element delay. Anything already in view on load
 * is never hidden — no flash for above-the-fold content.
 */
export function Reveal({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight * 0.92) {
      setHidden(true);
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              setShown(true);
              io.unobserve(en.target);
            }
          });
        },
        { threshold: 0.12 },
      );
      io.observe(el);
      return () => io.disconnect();
    }
  }, []);

  const style: React.CSSProperties = hidden
    ? {
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(26px)",
        transition: `opacity 0.75s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.75s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }
    : {};

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
