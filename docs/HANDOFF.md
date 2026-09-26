# BloodGrid Handoff

**Last updated:** 2026-09-25  
**Current phase:** Minimal demo data world complete; map display not yet created.

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

The GitHub remote is connected on the `main` branch. The foundation commit is published. The repository now contains documentation and a versioned CSV scenario, but no runnable frontend, backend, API endpoints, dependencies, or tests yet.

Completed foundation work:

- Full product specification copied into `docs/PRODUCT_SPEC.md`.
- Project, architecture, safety, data-provenance, implementation, and demo documentation created.
- `.env.example` and `.gitignore` created.
- Folder homes created for frontend, backend, data, scripts, and tests.
- Local Python and Node installations verified.
- Versioned CSV schema contract created under `data/schemas/v1/`.
- Complete synthetic scenario `rural_ga_initial_v1` created under `data/scenarios/`.
- Scenario metadata, provenance, a live incident, and configuration selection guidance added.

The scenario uses synthetic modeled rural-Georgia geography and operational data. It must not be presented as live or facility-accurate information.

## Repository Map

| Location | Purpose now | What will go there next |
| --- | --- | --- |
| `frontend/` | Dashboard guidance | Next.js app, map, controls, metrics, incident view |
| `backend/` | Service guidance | FastAPI app, models, routing, coverage, optimizer, rendezvous logic |
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

Build the map display for the initial scenario:

1. Scaffold the Next.js application in `frontend/`.
2. Load `rural_ga_initial_v1` through a temporary local data layer or the initial FastAPI endpoint.
3. Display stations, hospitals, response units, demand-proxy incidents, and approved rendezvous points on one map-first dashboard.
4. Show each unit's availability state and clearly label the scenario as synthetic.
5. Do not add routing, coverage, optimization, or clinical logic yet.

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
