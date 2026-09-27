# BloodGrid CSV Data Contract v1

## General Rules

- All files use UTF-8 CSV with a header row.
- IDs are unique within their file and use stable uppercase prefixes such as `S-01`, `BR-01`, and `H-01`.
- Latitude and longitude use WGS84 decimal degrees.
- Boolean values are lowercase `true` or `false`.
- Datetimes use ISO 8601 UTC timestamps, such as `2026-09-25T09:30:00Z`.
- A scenario's `scenario.json` names this contract as `v1` and supplies its geographic bounding box.
- CSV files are application data, not clinical records. Synthetic records must remain labeled in their scenario provenance.

## stations.csv

| Column | Type | Rule | Purpose |
| --- | --- | --- | --- |
| `station_id` | text | unique, required | Stable staging-location ID |
| `name` | text | required | Display name |
| `latitude` | number | inside scenario bounds | Map and routing coordinate |
| `longitude` | number | inside scenario bounds | Map and routing coordinate |
| `station_type` | text | `EMS_STATION`, `FIRE_EMS`, or `STAGING_SITE` | Location category |
| `active` | boolean | required | Only active locations may receive unit assignments |
| `capacity` | integer | zero or greater | Maximum units that can stage there |

## response_units.csv

| Column | Type | Rule | Purpose |
| --- | --- | --- | --- |
| `unit_id` | text | unique, required | Stable response-unit ID |
| `unit_type` | text | `SUPERVISOR` for initial scenario | Vehicle category |
| `home_station_id` | text | references `stations.station_id` | Home base |
| `current_latitude` | number | inside scenario bounds | Current map coordinate |
| `current_longitude` | number | inside scenario bounds | Current map coordinate |
| `vehicle_status` | text | `AVAILABLE`, `RESPONDING`, `WITH_PATIENT`, `RESTOCKING`, or `OUT_OF_SERVICE` | Vehicle readiness |
| `crew_status` | text | `AVAILABLE`, `ON_CALL`, `NO_QUALIFIED_CLINICIAN`, or `UNAVAILABLE` | Crew readiness |
| `crew_level` | text | `PARAMEDIC`, `EMT`, or `NONE` | Crew qualification summary |
| `blood_credentialed` | boolean | required | Whether the active crew is blood credentialed |
| `mobilization_minutes` | number | zero or greater | Added delay for on-call response |
| `blood_units_onboard` | integer | zero or greater | Must equal valid onboard blood-unit rows |
| `shift_start` | time | `HH:MM` local scenario time | Simplified shift start |
| `shift_end` | time | `HH:MM` local scenario time | Simplified shift end |

## blood_units.csv

| Column | Type | Rule | Purpose |
| --- | --- | --- | --- |
| `blood_unit_id` | text | unique, required | Stable inventory ID |
| `product_type` | text | `O_NEG` in initial scenario | Product display label |
| `current_location_type` | text | `RESPONSE_UNIT` or `RESERVE` | Where the unit is stored |
| `current_location_id` | text | references a response unit or hospital reserve | Current holder |
| `expiration_datetime` | datetime | required | Inventory validity input |
| `temperature_status` | text | `VALID`, `EXCURSION`, or `UNKNOWN` | Storage-status input |
| `availability_status` | text | `ONBOARD`, `RESERVE`, `TRANSFUSED`, `RETURNED`, `REASSIGNED`, `UNAVAILABLE`, or `EXPIRED` | Lifecycle state |

## hospitals.csv

| Column | Type | Rule | Purpose |
| --- | --- | --- | --- |
| `hospital_id` | text | unique, required | Stable destination ID |
| `name` | text | required | Display name |
| `latitude` | number | inside scenario bounds | Map and routing coordinate |
| `longitude` | number | inside scenario bounds | Map and routing coordinate |
| `trauma_level` | text | `LEVEL_I`, `LEVEL_II`, `LEVEL_III`, or `NONE` | Demo display attribute |
| `active` | boolean | required | Only active hospitals may be supplied as destinations |

## historical_incidents.csv

| Column | Type | Rule | Purpose |
| --- | --- | --- | --- |
| `incident_id` | text | unique, required | Stable demand-point ID |
| `timestamp` | datetime | required | Future time-of-day analysis input |
| `latitude` | number | inside scenario bounds | Demand coordinate |
| `longitude` | number | inside scenario bounds | Demand coordinate |
| `incident_type` | text | descriptive, nonclinical | Demand-proxy category |
| `severity_proxy` | text | `MEDIUM`, `HIGH`, or `CRITICAL` | Optional strategic weight, not a diagnosis |
| `source` | text | required | Provenance label |

## rendezvous_points.csv

| Column | Type | Rule | Purpose |
| --- | --- | --- | --- |
| `rendezvous_id` | text | unique, required | Stable rendezvous ID |
| `name` | text | required | Display name |
| `latitude` | number | inside scenario bounds | Candidate coordinate |
| `longitude` | number | inside scenario bounds | Candidate coordinate |
| `location_type` | text | `EMS_STATION`, `FIRE_EMS`, `HIGHWAY_INTERCHANGE`, or `SAFE_STAGING_AREA` | Approved-place category |
| `approved` | boolean | required | Must be `true` to consider the point |
| `active` | boolean | required | Must be `true` to consider the point |

## live_incidents.csv

| Column | Type | Rule | Purpose |
| --- | --- | --- | --- |
| `incident_id` | text | unique, required | Stable simulation ID |
| `latitude` | number | inside scenario bounds | Patient-ambulance starting coordinate |
| `longitude` | number | inside scenario bounds | Patient-ambulance starting coordinate |
| `destination_hospital_id` | text | references an active hospital | Supplied destination; not a clinical recommendation |
| `blood_requested` | boolean | `true` before logistics run | Authorized request input |
| `patient_unit_id` | text | required | Transporting-unit display ID |
| `status` | text | `OPEN`, `RESOLVED`, or `CANCELLED` | Simulation state |
| `created_at` | datetime | required | Scenario timeline input |

## availability_profiles.json

This optional-for-future but required-for-the-initial-demo JSON file defines named synthetic operating states without rewriting source CSV files.

| Field | Type | Rule | Purpose |
| --- | --- | --- | --- |
| `profiles` | array | non-empty; includes `baseline` | Demo operating-state catalog |
| `profile_id` | text | unique and stable | Query parameter and frontend selector value |
| `name` | text | required | Human-readable demo label |
| `description` | text | required | Synthetic-state explanation |
| `resource_overrides` | array | defaults to empty | Targeted resource changes |
| `resource_overrides[].unit_id` | text | references `response_units.csv` | Unit to overlay |
| override fields | values | optional | `vehicle_status`, `crew_status`, `blood_credentialed`, `mobilization_minutes`, `blood_units_onboard`, `blood_availability_status`, or `blood_temperature_status` |

## Cross-File Validation

1. Every `home_station_id` must exist in `stations.csv`.
2. Each `RESPONSE_UNIT` blood location must reference an existing response unit.
3. The count of `ONBOARD` blood units with `temperature_status=VALID` must match `blood_units_onboard` for each unit.
4. A unit is eligible only when its vehicle is `AVAILABLE`, crew is `AVAILABLE` or `ON_CALL`, `blood_credentialed=true`, its crew level is `PARAMEDIC`, and it has at least one valid onboard blood unit. `ON_CALL` adds `mobilization_minutes` to travel time.
5. Every live-incident destination must exist in `hospitals.csv` and be active.
6. Only rendezvous points with both `approved=true` and `active=true` may be evaluated.
7. Any changed scenario data must keep the supplied bounding box valid and update the scenario provenance when its source classification changes.
8. Availability profiles are synthetic overlays only. `baseline` must be present, profile IDs must be unique, and every override must reference an existing response unit.
