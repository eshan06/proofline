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
export function uid(prefix = "id"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}
