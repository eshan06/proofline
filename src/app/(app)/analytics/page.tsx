import { Suspense } from "react";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <AnalyticsView />
    </Suspense>
  );
}
