import release from "../../deployment/neon-finder/release.json" with { type: "json" };

/** Public immutable data identity. Contains no host, credential or private data. */
export const finderReleaseToken = `${release.id}:${release.manifestSha256}`;
export class FinderReleaseChangedError extends Error {
  constructor() {
    super("Finder data changed. Reload this page before continuing.");
  }
}
