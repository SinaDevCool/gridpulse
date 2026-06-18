// Server-only follow matcher: for each new article in the lookback window,
// create in-app notifications for users following companies/projects that
// the article mentions or links to. Dedupes via a partial unique index on
// notifications (user_id, type, article_id, link).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface FollowMatcherResult {
  followsEvaluated: number;
  notificationsCreated: number;
  durationMs: number;
}

const LOOKBACK_MS = 26 * 3_600_000; // 26 hours, matches the daily alert cadence

interface FollowRow {
  user_id: string;
  target_type: "company" | "project";
  target_key: string;
  target_label: string | null;
}

interface ArticleRow {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  tags: string[] | null;
  source_name: string | null;
  related_project_ids: string[] | null;
}

interface ProjectKeyRow {
  id: string;
  external_id: string | null;
  slug: string | null;
  name: string;
  developer: string | null;
  owner: string | null;
  operator: string | null;
  offtaker: string | null;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function slugifyCompany(name: string): string {
  return norm(name)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function runFollowMatcher(): Promise<FollowMatcherResult> {
  const startedAt = Date.now();
  const sinceIso = new Date(Date.now() - LOOKBACK_MS).toISOString();

  const [{ data: follows }, { data: articles }, { data: projects }] = await Promise.all([
    supabaseAdmin.from("follows").select("user_id,target_type,target_key,target_label"),
    supabaseAdmin
      .from("articles")
      .select("id,slug,headline,summary,tags,source_name,related_project_ids")
      .gte("published_at", sinceIso)
      .limit(500),
    supabaseAdmin
      .from("projects")
      .select("id,external_id,slug,name,developer,owner,operator,offtaker"),
  ]);

  const fRows = (follows ?? []) as FollowRow[];
  const aRows = (articles ?? []) as ArticleRow[];
  const pRows = (projects ?? []) as ProjectKeyRow[];

  if (fRows.length === 0 || aRows.length === 0) {
    return { followsEvaluated: fRows.length, notificationsCreated: 0, durationMs: Date.now() - startedAt };
  }

  // Index projects by external_id / slug for project follows, and by
  // company-slug → set of project external_ids the company appears on.
  const projectByKey = new Map<string, ProjectKeyRow>();
  const projectCompanies = new Map<string, Set<string>>(); // companySlug → set of project ext_ids
  for (const p of pRows) {
    if (p.external_id) projectByKey.set(p.external_id, p);
    if (p.slug) projectByKey.set(p.slug, p);
    for (const raw of [p.developer, p.owner, p.operator, p.offtaker]) {
      if (!raw) continue;
      const cs = slugifyCompany(raw);
      if (!cs) continue;
      const key = p.external_id ?? p.id;
      if (!projectCompanies.has(cs)) projectCompanies.set(cs, new Set());
      projectCompanies.get(cs)!.add(key);
    }
  }

  // For company follows we also need the display label (already in follow row).
  // Pre-compute lowercase haystacks per article.
  const haystacks = aRows.map((a) => ({
    art: a,
    hay: norm(`${a.headline} ${a.summary} ${(a.tags ?? []).join(" ")} ${a.source_name ?? ""}`),
    related: new Set(a.related_project_ids ?? []),
  }));

  const rows: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string | null;
    link: string;
    article_id: string;
  }> = [];

  for (const f of fRows) {
    if (f.target_type === "project") {
      const proj = projectByKey.get(f.target_key);
      if (!proj) continue;
      const projKey = proj.external_id ?? proj.id;
      const projName = proj.name;
      for (const h of haystacks) {
        const mentioned = h.related.has(projKey) || h.hay.includes(norm(projName));
        if (!mentioned) continue;
        rows.push({
          user_id: f.user_id,
          type: "follow_project",
          title: `${f.target_label ?? projName}: ${h.art.headline}`,
          body: h.art.summary,
          link: `/news/${h.art.slug}`,
          article_id: h.art.id,
        });
      }
    } else {
      // company follow
      const label = f.target_label ?? f.target_key.replace(/-/g, " ");
      const needle = norm(label);
      const linkedProjects = projectCompanies.get(f.target_key) ?? new Set<string>();
      for (const h of haystacks) {
        const mentioned =
          h.hay.includes(needle) ||
          [...h.related].some((id) => linkedProjects.has(id));
        if (!mentioned) continue;
        rows.push({
          user_id: f.user_id,
          type: "follow_company",
          title: `${label}: ${h.art.headline}`,
          body: h.art.summary,
          link: `/news/${h.art.slug}`,
          article_id: h.art.id,
        });
      }
    }
  }

  let notificationsCreated = 0;
  if (rows.length > 0) {
    const { data: inserted, error } = await supabaseAdmin
      .from("notifications")
      .upsert(rows, {
        onConflict: "user_id,type,article_id,link",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      console.error("Follow notification insert error:", error.message);
    } else {
      notificationsCreated = inserted?.length ?? 0;
    }
  }

  return {
    followsEvaluated: fRows.length,
    notificationsCreated,
    durationMs: Date.now() - startedAt,
  };
}
