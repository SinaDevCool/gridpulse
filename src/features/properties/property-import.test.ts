import { describe, expect, it } from "vitest";
import { parsePropertyImport, propertyImportTemplateCsv } from "./property-import";

describe("property portfolio import", () => {
  it("parses the template without converting blank optional MW values to zero", async () => {
    const file = new File([propertyImportTemplateCsv()], "properties.csv", { type: "text/csv" });
    const [row] = await parsePropertyImport(file);
    expect(row.errors).toEqual([]);
    expect(row.value.requiredTotalSiteLoadMw).toBe(55);
    expect(row.value.requiredItLoadMw).toBe(40);
  });

  it("reports invalid rows and duplicate external IDs before commit", async () => {
    const csv = [
      "property_name,external_property_id,latitude,longitude,required_total_site_load_mw",
      "A,duplicate,60,13,",
      "Valid property,DUPLICATE,52.5,13.4,50",
    ].join("\n");
    const rows = await parsePropertyImport(new File([csv], "properties.csv"));
    expect(rows[0].errors).toEqual(expect.arrayContaining([expect.stringContaining("Property name"), expect.stringContaining("Latitude"), expect.stringContaining("unknown")]));
    expect(rows.every((row) => row.errors.some((error) => error.includes("Duplicate")))).toBe(true);
  });

  it("accepts GeoJSON points with property attributes", async () => {
    const geojson = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [13.4, 52.5] }, properties: { property_name: "Geo property", required_total_site_load_mw: 20 } }] };
    const [row] = await parsePropertyImport(new File([JSON.stringify(geojson)], "properties.geojson"));
    expect(row.errors).toEqual([]);
    expect(row.value.longitude).toBe(13.4);
  });
});
