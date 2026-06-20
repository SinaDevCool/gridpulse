import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DataAuditCounts = {
  articles: {
    total: number;
    bySourceType: Record<string, number>;
    byVerification: Record<string, number>;
    withSourceUrl: number;
    withoutSourceUrl: number;
    latestFetchedAt: string | null;
  };
  projects: {
    total: number;
    bySourceType: Record<string, number>;
    byVerification: Record<string, number>;
    withSourceUrls: number;
    withoutSourceUrls: number;
    latestVerifiedAt: string | null;
  };
};

function tally<T extends string>(rows: { k: T | null }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = r.k ?? "(null)";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export const getDataAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const [aRes, pRes] = await Promise.all([
      supabase
        .from("articles")
        .select("source_type,verification_status,source_url,fetched_at"),
      supabase
        .from("projects")
        .select("source_type,verification_status,source_urls,last_verified_at"),
    ]);
    if (aRes.error) throw aRes.error;
    if (pRes.error) throw pRes.error;

    const articles = aRes.data ?? [];
    const projects = pRes.data ?? [];

    const articleResult: DataAuditCounts["articles"] = {
      total: articles.length,
      bySourceType: tally(articles.map((r) => ({ k: r.source_type as string | null }))),
      byVerification: tally(articles.map((r) => ({ k: r.verification_status as string | null }))),
      withSourceUrl: articles.filter((r) => !!r.source_url).length,
      withoutSourceUrl: articles.filter((r) => !r.source_url).length,
      latestFetchedAt:
        articles
          .map((r) => r.fetched_at as string | null)
          .filter((x): x is string => !!x)
          .sort()
          .pop() ?? null,
    };

    const projectResult: DataAuditCounts["projects"] = {
      total: projects.length,
      bySourceType: tally(projects.map((r) => ({ k: r.source_type as string | null }))),
      byVerification: tally(projects.map((r) => ({ k: r.verification_status as string | null }))),
      withSourceUrls: projects.filter((r) => Array.isArray(r.source_urls) && r.source_urls.length > 0).length,
      withoutSourceUrls: projects.filter((r) => !Array.isArray(r.source_urls) || r.source_urls.length === 0).length,
      latestVerifiedAt:
        projects
          .map((r) => r.last_verified_at as string | null)
          .filter((x): x is string => !!x)
          .sort()
          .pop() ?? null,
    };

    return { articles: articleResult, projects: projectResult };
  });
