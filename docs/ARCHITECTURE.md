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

## Boundaries

- The frontend displays operational state, sends control actions, and explains calculated results.
- The backend owns data validation, eligibility rules, routing calls, optimization, and response shaping.
- `routing.py` exposes provider-neutral functions such as route and travel-time lookups. Optimizers must not call Mapbox directly.
- Strategic placement uses OR-Tools because it is an explicit discrete optimization problem.
- Live rendezvous selection evaluates approved candidate points deterministically. It does not require OR-Tools.

## Initial configuration

Central configuration will include the coverage target, rendezvous hospital-delay weight, maximum acceptable detour, and Mapbox token. These values must remain easy to change.
