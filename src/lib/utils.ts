import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Per-customer avatar colors: hsl(<hue> 45% 20%) bg / hsl(<hue> 75% 72%) text. */
export function avatarBg(hue: number): string {
  return `hsl(${hue} 45% 20%)`;
}
export function avatarFg(hue: number): string {
  return `hsl(${hue} 75% 72%)`;
}

/** "First response due in 18m" / "1h 5m" style SLA labels. */
export function slaLabel(slaMins: number): string {
  if (slaMins === 0) return "SLA met · responded in 2m 40s";
  const span =
    slaMins >= 60 ? `${Math.floor(slaMins / 60)}h ${slaMins % 60}m` : `${slaMins}m`;
  return `First response due in ${span}`;
}

/** SLA risk color: red ≤20m, amber ≤45m, gray otherwise, green when met. */
export function slaColor(slaMins: number): string {
  if (slaMins === 0) return "#3DD68C";
  if (slaMins <= 20) return "#F36C6C";
  if (slaMins <= 45) return "#F5B74E";
  return "#8A93A6";
}

let idCounter = 0;
/**
 * Sequential id for *domain* entities (messages, kb docs, automations). These
 * are always workspace-scoped and never used as a bearer credential, so a
 * readable monotonic id is fine. For anything that authenticates a request
 * (session ids, reset/CSRF tokens) use {@link secureToken} instead.
 */
export function uid(prefix = "id"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/**
 * Cryptographically-random, unguessable token. Used for everything that is a
 * bearer credential — session ids, password-reset tokens, widget conversation
 * keys, CSRF tokens. Uses the Web Crypto global (`crypto.getRandomValues`),
 * which is present in the Node, edge, and browser runtimes, so this module
 * stays import-free and bundles cleanly on the client.
 */
export function secureToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let out = "";
  for (const b of arr) out += b.toString(16).padStart(2, "0");
  return out;
}
