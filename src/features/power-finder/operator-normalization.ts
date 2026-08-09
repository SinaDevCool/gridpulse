const canonicalOperators: Array<[RegExp, string]> = [
  [
    /^(50hertz|50hertz transmission(?: gmbh)?|vattenfall_europe_transmission)$/i,
    "50Hertz Transmission GmbH",
  ],
  [/^(e\.dis netz(?: gmbh)?|eon_edis|e\.dis)$/i, "E.DIS Netz GmbH"],
  [/^(db energie(?: gmbh)?|db netz ag)$/i, "DB Energie GmbH"],
  [/^(fbb|fbs|flughafen gmbh)$/i, "Flughafen Berlin Brandenburg GmbH"],
  [/^stromnetz berlin(?:, 50hz, e\.dis)?$/i, "Stromnetz Berlin GmbH"],
];

export function canonicalOperatorName(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return canonicalOperators.find(([pattern]) => pattern.test(normalized))?.[1] ?? normalized;
}
