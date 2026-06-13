"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { InboxView } from "@/components/inbox/inbox-view";

function InboxPageInner() {
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

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <InboxPageInner />
    </Suspense>
  );
}
