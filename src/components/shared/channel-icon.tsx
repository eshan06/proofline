import { Globe, Mail } from "lucide-react";
import type { Channel } from "@/lib/schemas";

/** web → globe · email → mail · slack → mono "#" glyph (per the handoff). */
export function ChannelIcon({ channel, size = 13 }: { channel: Channel; size?: number }) {
  if (channel === "slack") {
    return (
      <span
        aria-label="Slack"
        className="font-mono font-semibold leading-none"
        style={{ fontSize: size - 1.5 }}
      >
        #
      </span>
    );
  }
  const Icon = channel === "web" ? Globe : Mail;
  return <Icon size={size} strokeWidth={1.4} aria-label={channel === "web" ? "Website chat" : "Email"} />;
}
