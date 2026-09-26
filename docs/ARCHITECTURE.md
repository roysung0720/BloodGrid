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

## Current Display Slice

The initial map dashboard is complete.

- `backend/app/scenario_loader.py` reads the scenario selected by `BLOODGRID_SCENARIO`, validates its record relationships, and returns typed data.
- `backend/app/main.py` exposes read-only endpoints for the complete scenario and each map layer.
- `frontend/src/app/page.tsx` presents one interactive operations dashboard.
- `frontend/src/components/OperationsMap.tsx` renders the Mapbox basemap and scenario markers.
- The frontend reads all map data from the backend. It does not duplicate scenario CSV files.

The display slice has no travel-time, coverage, deployment, or rendezvous recommendation logic. Those additions belong in later modules so the current map remains a straightforward view of operational state.

## Boundaries

- The frontend displays operational state, sends control actions, and explains calculated results.
- The backend owns data validation, eligibility rules, routing calls, optimization, and response shaping.
- `routing.py` exposes provider-neutral functions such as route and travel-time lookups. Optimizers must not call Mapbox directly.
- Strategic placement uses OR-Tools because it is an explicit discrete optimization problem.
- Live rendezvous selection evaluates approved candidate points deterministically. It does not require OR-Tools.

## Initial configuration

Central configuration will include the coverage target, rendezvous hospital-delay weight, maximum acceptable detour, and Mapbox token. These values must remain easy to change.
