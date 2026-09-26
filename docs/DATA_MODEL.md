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
