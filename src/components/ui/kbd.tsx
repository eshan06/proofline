import { cn } from "@/lib/utils";

/** Mono keyboard hint chip (⌘K, ⌘↵, esc, ↑↓). */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] rounded-[4px] bg-white/6 px-[5px] py-px text-ink-4",
        className,
      )}
    >
      {children}
    </span>
  );
}
