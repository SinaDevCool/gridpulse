import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ProductHeader } from "./ProductChrome";
import { ProductFooter } from "./ProductFooter";
import { ProductTruthNotice } from "./ProductTruthNotice";
import { solutionOwner } from "@/config/solutions";

/** Shared chrome only. Each solution owns its workspace, providers and navigation. */
export function ProductShell({
  children,
  workspace = false,
  navigation,
  focused = true,
  truthNotice = false,
}: {
  children: ReactNode;
  workspace?: boolean;
  navigation?: ReactNode;
  focused?: boolean;
  truthNotice?: boolean;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div
      data-solution={solutionOwner(pathname) ?? "platform"}
      className={`product-shell${focused ? " product-shell--focused finder-shell" : ""}${pathname === "/" ? " finder-shell--landing" : ""}${pathname === "/data-sources" ? " finder-shell--methodology" : ""}${workspace ? " operations-workspace-shell" : ""}`}
    >
      <ProductHeader navigation={navigation} />
      {truthNotice ? <ProductTruthNotice compact /> : null}
      {children}
      <ProductFooter />
    </div>
  );
}
