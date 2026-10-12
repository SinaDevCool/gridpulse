import { supabase } from "@/integrations/supabase/client";
import {
type AssessmentActivity,
type AssessmentCollaborator,
type AssessmentDocument,
type AssessmentMilestone,
type CandidateSite,
type CapacitySnapshot,
type DecisionMemo,
type DsoDirectoryEntry,
type Evidence,
type FcaEnvelope,
type GridDataSource,
type IntervalProfile,
type NetworkAsset,
type NetworkNode,
type OperatorCorrespondence,
type OperatorProfile,
type OperatorRequirement,
type Scenario,
type StudyRun,
} from "@/lib/assessment-model";
export async function loadAssessment(id: string) {
  const [
    siteResult,
    evidenceResult,
    scenarioResult,
    profileResult,
    documentResult,
    requirementResult,
    correspondenceResult,
    envelopeResult,
    operatorProfileResult,
    dataSourceResult,
    dsoResult,
    milestoneResult,
    collaboratorResult,
    activityResult,
    memoResult,
    nodeResult,
    assetResult,
    capacityResult,
    studyResult,
    roleResult,
  ] = await Promise.all([
    supabase.from("candidate_sites").select("*").eq("id", id).single(),
    supabase
      .from("assessment_evidence")
      .select("*")
      .eq("site_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("connection_scenarios")
      .select("*")
      .eq("site_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("interval_profiles")
      .select("*")
      .eq("site_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("assessment_documents")
      .select("*")
      .eq("site_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("operator_requirements")
      .select("*")
      .eq("site_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("operator_correspondence")
      .select("*")
      .eq("site_id", id)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("fca_envelopes")
      .select("*")
      .eq("site_id", id)
      .order("version", { ascending: false }),
    supabase.from("operator_profiles").select("*").order("operator_name"),
    supabase.from("grid_data_sources").select("*").order("authority"),
    supabase.from("dso_directory").select("*").order("operator_name"),
    supabase.from("assessment_milestones").select("*").eq("site_id", id).order("due_at"),
    supabase.from("assessment_collaborators").select("*").eq("site_id", id).order("created_at"),
    supabase
      .from("assessment_activity")
      .select("*")
      .eq("site_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("decision_memos")
      .select("*")
      .eq("site_id", id)
      .order("version", { ascending: false }),
    supabase.from("network_nodes").select("*").eq("site_id", id).order("created_at"),
    supabase.from("network_assets").select("*").eq("site_id", id).order("created_at"),
    supabase
      .from("capacity_snapshots")
      .select("*")
      .eq("site_id", id)
      .order("version", { ascending: false }),
    supabase
      .from("study_runs")
      .select("*")
      .eq("site_id", id)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_assessment_role", { p_site_id: id }),
  ]);
  if (siteResult.error) throw siteResult.error;
  if (evidenceResult.error) throw evidenceResult.error;
  if (scenarioResult.error) throw scenarioResult.error;
  if (profileResult.error) throw profileResult.error;
  if (documentResult.error) throw documentResult.error;
  if (requirementResult.error) throw requirementResult.error;
  if (correspondenceResult.error) throw correspondenceResult.error;
  if (envelopeResult.error) throw envelopeResult.error;
  if (operatorProfileResult.error) throw operatorProfileResult.error;
  if (dataSourceResult.error) throw dataSourceResult.error;
  if (dsoResult.error) throw dsoResult.error;
  if (milestoneResult.error) throw milestoneResult.error;
  if (collaboratorResult.error) throw collaboratorResult.error;
  if (activityResult.error) throw activityResult.error;
  if (memoResult.error) throw memoResult.error;
  if (nodeResult.error) throw nodeResult.error;
  if (assetResult.error) throw assetResult.error;
  if (capacityResult.error) throw capacityResult.error;
  if (studyResult.error) throw studyResult.error;
  if (roleResult.error) throw roleResult.error;
  return {
    site: siteResult.data as CandidateSite,
    evidence: evidenceResult.data as Evidence[],
    scenarios: scenarioResult.data as Scenario[],
    profiles: profileResult.data as IntervalProfile[],
    documents: documentResult.data as AssessmentDocument[],
    requirements: requirementResult.data as OperatorRequirement[],
    correspondence: correspondenceResult.data as OperatorCorrespondence[],
    envelopes: envelopeResult.data as FcaEnvelope[],
    operatorProfiles: operatorProfileResult.data as OperatorProfile[],
    dataSources: dataSourceResult.data as GridDataSource[],
    dsos: dsoResult.data as DsoDirectoryEntry[],
    milestones: milestoneResult.data as AssessmentMilestone[],
    collaborators: collaboratorResult.data as AssessmentCollaborator[],
    activity: activityResult.data as AssessmentActivity[],
    memos: memoResult.data as DecisionMemo[],
    nodes: nodeResult.data as NetworkNode[],
    assets: assetResult.data as NetworkAsset[],
    snapshots: capacityResult.data as CapacitySnapshot[],
    studies: studyResult.data as StudyRun[],
    assessmentRole: String(roleResult.data ?? "none"),
  };
}

export function archiveAssessment(id: string) {
  return supabase.from("candidate_sites").update({ assessment_status: "archived" }).eq("id", id);
}
export function deleteAssessment(id: string) {
  return supabase.from("candidate_sites").delete().eq("id", id);
}
