"use client";

/** 32×18 pill switch — knob slides 2px → 16px, track tints accent when on. */
export function ToggleSwitch({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="relative h-[18px] w-8 shrink-0 cursor-pointer rounded-full border-0 p-0 transition-colors duration-200"
      style={{ background: on ? "#4D7CFE" : "rgba(255,255,255,0.12)" }}
    >
      <span
        className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-[left] duration-200"
        style={{ left: on ? 16 : 2 }}
      />
    </button>
  );
}
