import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TARGET_TYPES = ["company", "project"] as const;

export const FOLLOW_LIMITS: Record<"free" | "pro" | "enterprise", number> = {
  free: 3,
  pro: 20,
  enterprise: Number.MAX_SAFE_INTEGER,
};

const followInput = z.object({
  target_type: z.enum(TARGET_TYPES),
  target_key: z.string().trim().min(1).max(120),
  target_label: z.string().trim().min(1).max(200).optional(),
});

type Tier = "free" | "pro" | "enterprise";
async function getTier(supabase: any, userId: string): Promise<Tier> {
  const { data } = await supabase.rpc("get_user_tier", { _user_id: userId });
  if (data === "enterprise" || data === "pro" || data === "free") return data;
  return "free";
}

export const listFollows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("follows")
      .select("id,target_type,target_key,target_label,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const tier = await getTier(context.supabase, context.userId);
    const limit = FOLLOW_LIMITS[tier];
    return {
      follows: data ?? [],
      tier,
      limit: limit === Number.MAX_SAFE_INTEGER ? null : limit,
      used: data?.length ?? 0,
    };
  });

export const addFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => followInput.parse(input))
  .handler(async ({ data, context }) => {
    const tier = await getTier(context.supabase, context.userId);
    const limit = FOLLOW_LIMITS[tier];
    const { count } = await context.supabase
      .from("follows")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) >= limit) {
      throw new Error(
        tier === "free"
          ? "Free plan is limited to 3 follows. Upgrade to Pro for 20."
          : tier === "pro"
            ? "Pro plan is limited to 20 follows. Upgrade to Enterprise for unlimited."
            : "Follow limit reached.",
      );
    }
    const { data: row, error } = await context.supabase
      .from("follows")
      .insert({ user_id: context.userId, ...data })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") {
        // already followed — treat as success (idempotent)
        const { data: existing } = await context.supabase
          .from("follows")
          .select("*")
          .eq("user_id", context.userId)
          .eq("target_type", data.target_type)
          .eq("target_key", data.target_key)
          .maybeSingle();
        if (existing) return existing;
      }
      throw new Error(error.message);
    }
    return row;
  });

export const removeFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        target_type: z.enum(TARGET_TYPES),
        target_key: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("follows")
      .delete()
      .eq("user_id", context.userId)
      .eq("target_type", data.target_type)
      .eq("target_key", data.target_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
