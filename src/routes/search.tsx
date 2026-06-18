import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Search as SearchIcon, Bookmark, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { searchAll, type SearchResults } from "@/lib/search-client";
import { saveSearch } from "@/utils/alerts.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/use-subscription";

const searchSchema = z.object({
  q: fallback(z.string().max(200), "").default(""),
});

export const Route = createFileRoute("/search")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Search — GridPulse" },
      { name: "description", content: "Search GridPulse articles, projects, companies, and markets." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q: initialQ } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [input, setInput] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const authed = Boolean(userId);
  const { isActive } = useSubscription(userId);
  const saveFn = useServerFn(saveSearch);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(input), 250);
    return () => clearTimeout(id);
  }, [input]);

  useEffect(() => {
    const next = debouncedQ.trim();
    if (next !== initialQ) {
      navigate({ search: { q: next }, replace: true });
    }
  }, [debouncedQ, initialQ, navigate]);

  const { data, isLoading, error } = useQuery<SearchResults>({
    queryKey: ["search", debouncedQ],
    queryFn: () => searchAll(debouncedQ),
    enabled: debouncedQ.trim().length > 0,
    staleTime: 30_000,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const name = window.prompt("Name this saved search:", debouncedQ.slice(0, 60));
      if (!name) throw new Error("cancelled");
      return saveFn({ data: { name, query: debouncedQ, filters: {} } });
    },
    onSuccess: () => toast.success("Search saved. Add an alert in /alerts."),
    onError: (e) => {
      if ((e as Error).message === "cancelled") return;
      toast.error((e as Error).message);
    },
  });

  const totalShown =
    (data?.articles.length ?? 0) + (data?.projects.length ?? 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-10 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">
          Search
        </div>
        <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold tracking-tight">
          Search articles &amp; projects
        </h1>

        <div className="mt-6 flex items-center gap-2 rounded-md border border-border bg-surface/60 px-3 py-2">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try "ercot battery", "tesla megapack", "lithium iron phosphate"…'
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          {input && (
            <button
              onClick={() => setInput("")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            {debouncedQ.trim().length === 0 ? (
              <span>Type to search across all GridPulse content.</span>
            ) : isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching…
              </span>
            ) : (
              <span>
                {totalShown} result{totalShown === 1 ? "" : "s"} for &ldquo;{debouncedQ}&rdquo;
              </span>
            )}
          </div>
          {debouncedQ.trim().length > 0 && (
            <div>
              {authed ? (
                isActive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saveMut.isPending}
                    onClick={() => saveMut.mutate()}
                  >
                    <Bookmark className="mr-1.5 h-3.5 w-3.5" />
                    Save search
                  </Button>
                ) : (
                  <Link to="/billing" className="text-cyan-accent hover:underline">
                    Upgrade to save searches →
                  </Link>
                )
              ) : (
                <Link to="/auth" className="text-cyan-accent hover:underline">
                  Sign in to save searches →
                </Link>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {debouncedQ.trim().length > 0 && !isLoading && totalShown === 0 && !error && (
          <div className="mt-12 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <SearchIcon className="mx-auto mb-3 h-6 w-6 opacity-40" />
            No results. Try a broader keyword or different phrasing.
          </div>
        )}

        {data && data.articles.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Articles · {data.articles.length}
            </h2>
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface/40">
              {data.articles.map((a) => (
                <li key={a.id} className="p-4 hover:bg-surface-elevated/60">
                  <Link
                    to="/news/$slug"
                    params={{ slug: a.slug }}
                    className="block"
                  >
                    <div className="flex items-baseline gap-2 text-[11px] font-mono-data text-muted-foreground">
                      <span className="uppercase">{a.category}</span>
                      <span>·</span>
                      <span>{a.source_name ?? "GridPulse"}</span>
                      <span>·</span>
                      <span>{a.region}</span>
                    </div>
                    <div className="mt-1 font-medium text-foreground">{a.headline}</div>
                    <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{a.summary}</div>
                    {a.tags?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {a.tags.slice(0, 5).map((t) => (
                          <span
                            key={t}
                            className="rounded-sm border border-border bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data && data.projects.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Projects · {data.projects.length}
            </h2>
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface/40">
              {data.projects.map((p) => (
                <li key={p.id} className="p-4 hover:bg-surface-elevated/60">
                  <Link
                    to="/projects/$id"
                    params={{ id: p.id }}
                    className="block"
                  >
                    <div className="flex items-baseline gap-2 text-[11px] font-mono-data text-muted-foreground">
                      <span>{p.developer ?? "Unknown developer"}</span>
                      <span>·</span>
                      <span>{p.technology ?? "—"}</span>
                      <span>·</span>
                      <span>{p.region ?? "—"}</span>
                    </div>
                    <div className="mt-1 font-medium text-foreground">
                      {p.name}
                      {p.capacity_mw != null && (
                        <span className="ml-2 font-mono-data text-xs text-cyan-accent">
                          {p.capacity_mw} MW
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {p.location} · {p.status}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
