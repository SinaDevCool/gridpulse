import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Database,
  GitBranch,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type {
  CapacitySnapshot,
  CandidateSite,
  NetworkAsset,
  NetworkNode,
  StudyRun,
} from "@/lib/assessment-model";
import {
  capacityTruth,
  latestCapacityByNode,
  nodeDisplayName,
  parseJsonObject,
} from "./node-intelligence";

const numberOrNull = (value: FormDataEntryValue | null) =>
  value === null || String(value).trim() === "" ? null : Number(value);

export function NodeIntelligencePanel({
  site,
  nodes,
  assets,
  snapshots,
  studies,
  role,
  refresh,
}: {
  site: CandidateSite;
  nodes: NetworkNode[];
  assets: NetworkAsset[];
  snapshots: CapacitySnapshot[];
  studies: StudyRun[];
  role: string;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id ?? "");
  const latest = useMemo(() => latestCapacityByNode(snapshots), [snapshots]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0];
  const canManage = ["technical_reviewer", "grid_expert", "workspace_admin"].includes(role);

  async function submit(table: string, payload: Record<string, unknown>, success: string) {
    setBusy(true);
    const { error } = await supabase.from(table).insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(success);
    await refresh();
  }

  async function addNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submit(
      "network_nodes",
      {
        site_id: site.id,
        node_name: data.get("node_name"),
        node_code: data.get("node_code") || null,
        operator_name: data.get("operator_name"),
        node_type: data.get("node_type"),
        voltage_kv: numberOrNull(data.get("voltage_kv")),
        latitude: numberOrNull(data.get("latitude")),
        longitude: numberOrNull(data.get("longitude")),
        source_classification: data.get("source_classification"),
        confidence: data.get("confidence"),
        confidentiality: data.get("confidentiality"),
      },
      "Network node recorded",
    );
    event.currentTarget.reset();
  }

  async function addAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submit(
      "network_assets",
      {
        site_id: site.id,
        asset_name: data.get("asset_name"),
        asset_type: data.get("asset_type"),
        from_node_id: data.get("from_node_id") || null,
        voltage_kv: numberOrNull(data.get("voltage_kv")),
        normal_rating_mva: numberOrNull(data.get("normal_rating_mva")),
        operational_status: data.get("operational_status"),
        source_classification: "engineering_model",
        confidence: "low",
        confidentiality: "reviewers",
      },
      "Network asset recorded",
    );
    event.currentTarget.reset();
  }

  async function addSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submit(
      "capacity_snapshots",
      {
        site_id: site.id,
        node_id: data.get("node_id"),
        capacity_kind: data.get("capacity_kind"),
        firm_import_mw: numberOrNull(data.get("firm_import_mw")),
        firm_export_mw: numberOrNull(data.get("firm_export_mw")),
        conditional_import_mw: numberOrNull(data.get("conditional_import_mw")),
        conditional_export_mw: numberOrNull(data.get("conditional_export_mw")),
        network_state: data.get("network_state"),
        methodology_version: data.get("methodology_version") || null,
        status: "draft",
        source_classification:
          data.get("capacity_kind") === "operator_statement"
            ? "customer_declared"
            : "engineering_model",
        confidence: "low",
        confidentiality: "reviewers",
        notes: data.get("notes") || null,
      },
      "Versioned capacity evidence recorded",
    );
    event.currentTarget.reset();
  }

  async function addStudy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await submit(
        "study_runs",
        {
          site_id: site.id,
          node_id: data.get("node_id") || null,
          study_name: data.get("study_name"),
          study_type: data.get("study_type"),
          model_name: data.get("model_name"),
          model_version: data.get("model_version"),
          input_manifest: parseJsonObject(String(data.get("input_manifest") ?? "")),
          results: parseJsonObject(String(data.get("results") ?? "")),
          status: "draft",
          source_classification: "engineering_model",
          confidence: "low",
          confidentiality: "reviewers",
        },
        "Reproducible study record created",
      );
      event.currentTarget.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid study data");
    }
  }

  return (
    <div className="node-intelligence">
      <div className="truth-banner operator-review-entry">
        <ShieldCheck />
        <div>
          <b>Operator confirmation is separated from project modelling</b>
          <p>
            Invite a network-operator reviewer, attach authoritative evidence and preserve the
            signed decision as a new version.
          </p>
        </div>
        <a className="secondary-button" href={`/operator-review/${site.id}`}>
          Open review record <ArrowUpRight />
        </a>
      </div>
      <div className="truth-banner">
        <AlertTriangle />
        <div>
          <b>Planning intelligence—not a capacity offer</b>
          <p>
            Only an operator-confirmed source document can turn a snapshot into confirmed evidence.
            Internal studies remain screening inputs.
          </p>
        </div>
      </div>
      <div className="summary-grid node-summary">
        <article>
          <GitBranch />
          <span>Network nodes</span>
          <strong>{nodes.length}</strong>
        </article>
        <article>
          <Boxes />
          <span>Assets represented</span>
          <strong>{assets.length}</strong>
        </article>
        <article>
          <Database />
          <span>Capacity versions</span>
          <strong>{snapshots.length}</strong>
        </article>
        <article>
          <ShieldCheck />
          <span>Study records</span>
          <strong>{studies.length}</strong>
        </article>
      </div>

      <section className="workspace-card">
        <div className="workspace-card-header">
          <div>
            <span className="context-label">Node register</span>
            <h3>Known network context</h3>
          </div>
          {nodes.length > 0 && (
            <select
              value={selectedNode?.id}
              onChange={(event) => setSelectedNodeId(event.target.value)}
              aria-label="Selected network node"
            >
              {nodes.map((node) => (
                <option value={node.id} key={node.id}>
                  {nodeDisplayName(node)}
                </option>
              ))}
            </select>
          )}
        </div>
        {nodes.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Operator</th>
                  <th>Source</th>
                  <th>Latest capacity evidence</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => {
                  const truth = capacityTruth(latest.get(node.id));
                  return (
                    <tr key={node.id}>
                      <td>
                        <b>{node.node_name}</b>
                        <small>
                          {node.node_type} · {node.voltage_kv} kV
                        </small>
                      </td>
                      <td>{node.operator_name}</td>
                      <td>
                        {node.source_classification}
                        <small>{node.confidence} confidence</small>
                      </td>
                      <td>
                        <span className={`status node-truth-${truth.level}`}>{truth.label}</span>
                        {latest.get(node.id) && (
                          <small>
                            v{latest.get(node.id)?.version} · firm import{" "}
                            {latest.get(node.id)?.firm_import_mw ?? "unknown"} MW
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <GitBranch />
            <h3>No network node recorded</h3>
            <p>Add the candidate connection point or substation as a sourced planning record.</p>
          </div>
        )}
      </section>

      {canManage ? (
        <div className="node-form-grid">
          <details className="workspace-card">
            <summary>
              <Plus /> Add network node
            </summary>
            <form className="activation-form" onSubmit={addNode}>
              <label>
                Node name
                <input name="node_name" required placeholder="e.g. Candidate 110 kV substation" />
              </label>
              <label>
                Node code
                <input name="node_code" placeholder="Operator reference, if known" />
              </label>
              <label>
                Operator
                <input
                  name="operator_name"
                  required
                  defaultValue={
                    site.responsible_operator_name ?? site.likely_network_operator ?? ""
                  }
                />
              </label>
              <label>
                Type
                <select name="node_type" defaultValue="substation">
                  <option value="substation">Substation</option>
                  <option value="connection_point">Connection point</option>
                  <option value="grid_interface">Grid interface</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
              <label>
                Voltage (kV)
                <input
                  name="voltage_kv"
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  defaultValue={site.target_voltage_kv ?? ""}
                />
              </label>
              <label>
                Latitude
                <input name="latitude" type="number" step="any" defaultValue={site.latitude} />
              </label>
              <label>
                Longitude
                <input name="longitude" type="number" step="any" defaultValue={site.longitude} />
              </label>
              <label>
                Source
                <select name="source_classification">
                  <option value="public_context">Public context</option>
                  <option value="customer_declared">Customer declared</option>
                  <option value="engineering_model">Engineering model</option>
                  <option value="operator_statement">Operator statement</option>
                </select>
              </label>
              <label>
                Confidence
                <select name="confidence">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                Confidentiality
                <select name="confidentiality">
                  <option value="project_participants">Project participants</option>
                  <option value="reviewers">Reviewers</option>
                  <option value="operator_restricted">Operator restricted</option>
                  <option value="public_context">Public context</option>
                </select>
              </label>
              <button className="primary-button" disabled={busy}>
                Save node
              </button>
            </form>
          </details>

          <details className="workspace-card">
            <summary>
              <Plus /> Add asset
            </summary>
            {!nodes.length ? (
              <p className="form-hint">Add a node first.</p>
            ) : (
              <form className="activation-form" onSubmit={addAsset}>
                <label>
                  Asset name
                  <input name="asset_name" required />
                </label>
                <label>
                  Type
                  <select name="asset_type">
                    <option value="transformer">Transformer</option>
                    <option value="line">Line</option>
                    <option value="cable">Cable</option>
                    <option value="connection_bay">Connection bay</option>
                    <option value="upstream_interface">Upstream interface</option>
                  </select>
                </label>
                <label>
                  Connected node
                  <select name="from_node_id" required>
                    {nodes.map((node) => (
                      <option value={node.id} key={node.id}>
                        {node.node_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Voltage (kV)
                  <input name="voltage_kv" type="number" min="0" step="0.1" />
                </label>
                <label>
                  Normal rating (MVA)
                  <input name="normal_rating_mva" type="number" min="0" step="0.1" />
                </label>
                <label>
                  Status
                  <select name="operational_status">
                    <option value="unknown">Unknown</option>
                    <option value="planned">Planned</option>
                    <option value="construction">Construction</option>
                    <option value="operational">Operational</option>
                  </select>
                </label>
                <button className="primary-button" disabled={busy}>
                  Save asset
                </button>
              </form>
            )}
          </details>

          <details className="workspace-card">
            <summary>
              <Plus /> Add capacity evidence
            </summary>
            {!nodes.length ? (
              <p className="form-hint">Add a node first.</p>
            ) : (
              <form className="activation-form" onSubmit={addSnapshot}>
                <label>
                  Node
                  <select name="node_id" required>
                    {nodes.map((node) => (
                      <option value={node.id} key={node.id}>
                        {node.node_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Evidence kind
                  <select name="capacity_kind">
                    <option value="screening_estimate">Screening estimate</option>
                    <option value="engineering_result">Engineering result</option>
                    <option value="operator_statement">
                      Operator statement (unconfirmed until sourced)
                    </option>
                  </select>
                </label>
                <label>
                  Firm import (MW)
                  <input name="firm_import_mw" type="number" min="0" step="0.1" />
                </label>
                <label>
                  Conditional import (MW)
                  <input name="conditional_import_mw" type="number" min="0" step="0.1" />
                </label>
                <label>
                  Firm export (MW)
                  <input name="firm_export_mw" type="number" min="0" step="0.1" />
                </label>
                <label>
                  Conditional export (MW)
                  <input name="conditional_export_mw" type="number" min="0" step="0.1" />
                </label>
                <label>
                  Network state
                  <select name="network_state">
                    <option value="unknown">Unknown</option>
                    <option value="normal">Normal</option>
                    <option value="n_1">N-1</option>
                    <option value="constrained">Constrained</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </label>
                <label>
                  Method version
                  <input name="methodology_version" placeholder="e.g. screening-1.0" />
                </label>
                <label>
                  Notes
                  <textarea name="notes" />
                </label>
                <button className="primary-button" disabled={busy}>
                  Save new version
                </button>
              </form>
            )}
          </details>

          <details className="workspace-card">
            <summary>
              <Plus /> Register study run
            </summary>
            {!nodes.length ? (
              <p className="form-hint">Add a node first.</p>
            ) : (
              <form className="activation-form" onSubmit={addStudy}>
                <label>
                  Study name
                  <input name="study_name" required />
                </label>
                <label>
                  Node
                  <select name="node_id">
                    <option value="">Project-wide</option>
                    {nodes.map((node) => (
                      <option value={node.id} key={node.id}>
                        {node.node_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Study type
                  <select name="study_type">
                    <option value="screening">Screening</option>
                    <option value="load_flow">Load flow</option>
                    <option value="n_1">N-1</option>
                    <option value="short_circuit">Short circuit</option>
                    <option value="fca_envelope">FCA envelope</option>
                  </select>
                </label>
                <label>
                  Model
                  <input name="model_name" required placeholder="Model or workbook name" />
                </label>
                <label>
                  Model version
                  <input name="model_version" required placeholder="Immutable version" />
                </label>
                <label>
                  Input manifest (JSON)
                  <textarea name="input_manifest" placeholder={'{"profile_version": 2}'} />
                </label>
                <label>
                  Results (JSON)
                  <textarea name="results" placeholder={'{"screening_headroom_mw": 12}'} />
                </label>
                <button className="primary-button" disabled={busy}>
                  Create draft study
                </button>
              </form>
            )}
          </details>
        </div>
      ) : (
        <div className="truth-banner">
          <ShieldCheck />
          <div>
            <b>Read-only network record</b>
            <p>
              Your project role can inspect permitted node intelligence. A technical reviewer, grid
              expert, or workspace administrator must add or change engineering records.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
