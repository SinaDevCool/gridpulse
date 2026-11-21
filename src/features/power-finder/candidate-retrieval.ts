import type { PowerFinderBounds, PowerFinderDataMode } from "./data-source";
import type { PowerFinderCollection } from "./fixture-data";

type Sample = { collection: PowerFinderCollection; mode: PowerFinderDataMode };
type Loader = (
  bounds: PowerFinderBounds,
  signal?: AbortSignal,
  options?: { fallbackAllowed?: boolean; includeRegistryAssets?: boolean },
) => Promise<Sample>;

/** Bounded subdivision uses the existing read-only RPC; unresolved caps remain explicit. */
export async function retrieveCandidateContext(
  bounds: PowerFinderBounds,
  loader: Loader,
  signal?: AbortSignal,
  depth = 0,
): Promise<Sample> {
  signal?.throwIfAborted();
  const initial = await loader(bounds, signal, {
    fallbackAllowed: true,
    includeRegistryAssets: false,
  });
  if (
    !initial.collection.metadata.retrieval_capped ||
    depth >= 2 ||
    initial.mode === "published_artifact"
  )
    return initial;
  const middleX = (bounds.west + bounds.east) / 2;
  const middleY = (bounds.south + bounds.north) / 2;
  const partitions = [
    { west: bounds.west, south: bounds.south, east: middleX, north: middleY },
    { west: middleX, south: bounds.south, east: bounds.east, north: middleY },
    { west: bounds.west, south: middleY, east: middleX, north: bounds.north },
    { west: middleX, south: middleY, east: bounds.east, north: bounds.north },
  ];
  const samples: Sample[] = [];
  for (const partition of partitions) {
    try {
      samples.push(await retrieveCandidateContext(partition, loader, signal, depth + 1));
    } catch (error) {
      signal?.throwIfAborted();
      void error;
      return initial;
    }
  }
  if (samples.some((sample) => sample.mode !== initial.mode)) return initial;
  const features = [
    ...new Map(
      samples
        .flatMap((sample) => sample.collection.features)
        .map((feature) => [feature.id, feature]),
    ).values(),
  ];
  return {
    mode: initial.mode,
    collection: {
      ...initial.collection,
      features,
      metadata: {
        ...initial.collection.metadata,
        record_count: features.length,
        kind_counts: undefined,
        retrieval_capped: samples.some((sample) => sample.collection.metadata.retrieval_capped),
      },
    },
  };
}
