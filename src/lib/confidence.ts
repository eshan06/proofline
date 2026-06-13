/**
 * The confidence color scale — used everywhere AI confidence appears.
 * ≥ 0.80 → success green · 0.65–0.79 → warning amber · < 0.65 → danger red.
 *
 * Confidence is never rendered without its color coding, and anything below
 * LOW_CONFIDENCE_WARNING always pairs with an explicit warning in the UI.
 */

export const CONFIDENCE_GREEN = "#3DD68C";
export const CONFIDENCE_AMBER = "#F5B74E";
export const CONFIDENCE_RED = "#F36C6C";

/** Drafts below this ratio show the "Low confidence" warning box. */
export const LOW_CONFIDENCE_WARNING = 0.7;

export function confidenceColor(c: number): string {
  if (c >= 0.8) return CONFIDENCE_GREEN;
  if (c >= 0.65) return CONFIDENCE_AMBER;
  return CONFIDENCE_RED;
}

/** Tinted chip background matching the scale (inbox row "AI 92%" chips). */
export function confidenceChipBg(c: number): string {
  if (c >= 0.8) return "rgba(61,214,140,0.1)";
  if (c >= 0.65) return "rgba(245,183,78,0.1)";
  return "rgba(243,108,108,0.1)";
}

export function confidencePercent(c: number): string {
  return `${Math.round(c * 100)}%`;
}

export function isLowConfidence(c: number): boolean {
  return c < LOW_CONFIDENCE_WARNING;
}
