export type GermanGridSource = {
  id: string;
  authority: string;
  title: string;
  url: string;
  publishedOrUpdated: string;
  evidenceClass: "official_regulatory" | "official_operator" | "official_technical";
  establishes: string[];
  doesNotEstablish: string[];
};

export const germanGridSources: GermanGridSource[] = [
  {
    id: "bnetza-fca-17-2b",
    authority: "Bundesnetzagentur",
    title: "Flexible connection agreements for storage and consumer installations",
    url: "https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/Netzanschluss/artikel.html",
    publishedOrUpdated: "2026-06-19",
    evidenceClass: "official_regulatory",
    establishes: [
      "Section 17(2b) EnWG permits static or dynamic connection limits.",
      "An FCA may be temporary until reinforcement or permanent.",
      "Co-location with storage can be covered by an FCA.",
    ],
    doesNotEstablish: [
      "A general obligation for every operator to offer an FCA.",
      "Capacity or a connection date at a specific network node.",
    ],
  },
  {
    id: "four-tso-maturity-v1-1",
    authority: "German transmission system operators",
    title: "Maturity procedure for transmission-grid connection requests, version 1.1",
    url: "https://www.netztransparenz.de/Portals/1/Dokumente/Reifegradverfahren/Vier%20U%CC%88NB%20-%20Reifegradverfahren%20-%20Verfahrensdokumentation%20V1.1.pdf",
    publishedOrUpdated: "2026-05-01",
    evidenceClass: "official_operator",
    establishes: [
      "Large-load applications are prioritised using project-maturity evidence.",
      "The first 2026 cycle closes applications on 30 June and targets responses by 30 November.",
      "An offered reservation is accepted through a realisation security of EUR 1,500/MW.",
    ],
    doesNotEstablish: [
      "That an applicant will receive capacity.",
      "The construction or energisation date after reservation.",
    ],
  },
  {
    id: "four-tso-customer-installation-proof",
    authority: "German transmission system operators",
    title: "Plant-specific compliance process for customer installations",
    url: "https://www.netztransparenz.de/de-de/%C3%9Cber-uns/Studien-und-Positionspapiere/Anlagenspezifisches-Nachweisverfahren-fu%CC%88r-Kundenanlagen-16042026",
    publishedOrUpdated: "2026-04-16",
    evidenceClass: "official_technical",
    establishes: [
      "Large customer installations may require simulation and a detailed interaction study.",
      "Cooling, UPS, generation and auxiliary systems form part of the assessed installation.",
    ],
    doesNotEstablish: ["A standard study duration or a guaranteed connection outcome."],
  },
  {
    id: "nrm-pro-rata-electricity",
    authority: "NRM Netzdienste Rhein-Main",
    title: "Pro-rata allocation procedure for electricity connection capacity",
    url: "https://www.nrm-netzdienste.de/de/netzanschluss/pro-rata-verfahren-strom",
    publishedOrUpdated: "2026-07-01",
    evidenceClass: "official_operator",
    establishes: [
      "Frankfurt-area requests from 3.5 MW are generally considered in an annual node-level allocation.",
      "Available capacity is allocated proportionally when total requests exceed it.",
    ],
    doesNotEstablish: ["Capacity at a particular Frankfurt node before the allocation decision."],
  },
  {
    id: "stromnetz-berlin-repartition",
    authority: "Stromnetz Berlin",
    title: "Repartition procedure for large connection requests",
    url: "https://www.stromnetz.berlin/anschliessen/anschluss-mittel-hochspannung/repartierung/",
    publishedOrUpdated: "2026-07-01",
    evidenceClass: "official_operator",
    establishes: [
      "Requests above 3.5 MVA participate in proportional allocation when capacity is limited.",
    ],
    doesNotEstablish: [
      "Capacity, allocation share or energisation timing for an individual project.",
    ],
  },
];

export const germanGridEvidenceGaps = [
  "No authoritative nationwide data-centre connection-time average.",
  "No public node-by-node map of firm or conditional import capacity.",
  "No published German data-centre FCA pilot with measured connection-time savings.",
  "No standard national compensation model for accepting a non-firm connection.",
];
