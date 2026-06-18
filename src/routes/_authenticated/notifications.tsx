import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, CheckCheck } from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/utils/alerts.functions";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — GridPulse" }] }),
  component: NotificationsPage,
});

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function NotificationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);

  const q = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => listFn() as Promise<Notification[]>,
    refetchInterval: 30_000,
  });

  const markMut = useMutation({
    mutationFn: (id: string) => markFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllMut = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-[900px] px-4 py-10 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-accent">
              Notifications
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
              Notification center
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "All caught up."} ·{" "}
              <Link to="/alerts" className="text-cyan-accent hover:underline">
                Manage alerts
              </Link>
            </p>
          </div>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllMut.mutate()}>
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>

        <div className="mt-8">
          {q.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : q.error ? (
            <div className="text-sm text-destructive">{(q.error as Error).message}</div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <Bell className="mx-auto h-7 w-7 text-muted-foreground opacity-50" />
              <div className="mt-3 text-sm font-medium">No notifications yet</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Create an alert rule and you'll see matches here as new articles arrive.
              </div>
              <Link
                to="/alerts"
                className="mt-4 inline-block rounded-md bg-cyan-accent px-3 py-1.5 text-xs font-medium text-primary-foreground"
              >
                Set up alerts
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-3 p-4 ${
                    n.read_at ? "" : "bg-cyan-accent/5"
                  }`}
                >
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full">
                    {!n.read_at && <div className="h-2 w-2 rounded-full bg-cyan-accent" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {n.link ? (
                      <Link
                        to={n.link}
                        className="font-medium text-foreground hover:text-cyan-accent"
                      >
                        {n.title}
                      </Link>
                    ) : (
                      <div className="font-medium text-foreground">{n.title}</div>
                    )}
                    {n.body && (
                      <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {n.body}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-muted-foreground font-mono-data">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                  {!n.read_at && (
                    <button
                      onClick={() => markMut.mutate(n.id)}
                      className="text-muted-foreground hover:text-cyan-accent"
                      aria-label="Mark read"
                      title="Mark read"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
