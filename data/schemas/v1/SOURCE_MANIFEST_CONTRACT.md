# Source Manifest Contract v1

`sources.json` is the companion provenance manifest for a scenario that uses
public or derived data. It is metadata, not a runtime API input. Keep it beside
the scenario's CSV files so a presenter or another agent can trace every
real-world-derived value.

Each source entry must contain:

| Field | Purpose |
| --- | --- |
| `source_id` | Stable source identifier used by processed records or notes. |
| `classification` | `REAL`, `REAL_PROXY`, `SYNTHETIC`, or `REFERENCE_ONLY`. |
| `publisher` | Organization that published the source. |
| `title` | Human-readable source name. |
| `url` | Direct public source URL. |
| `accessed_at` | ISO 8601 date-time when BloodGrid retrieved or reviewed it. |
| `raw_path` | Repository path to an untouched snapshot, or `null` when the entry is contextual reference only. |
| `sha256` | Hash of the raw snapshot, or `null` when no snapshot is retained. |
| `used_fields` | Fields or facts used by the scenario. |
| `transformations` | Reproducible description of how it became a processed or runtime value. |
| `limitations` | What the source cannot establish. |

Do not use a public facility directory, geographic boundary, or contextual
report as evidence of live EMS staffing, blood inventory, credentialing,
operational availability, patient location, clinical suitability, or an
agency-approved rendezvous site.
