const restrictedTerritories = new Set(["AF", "BY", "KH", "CN", "HK", "MO", "CU", "ER", "ET", "HT", "IR", "IQ", "LY", "MM", "NI", "KP", "PK", "RU", "SO", "SY", "VE", "EH"]);

/** Use Worker-provided country metadata, never a client-supplied country header.
 * Region-specific sanctions and account eligibility still require separate review. */
export function modelAccessAllowed(request: Request) {
  const country = (request as Request & { cf?: { country?: string } }).cf?.country;
  return !country || !restrictedTerritories.has(country.toUpperCase());
}
