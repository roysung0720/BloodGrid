# BloodGrid

BloodGrid is a HackGT prototype for rural EMS prehospital-blood logistics. It helps operations teams decide where eligible blood-capable response units should stage and, after an authorized blood request, whether and where one should rendezvous with a transporting ambulance.

It is decision support for logistics, not a clinical decision-maker. BloodGrid does not determine whether a patient needs blood, select a blood product, or make treatment decisions.

## Project status

The project foundation, two versioned demo datasets, map-first operations dashboard, road-based baseline coverage calculation, strategic deployment recommendation, multi-incident live rendezvous evaluation, and dynamic availability simulation are in place. A working crew-facing Ambulance UI (`/ambulance`, reached with the **Ambulance view** button) lets a crew send a blood request and follow navigation to the rendezvous point and hospital. The current milestone is data improvement and polish.

## Planned application

- `frontend/`: Next.js map-first operations dashboard.
- `backend/`: FastAPI API, routing adapter, coverage calculations, strategic optimizer, and live rendezvous evaluator.
- `data/`: documented source data, schemas, and versioned runnable scenarios.
- `scripts/`: repeatable data preparation and demo-scenario utilities.
- `tests/`: deterministic tests for core decisions.

## Documentation

- `docs/PRODUCT_SPEC.md`: the full product and implementation specification.
- `docs/PROJECT_CONTEXT.md`: HackGT scope and working principles.
- `docs/ARCHITECTURE.md`: intended system boundaries.
- `docs/DATA_MODEL.md`: core records and eligibility rules.
- `docs/DATA_SOURCES.md`: provenance requirements.
- `docs/SAFETY_AND_ASSUMPTIONS.md`: clinical and operational limits.
- `docs/HANDOFF.md`: current project state and teammate/agent handoff context.
- `docs/IMPLEMENTATION_PLAN.md`: build order and milestones.
- `docs/DEMO_PLAN.md`: intended demo narrative.
- `docs/AMBULANCE_UI_SPEC.md`: the System UI / Ambulance UI split and the crew-facing request and navigation flow, including how it was built.

## Local development

Run the backend and frontend in separate terminals:

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend, in another terminal
cd frontend
npm install
npm run dev
```

Copy `.env.example` to `.env` and supply a Mapbox access token before testing road routing. `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` draws the browser map; `MAPBOX_ACCESS_TOKEN` is the backend routing token. For this local prototype, the backend can fall back to the browser token, but keeping the routing token separate is recommended. Do not commit `.env` or any real keys.

`BLOODGRID_SCENARIO` identifies the default data bundle when the backend starts. The dashboard's **Demo data set** menu can then switch between all available versioned scenarios without editing `.env` or restarting either local service. The default bundle is `rural_ga_initial_v1`, an all-synthetic demo. `echols_valdosta_public_geography_v1` is an optional second demo that combines public Census/CMS geography and facility references with explicitly synthetic operations. See `data/scenarios/` for each bundle's provenance.

The map dashboard uses `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. The backend uses the Mapbox Matrix API for baseline coverage, strategic staging, and live incident evaluation. The dashboard compares the current synthetic arrangement with an OR-Tools recommendation, then evaluates approved rendezvous points against direct transport to the selected incident's supplied hospital without selecting a destination. The Synthetic operating state selector applies named synthetic availability cases to all three calculations without changing the source scenario files; the Live incident selector changes only the request being evaluated.
