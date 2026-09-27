# Echols-Valdosta Public Geography Demo

## Purpose

This is an additive demo scenario for the rural south-Georgia corridor around
Echols County, Valdosta, and Lakeland. It does not replace
`rural_ga_initial_v1`, which remains the default all-synthetic demo world.

The region gives the project a concrete rural-service-distance story without
claiming that BloodGrid has live data or authority over any real agency.

## Classification

This scenario is **HYBRID_PUBLIC_GEOGRAPHY_SYNTHETIC_OPERATIONS**:

- **REAL:** Echols County boundary context, two CMS facility records and their
  Census-geocoded address coordinates, and public Census road centerlines.
- **SYNTHETIC:** every staging site, Blood Response Unit, blood unit, staffing
  state, availability profile, demand point, rendezvous point, patient unit,
  live incident, operational status, and timing input.
- **REFERENCE ONLY:** rural-designation and regional-service-area research used
  to explain why this is a useful demo setting. It does not supply runtime
  records.

The full field-level source manifest is `sources.json`. Its format is described
in `data/schemas/v1/SOURCE_MANIFEST_CONTRACT.md`.

## Public Inputs

| Runtime item | Public source and treatment | What it does not mean |
| --- | --- | --- |
| County context | Census TIGERweb boundary for Echols County | A road network, EMS coverage area, or dispatch record |
| Demand-proxy geography | Census TIGERweb primary and secondary road centerlines | Crash frequency, traffic volume, or any real incident |
| `H-EV-01` | CMS facility identity/address for SGMC HEALTH; Census geocoder coordinate | A selected destination, real-time availability, or operational recommendation |
| `H-EV-02` | CMS facility identity/address for SGMC HEALTH LANIER; Census geocoder coordinate | A selected destination, real-time availability, or operational recommendation |

`hospitals.csv` uses `LEVEL_III` for `H-EV-01` only as a static demo display
attribute based on public Georgia trauma-center context reviewed on 2026-09-26.
It is not a current verification, and BloodGrid never chooses a destination.

## Synthetic Inputs

The remaining runtime records model a controlled logistics exercise. Their
names start with `Synthetic` where a human-readable place or unit label could
otherwise be mistaken for an actual EMS operation.
`SYNTHETIC_ROAD_ALIGNED_DEMAND_PROXY` means a made-up coverage-testing point
placed near a real public road centerline, not an EMS, crash, or patient record.
The repeatable generator is `scripts/build_echols_valdosta_demand_proxies.mjs`;
its per-point road context and 12-54 meter synthetic offset are recorded in
`data/processed/echols_valdosta_public_geography_v1/road_aligned_demand_proxies.csv`.
All rendezvous points are invented placeholders and are not agency-approved
public meeting locations.

## How to Run

Start the app normally, then use the dashboard header's **Demo data set** menu
to choose **Echols-Valdosta Public Geography Demo**. The current data
classification appears beside the menu and changes with the selected scenario.
Switch back to **Initial Rural Georgia Demo** in that same menu to return to the
all-synthetic world.

`BLOODGRID_SCENARIO` still determines which scenario opens by default after a
backend restart. Do not put either scenario ID in frontend code.

## Known Limits

- Public source snapshots are dated, not live feeds.
- CMS does not provide geographic coordinates in this directory; coordinates
  come from separate saved Census Geocoder responses.
- The existing dashboard currently centers using its established behavior; a
  later polish task may expose a scenario-aware map framing control.
- Mapbox road times remain estimates and do not model emergency driving,
  traffic, closures, weather, dispatch workload, or local protocol.
- This data must never be used for live dispatch, destination selection,
  clinical care, staffing claims, or approval of a real rendezvous location.
