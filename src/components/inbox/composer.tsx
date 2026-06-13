"use client";

import { useInboxStore } from "@/stores/inbox";
import { Kbd } from "@/components/ui/kbd";
import { toast } from "@/stores/toasts";
import {
  useAddNote,
  useCloseTicket,
  useEscalateTicket,
  useSendReply,
} from "@/hooks/use-ticket-actions";
import type { Ticket } from "@/lib/schemas";

export function Composer({ ticket, isDemo }: { ticket: Ticket; isDemo: boolean }) {
  const composer = useInboxStore((s) => s.composers[ticket.id] ?? "");
  const setComposer = useInboxStore((s) => s.setComposer);
  const draftMode = useInboxStore((s) => s.draftModes[ticket.id] ?? "idle");

  const sendReply = useSendReply();
  const addNote = useAddNote();
  const escalate = useEscalateTicket();
  const closeTicket = useCloseTicket();

  void isDemo; // demo "send" step is completed server-side on POST /messages

  const send = () => {
    if (!composer.trim()) {
      toast("Write a reply first — or accept the AI draft");
      return;
    }
    sendReply.mutate({
      id: ticket.id,
      text: composer,
      viaAI: draftMode === "accepted",
      customerName: ticket.customer.name,
    });
    setComposer(ticket.id, "");
  };

  const note = () => {
    if (!composer.trim()) {
      toast("Write the note in the composer first");
      return;
    }
    addNote.mutate({ id: ticket.id, text: composer });
    setComposer(ticket.id, "");
  };

  return (
    <div className="shrink-0 border-t border-white/7 bg-panel px-5 pb-3.5 pt-3">
      <textarea
        value={composer}
        onChange={(e) => setComposer(ticket.id, e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            send();
          }
        }}
        placeholder={`Reply to ${ticket.customer.name}… (or accept the AI draft →)`}
        className="pl-focus min-h-[68px] w-full resize-none rounded-[10px] border border-white/9 bg-white/[0.035] px-[13px] py-2.5 text-[12.5px] leading-[1.55] text-ink"
      />
      <div className="mt-[9px] flex items-center gap-2">
        <button
          type="button"
          onClick={send}
          className="flex items-center gap-[7px] rounded-[7px] border-0 bg-accent px-3.5 py-[7px] text-[12px] font-semibold text-white hover:bg-accent-hover"
          style={{ boxShadow: "0 2px 12px rgba(77,124,254,0.3)" }}
        >
          <span>Send reply</span>
          <Kbd className="bg-white/18 text-white/70">⌘↵</Kbd>
        </button>
        <button
          type="button"
          onClick={() => toast("Draft saved")}
          className="rounded-[7px] border border-white/9 bg-white/5 px-3 py-[7px] text-[12px] font-medium text-ink-2 hover:bg-white/9"
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={note}
          className="rounded-[7px] border border-white/9 bg-white/5 px-3 py-[7px] text-[12px] font-medium text-ink-2 hover:border-warning/50 hover:text-warning"
        >
          Add note
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => escalate.mutate({ id: ticket.id })}
          className="rounded-[7px] border border-warning/30 bg-transparent px-3 py-[7px] text-[12px] font-medium text-warning hover:bg-warning/[0.08]"
        >
          Escalate
        </button>
        <button
          type="button"
          onClick={() => closeTicket.mutate({ id: ticket.id })}
          className="rounded-[7px] border border-white/9 bg-transparent px-3 py-[7px] text-[12px] font-medium text-ink-4 hover:border-success/50 hover:text-success"
        >
          Close ticket
        </button>
      </div>
    </div>
  );
}
