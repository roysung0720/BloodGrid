# Data Model

## Core records

The MVP uses the following data files and corresponding backend models:

- `response_units.csv`: vehicle, crew, location, readiness, mobilization, and onboard-blood fields.
- `blood_units.csv`: product, location, expiration, temperature, and availability fields.
- `stations.csv`: candidate EMS or staging locations and capacity.
- `hospitals.csv`: active destination hospitals and trauma levels.
- `historical_incidents.csv`: demand-proxy locations, timestamps, severity, and source.
- `rendezvous_points.csv`: approved, active intercept locations.
- `live_incidents.csv` or memory: active simulated blood-request incidents.

The detailed field contract is in `PRODUCT_SPEC.md` and will become Pydantic models in the backend.

The runnable CSV contract is maintained in `data/schemas/v1/DATA_CONTRACT.md`. Each complete data bundle belongs in `data/scenarios/<scenario_id>/` and declares its schema version in `scenario.json`.

## Eligibility invariant

A unit is eligible for a blood response only when all of the following are true:

1. It has usable onboard blood.
2. The vehicle is operationally available.
3. A qualified clinician is available.
4. Storage and operational status are valid.

`ON_CALL` may be eligible, but its mobilization minutes must be included in time-to-patient and rendezvous calculations. Units that are out of service, restocking, responding, with a patient, unqualified, or without valid blood must not be recommended.

## Data lifecycle

Blood is represented simply enough for the MVP to determine usability: reserve supply may be assigned to a response unit, become onboard, then be transfused, returned, reassigned, or unavailable/expired. BloodGrid is not a blood-bank information system.

## Baseline coverage result

`GET /coverage/baseline` produces a calculated view, not a new source-data file. For each synthetic demand proxy, it returns the coverage status, fastest eligible response unit, estimated driving minutes, on-call mobilization minutes, combined response estimate, and road distance. The result also exposes each unit's eligibility assessment and the scenario coverage target.

The calculation uses the provider-neutral routing interface. Mapbox-specific response data stays inside `backend/app/routing/`; coverage logic consumes only standardized duration and distance estimates.

## Strategic deployment result

`GET /deployment/strategic` returns a calculated strategic plan, not a new source-data file. It records one recommended active station for every eligible response unit, the optimized coverage count, and each demand point's fastest staged resource, station, and estimated response-time breakdown.

The first objective is intentionally narrow and inspectable: maximize the number of synthetic demand points reachable within the configured target. The optimizer enforces one assignment per eligible unit and respects declared station capacity. It does not yet weight incident severity, model repositioning cost, or make any real-world deployment order.

## Live rendezvous result

`GET /live-incidents/{incident_id}/rendezvous` returns a calculated comparison for an already-authorized synthetic blood request. It preserves the incident's supplied destination hospital, verifies that the record exists and is active, and reports its name and trauma level as context only.

The result includes direct transport time, the configured maximum added hospital delay and score weight, and one record for every rendezvous point. Each point explains whether it was unavailable, unroutable, too late to beat direct arrival, an excessive detour, an eligible alternative, or the selected recommendation. For viable points, it exposes patient and resource travel, on-call mobilization, wait times, time-to-blood, modeled hospital arrival, and the added delay against direct transport.
