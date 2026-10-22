import { Navigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ProductTruthNotice } from "./ProductTruthNotice";
import { productCapabilities } from "@/config/product-mode";
import { FinderShell } from "./FinderShell";
import { ProductHeader } from "./ProductChrome";
import { ProductFooter } from "./ProductFooter";
import { useAuth } from "@/context/useAuth";

function AuthenticatedBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <main id="main-content" className="empty-page" role="status" aria-live="polite">
        <p>Checking workspace access…</p>
      </main>
    );
  }
  if (!user) return <Navigate to="/power-finder" replace />;
  return children;
}

export function AppShell({
  children,
  requireAuth = false,
  workspace = false,
  navigation,
}: {
  children: ReactNode;
  requireAuth?: boolean;
  workspace?: boolean;
  navigation?: ReactNode;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const publicProduct = pathname.startsWith("/power-finder");
  if (!productCapabilities.workspace)
    return (
      <FinderShell workspace={workspace} navigation={navigation}>
        {children}
      </FinderShell>
    );
  const shell = (
    <div
      className={`product-shell${publicProduct ? " product-shell--focused" : ""}${workspace ? " operations-workspace-shell" : ""}`}
    >
      <ProductHeader navigation={navigation} />
      {publicProduct ? <ProductTruthNotice compact /> : null}
      {children}
      <ProductFooter />
    </div>
  );
  return requireAuth ? <AuthenticatedBoundary>{shell}</AuthenticatedBoundary> : shell;
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="context-label">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
