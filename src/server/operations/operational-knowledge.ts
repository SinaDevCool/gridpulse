/** Server-owned, curated public summaries. No customer documents or runtime web fetching. */
export const operationalKnowledge = [
  {
    "id": "battery-energy",
    "title": "Battery power, energy and reserve",
    "terms": [
      "battery",
      "bess",
      "soc",
      "reserve",
      "capacity",
      "discharge",
      "charge",
      "risk",
      "readiness",
      "review",
      "batterie",
      "speicher"
    ],
    "text": "Battery MW limits instantaneous response; MWh and conversion losses limit its duration. Review the full SOC trajectory, protected reserve and terminal target. Modelled compliance does not establish measured capacity or backup autonomy.",
    "source": "https://docs.nlr.gov/docs/fy24osti/87546.pdf",
    "section": "Battery performance evaluation",
    "applicability": "Battery energy storage; use equipment-specific limits for operation.",
    "version": "2026-10-26",
    "reviewStatus": "editorial_guidance",
    "license": "Linked reference; independently authored summary. No redistribution of source document."
  },
  {
    "id": "pue-boundary",
    "title": "PUE and measurement boundaries",
    "terms": [
      "pue",
      "overhead",
      "facility",
      "efficiency",
      "metering"
    ],
    "text": "Compare facility and IT energy over the same period and boundary. PUE alone does not locate a loss or establish cooling efficiency. In GridPulse component accounting it is reference-only; multiplying component loads by PUE again double-counts overhead.",
    "source": "https://www.energy.gov/cmei/femp/articles/best-practices-guide-energy-efficient-data-center-design",
    "section": "Energy metrics and facility systems",
    "applicability": "Component-accounted data-centre assessments.",
    "version": "2026-10-26",
    "reviewStatus": "editorial_guidance",
    "license": "Linked reference; independently authored summary. No redistribution of source document."
  },
  {
    "id": "workload-service",
    "title": "Workload completion and protected services",
    "terms": [
      "workload",
      "deadline",
      "completion",
      "queue",
      "restart",
      "checkpoint",
      "job",
      "training",
      "inference"
    ],
    "text": "Review deadlines, runtime, interruption/restart restrictions and protected inference together. Scheduling eligibility does not prove completion. Confirm real workload requirements and scheduler behaviour before applying a modelled schedule.",
    "source": "https://kueue.sigs.k8s.io/docs/concepts/workload/",
    "section": "Workload lifecycle",
    "applicability": "Scheduler semantics; not evidence of site execution.",
    "version": "2026-10-26",
    "reviewStatus": "editorial_guidance",
    "license": "Linked reference; independently authored summary. No redistribution of source document."
  },
  {
    "id": "solver-validity",
    "title": "Feasibility and optimality",
    "terms": [
      "optimal",
      "feasible",
      "solver",
      "gap",
      "risk",
      "review",
      "tradeoff"
    ],
    "text": "A feasible incumbent can satisfy model restrictions without proven optimality. Inspect solver termination, reported gap and physical replay. The optimum is conditional on the supplied objective, forecasts and constraints.",
    "source": "https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.milp.html",
    "section": "Termination status and MIP gap",
    "applicability": "Mixed-integer optimisation results.",
    "version": "2026-10-26",
    "reviewStatus": "editorial_guidance",
    "license": "Linked reference; independently authored summary. No redistribution of source document."
  },
  {
    "id": "metering-readiness",
    "title": "Measurements needed for operational review",
    "terms": [
      "measurement",
      "measured",
      "telemetry",
      "missing",
      "readiness",
      "approval",
      "verify",
      "meter",
      "evidence",
      "data"
    ],
    "text": "Check PCC import, battery AC power and SOC, IT/GPU power and workload execution with aligned timestamps, units and availability cutoffs. Establish measurement boundaries and calibration. Missing measurements remain evidence gaps; synthetic replay does not fill them.",
    "source": "https://betterbuildingssolutioncenter.energy.gov/resources/data-center-metering-and-resource-guide",
    "section": "Metering and resource guide",
    "applicability": "Site-specific measurement review required.",
    "version": "2026-10-26",
    "reviewStatus": "editorial_guidance",
    "license": "Linked reference; independently authored summary. No redistribution of source document."
  },
  {
    "id": "gpu-telemetry",
    "title": "GPU telemetry and facility load",
    "terms": [
      "gpu",
      "dcgm",
      "utilisation",
      "utilization",
      "accelerator",
      "watts",
      "power"
    ],
    "text": "GPU metrics describe devices, not the whole facility. Reconcile measured device power, idle consumption and workload timing; account separately for networking, storage, cooling and electrical losses. GPU utilisation is not a direct measurement of facility demand.",
    "source": "https://docs.nvidia.com/datacenter/dcgm/latest/reference/dcgm-exporter-metrics.html",
    "section": "DCGM exporter metrics",
    "applicability": "NVIDIA device telemetry; verify metric units and sampling.",
    "version": "2026-10-26",
    "reviewStatus": "editorial_guidance",
    "license": "Linked reference; independently authored summary. No redistribution of source document."
  },
  {
    "id": "cooling-validity",
    "title": "Cooling model limitations",
    "terms": [
      "cooling",
      "thermal",
      "temperature",
      "heat",
      "ambient",
      "risk"
    ],
    "text": "Facility cooling power and rack inlet temperature are different quantities. A simplified electrical cooling model cannot establish local thermal safety. Use measured cooling power and ambient conditions for calibration; validate temperatures and site operating procedures separately.",
    "source": "https://www.energy.gov/cmei/femp/articles/best-practices-guide-energy-efficient-data-center-design",
    "section": "Environmental conditions and cooling",
    "applicability": "No rack-temperature safety inference from aggregate MW.",
    "version": "2026-10-26",
    "reviewStatus": "editorial_guidance",
    "license": "Linked reference; independently authored summary. No redistribution of source document."
  },
  {
    "id": "accounting-tariff",
    "title": "Tariff accounting versus cost optimisation",
    "terms": [
      "cost",
      "tariff",
      "price",
      "electricity",
      "euro",
      "eur",
      "bill",
      "savings"
    ],
    "text": "Pricing an unchanged schedule requires interval energy and an applicable tariff, not another optimisation. Finding a cheaper schedule requires a new objective and solve. Market prices alone are not a retail bill; demand-charge periods, network fees, taxes and export treatment require explicit rules.",
    "source": "https://www.smard.de/home/datennutzung",
    "section": "Market-data use",
    "applicability": "Market reference; not a site tariff or full bill.",
    "version": "2026-10-26",
    "reviewStatus": "editorial_guidance",
    "license": "Linked reference; independently authored summary. No redistribution of source document."
  },
  {
    "id": "stress-boundary",
    "title": "Fixed-plan stress versus re-optimisation",
    "terms": [
      "stress",
      "sensitivity",
      "outage",
      "alternative",
      "half",
      "availability",
      "reduction"
    ],
    "text": "Fixed-plan replay asks whether accepted commands still satisfy checks under changed conditions. Re-optimisation searches for a different plan. Keep these results separate and retain baseline identity. Assumed stress cases do not provide calibrated failure probabilities.",
    "source": "https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.milp.html",
    "section": "Optimisation under supplied constraints",
    "applicability": "GridPulse tool semantics; qualitative interpretation.",
    "version": "2026-10-26",
    "reviewStatus": "editorial_guidance",
    "license": "Linked reference; independently authored summary. No redistribution of source document."
  },
  {
    "id": "calibration-evidence",
    "title": "Calibration and held-out validation",
    "terms": [
      "calibration",
      "uncertainty",
      "accuracy",
      "dataset",
      "historical",
      "backtest",
      "prediction"
    ],
    "text": "Split training, validation and test executions by time and identity. Record source, units, transformations and operating range. Public workload traces help test scheduling, but cannot calibrate a particular facility without corresponding site measurements.",
    "source": "https://github.com/alibaba/clusterdata",
    "section": "Cluster trace datasets",
    "applicability": "Research reference, not site calibration.",
    "version": "2026-10-26",
    "reviewStatus": "editorial_guidance",
    "license": "Linked reference; independently authored summary. No redistribution of source document."
  }
] as const;

/** Report provenance is guidance, never a calibration parameter or dispatch permission. */
const reportKnowledge = [
  {
    id: "edna-liquid-cooling", title: "Cooling topology and total energy",
    terms: ["liquid", "cooling", "immersion", "retrofit", "topology", "direct"],
    text: "Compare server and facility energy together when assessing liquid cooling; PUE can obscure improvements that move energy across those boundaries. Identify the cooling topology and retrofit constraints before estimating savings. Report-wide savings are not a site-specific prediction.",
    source: "https://www.iea-4e.org/edna/publications/liquid-cooling-in-data-centres/",
    section: "Technology and efficiency scope", sourceId: "B04",
    evidenceClass: "report_guidance", excludedUses: ["ai_workload_savings_calibration", "rack_temperature_safety", "automatic_retrofit_savings"],
    applicability: "Qualitative topology review. The report's non-AI quantitative model is not a calibrated AI facility model; Table 4 totals require reconciliation.",
    version: "2026-10-27", reviewStatus: "editorial_guidance", license: "Independently authored summary; source copyright retained."
  },
  {
    id: "edna-server-performance", title: "Match efficiency to the actual workload",
    terms: ["benchmark", "server", "throughput", "sert", "gpu", "calibration"],
    text: "Server efficiency depends on hardware, workload, performance metric and system boundary. Keep useful work, elapsed time and measured power together. Hardware ratings or broad benchmark trends cannot replace held-out measurements of the model, batch size and configuration used at the site.",
    source: "https://www.iea-4e.org/wp-content/uploads/2025/05/EDNA-EE-of-servers-FINAL.pdf",
    section: "Executive summary and benchmark scope", sourceId: "A03",
    evidenceClass: "report_guidance", excludedUses: ["site_calibration", "gpu_rating_as_measured_draw"],
    applicability: "Workload-specific benchmarking design; do not compare unlike performance units.",
    version: "2026-10-27", reviewStatus: "editorial_guidance", license: "Independently authored summary; source copyright retained."
  },
  {
    id: "edna-estimate-boundaries", title: "Separate sector estimates from site evidence",
    terms: ["forecast", "projection", "sector", "estimate", "uncertainty", "dataset"],
    text: "Data-centre energy estimates depend on model scope, boundaries and assumptions. Report the source and horizon of an estimate, and keep it separate from a facility measurement or an optimiser result. Use site measurements to qualify local decisions rather than transferring a sector projection directly.",
    source: "https://www.iea-4e.org/wp-content/uploads/2025/05/Data-Centre-Energy-Use-Critical-Review-of-Models-and-Results.pdf",
    section: "Objectives and scope", sourceId: "A02",
    evidenceClass: "report_guidance", excludedUses: ["site_calibration", "operational_forecast"],
    applicability: "Research methodology; not an operational demand profile.",
    version: "2026-10-27", reviewStatus: "editorial_guidance", license: "Independently authored summary; source copyright retained."
  },
  {
    id: "edna-tem-scope", title: "Long-term scenarios are not dispatch models",
    terms: ["tem", "policy", "long", "projection", "consolidation"],
    text: "TEM models computational capacity, efficiency and market segments for long-term policy scenarios. Its sensitivity approach helps organise assumptions, but its trajectories do not establish a site's quarter-hour dispatch, workload duration or available battery energy.",
    source: "https://www.iea-4e.org/publications/edna/total-energy-model-4-0-data-centres/",
    section: "Model purpose and methodology", sourceId: "A04",
    evidenceClass: "report_guidance", excludedUses: ["dispatch_calibration", "workload_runtime_prediction"],
    applicability: "Long-term scenario framing only.",
    version: "2026-10-27", reviewStatus: "editorial_guidance", license: "Independently authored summary; source copyright retained."
  },
  {
    id: "edna-usable-flexibility", title: "Usable flexibility needs operational permission",
    terms: ["flexibility", "commercial", "permission", "revenue", "participation", "market"],
    text: "Technical flexibility is not automatically available to a market or grid service. Check workload permissions, service obligations, reserve requirements, event timing and commercial terms together. A modelled schedule does not establish an offer or delivered response.",
    source: "https://www.iea-4e.org/edna/publications/data-centres-and-flexibility/",
    section: "Abstract and scope", sourceId: "B05", pdfPages: [3],
    evidenceClass: "report_guidance", excludedUses: ["site_calibration", "dispatch_authorisation", "failure_probability"],
    applicability: "Qualitative data-centre flexibility assessment; site and service-specific qualification remains necessary.",
    version: "2026-10-27", reviewStatus: "editorial_guidance",
    license: "Independently authored summary; source copyright retained."
  },
  {
    id: "edna-protocol-scope", title: "Protocol connectivity is not dispatch readiness",
    terms: ["protocol", "openadr", "eebus", "matter", "connector", "integration"],
    text: "The protocol review concerns residential demand flexibility. Its interoperability lessons help structure integrations, but it does not qualify a data-centre BMS, PCS or scheduler. Verify device semantics, authorisation, acknowledgements and delivered-response evidence separately.",
    source: "https://www.iea-4e.org/wp-content/uploads/2026/06/2026-EDNA-DEMAND-FLEXIBILITY-PROTOCOLS-WEB.pdf",
    section: "Executive summary", sourceId: "B02", pdfPages: [6, 9],
    evidenceClass: "report_guidance", excludedUses: ["data_centre_protocol_certification", "dispatch_authorisation"],
    applicability: "Residential protocol research; architecture guidance only for data-centre integrations.",
    version: "2026-10-27", reviewStatus: "editorial_guidance",
    license: "Independently authored summary; source copyright retained."
  }
] as const;
export const reviewedKnowledge = [...operationalKnowledge, ...reportKnowledge];
const tokens = (text: string) => [...new Set(text.toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]+/gu) ?? [])];
export function retrieveOperationalKnowledge(question: string) {
  const words = tokens(question);
  return reviewedKnowledge.map(item => ({ item, score: words.reduce((sum, word) =>
    sum + (item.terms.some(term => word === term || (term.length >= 5 && word.startsWith(term))) ? 1 : 0), 0) }))
    .filter(entry => entry.score > 0).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, 4).map(({ item: { terms: _terms, ...reference } }) => reference);
}
