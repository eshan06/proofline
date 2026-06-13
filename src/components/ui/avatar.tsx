import { avatarBg, avatarFg, cn } from "@/lib/utils";
import { agents } from "@/data/workspace";
import type { AgentName } from "@/lib/schemas";

/** Customer avatar — per-customer hue: hsl(h 45% 20%) bg / hsl(h 75% 72%) text. */
export function CustomerAvatar({
  initials,
  hue,
  size = 28,
  className,
}: {
  initials: string;
  hue: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold", className)}
      style={{
        width: size,
        height: size,
        background: avatarBg(hue),
        color: avatarFg(hue),
        fontSize: Math.round(size * 0.375),
      }}
    >
      {initials}
    </span>
  );
}

/** Agent avatar — fixed tints per agent (Eshan blue / Maya violet / Leo teal). */
export function AgentAvatar({
  name,
  size = 28,
  className,
}: {
  name: AgentName | null;
  size?: number;
  className?: string;
}) {
  const info = name ? agents[name] : null;
  return (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full font-semibold", className)}
      style={{
        width: size,
        height: size,
        background: info?.bg ?? "rgba(255,255,255,0.07)",
        color: info?.fg ?? "#8A93A6",
        fontSize: Math.round(size * 0.375),
      }}
    >
      {info?.init ?? "?"}
    </span>
  );
}
