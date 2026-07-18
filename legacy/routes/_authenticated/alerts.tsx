import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Plus, BellRing, Bookmark, Lock } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";
import {
  createAlertRule,
  deleteAlertRule,
  deleteSavedSearch,
  listAlertRules,
  listSavedSearches,
  updateAlertRule,
} from "@/utils/alerts.functions";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alerts — GridPulse" }] }),
  component: AlertsPage,
});

const RULE_TYPES = [
  { value: "keyword", label: "Keyword", placeholder: "e.g. megapack, grid-scale, virtual power plant" },
  { value: "tag", label: "Tag", placeholder: "e.g. lfp, ercot, tax-credits" },
  { value: "company", label: "Company", placeholder: "e.g. Tesla, Fluence, BYD" },
  { value: "region", label: "Region", placeholder: "north-america, europe, asia-pacific…" },
  { value: "technology", label: "Technology", placeholder: "e.g. lithium iron phosphate, sodium-ion" },
  { value: "market", label: "Market", placeholder: "e.g. ERCOT, CAISO, PJM" },
  { value: "category", label: "Category", placeholder: "breaking, policy, deals…" },
] as const;

const FREQUENCIES = ["instant", "daily", "weekly", "off"] as const;

type AlertRule = {
  id: string;
  name: string;
  rule_type: string;
  values: string[];
  frequency: string;
  active: boolean;
  last_matched_at: string | null;
  created_at: string;
};

type SavedSearch = {
  id: string;
  name: string;
  query: string;
  created_at: string;
};

function AlertsPage() {
  const { user } = Route.useRouteContext();
  const { isActive, loading: subLoading } = useSubscription(user.id);
  const qc = useQueryClient();

  const listRulesFn = useServerFn(listAlertRules);
  const listSearchesFn = useServerFn(listSavedSearches);
  const createFn = useServerFn(createAlertRule);
  const updateFn = useServerFn(updateAlertRule);
  const deleteRuleFn = useServerFn(deleteAlertRule);
  const deleteSearchFn = useServerFn(deleteSavedSearch);

  const rulesQ = useQuery<AlertRule[]>({
    queryKey: ["alert_rules"],
    queryFn: () => listRulesFn() as Promise<AlertRule[]>,
  });
  const searchesQ = useQuery<SavedSearch[]>({
    queryKey: ["saved_searches"],
    queryFn: () => listSearchesFn() as Promise<SavedSearch[]>,
  });

  const [form, setForm] = useState({
    name: "",
    rule_type: "keyword" as (typeof RULE_TYPES)[number]["value"],
    valuesText: "",
    frequency: "daily" as (typeof FREQUENCIES)[number],
  });

  const createMut = useMutation({
    mutationFn: () => {
      const values = form.valuesText
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 0) throw new Error("Add at least one value");
      if (!form.name.trim()) throw new Error("Give your alert a name");
      return createFn({
        data: {
          name: form.name.trim(),
          rule_type: form.rule_type,
          values,
          frequency: form.frequency,
          active: true,
        },
      });
    },
    onSuccess: () => {
      toast.success("Alert created");
      setForm({ ...form, name: "", valuesText: "" });
      qc.invalidateQueries({ queryKey: ["alert_rules"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleMut = useMutation({
    mutationFn: (r: AlertRule) =>
      updateFn({ data: { id: r.id, patch: { active: !r.active } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert_rules"] }),
  });

  const freqMut = useMutation({
    mutationFn: (args: { id: string; frequency: (typeof FREQUENCIES)[number] }) =>
      updateFn({ data: { id: args.id, patch: { frequency: args.frequency } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert_rules"] }),
  });

  const deleteRuleMut = useMutation({
    mutationFn: (id: string) => deleteRuleFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Alert deleted");
      qc.invalidateQueries({ queryKey: ["alert_rules"] });
    },
  });

  const deleteSearchMut = useMutation({
    mutationFn: (id: string) => deleteSearchFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Saved search deleted");
      qc.invalidateQueries({ queryKey: ["saved_searches"] });
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-10 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">
          Personalization
        </div>
        <h1 className="mt-2 font-display text-3xl md:text-4xl font-bold tracking-tight">
          Alerts &amp; saved searches
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
          Get notified when new articles match the companies, technologies, regions, or keywords
          you care about. Notifications appear in your{" "}
          <Link to="/notifications" className="text-cyan-accent hover:underline">
            notification center
          </Link>
          .
        </p>

        {!subLoading && !isActive && (
          <div className="mt-6 rounded-lg border border-cyan-accent/30 bg-cyan-accent/5 p-4 text-sm flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 text-cyan-accent shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-foreground">Alerts are a Pro feature</div>
              <div className="mt-1 text-muted-foreground">
                Free accounts can search across all GridPulse content, but saved searches and
                alert rules require Pro or Enterprise.
              </div>
              <Link
                to="/billing"
                className="mt-3 inline-block rounded-md bg-cyan-accent px-3 py-1.5 text-xs font-medium text-primary-foreground hover:brightness-110"
              >
                See plans
              </Link>
            </div>
          </div>
        )}

        {/* Create alert form */}
        <section className="mt-8 rounded-lg border border-border bg-surface/40 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BellRing className="h-4 w-4 text-cyan-accent" />
            <h2 className="font-semibold">New alert rule</h2>
          </div>

          <fieldset disabled={!isActive || createMut.isPending} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Tesla Megapack mentions"
                  className="mt-1 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm focus:border-cyan-accent focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Type</label>
                <select
                  value={form.rule_type}
                  onChange={(e) =>
                    setForm({ ...form, rule_type: e.target.value as typeof form.rule_type })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm focus:border-cyan-accent focus:outline-none disabled:opacity-50"
                >
                  {RULE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Values (comma-separated)
              </label>
              <input
                value={form.valuesText}
                onChange={(e) => setForm({ ...form, valuesText: e.target.value })}
                placeholder={RULE_TYPES.find((t) => t.value === form.rule_type)?.placeholder}
                className="mt-1 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm focus:border-cyan-accent focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Frequency</label>
              <div className="mt-1 flex gap-2">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForm({ ...form, frequency: f })}
                    className={`rounded-md border px-3 py-1.5 text-xs capitalize ${
                      form.frequency === f
                        ? "border-cyan-accent bg-cyan-accent/10 text-cyan-accent"
                        : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={() => createMut.mutate()} disabled={!isActive || createMut.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              {createMut.isPending ? "Creating…" : "Create alert"}
            </Button>
          </fieldset>
        </section>

        {/* Existing alerts */}
        <section className="mt-10">
          <h2 className="font-semibold">Your alert rules</h2>
          {rulesQ.isLoading ? (
            <div className="mt-3 text-sm text-muted-foreground">Loading…</div>
          ) : rulesQ.error ? (
            <div className="mt-3 text-sm text-destructive">
              {(rulesQ.error as Error).message}
            </div>
          ) : (rulesQ.data ?? []).length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No alert rules yet. {isActive ? "Create your first one above." : "Upgrade to Pro to start."}
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {(rulesQ.data ?? []).map((r) => (
                <li key={r.id} className="flex items-start gap-4 p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      <span className="rounded-sm border border-border bg-background/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {r.rule_type}
                      </span>
                      {!r.active && (
                        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          paused
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.values.map((v) => (
                        <span
                          key={v}
                          className="rounded-sm bg-cyan-accent/10 px-1.5 py-0.5 text-[11px] text-cyan-accent"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                    {r.last_matched_at && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Last match: {new Date(r.last_matched_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <select
                    value={r.frequency}
                    onChange={(e) =>
                      freqMut.mutate({
                        id: r.id,
                        frequency: e.target.value as (typeof FREQUENCIES)[number],
                      })
                    }
                    className="rounded-md border border-border bg-background/60 px-2 py-1 text-xs"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => toggleMut.mutate(r)}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:border-cyan-accent hover:text-cyan-accent"
                  >
                    {r.active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete alert "${r.name}"?`)) deleteRuleMut.mutate(r.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Saved searches */}
        <section className="mt-10">
          <div className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            <h2 className="font-semibold">Saved searches</h2>
          </div>
          {searchesQ.isLoading ? (
            <div className="mt-3 text-sm text-muted-foreground">Loading…</div>
          ) : (searchesQ.data ?? []).length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No saved searches yet. Save one from the{" "}
              <Link to="/search" className="text-cyan-accent hover:underline">
                search page
              </Link>
              .
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
              {(searchesQ.data ?? []).map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-4">
                  <div className="flex-1">
                    <div className="font-medium">{s.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Query: <span className="font-mono">{s.query || "(empty)"}</span>
                    </div>
                  </div>
                  <Link
                    to="/search"
                    search={{ q: s.query }}
                    className="rounded-md border border-border px-2 py-1 text-xs hover:border-cyan-accent hover:text-cyan-accent"
                  >
                    Run
                  </Link>
                  <button
                    onClick={() => deleteSearchMut.mutate(s.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
