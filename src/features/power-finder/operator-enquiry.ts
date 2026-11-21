import type { CandidateOpportunity } from "./candidate-intelligence";
import { projectOperatorQuestions, type FinderProject } from "./finder-project";

export function buildGermanOperatorEnquiry(
  project: FinderProject,
  candidate: CandidateOpportunity,
) {
  return [
    `Indicative connection enquiry: ${project.name}`,
    `Declared location: ${project.latitude ?? "unknown"}, ${project.longitude ?? "unknown"}`,
    `Initial / ultimate import: ${project.importMw} / ${project.ultimateImportMw} MW; export: ${project.exportMw} MW`,
    `Target year: ${project.targetEnergisationYear}; supply arrangement: ${project.redundancy}`,
    `Mapped asset for investigation: ${candidate.nodeName}; mapped operator: ${candidate.operator ?? "unverified"}`,
    candidate.suitabilityNote ?? "Connection role and responsibility remain unverified.",
    ...projectOperatorQuestions(project),
    "Please distinguish import/export limits, bay availability, reinforcement scope, validity and project-maturity requirements.",
    "Could phased supply or a flexible connection agreement be assessed, and under which restrictions?",
    "This enquiry contains declared requirements and mapping context, not an assertion of capacity or third-party access.",
  ].join("\n\n");
}
