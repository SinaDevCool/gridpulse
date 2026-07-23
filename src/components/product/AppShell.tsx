import { Link, useRouterState } from "@tanstack/react-router";
import { LockKeyhole, LogOut, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/context/useAuth";
import { ProductTruthNotice } from "./ProductTruthNotice";

const navigation = [
  { label: "Portfolio", to: "/portfolio" },
  { label: "Power Finder", to: "/power-finder" },
  { label: "Evidence review", to: "/evidence-review" },
  { label: "New project", to: "/assessments/new" },
  { label: "Methodology", to: "/data-sources" },
] as const;

export function AppHeader() {
  const { user, signOut } = useAuth();
  return (
    <header className="app-header">
      <Link to="/" className="brand" aria-label="GridPulse home">
        <span>GRID</span>
        <strong>PULSE</strong>
      </Link>
      <nav aria-label="Primary">
        {navigation.map((item) => (
          <Link key={item.to} to={item.to} activeProps={{ className: "active" }}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="header-account">
        {user ? (
          <>
            <span title={user.email}>{user.email}</span>
            <button onClick={() => void signOut()} aria-label="Sign out">
              <LogOut size={15} />
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
