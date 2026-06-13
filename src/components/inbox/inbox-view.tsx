"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TicketList } from "./ticket-list";
import { Conversation } from "./conversation";
import { CopilotPanel } from "./copilot-panel";
import { useWorkspace } from "@/hooks/use-workspace";
import { inboxTickets, isInboxFilter, type InboxFilter } from "@/lib/inbox-filter";

export function InboxView({
  ticketId,
  filterParam,
  searchParam,
}: {
  ticketId: string | undefined;
  filterParam: string | undefined;
  searchParam: string | undefined;
}) {
  const router = useRouter();
  const { data: ws } = useWorkspace();
  const filter: InboxFilter = isInboxFilter(filterParam) ? filterParam : "All";
  const search = searchParam ?? "";

  const tickets = ws?.tickets ?? [];
  const live = inboxTickets(tickets);
  const selected = tickets.find((t) => t.id === ticketId && !t.archived) ?? live[0];

  // Canonicalize the URL: /inbox with no id deep-links to the first ticket.
  useEffect(() => {
    if (!ticketId && selected) {
      router.replace(`/inbox/${selected.id}`);
    }
  }, [ticketId, selected, router]);

  const isDemo = ws?.demo.active ?? false;

  if (!selected) {
    return <div className="flex flex-1 items-center justify-center text-[12.5px] text-muted">No conversations yet.</div>;
  }

  return (
    <div className="flex min-h-0 flex-1" style={{ animation: "plFade 0.22s ease" }}>
      <TicketList tickets={tickets} selectedId={selected.id} filter={filter} search={search} />
      <Conversation ticket={selected} isDemo={isDemo} />
      <CopilotPanel ticket={selected} isDemo={isDemo} />
    </div>
  );
}
