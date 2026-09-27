# BloodGrid Handoff

**Last updated:** 2026-09-26

**Current phase:** Live incident and approved-rendezvous evaluation complete; dynamic availability simulation is next.

**Audience:** Alex, project teammates, and coding agents joining the work.

## Start Here

Read these files in order:

1. `AGENTS.md` for repository-wide engineering rules.
2. `docs/PROJECT_CONTEXT.md` for the HackGT scope and working principles.
3. `docs/PRODUCT_SPEC.md` for the full product contract.
4. `docs/SAFETY_AND_ASSUMPTIONS.md` for non-negotiable boundaries.
5. `docs/ARCHITECTURE.md` and `docs/IMPLEMENTATION_PLAN.md` for the system boundaries and approved next phase.
6. `frontend/AGENTS.md` before changing the dashboard.
7. This file for the current implementation state and next actions.

## What BloodGrid Is

BloodGrid is a rural EMS logistics prototype. It helps operations teams answer two questions:

1. Where should scarce, eligible Blood Response Units stage to improve modeled access to prehospital blood?
2. After blood has already been requested, which eligible unit should respond and at which approved rendezvous point can it meet the transporting ambulance with minimal delay to definitive care?

The project is map-first and intended for a clear HackGT demo. It is not a clinical decision-maker.

## Non-Negotiable Rules

- Do not decide whether a patient needs blood, which product to use, dosage, diagnosis, treatment, or hospital destination.
- Treat a resource as eligible only when it has usable blood, an eligible vehicle, a qualified clinician, and valid operational/storage status.
- Include `ON_CALL` mobilization delay in travel calculations.
- Use only approved rendezvous points, never arbitrary midpoint coordinates.
- Always compare an intercept against direct transport to the supplied hospital. Direct transport may win.
- Keep core recommendations deterministic and explainable from the calculated data. Do not use an LLM for optimization or clinical logic.
- Clearly label operational demo data as synthetic. Never imply it is live EMS or patient data.
- Avoid paid services and extra architecture unless the team explicitly approves them.

## Current State

The GitHub remote is connected on the `main` branch. The foundation and initial scenario commits are published. The repository now contains a runnable FastAPI data service and Next.js map dashboard backed by the versioned scenario data.

Completed foundation work:

- Full product specification copied into `docs/PRODUCT_SPEC.md`.
- Project, architecture, safety, data-provenance, implementation, and demo documentation created.
- `.env.example` and `.gitignore` created.
- Folder homes created for frontend, backend, data, scripts, and tests.
- Local Python and Node installations verified.
- Versioned CSV schema contract created under `data/schemas/v1/`.
- Complete synthetic scenario `rural_ga_initial_v1` created under `data/scenarios/`.
- Scenario metadata, provenance, a live incident, and configuration selection guidance added.
- Read-only FastAPI endpoints added for the scenario and every map layer.
- Next.js operations dashboard added with a real Mapbox basemap, scenario markers, layer controls, unit status, and marker details.
- Local browser-map token wiring added through the root `.env` file; no token is stored in Git.
- Provider-neutral Mapbox Matrix routing adapter added under `backend/app/routing/`.
- Deterministic baseline coverage service added under `backend/app/coverage/`. It requires valid onboard blood, an available vehicle, a qualified clinician, and either `AVAILABLE` or `ON_CALL` crew status. It adds an on-call unit's configured mobilization delay.
- `GET /coverage/baseline` added. It uses the scenario target by default, returns a result for every synthetic demand point, and keeps Mapbox-specific code outside coverage logic.
- Dashboard coverage panel, covered/uncovered demand markers, and point-level response-time details added.
- Backend tests, frontend type check, production frontend build, and a live Mapbox routing request passed.
- OR-Tools CP-SAT strategic deployment service added under `backend/app/deployment/`.
- `GET /deployment/strategic` assigns each eligible unit to one active station without exceeding station capacity, then maximizes synthetic target-time coverage using the existing routing and eligibility interfaces.
- Dashboard strategic deployment panel added with a current/recommended view toggle, before/after coverage counts, and unit-to-station assignments.
- Deployment tests cover maximum coverage, station capacity, exclusion of an ineligible unit, and the effect of on-call mobilization delay.
- Deterministic live incident evaluator added under `backend/app/rendezvous/` with `GET /live-incidents/{incident_id}/rendezvous`.
- Live evaluation validates the supplied active destination without selecting or changing it; it compares direct transport with every approved active rendezvous point, then returns the best feasible logistics option or direct transport.
- Dashboard live incident panel added with direct transport, supplied hospital context, every candidate's status, and a map marker for the recommended approved point.
- Rendezvous tests cover an explainable recommendation, direct transport when an intercept is too late, on-call mobilization, unapproved points, and ineligible resources. The Mapbox adapter now also handles a single origin/destination comparison internally.

The scenario uses synthetic modeled rural-Georgia geography and operational data. It must not be presented as live or facility-accurate information.

## Repository Map

| Location | Purpose now | What will go there next |
| --- | --- | --- |
| `frontend/` | Runnable Next.js dashboard with baseline, strategic, and live-rendezvous views | Dynamic scenario controls |
| `backend/` | FastAPI scenario API, routing adapter, coverage, deployment, and rendezvous evaluation | Dynamic availability simulation |
| `data/raw/` | Empty | Untouched public source datasets |
| `data/processed/` | Empty | Cleaned geographic and demand-proxy data |
| `data/synthetic/` | Empty | Demo inventory, staffing, availability, and simulated incidents |
| `data/schemas/v1/` | CSV data contract | Future schema versions when needed |
| `data/scenarios/rural_ga_initial_v1/` | Complete initial demo world | Subsequent data scenarios |
| `scripts/` | Empty | Repeatable data-preparation and scenario-generation utilities |
| `tests/` | Empty | Deterministic tests for core calculations and API behavior |

## Agreed Technical Direction

- **Frontend:** Next.js, initially one operations dashboard.
- **Backend:** Python and FastAPI.
- **Routing:** Mapbox Matrix API for MVP road travel, hidden behind a provider-neutral routing interface. The provider batches the current three units and 30 demand points into two requests because Mapbox permits 25 coordinates per matrix request.
- **Baseline coverage:** Fastest eligible unit by estimated `mapbox/driving` duration plus configured on-call mobilization. The initial scenario has a 20-minute target. Local `BLOODGRID_COVERAGE_TARGET_MINUTES` may override that target for demonstration only.
- **Strategic optimizer:** Google OR-Tools CP-SAT in `backend/app/deployment/`. It assigns every eligible unit to one active station, respects station capacity, and maximizes the number of demand points covered within the target. Routing and eligibility remain outside the optimizer.
- **Live rendezvous:** deterministic candidate evaluation in `backend/app/rendezvous/`, not OR-Tools. It requires an existing authorized request, uses only approved active points, includes direct transport as the feasibility reference, and preserves the supplied destination hospital.
- **Rendezvous assumptions:** `BLOODGRID_RENDEZVOUS_MAX_ADDED_HOSPITAL_DELAY_MINUTES` defaults to `10`; `BLOODGRID_RENDEZVOUS_HOSPITAL_DELAY_WEIGHT` defaults to `0.5`. Both are local configuration values and must not be hard-coded elsewhere.
- **Persistence:** CSV and JSON for the MVP; no database required.
- **Optional AI:** only a later explanation layer, never core decision logic.

## Current Baseline Result

With the initial synthetic scenario and its 20-minute target, the live Mapbox verification produced:

- 3 eligible Blood Response Units.
- 11 of 30 synthetic demand points covered.
- 19 of 30 synthetic demand points outside the target.

These values are reproducible from the current scenario and routing provider but should still be described as synthetic prototype output, not an operational coverage claim. `mapbox/driving` supplies estimated road travel time without live-traffic, emergency-driving, weather, closure, dispatch-workload, or handoff-time modeling.

## Current Strategic Result

With the same initial synthetic scenario and 20-minute target, the live strategic deployment verification produced an `OPTIMAL` plan:

- Current arrangement: 11 of 30 synthetic demand points covered.
- Recommended arrangement: 18 of 30 synthetic demand points covered.
- `BR-01` -> Riverbend EMS (`S-04`).
- `BR-02` -> Pine Valley EMS (`S-03`).
- `BR-03` -> Highland EMS (`S-07`), retaining its 8-minute on-call mobilization delay.

This is a strategic planning comparison, not a real deployment command. It uses one narrow, explicit objective: maximize target-time coverage while respecting the synthetic station capacities.

## Current Live Incident Result

With the same synthetic scenario, live Mapbox verification for `LIVE-001` produced:

- Supplied destination: North Valley Trauma Center (`H-01`, recorded `LEVEL_II`). BloodGrid validated that it is an active record but did not choose it.
- Direct transport estimate: 28.7 minutes.
- Recommendation: `RV-03`, Route 17 Safe Staging Area, with `BR-02`.
- Estimated time-to-blood: 19.5 minutes; the patient ambulance waits 6.5 minutes and the resource waits 0 minutes.
- Modeled hospital arrival after rendezvous: 34.9 minutes, or 6.2 minutes of added delay compared with direct transport.
- Other points were rejected transparently as too late or as exceeding the configured 10-minute added-delay limit.

This is synthetic logistics output, not a clinical transfusion, transport, or destination recommendation.

## Working Across Agents

This section is the practical integration contract for Alex, Claude, Codex, and any future coding agent. The goal is for one agent's work to fit the repository cleanly rather than creating a parallel implementation.

### Before Starting a Change

1. Start from the latest `main` branch and inspect `git status`. Preserve any work already present; do not reset, overwrite, or reformat unrelated files.
2. Read the files in **Start Here**, then identify the current milestone in `docs/IMPLEMENTATION_PLAN.md`. Do not begin a later feature while the current milestone is unfinished.
3. State the intended behavior, the likely files to touch, and which existing interface will be extended before editing.
4. Work in one focused branch or commit-sized slice. Avoid unrelated cleanup, framework swaps, package changes, or broad stylistic rewrites.

### Existing Interfaces to Preserve

| Responsibility | Existing home | Integration rule |
| --- | --- | --- |
| Scenario loading and validation | `backend/app/scenario_loader.py` | Read versioned CSV/JSON scenario data here. Do not duplicate scenario data in the frontend. |
| Configuration and private environment values | `backend/app/config.py` and root `.env` | Add configurable values centrally. Never commit `.env` or paste token values into source, docs, logs, or chat. |
| Road routing | `backend/app/routing/provider.py` | New coverage, deployment, or rendezvous code must use `RoutingProvider`; only `backend/app/routing/mapbox_provider.py` may contain Mapbox request details. |
| Eligibility and baseline coverage | `backend/app/coverage/service.py` | Reuse or extend the explicit eligibility rule. Do not create a second, slightly different eligibility check elsewhere. |
| Live rendezvous evaluation | `backend/app/rendezvous/service.py` | Use the existing routing and eligibility interfaces. Only approved, active points may be evaluated; preserve the incident's supplied destination. |
| HTTP API | `backend/app/main.py` | Keep endpoint functions thin: receive a request, call a service, return typed data. Put business logic in focused modules. |
| Dashboard API client and types | `frontend/src/lib/api.ts` and `frontend/src/lib/types.ts` | Add backend response shapes here before displaying them. Do not calculate coverage or optimization results in the browser. |
| Map rendering | `frontend/src/components/OperationsMap.tsx` | Use it to visualize API results. Keep marker semantics, colors, labels, and legend entries synchronized. |
| Scenario data contract | `data/schemas/v1/` and `data/scenarios/` | Create a new scenario or schema version when data meaning changes; retain synthetic labels and provenance. |

### Current Technical Facts

- The dashboard calls the FastAPI backend at `http://localhost:8000` by default.
- The root `.env` contains local configuration. `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is used by the browser map. `MAPBOX_ACCESS_TOKEN` is preferred for backend routing; the local backend can temporarily fall back to the browser token.
- `GET /coverage/baseline` returns typed results for all 30 synthetic demand points. It uses the scenario's `target_coverage_minutes` unless `BLOODGRID_COVERAGE_TARGET_MINUTES` is set locally.
- `GET /deployment/strategic` returns the OR-Tools result for the same scenario. Its core code is `backend/app/deployment/service.py`; tests must use a fake `RoutingProvider`, not live Mapbox requests.
- `GET /live-incidents/{incident_id}/rendezvous` returns the deterministic live comparison. Its core code is `backend/app/rendezvous/service.py`; tests must use a fake `RoutingProvider`, not live Mapbox requests.
- The current routing profile is `mapbox/driving`, and `MapboxMatrixProvider` batches the initial three eligible units and 30 demand points into two Matrix API requests.
- The coverage result is a logistics estimate only. It does not provide a dispatch order, clinical recommendation, hospital selection, or real-world response guarantee.
- The next approved work is dynamic availability simulation. It should change scenario resource status through a controlled demo mechanism, then recalculate baseline coverage, strategic deployment, and live rendezvous output using the same eligibility rule.

### Required Handoff From an Agent

Before an agent asks Alex or another agent to integrate its work, it should provide all of the following in its final note or commit message:

1. The user-facing behavior that changed.
2. The files added or materially changed, grouped by backend, frontend, data, and docs.
3. Any new environment variable, scenario field, API endpoint, or dependency.
4. The deterministic tests and local checks run, including their result.
5. Any limitation, assumption, or follow-up that remains.
6. An update to this document when the current state, architecture, setup, or recommended next work changes.

### Minimum Verification Before Integration

Run the relevant checks from the repository root after merging or applying another agent's patch:

```bash
cd backend
./.venv/bin/python -m unittest discover -s tests

cd ../frontend
npm run lint
npm run build
```

For dashboard changes, also start the backend and frontend locally and inspect `http://localhost:3000`. Confirm that the synthetic-data label remains visible, map layers still toggle, and the changed result is understandable from the displayed facts.

## Next Recommended Work

Build dynamic availability simulation:

1. Define a small synthetic availability change that can be triggered and reversed locally without editing the source scenario files.
2. Reuse the shared eligibility rule so unavailable vehicle, on-call, unqualified clinician, and invalid-blood states affect every calculation consistently.
3. Recalculate the current baseline, strategic staging plan, and live rendezvous result from the changed state.
4. Make the before/after operational effect understandable in the dashboard without implying a clinical recommendation.
5. Add deterministic tests for each affected calculation and retain the original scenario as the resettable baseline.

## Important Decisions Still Open

- Exact Georgia demo region.
- Coverage target, currently 20 minutes in `rural_ga_initial_v1`; whether it should differ for the final demo.
- Whether the default 10-minute maximum hospital delay and 0.5 hospital-delay weight should change for the final demo.
- How much real public geography to incorporate in the first demo dataset.
- Whether the final demo includes optional OpenAI-generated wording.

These values should be centralized as configuration rather than hard-coded.

## Before You Make Changes

1. Check `git status` to see any teammate work that is not yet committed.
2. Read the documents listed in **Start Here**.
3. Keep changes focused on the current phase in `docs/IMPLEMENTATION_PLAN.md`.
4. Do not overwrite or remove other contributors' changes.

## Update This Document

Update this handoff at the end of every meaningful work session or whenever any of these change:

- current phase or completed features;
- file structure or architecture;
- datasets, source provenance, or synthetic/real status;
- configuration decisions or required environment variables;
- endpoints, user-facing workflows, or how to run the project;
- known limitations, blockers, or next recommended work.

Keep the opening status current, list what changed, and leave the next person with one clear recommended starting point. Prefer short, concrete language over a detailed activity log.
