/* Publisher byte hashes verified on 28 October 2026; editorial review is not engineering approval. */
export const reportProvenance: Record<
  string,
  {
    sourceContentHash: string;
    pdfPages: number[];
    revision: string;
    reviewedAt: string;
    reviewer: string;
    requiredInputs: string[];
    supportedActionIds: string[];
  }
> = {
  A01: {
    sourceContentHash:
      "c6e2ff10d1d49eca413f3e9bba8eaec8ac571f302fa983b58b597a99c0aa350d",
    pdfPages: [13],
    revision: "2026-10-28.1",
    reviewedAt: "2026-10-28",
    reviewer: "application_editorial_review_not_engineering_approval",
    requiredInputs: [
      "precommitted baseline",
      "activation timestamps",
      "meter coverage",
    ],
    supportedActionIds: ["review_measurements"],
  },
  A02: {
    sourceContentHash:
      "0f80fd2fd0ec201a2e681e4c10e7fe41bc5f44d5c2b1bc1af420d010f483ecbe",
    pdfPages: [6],
    revision: "2026-10-28.1",
    reviewedAt: "2026-10-28",
    reviewer: "application_editorial_review_not_engineering_approval",
    requiredInputs: ["model boundary", "forecast horizon", "assumptions"],
    supportedActionIds: ["review_measurements"],
  },
  A03: {
    sourceContentHash:
      "ba42dc7a2419715f58881197877a26d642f62cc603142df9c3ff0bb3d26f51cc",
    pdfPages: [8],
    revision: "2026-10-28.1",
    reviewedAt: "2026-10-28",
    reviewer: "application_editorial_review_not_engineering_approval",
    requiredInputs: [
      "useful work",
      "hardware configuration",
      "measured power and throughput",
    ],
    supportedActionIds: ["review_measurements"],
  },
  A04: {
    sourceContentHash:
      "5f254ffb2bc4a441f34fba0005086ff357d4c60ca7b3004f1544b4b560a1ad5e",
    pdfPages: [12, 44],
    revision: "2026-10-28.1",
    reviewedAt: "2026-10-28",
    reviewer: "application_editorial_review_not_engineering_approval",
    requiredInputs: [
      "scenario horizon",
      "computational-capacity assumptions",
      "sensitivity ranges",
    ],
    supportedActionIds: ["review_measurements"],
  },
  A05: {
    sourceContentHash:
      "6eb5474cc07c8fdf88a481eb6eea2d82a5f1ee430c028e61dd6a9b46c8b46158",
    pdfPages: [2],
    revision: "2026-10-28.1",
    reviewedAt: "2026-10-28",
    reviewer: "application_editorial_review_not_engineering_approval",
    requiredInputs: [
      "measurement period",
      "IT versus infrastructure boundary",
      "independent label assessment",
    ],
    supportedActionIds: ["review_measurements"],
  },
  B01: {
    sourceContentHash:
      "0e3db5066ad3be192f1bf6b8e39ddf8fe4825ac3e35cf4c27cae66a2181fdee6",
    pdfPages: [1],
    revision: "2026-10-28.1",
    reviewedAt: "2026-10-28",
    reviewer: "application_editorial_review_not_engineering_approval",
    requiredInputs: [
      "aggregator agreement",
      "product terms",
      "verified delivery evidence",
    ],
    supportedActionIds: ["review_measurements"],
  },
  B02: {
    sourceContentHash:
      "5e3e143d1d500cf71bc8f1a7e6522d298d5951674208c043178430b8f55b328e",
    pdfPages: [6, 9],
    revision: "2026-10-28.1",
    reviewedAt: "2026-10-28",
    reviewer: "application_editorial_review_not_engineering_approval",
    requiredInputs: [
      "protocol version",
      "device semantics",
      "permissions and acknowledgements",
    ],
    supportedActionIds: ["review_measurements"],
  },
  B03: {
    sourceContentHash:
      "f65392b8a1a06b24c883714525da4ba6db3b244b32918bee8d3856bb0165e5e6",
    pdfPages: [3],
    revision: "2026-10-28.1",
    reviewedAt: "2026-10-28",
    reviewer: "application_editorial_review_not_engineering_approval",
    requiredInputs: [
      "equivalent service",
      "test conditions",
      "measurement method",
    ],
    supportedActionIds: ["review_measurements"],
  },
  B04: {
    sourceContentHash:
      "d73ebf4590daddc2ebd0247e0b4f0f4a28bdd973ee6fe1a80249be66e37abd25",
    pdfPages: [4, 28, 29],
    revision: "2026-10-28.1",
    reviewedAt: "2026-10-28",
    reviewer: "application_editorial_review_not_engineering_approval",
    requiredInputs: [
      "cooling topology",
      "heat-rejection path",
      "IT and cooling power",
      "ambient operating range",
    ],
    supportedActionIds: ["review_measurements"],
  },
  B05: {
    sourceContentHash:
      "ca8cb1bb558653ac333663f55114f73234ae508c270f634acef70a9ec85ce444",
    pdfPages: [10, 17, 20, 25, 26],
    revision: "2026-10-28.1",
    reviewedAt: "2026-10-28",
    reviewer: "application_editorial_review_not_engineering_approval",
    requiredInputs: [
      "tenant and SLA authority",
      "backup obligations",
      "response duration and recovery",
      "commercial terms",
    ],
    supportedActionIds: ["review_measurements"],
  },
};
