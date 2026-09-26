# BloodGrid

BloodGrid is a HackGT prototype for rural EMS prehospital-blood logistics. It helps operations teams decide where eligible blood-capable response units should stage and, after an authorized blood request, whether and where one should rendezvous with a transporting ambulance.

It is decision support for logistics, not a clinical decision-maker. BloodGrid does not determine whether a patient needs blood, select a blood product, or make treatment decisions.

## Project status

The project foundation is in place. The next milestone is a small, documented demo dataset and a map that displays its stations, hospitals, units, incident-demand points, and approved rendezvous locations.

## Planned application

- `frontend/`: Next.js map-first operations dashboard.
- `backend/`: FastAPI API, routing adapter, coverage calculations, strategic optimizer, and rendezvous logic.
- `data/`: documented real and synthetic source data.
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

The runnable applications will be added in subsequent phases. The expected workflow is:

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

Copy `.env.example` to `.env` and supply a Mapbox access token before testing road routing. Do not commit `.env` or any real keys.
