import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { ProductHeader } from "./ProductChrome";
import { ProductFooter } from "./ProductFooter";

export function FinderShell({
  children,
  workspace = false,
  navigation,
}: {
  children: ReactNode;
  workspace?: boolean;
  navigation?: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const landingPage = pathname === "/";
  const methodologyPage = pathname === "/data-sources";
  return (
    <div
      className={`product-shell product-shell--focused finder-shell${landingPage ? " finder-shell--landing" : ""}${methodologyPage ? " finder-shell--methodology" : ""}${workspace ? " operations-workspace-shell" : ""}`}
    >
      <ProductHeader navigation={navigation} />
      {children}
      <ProductFooter />
    </div>
  );
}
