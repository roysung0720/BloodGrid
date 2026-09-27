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

## Current Routing, Coverage, and Deployment Slice

The initial map dashboard, baseline coverage calculation, and strategic deployment recommendation are complete.

- `backend/app/scenario_loader.py` reads the scenario selected by `BLOODGRID_SCENARIO`, validates its record relationships, and returns typed data.
- `backend/app/routing/` defines the provider-neutral travel-time interface and confines Mapbox Matrix API requests to `mapbox_provider.py`.
- `backend/app/coverage/service.py` checks eligibility, obtains road travel estimates, adds any on-call mobilization delay, and classifies each synthetic demand point against the configured target.
- `backend/app/deployment/service.py` uses OR-Tools CP-SAT to assign eligible units to active station capacity while maximizing demand points reachable within the target.
- `backend/app/main.py` exposes read-only scenario endpoints plus `GET /coverage/baseline` and `GET /deployment/strategic`.
- `frontend/src/app/page.tsx` presents one interactive operations dashboard.
- `frontend/src/components/OperationsMap.tsx` renders the Mapbox basemap and colors demand markers by baseline coverage status.
- `frontend/src/components/CoveragePanel.tsx` summarizes the current coverage result; `FeatureDetails.tsx` explains an individual demand point's result.
- `frontend/src/components/DeploymentPanel.tsx` compares current and optimized coverage, lists the recommended staging assignments, and controls the map's current/recommended view.
- The frontend reads all map data from the backend. It does not duplicate scenario CSV files.

The baseline and strategic plan use the scenario's `target_coverage_minutes` by default. `BLOODGRID_COVERAGE_TARGET_MINUTES` may override it locally for a demo. Mapbox's `mapbox/driving` Matrix profile returns estimated driving duration and road distance; the system does not claim live dispatch-grade timing or use traffic-aware routing in this phase.

## Boundaries

- The frontend displays operational state, sends control actions, and explains calculated results.
- The backend owns data validation, eligibility rules, routing calls, optimization, and response shaping.
- The `routing/` package exposes provider-neutral matrix travel-time lookups. Optimizers must not call Mapbox directly.
- The `deployment/` package uses OR-Tools CP-SAT because strategic placement is an explicit discrete assignment problem. It reuses the coverage package's eligibility rule.
- Live rendezvous selection evaluates approved candidate points deterministically. It does not require OR-Tools.

## Initial configuration

Central configuration will include the coverage target, rendezvous hospital-delay weight, maximum acceptable detour, and Mapbox token. These values must remain easy to change.
