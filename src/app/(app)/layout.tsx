import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { loadWorkspace } from "@/server/load-workspace";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const workspace = await loadWorkspace();
  return (
    <Providers>
      <AppShell initialWorkspace={workspace}>{children}</AppShell>
    </Providers>
  );
}
