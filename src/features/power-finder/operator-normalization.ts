const canonicalOperators: Array<[RegExp, string]> = [
  [
    /^(50hertz|50hertz transmission(?: gmbh)?|vattenfall_europe_transmission)$/i,
    "50Hertz Transmission GmbH",
  ],
  [/^amprion(?: gmbh)?$/i, "Amprion GmbH"],
  [/^tennet(?: tso)?(?: gmbh)?$/i, "TenneT TSO GmbH"],
  [/^transnetbw(?: gmbh)?$/i, "TransnetBW GmbH"],
  [/^(?:aon[ _])?avacon(?: ag| netz(?: ag| gmbh)?)?$/i, "Avacon Netz GmbH"],
  [/^e[ _.-]?on[ _-]?avacon(?: ag)?$/i, "Avacon Netz GmbH"],
  [/^wesernetz(?: bremen)?(?: gmbh)?$/i, "wesernetz Bremen GmbH"],
  [/^ewe[_ -]?netz(?: ag| gmbh)?$/i, "EWE Netz GmbH"],
  [/^ewe$/i, "EWE Netz GmbH"],
  [/^(e\.dis netz(?: gmbh)?|eon_edis|e\.dis)$/i, "E.DIS Netz GmbH"],
  [/^(db energie(?: gmbh)?|db netz ag)$/i, "DB Energie GmbH"],
  [/^(fbb|fbs|flughafen gmbh)$/i, "Flughafen Berlin Brandenburg GmbH"],
  [/^stromnetz berlin(?:, 50hz, e\.dis)?$/i, "Stromnetz Berlin GmbH"],
];

const canonicalTsoNames = new Set([
  "50Hertz Transmission GmbH",
  "Amprion GmbH",
  "TenneT TSO GmbH",
  "TransnetBW GmbH",
]);

export function canonicalOperatorName(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return canonicalOperators.find(([pattern]) => pattern.test(normalized))?.[1] ?? normalized;
}

export function canonicalOperatorNames(value?: string | null) {
  if (!value?.trim()) return [];

  return Array.from(
    new Set(
      value
        .split(/[;,|]/)
        .map((name) => canonicalOperatorName(name))
        .filter((name): name is string => Boolean(name)),
    ),
  );
}

export function formatOperatorNames(value?: string | null) {
  const names = canonicalOperatorNames(value);
  return names.length ? names.join(" · ") : null;
}

export function knownOperatorRole(value?: string | null): "TSO" | null {
  const canonical = canonicalOperatorName(value);
  return canonical && canonicalTsoNames.has(canonical) ? "TSO" : null;
}

export function sameOperatorIdentity(left?: string | null, right?: string | null) {
  const canonicalLeft = canonicalOperatorNames(left);
  const canonicalRight = canonicalOperatorNames(right);
  return canonicalLeft.some((leftName) =>
    canonicalRight.some(
      (rightName) =>
        leftName.localeCompare(rightName, undefined, { sensitivity: "accent" }) === 0,
    ),
  );
}
