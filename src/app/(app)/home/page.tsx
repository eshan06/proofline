import { Suspense } from "react";
import { HomeView } from "@/components/home/home-view";

function HomeViewSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1060px] px-8 pb-10 pt-[26px]">
        {/* greeting row */}
        <div className="flex items-end gap-3">
          <div className="flex flex-col gap-[5px]">
            <div className="h-5 w-44 animate-pulse rounded-md bg-white/8" />
            <div className="h-3.5 w-64 animate-pulse rounded-md bg-white/5" />
          </div>
          <span className="flex-1" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[30px] w-28 animate-pulse rounded-[7px] bg-white/6" />
            ))}
          </div>
        </div>
        {/* metric cards */}
        <div className="mt-5 grid grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-[11px] bg-white/5" />
          ))}
        </div>
        {/* main grid */}
        <div className="mt-3.5 grid grid-cols-[1fr_340px] gap-3.5">
          <div className="flex flex-col gap-3.5">
            <div className="h-[210px] animate-pulse rounded-[11px] bg-white/5" />
            <div className="h-[200px] animate-pulse rounded-[11px] bg-white/5" />
          </div>
          <div className="flex flex-col gap-3.5">
            <div className="h-[160px] animate-pulse rounded-[11px] bg-white/5" />
            <div className="h-[120px] animate-pulse rounded-[11px] bg-white/5" />
            <div className="h-[140px] animate-pulse rounded-[11px] bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeViewSkeleton />}>
      <HomeView />
    </Suspense>
  );
}
