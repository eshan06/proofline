import { Check } from "lucide-react";

/** White check in a blue-gradient rounded square — the Proofline mark. */
export function Logo({ size = 26, radius = 7 }: { size?: number; radius?: number }) {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "linear-gradient(135deg, #4D7CFE, #3B5FD9)",
        boxShadow: "0 2px 10px rgba(77,124,254,0.35)",
      }}
    >
      <Check size={Math.round(size * 0.54)} strokeWidth={2.2} color="#fff" />
    </div>
  );
}
