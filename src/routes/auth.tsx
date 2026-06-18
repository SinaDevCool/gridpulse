import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GridPulse" },
      { name: "description", content: "Sign in or create an account to access GridPulse." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !pwd) { toast.error("Email and password are required."); return; }
    toast.info("Authentication isn't wired up in this demo build yet.");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16 lg:px-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{mode === "signin" ? "Sign in to GridPulse." : "Start your free GridPulse account."}</p>

        <div className="mt-6 flex rounded-md border border-border bg-surface/40 p-1 text-sm">
          {(["signin", "signup"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`flex-1 rounded px-3 py-1.5 cursor-pointer ${mode === m ? "bg-cyan-accent text-primary-foreground" : "text-muted-foreground"}`}>
              {m === "signin" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <button
          onClick={() => toast.info("Google sign-in isn't wired up in this demo build yet.")}
          className="mt-6 w-full rounded-md border border-border bg-surface/60 px-4 py-2.5 text-sm hover:border-cyan-accent/40 cursor-pointer"
        >
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or email <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@utility.com" className="w-full rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm focus:border-cyan-accent focus:outline-none" />
          <input type="password" required value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Password" className="w-full rounded-md border border-border bg-background/60 px-3 py-2.5 text-sm focus:border-cyan-accent focus:outline-none" />
          <button type="submit" className="w-full rounded-md bg-cyan-accent px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110 cursor-pointer">
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our terms.{" "}
          <Link to="/subscribe" className="text-cyan-accent hover:underline">See plans →</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
