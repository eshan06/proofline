import { Suspense } from "react";
import { HomeView } from "@/components/home/home-view";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-0 flex-1 bg-page" />}>
      <HomeView />
    </Suspense>
  );
}
