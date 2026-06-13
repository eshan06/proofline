import { Suspense } from "react";
import { KbView } from "@/components/kb/kb-view";

export default function KbPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <KbView />
    </Suspense>
  );
}
