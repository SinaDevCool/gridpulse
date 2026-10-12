/** Static public contract; implementation conforms to this boundary. */
export interface PortfolioWorkspaceContract {
  navigate: import("@tanstack/router-core").UseNavigateResult<string>;
  search: {
    sort?: "name" | "priority" | "updated" | "mw" | undefined;
    selected?: string | undefined;
    q?: string | undefined;
    view?: "decisions" | "pipeline" | "readiness" | undefined;
    stage?:
      | "all"
      | "action_required"
      | "draft"
      | "screening"
      | "shortlisted"
      | "evidence_review"
      | "decision_ready"
      | undefined;
    decision?: "all" | "unreviewed" | "advance" | "hold" | "reject" | undefined;
    risk?: "deadline" | "all" | "blocked" | "operator_confirmed" | undefined;
    operator?: string | undefined;
    import?: "open" | undefined;
  };
  restoreInput: import("react").RefObject<HTMLInputElement | null>;
  summaries: import("@/features/anonymous-workspace/portfolio-projection").AnonymousSiteSummary[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  metrics: {
    sites: number;
    declaredMw: number;
    actionRequired: number;
    decisionReady: number;
  };
  selected:
    | import("@/features/anonymous-workspace/portfolio-projection").AnonymousSiteSummary
    | null;
  activeView: "decisions" | "pipeline" | "readiness";
  importOpen: boolean;
  visible: import("@/features/anonymous-workspace/portfolio-projection").AnonymousSiteSummary[];
  patchSearch: (
    patch: Partial<{
      sort?: "name" | "priority" | "updated" | "mw" | undefined;
      selected?: string | undefined;
      q?: string | undefined;
      view?: "decisions" | "pipeline" | "readiness" | undefined;
      stage?:
        | "all"
        | "action_required"
        | "draft"
        | "screening"
        | "shortlisted"
        | "evidence_review"
        | "decision_ready"
        | undefined;
      decision?: "all" | "unreviewed" | "advance" | "hold" | "reject" | undefined;
      risk?: "deadline" | "all" | "blocked" | "operator_confirmed" | undefined;
      operator?: string | undefined;
      import?: "open" | undefined;
    }>,
  ) => undefined;
  intelligence: {
    rows: {
      risk: {
        severity: string;
        urgency: number;
        daysToDeadline: number | null;
      };
      site_id: string;
      site_name: string;
      project_type: string;
      requested_import_mw: number;
      minimum_viable_import_mw: number | null;
      target_voltage_kv: number | null;
      target_energization_date: string | null;
      operator_name: string | null;
      engagement_status: string;
      evidence_state: string;
      indicated_import_mw: number | null;
      reinforcement_required: boolean | null;
      reinforcement_summary: string | null;
      estimated_connection_cost_eur: number | null;
      indicated_connection_date: string | null;
      response_due_at: string | null;
      offer_expires_at: string | null;
      reservation_expires_at: string | null;
      evidence_score: number;
      evidence_label: string;
      missing_evidence: string[];
      next_deadline: string | null;
    }[];
    operators: {
      operator: string;
      projects: number;
      requestedMw: number;
    }[];
    metrics: {
      totalMw: number;
      atRiskMw: number;
      indicatedMw: number;
      evidenceGapMw: number;
      urgentProjects: number;
      confirmedProjects: number;
    };
    boundary: string;
  };
  decisionSites: import("@/features/anonymous-workspace/portfolio-projection").AnonymousSiteSummary[];
  exportRows: import("@/features/properties/property-export").ExportableProperty[];
  filtersActive: boolean;
}
