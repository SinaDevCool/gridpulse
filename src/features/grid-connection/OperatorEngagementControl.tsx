import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Download, FileCheck2, FileSearch, Gauge, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type {
  AssessmentDocument,
  CandidateSite,
  OperatorCorrespondence,
} from "@/lib/assessment-model";
import {
  compareOperatorFacts,
  extractOperatorFacts,
  PHASE5_VERSION,
  simulateRestrictionEvent,
} from "./phase5-operator";
import { maySignAs, roleLabel } from "./project-roles";
import { evaluateOperationalSnapshot, type OperationalAssessment } from "./operations-readiness";

type Props = {
  site: CandidateSite;
  documents: AssessmentDocument[];
  correspondence: OperatorCorrespondence[];
  refresh: () => Promise<void>;
};

export function OperatorEngagementControl({ site, documents, correspondence, refresh }: Props) {
  const [draftText, setDraftText] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [selectedDocumentHash, setSelectedDocumentHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [operationalAssessment, setOperationalAssessment] = useState<OperationalAssessment | null>(
    null,
  );
  const facts = useMemo(() => extractOperatorFacts(draftText), [draftText]);
  const discrepancies = useMemo(
    () =>
      compareOperatorFacts(facts, {
        requestedImportMw: site.requested_import_mw,
        requestedExportMw: site.requested_export_mw,
      }),
    [facts, site.requested_export_mw, site.requested_import_mw],
  );
  const { data, refetch } = useQuery({
    queryKey: ["phase5-control", site.id],
    queryFn: async () => {
      const [events, reviews, simulations, metrics, role] = await Promise.all([
        supabase
          .from("integration_events")
          .select("*")
          .eq("site_id", site.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("assessment_reviews")
          .select("*")
          .eq("site_id", site.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("operations_simulations")
          .select("*")
          .eq("site_id", site.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("pilot_metrics")
          .select("*")
          .eq("site_id", site.id)
          .order("observed_at", { ascending: true }),
        supabase.rpc("get_assessment_role", { p_site_id: site.id }),
      ]);
      const error =
        events.error || reviews.error || simulations.error || metrics.error || role.error;
      if (error) throw error;
      return {
        events: events.data,
        reviews: reviews.data,
        simulations: simulations.data,
        metrics: metrics.data,
        role: String(role.data ?? "none"),
      };
    },
  });

  async function confirmEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (values.get("humanConfirmed") !== "on")
      return toast.error("Human source review is required.");
    const documentId = String(values.get("documentId") || "");
    if (!documentId) return toast.error("Link the operator source document first.");
    if (!selectedDocumentHash)
      return toast.error("Extract the linked PDF so its source hash can be verified.");
    setBusy(true);
    const organization = String(values.get("organization") || "Responsible network operator");
    const payload = {
      sourceDocumentId: documentId,
      sourceDocumentSha256: selectedDocumentHash,
      correspondenceId: String(values.get("correspondenceId") || "") || null,
      reviewedText: draftText,
      facts,
      discrepancies,
      declaredValues: {
        requestedImportMw: site.requested_import_mw,
        requestedExportMw: site.requested_export_mw,
      },
      reviewerStatement: "Compared with the linked source by a human reviewer.",
      methodologyVersion: PHASE5_VERSION,
    };
    const { error } = await supabase.from("integration_events").insert({
      site_id: site.id,
      organization,
      kind: "capacity_evidence",
      evidence_state: "reviewed",
      valid_from: new Date().toISOString(),
      schema_version: "gridpulse.integration.v1",
      payload,
    });
    if (!error) {
      await supabase.from("assessment_reviews").insert({
        site_id: site.id,
        role: "grid_expert",
        subject_type: "operator_capacity_evidence",
        subject_id: documentId,
        status: "open",
        note: "Verify the extraction before it is treated as operator-confirmed evidence.",
        assumptions: [],
        assigned_to_email: null,
        due_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      });
      await supabase.from("assessment_milestones").insert({
        site_id: site.id,
        user_id: site.user_id,
        title: "Review operator limit and prepare controlled envelope",
        milestone_type: "operator_response",
        status: "open",
        due_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        notes: `Created from ${PHASE5_VERSION}.`,
      });
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Reviewed evidence recorded; grid-expert approval is still required");
      await Promise.all([refresh(), refetch()]);
    }
  }

  async function extractLinkedPdf() {
    const document = documents.find((item) => item.id === selectedDocumentId);
    if (!document) return toast.error("Select the controlling source first.");
    if (document.mime_type !== "application/pdf")
      return toast.error("Automatic extraction currently supports text-based PDF files.");
    setBusy(true);
    try {
      const downloaded = await supabase.storage
        .from("assessment-documents")
        .download(document.storage_path);
      if (downloaded.error) throw downloaded.error;
      const bytes = await downloaded.data.arrayBuffer();
      const sourceHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const content = await (await pdf.getPage(pageNumber)).getTextContent();
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      }
      const extracted = pages.join("\n\n").trim();
      if (!extracted) throw new Error("No selectable text found. This PDF may require OCR.");
      setDraftText(extracted);
      setSelectedDocumentHash(sourceHash);
      toast.success(`Extracted ${pdf.numPages} PDF page${pdf.numPages === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF extraction failed");
    } finally {
      setBusy(false);
    }
  }

  async function approveReviewedEvent(eventId: string, documentId: string) {
    if (!maySignAs(data?.role ?? "none", "grid_expert"))
      return toast.error("Only the assigned grid expert can issue this approval.");
    const reviewedEvent = data?.events.find((item) => item.id === eventId);
    if (!reviewedEvent || !documentId) return toast.error("The evidence source is incomplete.");
    setBusy(true);
    const payload = reviewedEvent.payload as { sourceDocumentSha256?: string };
    const approval = await supabase.rpc("approve_release5_operator_evidence", {
      p_event_id: eventId,
      p_document_id: documentId,
      p_source_sha256: payload.sourceDocumentSha256 ?? "",
    });
    setBusy(false);
    if (approval.error) toast.error(approval.error.message);
    else {
      toast.success("Signed grid-expert approval recorded");
      await Promise.all([refresh(), refetch()]);
    }
  }

  async function saveRehearsal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const simulation = simulateRestrictionEvent({
      baselineMw: Number(values.get("baselineMw")),
      networkLimitMw: Number(values.get("networkLimitMw")),
      batteryResponseMw: Number(values.get("batteryResponseMw")),
      workloadResponseMw: Number(values.get("workloadResponseMw")),
    });
    const recordedAt = new Date().toISOString();
    const readiness = evaluateOperationalSnapshot({
      observedAt: recordedAt,
      receivedAt: recordedAt,
      telemetryQuality: "good",
      limitEvidence: "fixture",
      baselineMw: simulation.baselineMw,
      networkLimitMw: simulation.networkLimitMw,
      deliveredResponseMw: simulation.deliveredReductionMw,
      failSafeAvailable: true,
    });
    setOperationalAssessment(readiness);
    setBusy(true);
    const { error } = await supabase.from("operations_simulations").insert({
      site_id: site.id,
      status: "simulation",
      event_source: "human_reviewed_fixture",
      events: [{ startsAt: recordedAt, ...simulation }],
      results: [{ ...simulation, operationalAssessment: readiness }],
      disclaimer: simulation.disclaimer,
      calculation_version: PHASE5_VERSION,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(
        simulation.compliant
          ? "Rehearsal passed"
          : `Rehearsal leaves ${simulation.residualMw} MW residual`,
      );
      await refetch();
    }
  }

  async function downloadBilingualPackage() {
    const confirmed =
      data?.events.filter((item) => item.evidence_state === "operator_confirmed") ?? [];
    const approvals = data?.reviews.filter((item) => item.status === "accepted") ?? [];
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("GridPulse operator record", 18, 22);
    pdf.setFontSize(11);
    pdf.text("Netzbetreiber-Dialogakte / Operator engagement record", 18, 30);
    pdf.setFont("helvetica", "normal");
    const lines = [
      `Projekt / Project: ${site.name}`,
      `Erstellt / Generated: ${new Date().toLocaleString("de-DE")}`,
      "",
      "Zweck / Purpose",
      "Kundenseitige Evidenz- und Entscheidungsakte. Kein Netzanschlussangebot",
      "und keine Kapazitaetsbestaetigung.",
      "Customer-side evidence and decision record. Not a connection offer or capacity confirmation.",
      "",
      `Netzbetreiber-bestaetigte Evidenz / Operator-confirmed evidence: ${confirmed.length}`,
      `Signierte Freigaben / Signed approvals: ${approvals.length}`,
      `Offene Pruefpunkte / Open controls: ${data?.reviews.filter((item) => item.status !== "accepted").length ?? 0}`,
      "",
      ...approvals.flatMap((item) => [
        `${item.role}: ${item.subject_type}`,
        `Status: ${item.status} · ${item.resolved_at ?? item.created_at}`,
        item.note,
        "",
      ]),
    ];
    let y = 42;
    for (const line of lines) {
      const wrapped = pdf.splitTextToSize(line, 172) as string[];
      if (y + wrapped.length * 5 > 282) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(wrapped, 18, y);
      y += Math.max(1, wrapped.length) * 5;
    }
    pdf.save(`${site.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-operator-record-de-en.pdf`);
  }

  const snapshots = new Set(data?.metrics.map((item) => item.observed_at)).size;
  const evidenceMetrics =
    data?.metrics.filter((item) => item.metric_key === "evidence_completion") ?? [];
  const evidenceChange =
    evidenceMetrics.length > 1
      ? Number(evidenceMetrics.at(-1)!.metric_value) - Number(evidenceMetrics[0].metric_value)
      : null;
  return (
    <section className="phase5-control workspace-card">
      <div className="panel-heading">
        <div>
          <p className="context-label">Phase 5 · reviewed operator workflow</p>
          <h2>Turn correspondence into controlled evidence</h2>
          <p>
            Highlight facts, verify them against a linked source, then rehearse—not execute—the
            operating response.
          </p>
        </div>
        <FileCheck2 />
      </div>
      <div className="phase5-grid">
        <form className="activation-form" onSubmit={confirmEvidence}>
          <h3>1. Review an operator statement</h3>
          <label>
            Statement text
            <textarea
              rows={7}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Paste the relevant operator passage in German or English"
              required
            />
          </label>
          <div className="fact-preview">
            <span>
              Import <b>{facts.importLimitMw ?? "not found"} MW</b>
            </span>
            <span>
              Mode <b>{facts.flexibilityMode}</b>
            </span>
            <span>
              Notice <b>{facts.noticeMinutes ?? "open"} min</b>
            </span>
            <span>
              Studies <b>{facts.studyRequirements.length}</b>
            </span>
          </div>
          <div className="phase5-history" aria-label="Operator discrepancy register">
            {discrepancies.map((item) => (
              <span key={item.field}>
                <b>{item.status.replaceAll("_", " ")}</b> {item.field.replaceAll("_", " ")}
                <small>
                  Declared {item.declaredValue ?? "open"} · operator {item.operatorValue ?? "open"}
                </small>
              </span>
            ))}
          </div>
          {facts.warnings.map((warning) => (
            <p className="model-warning" key={warning}>
              <ShieldAlert />
              {warning}
            </p>
          ))}
          <label>
            Operator organization
            <input name="organization" required placeholder="e.g. Stromnetz Berlin GmbH" />
          </label>
          <label>
            Linked correspondence
            <select name="correspondenceId" defaultValue="">
              <option value="">No timeline link</option>
              {correspondence.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.subject}
                </option>
              ))}
            </select>
          </label>
          <label>
            Controlling source document
            <select
              name="documentId"
              value={selectedDocumentId}
              onChange={(event) => setSelectedDocumentId(event.target.value)}
              onInput={() => setSelectedDocumentHash("")}
              required
            >
              <option value="">Select operator source</option>
              {documents
                .filter((item) => item.source_classification === "operator_source")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.file_name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void extractLinkedPdf()}
            disabled={busy || !selectedDocumentId}
          >
            <FileSearch /> Extract text from linked PDF
          </button>
          <label className="candidate-checkbox">
            <input type="checkbox" name="humanConfirmed" />I compared every extracted field with the
            linked source.
          </label>
          <button className="primary-button" disabled={busy || !draftText}>
            <Check />
            Confirm reviewed evidence
          </button>
        </form>
        <form className="activation-form" onSubmit={saveRehearsal}>
          <h3>2. Rehearse a restriction event</h3>
          <p className="source-warning">
            <Gauge />
            No equipment is controlled and no operator signal is received.
          </p>
          <label>
            Baseline import (MW)
            <input
              name="baselineMw"
              type="number"
              min="0"
              step="0.1"
              defaultValue={site.requested_import_mw}
              required
            />
          </label>
          <label>
            Network limit (MW)
            <input
              name="networkLimitMw"
              type="number"
              min="0"
              step="0.1"
              defaultValue={facts.importLimitMw ?? Math.max(0, site.requested_import_mw * 0.7)}
              required
            />
          </label>
          <label>
            Battery response (MW)
            <input
              name="batteryResponseMw"
              type="number"
              min="0"
              step="0.1"
              defaultValue={site.bess_power_mw ?? 0}
              required
            />
          </label>
          <label>
            Shiftable workload response (MW)
            <input
              name="workloadResponseMw"
              type="number"
              min="0"
              step="0.1"
              defaultValue={0}
              required
            />
          </label>
          <button className="primary-button" disabled={busy}>
            <Gauge />
            Save simulation
          </button>
          {operationalAssessment ? (
            <p className="model-warning">
              <ShieldAlert />
              {operationalAssessment.status.replaceAll("_", " ")} ·{" "}
              {operationalAssessment.recommendedHumanAction} No automatic dispatch is authorized.
            </p>
          ) : null}
          <div className="phase5-history">
            <span>
              <b>{data?.events.length ?? 0}</b> evidence events
            </span>
            <span>
              <b>{data?.simulations.length ?? 0}</b> rehearsals
            </span>
            <span>
              <b>{data?.reviews.filter((item) => item.status === "accepted").length ?? 0}</b>{" "}
              approvals
            </span>
            <span>
              <b>{snapshots}</b> KPI snapshots
            </span>
            <span>
              <b>
                {evidenceChange === null
                  ? "—"
                  : `${evidenceChange >= 0 ? "+" : ""}${evidenceChange} pp`}
              </b>{" "}
              evidence change
            </span>
          </div>
          <p className="source-warning">
            Current project role: <b>{roleLabel(data?.role ?? "none")}</b>. A workspace
            administrator cannot sign as a grid expert.
          </p>
          {(data?.events ?? [])
            .filter((item) => item.evidence_state === "reviewed")
            .map((item) => {
              const payload = item.payload as { sourceDocumentId?: string };
              return (
                <article className="timeline-row" key={item.id}>
                  <span>Review</span>
                  <div>
                    <b>{item.organization}</b>
                    <small>Human-reviewed extraction · grid-expert signature pending</small>
                  </div>
                  {maySignAs(data?.role ?? "none", "grid_expert") ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void approveReviewedEvent(item.id, payload.sourceDocumentId ?? "")
                      }
                    >
                      Approve and sign
                    </button>
                  ) : null}
                </article>
              );
            })}
          <button type="button" onClick={() => void downloadBilingualPackage()}>
            <Download />
            Download DE/EN record
          </button>
        </form>
      </div>
    </section>
  );
}
