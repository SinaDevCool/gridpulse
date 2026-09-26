-- Seed the accepted Release 1 German public-context manifest generated on 2026-08-08.
-- This release is context only and is structurally prohibited from claiming capacity.

insert into public.public_context_releases (
  release_key, release_sha256, status, capacity_claim, manifest, accepted_at
) values (
  'german-hourly-context-2023-2025',
  '11f0ef7313d4afa4d3e41282084029f2d9a11882df57fd0575ba8e07deb3fb17',
  'accepted',
  false,
  $manifest${
    "schema_version": "gridpulse-public-source-release-v1",
    "status": "accepted",
    "capacity_claim": false,
    "evidence_boundary": "Public German context only; not feeder loading or available capacity.",
    "release_sha256": "11f0ef7313d4afa4d3e41282084029f2d9a11882df57fd0575ba8e07deb3fb17",
    "sources": [
      {
        "source_key": "bnetza-smard-grid-load",
        "status": "accepted",
        "observation_count": 26281,
        "expected_count": 26304,
        "duplicate_count": 0,
        "missing_count": 23,
        "coverage": 0.99912561,
        "first_timestamp": "2023-01-01T23:00:00+00:00",
        "last_timestamp": "2025-12-31T23:00:00+00:00",
        "artifact_sha256": "94318fce2344e106e0d1e118578b19647151ee92888bada2a88564fd2e3ef53b",
        "parser_version": "smard-hourly-v1",
        "evidence_boundary": "German system context; not node or feeder loading.",
        "issues": []
      },
      {
        "source_key": "dwd-cdc-hourly-temperature",
        "status": "accepted",
        "observation_count": 26294,
        "expected_count": 26304,
        "duplicate_count": 0,
        "missing_count": 10,
        "coverage": 0.99961983,
        "first_timestamp": "2023-01-01T00:00:00+00:00",
        "last_timestamp": "2025-12-31T23:00:00+00:00",
        "artifact_sha256": "ee67c7cf45b820ff3c28ac579fc3d3ce790ca41468709a45bd30ad8717de1267",
        "parser_version": "dwd-cdc-temperature-v1",
        "evidence_boundary": "Weather observation; not network loading or capacity.",
        "issues": []
      }
    ]
  }$manifest$::jsonb,
  '2026-08-08T19:55:57.054357+00:00'::timestamptz
)
on conflict (release_key, release_sha256) do update set
  status = excluded.status,
  capacity_claim = false,
  manifest = excluded.manifest,
  accepted_at = excluded.accepted_at;

with accepted_release as (
  select id
  from public.public_context_releases
  where release_key = 'german-hourly-context-2023-2025'
    and release_sha256 = '11f0ef7313d4afa4d3e41282084029f2d9a11882df57fd0575ba8e07deb3fb17'
)
insert into public.public_context_quality_reports (
  release_id, source_key, artifact_sha256, parser_version, observation_count,
  expected_count, coverage, duplicate_count, missing_count, status,
  evidence_boundary, issues
)
select id, source_key, artifact_sha256, parser_version, observation_count,
       expected_count, coverage, duplicate_count, missing_count, 'accepted',
       evidence_boundary, '[]'::jsonb
from accepted_release
cross join (values
  ('bnetza-smard-grid-load', '94318fce2344e106e0d1e118578b19647151ee92888bada2a88564fd2e3ef53b', 'smard-hourly-v1', 26281, 26304, 0.99912561::double precision, 0, 23, 'German system context; not node or feeder loading.'),
  ('dwd-cdc-hourly-temperature', 'ee67c7cf45b820ff3c28ac579fc3d3ce790ca41468709a45bd30ad8717de1267', 'dwd-cdc-temperature-v1', 26294, 26304, 0.99961983::double precision, 0, 10, 'Weather observation; not network loading or capacity.')
) as source(source_key, artifact_sha256, parser_version, observation_count,
            expected_count, coverage, duplicate_count, missing_count, evidence_boundary)
on conflict (release_id, source_key) do update set
  artifact_sha256 = excluded.artifact_sha256,
  parser_version = excluded.parser_version,
  observation_count = excluded.observation_count,
  expected_count = excluded.expected_count,
  coverage = excluded.coverage,
  duplicate_count = excluded.duplicate_count,
  missing_count = excluded.missing_count,
  status = excluded.status,
  evidence_boundary = excluded.evidence_boundary,
  issues = excluded.issues;
