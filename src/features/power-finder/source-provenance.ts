import type { PowerFinderCollection, PowerFinderFeature } from "./fixture-data";

/** A database response timestamp is never evidence of source freshness. */
export function sourcePublicationDate(
  collection: PowerFinderCollection,
  feature: PowerFinderFeature,
) {
  const recordDate = feature.properties.source_published_at;
  if (recordDate && Number.isFinite(Date.parse(recordDate))) return recordDate;
  const metadata = collection.metadata;
  if (metadata.published_at_basis !== "source_release") return null;
  return Number.isFinite(Date.parse(metadata.published_at)) ? metadata.published_at : null;
}
