// Seed data for GridPulse MVP. Schema mirrors the planned Postgres tables so
// we can swap this for live scraped data without changing the UI.

export type ArticleCategory =
  | "breaking"
  | "analysis"
  | "deals"
  | "policy"
  | "technology"
  | "safety"
  | "markets";

export interface Article {
  id: string;
  headline: string;
  summary: string;
  whyItMatters: string;
  category: ArticleCategory;
  source: { name: string; domain: string };
  author: string;
  publishedAt: string; // ISO
  readMinutes: number;
  verified: boolean;
  tags: string[];
  region: string;
  isBreaking?: boolean;
  alsoReportedBy?: string[];
}

export interface Project {
  id: string;
  name: string;
  developer: string;
  capacityMw: number;
  capacityMwh: number;
  technology: string;
  location: string;
  status: "Permitting" | "Construction" | "Commissioning" | "Operational";
  cod: string;
}

export interface TickerItem {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
}

export const tickerItems: TickerItem[] = [
  { label: "GLOBAL BESS", value: "412.8 GWh", delta: "+18.4% YoY", positive: true },
  { label: "Q3 ADDITIONS US", value: "9.2 GW", delta: "+62% QoQ", positive: true },
  { label: "AVG $/kWh (DC)", value: "$138", delta: "-11% YoY", positive: true },
  { label: "TSLA", value: "$268.41", delta: "+1.24%", positive: true },
  { label: "FLNC", value: "$22.07", delta: "-0.86%", positive: false },
  { label: "CATL (300750)", value: "¥248.30", delta: "+2.11%", positive: true },
  { label: "BYD (1211)", value: "HK$284.40", delta: "+0.74%", positive: true },
  { label: "ERCOT BESS QUEUE", value: "147 GW", delta: "+9 GW MoM", positive: true },
  { label: "CAISO BESS ONLINE", value: "13.4 GW", delta: "+420 MW MoM", positive: true },
  { label: "LFP CELL", value: "$58/kWh", delta: "-6% QoQ", positive: true },
];

export const heroStats = [
  { label: "Global operational capacity", value: "412.8", unit: "GWh", delta: "+18.4% YoY" },
  { label: "2026 pipeline coming online", value: "243", unit: "GW", delta: "Tracked across 41 markets" },
  { label: "Avg utility-scale system cost", value: "$138", unit: "/kWh DC", delta: "-11% YoY" },
];

export const articles: Article[] = [
  {
    id: "a1",
    headline: "Fluence books 4.2 GWh Saudi mega-order, its largest contract to date",
    summary:
      "The Siemens-backed integrator will supply Gridstack Pro systems to a portfolio of PIF-backed projects under a multi-year master supply agreement, with first deliveries in Q2 2026.",
    whyItMatters:
      "Cements the Gulf as the third major BESS theatre after the US and China, and validates Fluence's pivot to long-duration LFP.",
    category: "deals",
    source: { name: "Energy-Storage.news", domain: "energy-storage.news" },
    author: "Andy Colthorpe",
    publishedAt: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
    readMinutes: 4,
    verified: true,
    tags: ["Fluence", "Saudi Arabia", "LFP", "Supply Agreement"],
    region: "MENA",
    isBreaking: true,
    alsoReportedBy: ["Reuters", "PV Magazine"],
  },
  {
    id: "a2",
    headline: "ERCOT clears 3.1 GW of new battery storage in November queue update",
    summary:
      "Texas added 3,114 MW / 8,890 MWh of standalone storage to its interconnection queue last month, with 71% co-located alongside solar in the Permian Basin.",
    whyItMatters:
      "ERCOT remains the price-setter for US merchant BESS economics — queue growth points to continued downward pressure on ancillary service revenues into 2027.",
    category: "markets",
    source: { name: "EIA", domain: "eia.gov" },
    author: "GridPulse Data Desk",
    publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    readMinutes: 6,
    verified: true,
    tags: ["ERCOT", "Texas", "Interconnection", "Merchant"],
    region: "North America",
  },
  {
    id: "a3",
    headline: "FERC approves Order 1920-A, locking in long-term BESS transmission planning",
    summary:
      "Commissioners unanimously voted to finalize amendments requiring storage-as-transmission scenarios in 20-year regional plans, with first compliance filings due July 2026.",
    whyItMatters:
      "Turns long-duration storage from an optional resource into a mandatory line item in every US RTO planning cycle.",
    category: "policy",
    source: { name: "FERC", domain: "ferc.gov" },
    author: "Maria Gallucci",
    publishedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    readMinutes: 7,
    verified: true,
    tags: ["FERC", "Transmission", "LDES", "IRA"],
    region: "North America",
  },
  {
    id: "a4",
    headline: "CATL unveils second-gen sodium-ion cell with 200 Wh/kg, claims grid parity by 2027",
    summary:
      "Naxtra 2.0 packs hit 200 Wh/kg at the cell level and target a $40/kWh bill of materials, with pilot deployments at two Chinese utility sites in H1 2026.",
    whyItMatters:
      "If validated, sodium-ion finally has the energy density to challenge LFP for 4-hour grid duty in cold climates — without lithium exposure.",
    category: "technology",
    source: { name: "Bloomberg NEF", domain: "about.bnef.com" },
    author: "David Stringer",
    publishedAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    readMinutes: 5,
    verified: true,
    tags: ["CATL", "Sodium-Ion", "Naxtra", "China"],
    region: "APAC",
  },
  {
    id: "a5",
    headline: "Moss Landing post-mortem: Cal Fire cites thermal runaway propagation across racks",
    summary:
      "A 91-page report concludes the January incident propagated through 14 rack rows over 6 hours; recommends 3-meter aisle spacing and mandatory aerosol suppression for new NMC sites.",
    whyItMatters:
      "Sets a likely template for NFPA 855 revisions and could push California developers toward LFP-only procurement for permits filed after Q1 2026.",
    category: "safety",
    source: { name: "Cal Fire", domain: "fire.ca.gov" },
    author: "Julian Spector",
    publishedAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    readMinutes: 9,
    verified: true,
    tags: ["Moss Landing", "Safety", "NMC", "NFPA 855"],
    region: "North America",
  },
  {
    id: "a6",
    headline: "Powin files Chapter 11, signals asset sale to strategic buyer",
    summary:
      "The Oregon-based integrator listed $1.1B in liabilities and 2.4 GWh of contracted but undelivered backlog; bondholders are reportedly in talks with two Asian OEMs.",
    whyItMatters:
      "Marks the first major US integrator failure of the post-IRA era and stress-tests counterparty risk frameworks for project finance lenders.",
    category: "breaking",
    source: { name: "SEC EDGAR", domain: "sec.gov" },
    author: "Andy Colthorpe",
    publishedAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString(),
    readMinutes: 6,
    verified: true,
    tags: ["Powin", "Restructuring", "Integrators", "Risk"],
    region: "North America",
    isBreaking: true,
  },
  {
    id: "a7",
    headline: "UK awards 2.8 GW of long-duration storage in inaugural cap-and-floor round",
    summary:
      "Ofgem named 12 winning projects spanning lithium, flow, and compressed air, with strike-price floors of £55/MWh indexed to wholesale spreads.",
    whyItMatters:
      "First revenue stabilisation mechanism in Europe specifically for 6+ hour duration — gives flow and CAES projects a viable bankability path.",
    category: "policy",
    source: { name: "Ofgem", domain: "ofgem.gov.uk" },
    author: "Molly Lempriere",
    publishedAt: new Date(Date.now() - 27 * 60 * 60 * 1000).toISOString(),
    readMinutes: 5,
    verified: true,
    tags: ["UK", "LDES", "Cap and Floor", "Ofgem"],
    region: "Europe",
  },
  {
    id: "a8",
    headline: "Analysis: $/kWh for utility-scale BESS could break $100 before 2027",
    summary:
      "BNEF, Wood Mac, and Clean Energy Associates now converge on a sub-$110/kWh DC system price by Q4 2026, driven by Chinese LFP cell overcapacity and falling EPC margins.",
    whyItMatters:
      "Breaks the psychological barrier that has gated peaker-replacement economics in PJM, MISO, and Southeast US.",
    category: "analysis",
    source: { name: "Wood Mackenzie", domain: "woodmac.com" },
    author: "Allison Weis",
    publishedAt: new Date(Date.now() - 31 * 60 * 60 * 1000).toISOString(),
    readMinutes: 11,
    verified: true,
    tags: ["Pricing", "LFP", "BNEF", "Peakers"],
    region: "Global",
  },
];

export const upcomingProjects: Project[] = [
  {
    id: "p1",
    name: "Crimson Storage Phase II",
    developer: "Recurrent Energy",
    capacityMw: 350,
    capacityMwh: 1400,
    technology: "LFP",
    location: "Riverside County, CA",
    status: "Construction",
    cod: "Q2 2026",
  },
  {
    id: "p2",
    name: "Waratah Super Battery",
    developer: "Akaysha Energy",
    capacityMw: 850,
    capacityMwh: 1680,
    technology: "LFP",
    location: "New South Wales, AU",
    status: "Commissioning",
    cod: "Q1 2026",
  },
  {
    id: "p3",
    name: "Highview Carrington",
    developer: "Highview Power",
    capacityMw: 50,
    capacityMwh: 300,
    technology: "Liquid Air",
    location: "Manchester, UK",
    status: "Construction",
    cod: "Q4 2026",
  },
  {
    id: "p4",
    name: "Permian Basin BESS",
    developer: "Engie North America",
    capacityMw: 600,
    capacityMwh: 2400,
    technology: "LFP",
    location: "Reeves County, TX",
    status: "Permitting",
    cod: "Q3 2027",
  },
  {
    id: "p5",
    name: "Hokkaido Grid Reserve",
    developer: "TEPCO Renewable Power",
    capacityMw: 240,
    capacityMwh: 720,
    technology: "Sodium-Ion",
    location: "Tomakomai, JP",
    status: "Construction",
    cod: "Q2 2026",
  },
];

export const trendingTopics = [
  { tag: "LFP", weight: 5 },
  { tag: "Grid-Forming", weight: 4 },
  { tag: "LDES", weight: 4 },
  { tag: "IRA", weight: 3 },
  { tag: "FEOC", weight: 3 },
  { tag: "ERCOT", weight: 5 },
  { tag: "Sodium-Ion", weight: 4 },
  { tag: "Co-Located Solar", weight: 3 },
  { tag: "Capacity Market", weight: 2 },
  { tag: "NFPA 855", weight: 3 },
  { tag: "CATL", weight: 4 },
  { tag: "Tariffs", weight: 3 },
];

export const marketRegions = [
  { name: "North America", gw: 168, pct: 41 },
  { name: "China", gw: 142, pct: 34 },
  { name: "Europe", gw: 58, pct: 14 },
  { name: "APAC ex-China", gw: 32, pct: 8 },
  { name: "ROW", gw: 13, pct: 3 },
];

export const categoryStyles: Record<ArticleCategory, { label: string; className: string }> = {
  breaking:   { label: "BREAKING",   className: "bg-red-accent/15 text-red-accent border-red-accent/40" },
  analysis:   { label: "ANALYSIS",   className: "bg-cyan-accent/10 text-cyan-accent border-cyan-accent/40" },
  deals:      { label: "DEALS",      className: "bg-green-accent/10 text-green-accent border-green-accent/40" },
  policy:     { label: "POLICY",     className: "bg-amber-accent/10 text-amber-accent border-amber-accent/40" },
  technology: { label: "TECHNOLOGY", className: "bg-cyan-accent/10 text-cyan-accent border-cyan-accent/40" },
  safety:     { label: "SAFETY",     className: "bg-red-accent/10 text-red-accent border-red-accent/40" },
  markets:    { label: "MARKETS",    className: "bg-green-accent/10 text-green-accent border-green-accent/40" },
};

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
