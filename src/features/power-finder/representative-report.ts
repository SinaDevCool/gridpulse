import { isFinderMvp } from "../../config/product-mode";
import {
  activationStatusLabel,
  calculateRepresentativeCommercialValue,
  createActivationStudyContext,
} from "./activation-study";
import type { CandidateOpportunity } from "./candidate-intelligence";
import type { FinderProject } from "./finder-project";
const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
export function writeRepresentativeReport(
  project: FinderProject,
  candidate: CandidateOpportunity,
  writer: {
    subsection(label: string): void;
    paragraph(text: string): void;
    keyValueGrid(items: Array<[string, unknown]>, columns?: number): void;
  },
) {
  const { subsection, paragraph, keyValueGrid } = writer;
  if (!isFinderMvp()) {
    const activation = createActivationStudyContext({
      project,
      candidate,
      registeredStudy: null,
    });
    const recommended = activation.recommendedOption;
    subsection("Representative activation pathway");
    if (recommended) {
      keyValueGrid([
        ["Leading pathway", recommended.title],
        ["Strategy", activationStatusLabel(recommended.operationalStatus)],
        [
          "Initial / eventual",
          `${number.format(recommended.initialImportMw)} / ${number.format(recommended.eventualImportMw)} MW`,
        ],
        [
          "Demand served",
          `${recommended.analysis?.demandServedPercent ?? "Unavailable"}%`,
        ],
        [
          "Restricted hours",
          recommended.analysis?.restrictedHours ?? "Unavailable",
        ],
        [
          "Residual energy",
          `${recommended.analysis?.residualUnservedMwh ?? "Unavailable"} MWh`,
        ],
      ]);
      paragraph(`Next validation action: ${recommended.nextAction}`);
    } else paragraph("No representative pathway is established.");

    const commercial = calculateRepresentativeCommercialValue(activation);
    subsection("Commercial sensitivity - representative only");
    keyValueGrid(
      [
        ["Low", money.format(commercial.lowIndicativeValueEur)],
        ["Base", money.format(commercial.netIndicativeValueEur)],
        ["High", money.format(commercial.highIndicativeValueEur)],
      ],
      3,
    );
    paragraph(commercial.boundary);
  }
}
