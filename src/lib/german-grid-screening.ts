export type OperatorScreening = {
  profileKey: "50hertz" | "tennet" | "amprion" | "transnetbw";
  transmissionOperator: string;
  regionalContext: string;
  confidence: "screening_only";
  rationale: string;
  sourceUrl: string;
};

export function screenGermanOperator(latitude: number, longitude: number): OperatorScreening {
  let profileKey: OperatorScreening["profileKey"] = "tennet";
  let transmissionOperator = "TenneT TSO GmbH";
  let regionalContext = "Central / northern Germany screening area";
  if (longitude >= 11.3 && latitude >= 50.1) {
    profileKey = "50hertz";
    transmissionOperator = "50Hertz Transmission GmbH";
    regionalContext = "Eastern Germany screening area";
  } else if (longitude <= 8.8 && latitude >= 50.4) {
    profileKey = "amprion";
    transmissionOperator = "Amprion GmbH";
    regionalContext = "Western Germany screening area";
  } else if (longitude <= 10.6 && latitude < 50.4) {
    profileKey = "transnetbw";
    transmissionOperator = "TransnetBW GmbH";
    regionalContext = "South-western Germany screening area";
  }
  return {
    profileKey,
    transmissionOperator,
    regionalContext,
    confidence: "screening_only",
    rationale:
      "Coordinate-based transmission-area screening. The responsible distribution operator and connection point must be confirmed independently.",
    sourceUrl: "https://www.netzentwicklungsplan.de/",
  };
}
