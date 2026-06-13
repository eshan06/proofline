"use client";

import { useParams, useSearchParams } from "next/navigation";
import { InboxView } from "@/components/inbox/inbox-view";

export default function InboxPage() {
  const params = useParams<{ ticketId?: string[] }>();
  const searchParams = useSearchParams();
  const ticketId = params.ticketId?.[0];
  return (
    <InboxView
      ticketId={ticketId}
      filterParam={searchParams.get("filter") ?? undefined}
      searchParam={searchParams.get("q") ?? undefined}
    />
  );
}
