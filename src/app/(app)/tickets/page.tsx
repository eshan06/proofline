import { Suspense } from "react";
import { TicketsView } from "@/components/tickets/tickets-view";

export default function TicketsPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <TicketsView />
    </Suspense>
  );
}
