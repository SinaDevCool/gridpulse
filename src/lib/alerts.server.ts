// Server-only: matches alert rules against new articles and creates
// in-app notifications. Uses the service-role client because we need to
// write notifications for arbitrary users (the cron caller is unauthenticated).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Frequency = "instant" | "daily" | "weekly" | "all";

const LOOKBACK: Record<Exclude<Frequency, "all">, string> = {
  instant: "30 minutes",
  daily: "26 hours",
  weekly: "8 days",
};

interface AlertRule {
  id: string;
  user_id: string;
  name: string;
  rule_type: "keyword" | "tag" | "company" | "region" | "technology" | "market" | "category";
  values: string[];
  frequency: "instant" | "daily" | "weekly" | "off";
  active: boolean;
}

interface ArticleMatch {
  id: string;
  slug: string;
  headline: string;
  summary: string;
  category: string;
  region: string;
  source_name: string | null;
  tags: string[];
  published_at: string | null;
}

function sanitize(values: string[]): string[] {
  return values
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0 && v.length <= 80)
    .slice(0, 20);
}

async function findMatches(rule: AlertRule, sinceIso: string): Promise<ArticleMatch[]> {
  const values = sanitize(rule.values);
  if (values.length === 0) return [];

  let q = supabaseAdmin
    .from("articles")
    .select("id,slug,headline,summary,category,region,source_name,tags,published_at,content")
    .gte("published_at", sinceIso)
    .order("published_at", { ascending: false })
    .limit(50);

  switch (rule.rule_type) {
    case "tag":
      q = q.overlaps("tags", values);
      break;
    case "category":
      q = q.in("category", values);
      break;
    case "region":
      q = q.in("region", values);
      break;
    case "keyword":
    case "company":
    case "technology":
    case "market": {
      // websearch-style OR query
      const expr = values.map((v) => `"${v.replace(/"/g, "")}"`).join(" OR ");
      q = q.textSearch("search_tsv", expr, { type: "websearch", config: "english" });
      break;
    }
  }

  const { data, error } = await q;
  if (error) {
    console.error(`Alert rule ${rule.id} match error:`, error.message);
    return [];
  }
  return (data ?? []) as ArticleMatch[];
}

export interface MatcherResult {
  rulesEvaluated: number;
  notificationsCreated: number;
  durationMs: number;
}

export async function runAlertMatcher(frequency: Frequency = "all"): Promise<MatcherResult> {
  const startedAt = Date.now();
  const frequencies: Array<Exclude<Frequency, "all">> =
    frequency === "all" ? ["instant", "daily", "weekly"] : [frequency];

  let rulesEvaluated = 0;
  let notificationsCreated = 0;

  for (const freq of frequencies) {
    const { data: rules, error } = await supabaseAdmin
      .from("alert_rules")
      .select("id,user_id,name,rule_type,values,frequency,active")
      .eq("active", true)
      .eq("frequency", freq);
    if (error) {
      console.error(`Failed to load ${freq} rules:`, error.message);
      continue;
    }

    const lookback = LOOKBACK[freq];
    const sinceIso = new Date(Date.now() - lookbackMs(lookback)).toISOString();

    for (const rule of (rules ?? []) as AlertRule[]) {
      rulesEvaluated += 1;
      try {
        const matches = await findMatches(rule, sinceIso);
        if (matches.length === 0) {
          await supabaseAdmin
            .from("alert_rules")
            .update({ last_run_at: new Date().toISOString() })
            .eq("id", rule.id);
          continue;
        }
        const rows = matches.map((m) => ({
          user_id: rule.user_id,
          type: "alert",
          title: `${rule.name}: ${m.headline}`,
          body: m.summary,
          link: `/news/${m.slug}`,
          alert_rule_id: rule.id,
          article_id: m.id,
        }));
        // Dedupe via unique index — upsert with ignoreDuplicates
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("notifications")
          .upsert(rows, {
            onConflict: "user_id,alert_rule_id,article_id",
            ignoreDuplicates: true,
          })
          .select("id");
        if (insErr) {
          console.error(`Notification insert error for rule ${rule.id}:`, insErr.message);
        } else {
          notificationsCreated += inserted?.length ?? 0;
        }
        await supabaseAdmin
          .from("alert_rules")
          .update({
            last_run_at: new Date().toISOString(),
            last_matched_at: new Date().toISOString(),
          })
          .eq("id", rule.id);
      } catch (e) {
        console.error(`Rule ${rule.id} failed:`, e);
      }
    }
  }

  return {
    rulesEvaluated,
    notificationsCreated,
    durationMs: Date.now() - startedAt,
  };
}

function lookbackMs(interval: string): number {
  const [n, unit] = interval.split(" ");
  const num = parseInt(n, 10);
  if (unit.startsWith("minute")) return num * 60_000;
  if (unit.startsWith("hour")) return num * 3_600_000;
  if (unit.startsWith("day")) return num * 86_400_000;
  return 86_400_000;
}
