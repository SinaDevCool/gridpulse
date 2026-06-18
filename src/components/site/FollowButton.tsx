import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listFollows, addFollow, removeFollow } from "@/utils/follows.functions";

type Props = {
  targetType: "company" | "project";
  targetKey: string;
  targetLabel?: string;
  size?: "sm" | "md";
};

type FollowsState = {
  follows: Array<{ id: string; target_type: string; target_key: string }>;
  tier: "free" | "pro" | "enterprise";
  limit: number | null;
  used: number;
};

export function FollowButton({ targetType, targetKey, targetLabel, size = "md" }: Props) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => mounted && setAuthed(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setAuthed(!!session?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const listFn = useServerFn(listFollows);
  const addFn = useServerFn(addFollow);
  const rmFn = useServerFn(removeFollow);

  const q = useQuery<FollowsState>({
    queryKey: ["follows"],
    queryFn: () => listFn() as Promise<FollowsState>,
    enabled: authed === true,
  });

  const isFollowing = !!q.data?.follows.find(
    (f) => f.target_type === targetType && f.target_key === targetKey,
  );

  const addMut = useMutation({
    mutationFn: () =>
      addFn({ data: { target_type: targetType, target_key: targetKey, target_label: targetLabel } }),
    onSuccess: () => {
      setErrMsg(null);
      qc.invalidateQueries({ queryKey: ["follows"] });
    },
    onError: (e: Error) => setErrMsg(e.message),
  });

  const rmMut = useMutation({
    mutationFn: () => rmFn({ data: { target_type: targetType, target_key: targetKey } }),
    onSuccess: () => {
      setErrMsg(null);
      qc.invalidateQueries({ queryKey: ["follows"] });
    },
    onError: (e: Error) => setErrMsg(e.message),
  });

  if (authed === false) {
    return (
      <Link
        to="/auth"
        className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 ${
          size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
        } text-muted-foreground hover:text-foreground`}
      >
        <Star className="h-3.5 w-3.5" /> Sign in to follow
      </Link>
    );
  }

  const busy = addMut.isPending || rmMut.isPending || q.isLoading || authed === null;
  const baseCls = `inline-flex items-center gap-1.5 rounded-md border ${
    size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
  } font-medium transition`;
  const onCls = "border-cyan-accent/40 bg-cyan-accent/15 text-cyan-accent hover:bg-cyan-accent/25";
  const offCls = "border-border bg-surface/60 text-foreground hover:border-cyan-accent/40";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => (isFollowing ? rmMut.mutate() : addMut.mutate())}
        className={`${baseCls} ${isFollowing ? onCls : offCls} disabled:opacity-50`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Star className={`h-3.5 w-3.5 ${isFollowing ? "fill-current" : ""}`} />
        )}
        {isFollowing ? "Following" : "Follow"}
      </button>
      {errMsg && (
        <span className="text-[11px] text-amber-accent">
          {errMsg}{" "}
          {/Pro|Enterprise|limit/i.test(errMsg) && (
            <Link to="/subscribe" className="underline">Upgrade</Link>
          )}
        </span>
      )}
    </div>
  );
}
