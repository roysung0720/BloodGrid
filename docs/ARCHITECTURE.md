# Architecture

## Overview

The MVP is a map-first Next.js dashboard backed by a Python FastAPI service. CSV and JSON files provide initial persistence. Google OR-Tools handles strategic unit placement, while deterministic Python logic evaluates live rendezvous options.

```text
Next.js dashboard
       |
       | HTTP JSON
       v
FastAPI service
  |-- data loading and validation
  |-- routing interface
  |     `-- Mapbox implementation
  |-- coverage calculations
  |-- OR-Tools deployment optimizer
  `-- rendezvous evaluator
       |
       v
CSV / JSON data files
```

## Current Routing, Coverage, Deployment, and Rendezvous Slice

The initial map dashboard, baseline coverage calculation, strategic deployment recommendation, and live incident rendezvous evaluation are complete.

- `backend/app/scenario_loader.py` reads the scenario selected by `BLOODGRID_SCENARIO`, validates its record relationships, and returns typed data.
- `backend/app/routing/` defines the provider-neutral travel-time interface and confines Mapbox Matrix API requests to `mapbox_provider.py`.
- `backend/app/coverage/service.py` checks eligibility, obtains road travel estimates, adds any on-call mobilization delay, and classifies each synthetic demand point against the configured target.
- `backend/app/deployment/service.py` uses OR-Tools CP-SAT to assign eligible units to active station capacity while maximizing demand points reachable within the target.
- `backend/app/rendezvous/service.py` compares direct transport with approved, active rendezvous points using the shared eligibility and routing interfaces. It never changes the supplied destination.
- `backend/app/main.py` exposes read-only scenario endpoints plus `GET /coverage/baseline`, `GET /deployment/strategic`, and `GET /live-incidents/{incident_id}/rendezvous`.
- `frontend/src/app/page.tsx` presents one interactive operations dashboard.
- `frontend/src/components/OperationsMap.tsx` renders the Mapbox basemap and colors demand markers by baseline coverage status.
- `frontend/src/components/CoveragePanel.tsx` summarizes the current coverage result; `FeatureDetails.tsx` explains an individual demand point's result.
- `frontend/src/components/DeploymentPanel.tsx` compares current and optimized coverage, lists the recommended staging assignments, and controls the map's current/recommended view.
- `frontend/src/components/RendezvousPanel.tsx` shows the live logistics recommendation, direct-transport reference, and every approved-point result; the selected point is marked on the map.
- The frontend reads all map data from the backend. It does not duplicate scenario CSV files.

The baseline and strategic plan use the scenario's `target_coverage_minutes` by default. `BLOODGRID_COVERAGE_TARGET_MINUTES` may override it locally for a demo. Mapbox's `mapbox/driving` Matrix profile returns estimated driving duration and road distance; the system does not claim live dispatch-grade timing or use traffic-aware routing in this phase.

## Boundaries

- The frontend displays operational state, sends control actions, and explains calculated results.
- The backend owns data validation, eligibility rules, routing calls, optimization, and response shaping.
- The `routing/` package exposes provider-neutral matrix travel-time lookups. Optimizers must not call Mapbox directly.
- The `deployment/` package uses OR-Tools CP-SAT because strategic placement is an explicit discrete assignment problem. It reuses the coverage package's eligibility rule.
- The `rendezvous/` package evaluates approved candidate points deterministically. It uses the direct route as a feasibility reference, includes mobilization and wait time, and does not require OR-Tools.

## Initial configuration

Central configuration includes the scenario coverage target, `BLOODGRID_RENDEZVOUS_MAX_ADDED_HOSPITAL_DELAY_MINUTES` (default `10`), `BLOODGRID_RENDEZVOUS_HOSPITAL_DELAY_WEIGHT` (default `0.5`), and Mapbox routing settings. These values must remain easy to change.
