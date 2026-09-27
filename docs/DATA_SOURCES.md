# Data Sources and Provenance

Every file added under `data/` needs a short provenance record containing:

- source name and URL/provider;
- download or creation date;
- geographic coverage;
- important fields and transformations;
- limitations;
- whether the values are real or synthetic.

## Expected data categories

| Category | MVP source approach | Label |
| --- | --- | --- |
| Geography, road travel, stations, hospitals | Public real-world sources where practical | REAL |
| Severe-trauma demand | Public crash geography or another defensible proxy | REAL PROXY |
| Blood inventory, expiration, credentials, availability, shifts | Purpose-built demo values | SYNTHETIC |
| Live incidents | Controlled demo scenarios | SYNTHETIC |

Synthetic values must never be represented as live EMS, blood-bank, or patient data. Source notes will live beside each dataset or in a central manifest as the data world is created.

For runnable bundles, keep the scenario-specific provenance in `data/scenarios/<scenario_id>/README.md`. It must describe all source classifications, transformations, and scenario limitations in one place.

## Public-Geography Demo Scenario

`echols_valdosta_public_geography_v1` is an additive, hybrid scenario. It
keeps the existing `rural_ga_initial_v1` all-synthetic dataset intact.

| Data use | Source | Classification | Why it is usable | Important limit |
| --- | --- | --- | --- | --- |
| Echols County context and boundary | U.S. Census TIGERweb | REAL | Public geographic boundary with a stable county GEOID | Does not show EMS coverage, roads, operations, or incidents |
| Facility identity and address | CMS Hospital General Information directory | REAL | Public provider directory | Not a live status feed, trauma directory, or destination protocol |
| Facility map coordinate | U.S. Census Geocoder | REAL | Repeatable geocode of the public CMS address | Approximate address coordinate, not an ambulance bay or clinical claim |
| Demand-proxy placement geometry | U.S. Census TIGERweb primary and secondary road centerlines | REAL geometry + SYNTHETIC proxy | Makes controlled coverage points follow public rural travel corridors | Does not measure traffic, crashes, EMS demand, or real incident locations |
| Rural-region rationale | Georgia HRSA-designated county material and SGMC's public service-area report | REFERENCE ONLY | Explains why the corridor is relevant for a rural logistics demo | Does not establish present-day EMS staffing, coverage, or need |
| Stations, units, blood, staffing, availability, demand, rendezvous, and live requests | Hand-authored controlled scenario values | SYNTHETIC | Lets the team safely exercise known logistics cases | Not CAD, blood-bank, credentialing, patient, or agency-approved data |

The scenario's `sources.json` contains direct URLs, access dates, raw-file
paths, hashes, transformations, and limitations. The untouched downloads live
under `data/raw/`; cleaned reference rows live under `data/processed/`.

The Echols-Valdosta road-aligned demand set uses a repeatable script to sample
18 primary-road and 12 secondary-road centerline coordinates, then applies a
small synthetic map offset. This improves geographic realism without changing
the classification: the resulting demand proxies are still synthetic and must
never be described as crash or EMS data.

## Meeting-Spot Catalog (OpenStreetMap)

- **Classification:** REAL public geography. The places exist on the map, but nothing asserts that they are open, safe, or agency-approved at any moment.
- **Source:** OpenStreetMap contributors, via the Overpass API, retrieved 2026-09-27.
  - Features: `amenity` = parking, fuel, fire_station, place_of_worship, or school.
  - Area: each scenario's bounding box plus 0.15 degrees.
- **License:** Open Database License (ODbL) 1.0. Credit "(c) OpenStreetMap contributors" wherever spots are shown; the live-incident panel does.
- **Files:**
  - Raw snapshots: `data/raw/openstreetmap_meeting_spots_2026-09-27/`
  - Processed CSVs: `data/meeting_spots/`
  - Manifest, with hashes and transformations: `data/meeting_spots/sources.json`
- **Transformations:** `scripts/build_meeting_spots.mjs`.
  - Drops private or no-access places.
  - Drops multi-storey, underground, and rooftop parking.
  - Drops places whose bounding box is under 400 m2.
  - Drops parking nodes tagged with fewer than 15 spaces.
  - Uses the node coordinate, or the bounding-box midpoint for ways and relations.
- **Limitations:**
  - Rural coverage is incomplete.
  - Hours, gates, surface, and turning space are unknown.
  - The catalog is a dated snapshot.

## Public Data That Is Not Available Here

BloodGrid intentionally does not attempt to reconstruct restricted operational
data from public web pages:

- **Live EMS/CAD incidents and patient information:** protected operational and
  health information. Georgia GEMSIS access is controlled through its EMS data
  program; NEMSIS research extracts are de-identified and remove key agency,
  hospital, and location identifiers.
- **Vehicle locations, staffing rosters, qualifications, blood inventory,
  temperature records, and shift availability:** normally held by EMS agencies,
  CAD systems, and blood-management systems. These are not public live feeds.
- **Agency-approved rendezvous sites and destination protocols:** agency and
  medical direction decisions, not public geography. BloodGrid's meeting spots
  are public mapped places (see below) offered as suggestions, not approvals.
- **Current trauma capability and hospital availability:** must be verified with
  the appropriate official or operational source in any real deployment. The
  MVP only displays static demo context for a supplied destination.

For future access to restricted data, use formal agency permission, data-use
agreements, security review, and minimum-necessary fields. Do not scrape,
infer, or represent protected operational data as public facts.
