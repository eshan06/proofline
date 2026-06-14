import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { loadShell } from "@/server/load-workspace";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // SSR only the light shell (fast first paint); the heavy workspace data loads
  // lazily on the client (useWorkspace), so navigation/first paint isn't blocked
  // on a ~9-query fetch.
  const shell = await loadShell();
  return (
    <Providers>
      <AppShell shell={shell}>{children}</AppShell>
    </Providers>
  );
}
