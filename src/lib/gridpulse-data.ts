// Seed data for GridPulse. Times are stored as minute offsets so server
// and client hydration agree (timeAgo is rendered client-only via <TimeAgo/>).

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
  slug: string;
  headline: string;
  summary: string;
  content: string;
  whyItMatters: string;
  category: ArticleCategory;
  source: { name: string; domain: string };
  author: string;
  minutesAgo: number;
  readMinutes: number;
  verified: boolean;
  tags: string[];
  region: string;
  isBreaking?: boolean;
  alsoReportedBy?: string[];
  relatedProjectIds?: string[];
}

export interface Project {
  id: string;
  slug?: string;

  name: string;
  developer: string;
  capacityMw: number;
  capacityMwh: number;
  technology: string;
  location: string;
  country: string;
  region: string;
  lat: number;
  lng: number;
  status: "Permitting" | "Construction" | "Commissioning" | "Operational";
  cod: string;
  description?: string;
  owner?: string;
  operator?: string;
  chemistry?: string;
  useCase?: string;
  offtaker?: string;
  sourceUrls?: string[];
  lastVerifiedAt?: string;
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
    slug: "fluence-saudi-4-2-gwh-mega-order",
    headline: "Fluence books 4.2 GWh Saudi mega-order, its largest contract to date",
    summary:
      "The Siemens-backed integrator will supply Gridstack Pro systems to a portfolio of PIF-backed projects under a multi-year master supply agreement, with first deliveries in Q2 2026.",
    content:
      "Fluence Energy confirmed Monday it has signed a master supply agreement covering 4.2 GWh of grid-scale battery storage capacity with a portfolio of developers backed by Saudi Arabia's Public Investment Fund. The deal — Fluence's largest single-customer commitment since spinning out of AES and Siemens — will see Gridstack Pro 5000 systems delivered between Q2 2026 and the end of 2028.\n\nThe agreement spans at least six projects across the Kingdom, with the first 1.1 GWh expected to underpin a co-located solar-plus-storage site in NEOM. Pricing was not disclosed, but two sources familiar with the negotiations told GridPulse that contracted system pricing landed in the low-$130s per kWh DC, materially below the company's reported Q3 average.\n\nThe order cements the Gulf as a third major BESS theatre after the United States and China and validates Fluence's pivot to long-duration LFP architectures. It also extends a string of multi-GWh wins announced over the past six months as Saudi Arabia accelerates its Vision 2030 renewables build-out.",
    whyItMatters:
      "Cements the Gulf as the third major BESS theatre after the US and China, and validates Fluence's pivot to long-duration LFP.",
    category: "deals",
    source: { name: "Energy-Storage.news", domain: "energy-storage.news" },
    author: "Andy Colthorpe",
    minutesAgo: 38,
    readMinutes: 4,
    verified: true,
    tags: ["Fluence", "Saudi Arabia", "LFP", "Supply Agreement"],
    region: "MENA",
    isBreaking: true,
    alsoReportedBy: ["Reuters", "PV Magazine"],
  },
  {
    id: "a2",
    slug: "ercot-3-1-gw-storage-november-queue",
    headline: "ERCOT clears 3.1 GW of new battery storage in November queue update",
    summary:
      "Texas added 3,114 MW / 8,890 MWh of standalone storage to its interconnection queue last month, with 71% co-located alongside solar in the Permian Basin.",
    content:
      "The Electric Reliability Council of Texas cleared 3,114 MW (8,890 MWh) of standalone and co-located battery storage projects through its November interconnection queue, according to data released by the grid operator on Friday. The new entrants push the active queue past 147 GW of energy storage capacity — a record.\n\nRoughly 71% of the new MW are co-located with solar, with the Permian Basin and the Texas Panhandle dominating site selection. Average project size has now climbed to 248 MW / 720 MWh, up from 190 MW / 540 MWh a year ago, a sign that developers continue to scale up to capture economies of integration and shared interconnection costs.\n\nMerchant economics in ERCOT remain volatile. Average BESS revenues in West Texas fell 18% year-on-year through Q3 as ancillary service prices compressed, but operators continue to underwrite new projects against an energy-arbitrage thesis tied to growing solar penetration.",
    whyItMatters:
      "ERCOT remains the price-setter for US merchant BESS economics — queue growth points to continued downward pressure on ancillary service revenues into 2027.",
    category: "markets",
    source: { name: "EIA", domain: "eia.gov" },
    author: "GridPulse Data Desk",
    minutesAgo: 120,
    readMinutes: 6,
    verified: true,
    tags: ["ERCOT", "Texas", "Interconnection", "Merchant"],
    region: "North America",
    relatedProjectIds: ["p4"],
  },
  {
    id: "a3",
    slug: "ferc-order-1920a-bess-transmission",
    headline: "FERC approves Order 1920-A, locking in long-term BESS transmission planning",
    summary:
      "Commissioners unanimously voted to finalize amendments requiring storage-as-transmission scenarios in 20-year regional plans, with first compliance filings due July 2026.",
    content:
      "The Federal Energy Regulatory Commission voted 4-0 to finalize amendments to Order 1920 that explicitly require regional transmission organizations to model storage-as-transmission scenarios in their 20-year planning cycles. The first compliance filings are due July 2026.\n\nThe ruling instructs RTOs to evaluate at least three benefit categories for storage when planning new transmission, including avoided generation capacity, reliability benefits, and avoided congestion costs. It also obliges planners to consider the colocation of storage at existing substations as a non-wires alternative.\n\nIndustry groups including ACP and ACORE applauded the move; transmission owners signaled they would seek clarification on cost allocation between storage developers and ratepayers.",
    whyItMatters:
      "Turns long-duration storage from an optional resource into a mandatory line item in every US RTO planning cycle.",
    category: "policy",
    source: { name: "FERC", domain: "ferc.gov" },
    author: "Maria Gallucci",
    minutesAgo: 300,
    readMinutes: 7,
    verified: true,
    tags: ["FERC", "Transmission", "LDES", "IRA"],
    region: "North America",
  },
  {
    id: "a4",
    slug: "catl-naxtra-sodium-ion-200whkg",
    headline: "CATL unveils second-gen sodium-ion cell with 200 Wh/kg, claims grid parity by 2027",
    summary:
      "Naxtra 2.0 packs hit 200 Wh/kg at the cell level and target a $40/kWh bill of materials, with pilot deployments at two Chinese utility sites in H1 2026.",
    content:
      "CATL revealed its second-generation Naxtra sodium-ion cell at a closed investor day in Ningde, claiming a gravimetric energy density of 200 Wh/kg — a roughly 40% improvement over its first-generation chemistry and the first sodium-ion product to approach LFP density at the cell level.\n\nThe company said two Chinese utility partners will host pilot deployments in H1 2026, each in the 50-100 MWh range, with full commercial availability targeted for late 2026. Internal cost modeling presented to investors put the bill-of-materials at approximately $40/kWh at scale, contingent on hard-carbon anode supply ramps.\n\nIf field performance matches CATL's specs, sodium-ion will finally have the energy density to challenge LFP for 4-hour grid duty, with intrinsic advantages in cold-climate performance, fire safety, and lithium-free supply chains.",
    whyItMatters:
      "If validated, sodium-ion finally has the energy density to challenge LFP for 4-hour grid duty in cold climates — without lithium exposure.",
    category: "technology",
    source: { name: "Bloomberg NEF", domain: "about.bnef.com" },
    author: "David Stringer",
    minutesAgo: 540,
    readMinutes: 5,
    verified: true,
    tags: ["CATL", "Sodium-Ion", "Naxtra", "China"],
    region: "APAC",
    relatedProjectIds: ["p5"],
  },
  {
    id: "a5",
    slug: "moss-landing-post-mortem-cal-fire",
    headline: "Moss Landing post-mortem: Cal Fire cites thermal runaway propagation across racks",
    summary:
      "A 91-page report concludes the January incident propagated through 14 rack rows over 6 hours; recommends 3-meter aisle spacing and mandatory aerosol suppression for new NMC sites.",
    content:
      "Cal Fire released its long-awaited 91-page incident report into the January Moss Landing battery fire, concluding that thermal runaway propagated through 14 rack rows over a six-hour window and that existing rack spacing did not provide adequate firebreak.\n\nThe agency recommends a minimum 3-meter aisle spacing for new NMC installations, mandatory aerosol suppression systems, and revised emergency response protocols for first responders entering damaged BESS enclosures. The recommendations are expected to feed into the next revision of NFPA 855.\n\nCalifornia developers have already begun re-evaluating procurement strategies; two large IPPs told GridPulse they will not bid NMC chemistries into permits filed after Q1 2026.",
    whyItMatters:
      "Sets a likely template for NFPA 855 revisions and could push California developers toward LFP-only procurement for permits filed after Q1 2026.",
    category: "safety",
    source: { name: "Cal Fire", domain: "fire.ca.gov" },
    author: "Julian Spector",
    minutesAgo: 840,
    readMinutes: 9,
    verified: true,
    tags: ["Moss Landing", "Safety", "NMC", "NFPA 855"],
    region: "North America",
  },
  {
    id: "a6",
    slug: "powin-chapter-11-asset-sale",
    headline: "Powin files Chapter 11, signals asset sale to strategic buyer",
    summary:
      "The Oregon-based integrator listed $1.1B in liabilities and 2.4 GWh of contracted but undelivered backlog; bondholders are reportedly in talks with two Asian OEMs.",
    content:
      "Powin LLC filed for Chapter 11 bankruptcy protection in the District of Oregon, listing $1.1B in liabilities against $640M in assets and 2.4 GWh of contracted but undelivered backlog. The filing names two Asian battery OEMs as potential stalking-horse bidders for the company's integration business.\n\nThe failure marks the first major US integrator collapse of the post-IRA era and will stress-test counterparty risk frameworks at project finance lenders. Several utility offtakers with active Powin contracts told GridPulse they are reviewing performance bonds and contingent supply arrangements.\n\nIndustry observers say consolidation in the integrator tier is overdue: tight margins, fierce Chinese cell pricing, and rising warranty exposure have squeezed pure-play US integrators for two years.",
    whyItMatters:
      "Marks the first major US integrator failure of the post-IRA era and stress-tests counterparty risk frameworks for project finance lenders.",
    category: "breaking",
    source: { name: "SEC EDGAR", domain: "sec.gov" },
    author: "Andy Colthorpe",
    minutesAgo: 1320,
    readMinutes: 6,
    verified: true,
    tags: ["Powin", "Restructuring", "Integrators", "Risk"],
    region: "North America",
    isBreaking: true,
  },
  {
    id: "a7",
    slug: "uk-2-8gw-ldes-cap-floor",
    headline: "UK awards 2.8 GW of long-duration storage in inaugural cap-and-floor round",
    summary:
      "Ofgem named 12 winning projects spanning lithium, flow, and compressed air, with strike-price floors of £55/MWh indexed to wholesale spreads.",
    content:
      "Ofgem named 12 winning projects in the inaugural Long-Duration Electricity Storage cap-and-floor scheme, totaling 2.8 GW of capacity across lithium-ion, vanadium flow, and compressed-air technologies. Strike-price floors land at £55/MWh, indexed to wholesale spread benchmarks.\n\nThe mechanism — modeled on the UK's interconnector regime — guarantees a minimum revenue floor in exchange for capped upside, giving long-duration projects a bankable revenue profile that pure merchant exposure cannot.\n\nHighview Power and Invinity Energy Systems featured among the winners, alongside several lithium-ion incumbents. The next round is expected in early 2026.",
    whyItMatters:
      "First revenue stabilisation mechanism in Europe specifically for 6+ hour duration — gives flow and CAES projects a viable bankability path.",
    category: "policy",
    source: { name: "Ofgem", domain: "ofgem.gov.uk" },
    author: "Molly Lempriere",
    minutesAgo: 1620,
    readMinutes: 5,
    verified: true,
    tags: ["UK", "LDES", "Cap and Floor", "Ofgem"],
    region: "Europe",
    relatedProjectIds: ["p3"],
  },
  {
    id: "a8",
    slug: "kwh-system-price-sub-100-2027",
    headline: "Analysis: $/kWh for utility-scale BESS could break $100 before 2027",
    summary:
      "BNEF, Wood Mac, and Clean Energy Associates now converge on a sub-$110/kWh DC system price by Q4 2026, driven by Chinese LFP cell overcapacity and falling EPC margins.",
    content:
      "Three of the leading research houses tracking battery system pricing — BloombergNEF, Wood Mackenzie, and Clean Energy Associates — have independently converged on a sub-$110/kWh DC utility-scale BESS system price by Q4 2026, with two of the three forecasting a sub-$100 print before 2027.\n\nThe consensus is built on three trends: Chinese LFP cell overcapacity now exceeding 1.4 TWh annually, EPC margin compression as integrator competition intensifies, and falling balance-of-plant equipment costs as standardized 5 MWh enclosures become the industry default.\n\nBreaking the $100/kWh threshold has long been seen as the psychological barrier that unlocks peaker-replacement economics in PJM, MISO, and the Southeast US. Project developers told GridPulse they are now structuring 2027 RFPs against a $95-110/kWh budget.",
    whyItMatters:
      "Breaks the psychological barrier that has gated peaker-replacement economics in PJM, MISO, and Southeast US.",
    category: "analysis",
    source: { name: "Wood Mackenzie", domain: "woodmac.com" },
    author: "Allison Weis",
    minutesAgo: 1860,
    readMinutes: 11,
    verified: true,
    tags: ["Pricing", "LFP", "BNEF", "Peakers"],
    region: "Global",
  },
  {
    id: "a9",
    slug: "tesla-megapack-3-shipping",
    headline: "Tesla begins shipping Megapack 3 from Lathrop, ramps to 40 GWh annual run-rate",
    summary:
      "First Megapack 3 units left the Lathrop factory this week; Tesla says the upgraded enclosure cuts on-site install time by 35%.",
    content:
      "Tesla shipped its first Megapack 3 units from the Lathrop, California factory this week and is targeting a 40 GWh annual production run-rate by year-end, according to two people briefed on the ramp.\n\nMegapack 3 integrates a new 5 MWh enclosure with factory-installed AC interconnect hardware, which Tesla says cuts on-site installation time by 35% relative to Megapack 2 XL. Pricing was not disclosed.",
    whyItMatters:
      "Tesla's ramp adds material LFP supply in North America just as IRA-driven domestic content rules tighten in 2026.",
    category: "deals",
    source: { name: "Tesla", domain: "tesla.com" },
    author: "Julian Spector",
    minutesAgo: 2400,
    readMinutes: 4,
    verified: true,
    tags: ["Tesla", "Megapack", "Manufacturing"],
    region: "North America",
  },
  {
    id: "a10",
    slug: "iea-global-storage-outlook-2026",
    headline: "IEA: Global battery storage additions to exceed 200 GW in 2026",
    summary:
      "The IEA's December tracker pegs 2026 BESS additions at 207 GW / 580 GWh, with China alone accounting for 58% of new capacity.",
    content:
      "The International Energy Agency's December storage tracker projects 207 GW (580 GWh) of new battery storage additions in 2026, a 34% year-on-year increase. China accounts for 58% of expected installs, followed by the United States at 21%.",
    whyItMatters:
      "Reinforces the consensus that BESS will be the fastest-growing clean-energy asset class for the third consecutive year.",
    category: "analysis",
    source: { name: "IEA", domain: "iea.org" },
    author: "GridPulse Data Desk",
    minutesAgo: 3300,
    readMinutes: 5,
    verified: true,
    tags: ["IEA", "Forecast", "Global"],
    region: "Global",
  },
];

export const projects: Project[] = [
  { id: "p1", name: "Crimson Storage Phase II", developer: "Recurrent Energy", capacityMw: 350, capacityMwh: 1400, technology: "LFP", location: "Riverside County, CA", country: "USA", region: "North America", lat: 33.65, lng: -115.4, status: "Construction", cod: "Q2 2026", description: "Phase II expansion of the existing Crimson site, adding 4-hour duration LFP storage to support CAISO peak shaving." },
  { id: "p2", name: "Waratah Super Battery", developer: "Akaysha Energy", capacityMw: 850, capacityMwh: 1680, technology: "LFP", location: "New South Wales, AU", country: "Australia", region: "APAC", lat: -33.28, lng: 151.57, status: "Commissioning", cod: "Q1 2026", description: "One of the largest grid-forming batteries in the southern hemisphere; system integrator Tesla." },
  { id: "p3", name: "Highview Carrington", developer: "Highview Power", capacityMw: 50, capacityMwh: 300, technology: "Liquid Air", country: "UK", region: "Europe", location: "Manchester, UK", lat: 53.46, lng: -2.32, status: "Construction", cod: "Q4 2026", description: "First commercial-scale liquid-air long-duration storage facility in the UK." },
  { id: "p4", name: "Permian Basin BESS", developer: "Engie North America", capacityMw: 600, capacityMwh: 2400, technology: "LFP", country: "USA", region: "North America", location: "Reeves County, TX", lat: 31.42, lng: -103.49, status: "Permitting", cod: "Q3 2027", description: "Co-located with 450 MW of solar PV, targeting ERCOT West congestion zone." },
  { id: "p5", name: "Hokkaido Grid Reserve", developer: "TEPCO Renewable Power", capacityMw: 240, capacityMwh: 720, technology: "Sodium-Ion", country: "Japan", region: "APAC", location: "Tomakomai, JP", lat: 42.63, lng: 141.6, status: "Construction", cod: "Q2 2026", description: "Japan's first utility-scale sodium-ion deployment, sited for cold-climate performance trials." },
  { id: "p6", name: "Aragon Salt Cavern CAES", developer: "Storengy", capacityMw: 320, capacityMwh: 6400, technology: "CAES", country: "Spain", region: "Europe", location: "Aragon, ES", lat: 41.65, lng: -0.88, status: "Permitting", cod: "Q4 2027" },
  { id: "p7", name: "Edwards Sanborn II", developer: "Terra-Gen", capacityMw: 875, capacityMwh: 3500, technology: "LFP", country: "USA", region: "North America", location: "Kern County, CA", lat: 35.02, lng: -118.05, status: "Operational", cod: "Q1 2025" },
  { id: "p8", name: "Cottingham BESS", developer: "Harmony Energy", capacityMw: 196, capacityMwh: 392, technology: "LFP", country: "UK", region: "Europe", location: "East Yorkshire, UK", lat: 53.78, lng: -0.43, status: "Commissioning", cod: "Q1 2026" },
  { id: "p9", name: "Riyadh Solar+Storage", developer: "ACWA Power", capacityMw: 1300, capacityMwh: 5200, technology: "LFP", country: "Saudi Arabia", region: "MENA", location: "Riyadh, SA", lat: 24.71, lng: 46.67, status: "Construction", cod: "Q3 2026" },
  { id: "p10", name: "NEOM Helios", developer: "NEOM Green Hydrogen Co.", capacityMw: 400, capacityMwh: 1600, technology: "LFP", country: "Saudi Arabia", region: "MENA", location: "NEOM, SA", lat: 28.0, lng: 35.0, status: "Permitting", cod: "Q4 2027" },
  { id: "p11", name: "Gansu Wind Pairing", developer: "China Huaneng", capacityMw: 1000, capacityMwh: 4000, technology: "LFP", country: "China", region: "APAC", location: "Gansu, CN", lat: 38.93, lng: 100.45, status: "Construction", cod: "Q2 2026" },
  { id: "p12", name: "Hornsdale Expansion 3", developer: "Neoen", capacityMw: 150, capacityMwh: 194, technology: "LFP", country: "Australia", region: "APAC", location: "South Australia, AU", lat: -33.07, lng: 138.25, status: "Operational", cod: "Q3 2024" },
  { id: "p13", name: "Chuckwalla BESS", developer: "EDF Renewables", capacityMw: 500, capacityMwh: 2000, technology: "LFP", country: "USA", region: "North America", location: "Imperial County, CA", lat: 32.96, lng: -114.92, status: "Permitting", cod: "Q2 2027" },
  { id: "p14", name: "Inverness Flow Battery", developer: "Invinity Energy Systems", capacityMw: 30, capacityMwh: 240, technology: "Vanadium Flow", country: "UK", region: "Europe", location: "Inverness, UK", lat: 57.48, lng: -4.22, status: "Construction", cod: "Q4 2026" },
  { id: "p15", name: "Kanto Megapack Hub", developer: "Itochu Corp", capacityMw: 180, capacityMwh: 720, technology: "LFP", country: "Japan", region: "APAC", location: "Chiba, JP", lat: 35.6, lng: 140.12, status: "Commissioning", cod: "Q1 2026" },
  { id: "p16", name: "Berlin Grid Booster", developer: "50Hertz", capacityMw: 250, capacityMwh: 500, technology: "LFP", country: "Germany", region: "Europe", location: "Brandenburg, DE", lat: 52.4, lng: 13.4, status: "Construction", cod: "Q3 2026" },
  { id: "p17", name: "Coopers Gap BESS", developer: "AGL Energy", capacityMw: 200, capacityMwh: 800, technology: "LFP", country: "Australia", region: "APAC", location: "Queensland, AU", lat: -26.74, lng: 151.49, status: "Permitting", cod: "Q4 2026" },
  { id: "p18", name: "Calumet IL Peaker Replacement", developer: "Vistra", capacityMw: 400, capacityMwh: 1600, technology: "LFP", country: "USA", region: "North America", location: "Cook County, IL", lat: 41.66, lng: -87.6, status: "Construction", cod: "Q3 2026" },
  { id: "p19", name: "Antofagasta Solar Hybrid", developer: "Colbun", capacityMw: 220, capacityMwh: 1320, technology: "LFP", country: "Chile", region: "LATAM", location: "Antofagasta, CL", lat: -23.65, lng: -70.4, status: "Construction", cod: "Q2 2026" },
  { id: "p20", name: "Mumbai Grid Reserve", developer: "Tata Power", capacityMw: 350, capacityMwh: 1400, technology: "LFP", country: "India", region: "APAC", location: "Maharashtra, IN", lat: 19.07, lng: 72.87, status: "Permitting", cod: "Q1 2027" },
];

export const upcomingProjects: Project[] = projects.slice(0, 5);

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

export function formatMinutesAgo(m: number): string {
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function getProjectById(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

// Market dashboard mock data
export const quarterlyAdditions = [
  { quarter: "Q1'24", gw: 6.2 }, { quarter: "Q2'24", gw: 7.8 }, { quarter: "Q3'24", gw: 8.4 }, { quarter: "Q4'24", gw: 10.1 },
  { quarter: "Q1'25", gw: 9.6 }, { quarter: "Q2'25", gw: 11.2 }, { quarter: "Q3'25", gw: 14.3 }, { quarter: "Q4'25", gw: 16.8 },
];

export const costTrend = [
  { year: "2020", usdKwh: 312 },
  { year: "2021", usdKwh: 268 },
  { year: "2022", usdKwh: 248 },
  { year: "2023", usdKwh: 195 },
  { year: "2024", usdKwh: 158 },
  { year: "2025", usdKwh: 138 },
  { year: "2026E", usdKwh: 112 },
  { year: "2027E", usdKwh: 96 },
];

export const technologyMix = [
  { name: "LFP", value: 78 },
  { name: "NMC", value: 12 },
  { name: "Sodium-Ion", value: 3 },
  { name: "Flow", value: 4 },
  { name: "CAES / Liquid Air", value: 3 },
];
