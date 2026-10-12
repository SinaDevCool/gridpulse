import { AppShell } from "@/components/product/AppShell";
import { FinderSidebar } from "./FinderSidebar";
import { FinderStage } from "./FinderStage";
import type { FinderControllerContract } from "./controller-contract";
export function FinderScreen({ model }: { model: FinderControllerContract }) {
  const { sidebarOpen } = model;
  return (
    <AppShell>
      <main
        id="main-content"
        className={`power-finder-page ${sidebarOpen ? "" : "is-sidebar-collapsed"}`}
      >
        <FinderSidebar model={model} />

        <FinderStage model={model} />
      </main>
    </AppShell>
  );
}
