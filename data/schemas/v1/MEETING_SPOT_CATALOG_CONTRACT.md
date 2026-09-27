# Meeting-Spot Catalog Contract v1

The meeting-spot catalog lists public mapped places where a Blood Response Unit could meet a transporting ambulance.

- **Scope:** the catalog is shared across scenarios and selected by map area. It is not part of any scenario bundle.
- **Loader:** `backend/app/meeting_spots.py`.
- **Builder:** `scripts/build_meeting_spots.mjs`.

## Files

- `data/meeting_spots/<region_id>.csv`: one file per region. Every CSV in the folder is loaded.
- `data/meeting_spots/sources.json`: provenance manifest. Its entries follow `SOURCE_MANIFEST_CONTRACT.md` and add `license` and `region`.
- `data/raw/openstreetmap_meeting_spots_<date>/<region_id>.json`: the untouched Overpass responses, hashed in the manifest.

## CSV columns

| Column | Type | Rules |
| --- | --- | --- |
| `spot_id` | string | Unique. `OSM-` followed by `N`, `W`, or `R` and the OSM id. |
| `name` | string | The OSM `name` or `brand`, or blank. The UI labels a blank name by its category and road. |
| `category` | enum | `PARKING`, `FUEL_STATION`, `FIRE_STATION`, `PLACE_OF_WORSHIP`, or `SCHOOL`. |
| `latitude`, `longitude` | decimal | WGS84. The node location, or the bounding-box midpoint. |
| `area_m2` | decimal or blank | Approximate bounding-box area. Blank for nodes. |
| `osm_type`, `osm_id` | string | The source element, for attribution and refresh. |

A malformed row raises `MeetingSpotCatalogError` rather than being skipped silently.

## Rules

- **Classification:** REAL public geography, under the ODbL license. Credit "(c) OpenStreetMap contributors" wherever spots are displayed.
- **Not an approval:** a catalog entry is not evidence that a place is open, safe, large enough, accessible, or agency-approved. Spots are presented as suggestions, and the crew decides where to stop.
- **Other sources:** at runtime the catalog is combined with two other sources.
  - The scenario's active `rendezvous_points.csv` rows: category `KNOWN_SITE`, source `SCENARIO`.
  - Where mapped places are scarce, labeled roadside points on a route: category `ROADSIDE`, source `ROUTE`.
- **Refresh:** do not edit a catalog CSV by hand. Rerun the builder with `--refresh`, which creates a new dated raw snapshot. Update this contract if the columns change.
