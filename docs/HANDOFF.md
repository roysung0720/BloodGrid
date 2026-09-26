# BloodGrid Handoff

**Last updated:** 2026-09-26

**Current phase:** Map display complete; routing and baseline coverage not yet started.

**Audience:** Alex, project teammates, and coding agents joining the work.

## Start Here

Read these files in order:

1. `docs/PROJECT_CONTEXT.md` for the HackGT scope and working principles.
2. `docs/PRODUCT_SPEC.md` for the full product contract.
3. `docs/SAFETY_AND_ASSUMPTIONS.md` for non-negotiable boundaries.
4. This file for the current implementation state and next actions.

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
- Backend loader test, frontend type check, production frontend build, and live browser map check passed.

The scenario uses synthetic modeled rural-Georgia geography and operational data. It must not be presented as live or facility-accurate information.

## Repository Map

| Location | Purpose now | What will go there next |
| --- | --- | --- |
| `frontend/` | Runnable Next.js operations dashboard | Routing results and later decision controls |
| `backend/` | Runnable read-only FastAPI scenario API | Routing, coverage, optimizer, and rendezvous logic |
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
- **Routing:** Mapbox for MVP road travel, hidden behind a provider-neutral routing interface.
- **Strategic optimizer:** Google OR-Tools CP-SAT.
- **Live rendezvous:** straightforward deterministic candidate evaluation, not OR-Tools.
- **Persistence:** CSV and JSON for the MVP; no database required.
- **Optional AI:** only a later explanation layer, never core decision logic.

## Next Recommended Work

Build routing and baseline coverage:

1. Add `backend/app/routing.py` with provider-neutral route and travel-time functions.
2. Keep the Mapbox implementation confined to that adapter and use a server-only `MAPBOX_ACCESS_TOKEN` for requests.
3. Verify point-to-point road duration, distance, and a small travel-time matrix using the initial scenario.
4. Add a deterministic baseline coverage calculation using only eligible units and the configured target time.
5. Display the baseline coverage result without adding strategic optimization yet.

## Important Decisions Still Open

- Exact Georgia demo region.
- Coverage target, initially expected to be around 20 minutes.
- Rendezvous score weight for hospital delay and maximum acceptable detour.
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
