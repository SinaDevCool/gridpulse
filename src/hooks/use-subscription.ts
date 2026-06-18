import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";

export interface SubscriptionRow {
  id: string;
  user_id: string;
  status: string;
  price_id: string;
  product_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  environment: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
}

export function useSubscription(userId: string | undefined) {
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    let env: string;
    try {
      env = getStripeEnvironment();
    } catch {
      setLoading(false);
      return;
    }

    let active = true;
    const uid = userId;
    async function load() {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", uid)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setSubscription((data as SubscriptionRow | null) ?? null);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`subscriptions:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const isActive =
    !!subscription &&
    ((["active", "trialing", "past_due"].includes(subscription.status) &&
      (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date())) ||
      (subscription.status === "canceled" &&
        !!subscription.current_period_end &&
        new Date(subscription.current_period_end) > new Date()));

  const plan = isActive
    ? subscription!.price_id === "enterprise_monthly"
      ? "enterprise"
      : subscription!.price_id === "pro_monthly"
        ? "pro"
        : "free"
    : "free";

  return { subscription, isActive, plan, loading };
}
