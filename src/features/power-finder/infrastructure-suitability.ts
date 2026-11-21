import { knownOperatorRole } from "./operator-normalization";

/** Mapping-derived investigation categories, never a connection qualification. */
export function classifyInfrastructure(name: string, operator?: string | null) {
  const identity = `${name} ${operator ?? ""}`;
  if (/bahn|rail|gleichrichter|unterwerk|DB Energie/i.test(identity)) {
    return {
      kind: "specialised" as const,
      scoreCeiling: 55,
      note: "Specialised or railway infrastructure; public-grid suitability requires confirmation.",
    };
  }
  if (
    /krankenhaus|klinikum|universit|campus|pharma|\bbayer\b|siemens|flughafen|airport|hospital/i.test(
      identity,
    )
  ) {
    return {
      kind: "possible_customer_asset" as const,
      scoreCeiling: 65,
      note: "Possible private or customer substation; third-party access and the public-network connection point are unverified.",
    };
  }
  if (knownOperatorRole(operator)) {
    return {
      kind: "mapped_network_operator" as const,
      scoreCeiling: 100,
      note: "Network operator mapped; connection responsibility, third-party access and capacity still require confirmation.",
    };
  }
  return {
    kind: "unclassified" as const,
    scoreCeiling: 100,
    note: "Infrastructure ownership and connection role are unclassified; an operator tag alone does not establish a public network.",
  };
}
