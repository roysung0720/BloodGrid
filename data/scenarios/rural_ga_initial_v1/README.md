# Initial Rural Georgia Demo

## Purpose

This is the first complete BloodGrid scenario. It gives the project a small, consistent map world for the dashboard, eligibility rules, future coverage calculation, staging optimization, and live rendezvous simulation.

## Classification

Every record in this scenario is **SYNTHETIC**. It is modeled around a rural-Georgia-style region to make the HackGT story concrete, but no row represents a live EMS resource, an actual facility, an actual blood unit, or a patient record.

## Contents

- 8 candidate staging locations
- 3 Blood Response Units
- 6 valid onboard blood units
- 3 hospitals
- 30 incident-demand proxy points
- 8 approved active rendezvous points
- 1 simulated open blood-request incident
- 5 named synthetic availability profiles, including a resettable baseline

## Provenance

| Dataset | Classification | Creation method | Limitation |
| --- | --- | --- | --- |
| `stations.csv` | SYNTHETIC | Hand-authored demo locations | Names and coordinates are fictional |
| `response_units.csv` | SYNTHETIC | Hand-authored operational scenario | Not a live staffing or vehicle feed |
| `blood_units.csv` | SYNTHETIC | Hand-authored inventory records | Not blood-bank data; expiration dates are demo inputs |
| `hospitals.csv` | SYNTHETIC | Hand-authored destination locations | Not a trauma-center directory or destination guidance |
| `historical_incidents.csv` | SYNTHETIC | Hand-authored demand-proxy distribution | Not crash, EMS, or patient data |
| `rendezvous_points.csv` | SYNTHETIC | Hand-authored approved-place examples | Not agency-approved real locations |
| `live_incidents.csv` | SYNTHETIC | Controlled major-collision simulation | Not a live incident feed |
| `availability_profiles.json` | SYNTHETIC | Hand-authored demo operating states | Not a live CAD, staffing, or inventory feed |

**Created:** 2026-09-25  
**Coordinate system:** WGS84 decimal degrees  
**Geographic coverage:** A modeled rural Georgia demonstration area bounded in `scenario.json`.

## How to Use It

Set `BLOODGRID_SCENARIO=rural_ga_initial_v1`. The backend loads the CSV and JSON files in this folder and validates their relationships against `data/schemas/v1/DATA_CONTRACT.md`.

## Known Limitations

- Coordinates are useful for an initial map display only. Road travel times will not be meaningful until the Mapbox routing phase.
- The three hospitals are supplied demo destinations. BloodGrid must not use them to make clinical destination decisions.
- Unit status, credentialing, blood inventory, and mobilization timing are controlled inputs for a demo, not operational facts.
- Availability profiles apply only to an in-memory scenario copy. They are intended for repeatable demonstrations, not live dispatch control.
- When replacing any part of this scenario with public or real-derived data, create a new scenario version and update its provenance rather than silently relabeling these records.
