import { describe, expect, it } from "vitest";
import { retrieveOperationalKnowledge, operationalKnowledge } from "./operational-knowledge";
describe("reviewed operational retrieval", () => {
  it("does not supply report guidance as calibration or dispatch evidence", () => {
    expect(retrieveOperationalKnowledge("battery capacity", { purpose: "site_calibration" })).toEqual([]);
    expect(retrieveOperationalKnowledge("battery capacity", { purpose: "dispatch_authorisation" })).toEqual([]);
    expect(retrieveOperationalKnowledge("battery capacity", { intents: ["why"] })).toEqual([]);
  });
  it("ranks bounded guidance with explicit source and applicability", () => {
    const result = retrieveOperationalKnowledge("PUE facility overhead efficiency");
    expect(result[0].id).toBe("pue-boundary");
    expect(result.length).toBeLessThanOrEqual(4);
    expect(result.every(item => item.source.startsWith("https://") && item.version && item.applicability && item.section)).toBe(true);
    expect(retrieveOperationalKnowledge("hello")).toEqual([]);
    expect(new Set(operationalKnowledge.map(item => item.id)).size).toBe(operationalKnowledge.length);
  });
  it("keeps measurement and approval gaps discoverable", () => {
    expect(retrieveOperationalKnowledge("missing telemetry measurements approval").some(item => item.id === "metering-readiness")).toBe(true);
  });
  it("preserves report scope and page provenance without treating protocols as site qualification", () => {
    const result = retrieveOperationalKnowledge("OpenADR protocol EEBUS Matter");
    const report = result.find(item => item.id === "edna-protocol-scope");
    expect(report).toMatchObject({ sourceId: "B02", pdfPages: [6, 9], evidenceClass: "report_guidance" });
    expect(report?.text).toContain("residential");
    expect(report).toHaveProperty("excludedUses", expect.arrayContaining(["dispatch_authorisation"]));
  });
});

it("retrieves German reporting and connection terminology", () => {
  expect(retrieveOperationalKnowledge("Welche Berichtspflichten gelten?").some(item => item.id === "de-reporting")).toBe(true);
  expect(retrieveOperationalKnowledge("Netzanschlussvertrag").some(item => item.id === "de-flexible-connection")).toBe(true);
});

const retrievalCases: [string,string][] = [
 ["liquid cooling topology","edna-liquid-cooling"],["immersion retrofit","edna-liquid-cooling"],["direct cooling","edna-liquid-cooling"],
 ["benchmark throughput SERT","edna-server-performance"],["GPU calibration benchmark","edna-server-performance"],["server benchmark","edna-server-performance"],
 ["sector projection","edna-estimate-boundaries"],["forecast uncertainty dataset","edna-estimate-boundaries"],["sector estimate","edna-estimate-boundaries"],
 ["TEM consolidation","edna-tem-scope"],["long projection TEM","edna-tem-scope"],["TEM policy","edna-tem-scope"],
 ["flexibility permission","edna-usable-flexibility"],["commercial participation revenue","edna-usable-flexibility"],["market permission flexibility","edna-usable-flexibility"],
 ["OpenADR protocol","edna-protocol-scope"],["EEBUS connector","edna-protocol-scope"],["Matter integration protocol","edna-protocol-scope"],
 ["event evidence baseline","edna-event-evidence"],["measurement and verification","edna-event-evidence"],["activation verification","edna-event-evidence"],
 ["infrastructure efficiency label","edna-label-boundaries"],["IT efficiency certification","edna-label-boundaries"],["label certification","edna-label-boundaries"],
 ["aggregator enrolment","edna-platform-roles"],["platform settlement","edna-platform-roles"],["aggregator settlement","edna-platform-roles"],
 ["service quality test conditions","edna-service-preserving-measurement"],["measurement methodology","edna-service-preserving-measurement"],["test conditions","edna-service-preserving-measurement"]
];
it.each(retrievalCases)("retrieves reviewed subject %s",(question,id)=>{expect(retrieveOperationalKnowledge(question).some(r=>r.id===id)).toBe(true);});
it("retains ten verified report identities and page ranges",async()=>{
 const {reviewedKnowledge}=await import("./operational-knowledge");
 const records=reviewedKnowledge.filter(r=>"sourceId" in r);
 expect(new Set(records.map(r=>"sourceId" in r?r.sourceId:undefined)).size).toBe(10);
 expect(records.every(r=>r.pdfPages?.length && /^[a-f0-9]{64}$/.test(r.sourceContentHash??""))).toBe(true);
});
