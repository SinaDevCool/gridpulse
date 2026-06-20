import { AlertTriangle, ShieldCheck, Rss, FileText, Pencil } from "lucide-react";

type Variant = "demo" | "unverified" | "verified" | "rss" | "seed" | "manual";

const styles: Record<Variant, string> = {
  demo: "bg-amber-accent/10 text-amber-accent border-amber-accent/40",
  unverified: "bg-amber-accent/10 text-amber-accent border-amber-accent/40",
  verified: "bg-green-accent/10 text-green-accent border-green-accent/40",
  rss: "bg-cyan-accent/10 text-cyan-accent border-cyan-accent/40",
  seed: "bg-amber-accent/10 text-amber-accent border-amber-accent/40",
  manual: "bg-muted/30 text-muted-foreground border-border",
};

const labels: Record<Variant, string> = {
  demo: "Demo data",
  unverified: "Unverified",
  verified: "Verified",
  rss: "RSS-sourced",
  seed: "Manual seed",
  manual: "Manual entry",
};

const Icon: Record<Variant, typeof ShieldCheck> = {
  demo: AlertTriangle,
  unverified: AlertTriangle,
  verified: ShieldCheck,
  rss: Rss,
  seed: FileText,
  manual: Pencil,
};

export function DemoBadge({
  variant = "demo",
  className = "",
  label,
}: {
  variant?: Variant;
  className?: string;
  label?: string;
}) {
  const I = Icon[variant];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[variant]} ${className}`}
      title={label ?? labels[variant]}
    >
      <I className="h-3 w-3" />
      {label ?? labels[variant]}
    </span>
  );
}

export function provenanceVariant(
  sourceType: string | null | undefined,
  verificationStatus: string | null | undefined,
): Variant {
  if (verificationStatus === "demo" || sourceType === "seed") return "demo";
  if (verificationStatus === "verified") return "verified";
  if (sourceType === "rss") return "rss";
  if (sourceType === "manual") return "manual";
  return "unverified";
}
