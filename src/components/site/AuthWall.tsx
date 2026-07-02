import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

type Props = {
  children: ReactNode;
  title?: string;
  message?: string;
};

/**
 * Client-side auth gate for premium views. Renders a sign-in prompt for
 * anonymous visitors and the children for authenticated users.
 */
export function AuthWall({
  children,
  title = "Create a free account to unlock deep market metrics",
  message = "Sign in to access personalized watchlists, project deep-dives, and interactive analytics.",
}: Props) {
  const [status, setStatus] = useState<"loading" | "authed" | "anon">("loading");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setStatus(data.user ? "authed" : "anon");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return;
      setStatus(session?.user ? "authed" : "anon");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "authed") return <>{children}</>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center lg:px-8">
        <div className="rounded-full border border-cyan-accent/30 bg-cyan-accent/10 p-4">
          <Lock className="h-6 w-6 text-cyan-accent" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
          {status === "loading" ? "Loading…" : title}
        </h1>
        {status === "anon" && (
          <>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">{message}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth"
                search={{ redirect: pathname, mode: "signup" }}
                className="rounded-md bg-cyan-accent px-5 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110"
              >
                Create free account
              </Link>
              <Link
                to="/auth"
                search={{ redirect: pathname, mode: "signin" }}
                className="rounded-md border border-border bg-surface/60 px-5 py-2.5 text-sm font-medium hover:border-cyan-accent/40"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Free tier includes up to 3 followed projects · No credit card required.
            </p>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
