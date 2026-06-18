import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, LayoutDashboard, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function UserMenu() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (loading) {
    return <div className="hidden sm:block h-8 w-8 rounded-full bg-surface-elevated/60 animate-pulse" />;
  }

  if (!user) {
    return (
      <Link to="/auth" className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground">
        Sign in
      </Link>
    );
  }

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  async function signOut() {
    setOpen(false);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-accent/20 text-cyan-accent text-sm font-semibold border border-cyan-accent/30 hover:brightness-110"
        aria-label="Account menu"
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-md border border-border bg-surface shadow-xl py-1">
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserIcon className="h-3.5 w-3.5" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>
          <Link
            to="/dashboard"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-elevated"
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-elevated"
          >
            <SettingsIcon className="h-4 w-4" /> Settings
          </Link>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-accent hover:bg-surface-elevated"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
