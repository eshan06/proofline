"use client";

import { Check } from "lucide-react";
import { useToastStore } from "@/stores/toasts";

/** Bottom-right toast stack — dark card, green check, pop-in, auto-dismiss. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="pointer-events-none absolute bottom-[18px] right-[18px] z-90 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="flex items-center gap-[9px] rounded-[9px] border border-accent/30 bg-toast px-3.5 py-[9px]"
          style={{
            boxShadow: "0 10px 34px rgba(0,0,0,0.55)",
            animation: "plToast 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <Check size={13} strokeWidth={1.8} className="text-success" />
          <span className="text-[12px] text-[#D6DCE8]">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
