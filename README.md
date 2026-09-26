# BloodGrid

BloodGrid is a HackGT prototype for rural EMS prehospital-blood logistics. It helps operations teams decide where eligible blood-capable response units should stage and, after an authorized blood request, whether and where one should rendezvous with a transporting ambulance.

It is decision support for logistics, not a clinical decision-maker. BloodGrid does not determine whether a patient needs blood, select a blood product, or make treatment decisions.

## Project status

The project foundation, first versioned demo dataset, map-first operations dashboard, and road-based baseline coverage calculation are in place. The next milestone is strategic deployment recommendations.

## Planned application

- `frontend/`: Next.js map-first operations dashboard.
- `backend/`: FastAPI API, routing adapter, coverage calculations, strategic optimizer, and rendezvous logic.
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

`BLOODGRID_SCENARIO` identifies the data bundle the backend will load. The initial bundle is `rural_ga_initial_v1`; see `data/scenarios/` for its contents and provenance.

The map dashboard uses `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. The baseline coverage endpoint uses the Mapbox Matrix API through the backend and returns estimated road time, road distance, and the fastest eligible unit for each synthetic demand point.
