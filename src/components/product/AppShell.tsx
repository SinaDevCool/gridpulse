import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LockKeyhole, LogOut, Menu, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/context/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lifecycleStageForLocation } from "@/features/grid-connection/product-lifecycle";
import { ProductTruthNotice } from "./ProductTruthNotice";

const navigation = [
  { label: "Portfolio", to: "/portfolio" },
  { label: "Power Finder", to: "/power-finder" },
  { label: "Evidence", to: "/evidence" },
  { label: "Reports", to: "/reports" },
  { label: "Methodology", to: "/data-sources" },
] as const;

const lifecycle = [
  { key: "discover", label: "Discover", to: "/power-finder" },
  { key: "qualify", label: "Qualify", to: "/portfolio" },
  { key: "prepare", label: "Prepare", to: "/portfolio" },
  { key: "engage", label: "Engage", to: "/portfolio" },
  { key: "decide", label: "Decide", to: "/reports" },
  { key: "learn", label: "Learn", to: "/reports" },
] as const;

export function AppHeader() {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const reviewer = useQuery({
    queryKey: ["workspace-reviewer-navigation", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const result = await supabase.rpc("is_operator_evidence_reviewer");
      if (result.error) return false;
      return Boolean(result.data);
    },
  });
  const pilotAdmin = useQuery({
    queryKey: ["pilot-admin-navigation", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const result = await supabase
        .from("pilot_admins")
        .select("user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !result.error && Boolean(result.data);
    },
  });
  return (
    <header className="app-header">
      <Link to="/" className="brand" aria-label="GridPulse home">
        <span>GRID</span>
        <strong>PULSE</strong>
      </Link>
      <nav aria-label="Primary" className={menuOpen ? "is-open" : undefined}>
        {navigation.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeProps={{ className: "active" }}
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
          </Link>
        ))}
        {pilotAdmin.data ? (
          <Link
            to="/pilot-requests"
            activeProps={{ className: "active" }}
            onClick={() => setMenuOpen(false)}
          >
            Pilot requests
          </Link>
        ) : null}
        {reviewer.data ? (
          <Link
            to="/evidence-review"
            activeProps={{ className: "active" }}
            onClick={() => setMenuOpen(false)}
          >
            Review queue
          </Link>
        ) : null}
      </nav>
      <button
        type="button"
        className="app-menu-button"
        aria-label={menuOpen ? "Close workspace navigation" : "Open workspace navigation"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      <div className="header-account">
        {user ? (
          <>
            <span title={user.email}>{user.email}</span>
            <button onClick={() => void signOut()} aria-label="Sign out">
              <LogOut size={15} aria-hidden="true" />
            </button>
          </>
        ) : (
          <Link to="/auth" search={{ redirect: undefined }} className="header-sign-in">
            Sign in
          </Link>
        )}
        <Link to="/assessments/new" className="primary-button">
          <Plus size={15} /> New project
        </Link>
      </div>
    </header>
  );
}

export function AppShell({
  children,
  requireAuth = false,
}: {
  children: ReactNode;
  requireAuth?: boolean;
}) {
  return (
    <div className="product-shell">
      <AppHeader />
      <ProductLifecycle />
      <ProductTruthNotice />
      {requireAuth ? <ProtectedContent>{children}</ProtectedContent> : children}
      <footer className="product-footer">
        <span>
          Preliminary decision support only. Validate connection conclusions with the network
          operator.
        </span>
        <b>Traceability first.</b>
      </footer>
    </div>
  );
}

function ProductLifecycle() {
  const location = useRouterState({ select: (state) => state.location });
  const view = new URLSearchParams(location.searchStr).get("view");
  const active = lifecycleStageForLocation(location.pathname, view);
  return (
    <nav className="product-lifecycle" aria-label="Grid connection lifecycle">
      {lifecycle.map((item, index) => (
        <Link
          to={item.to}
          className={active === item.key ? "active" : undefined}
          aria-current={active === item.key ? "step" : undefined}
          key={item.key}
        >
          <span>{index + 1}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function ProtectedContent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const redirect = useRouterState({ select: (state) => state.location.href });
  if (loading)
    return (
      <main id="main-content" className="auth-gate">
        <div className="loading-spinner" />
        <p>Checking your session…</p>
      </main>
    );
  if (!user)
    return (
      <main id="main-content" className="auth-gate">
        <LockKeyhole />
        <p className="context-label">Private workspace</p>
        <h1>Sign in to continue</h1>
        <p>Your projects and evidence are protected per account.</p>
        <Link to="/auth" search={{ redirect }} className="primary-button">
          Sign In to Continue
        </Link>
      </main>
    );
  return <>{children}</>;
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
