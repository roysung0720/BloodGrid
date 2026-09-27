# Backend

This folder contains the FastAPI service and its tests. It validates the selected scenario, exposes the read-only map data, calculates road-based baseline coverage, optimizes strategic unit staging, and evaluates approved live-incident rendezvous points for its synthetic scenario.

Core modules now: `main.py`, `models.py`, `config.py`, `scenario_loader.py`, `routing/`, `coverage/`, `deployment/`, and `rendezvous/`.

Future modules: `simulation.py`.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API starts at `http://localhost:8000`. Open `http://localhost:8000/docs` to inspect the endpoints. `GET /coverage/baseline` uses the configured Mapbox Matrix provider to calculate road distance and driving time from each eligible response unit to each synthetic demand point. It adds an on-call unit's mobilization delay before comparing the result with the selected scenario's target time.

`GET /deployment/strategic` uses the same provider-neutral routing interface and shared eligibility rule. The OR-Tools CP-SAT model assigns every eligible unit to one active station without exceeding station capacity, then maximizes the number of synthetic demand points reachable within the target time. Mapbox-specific code does not appear in the optimizer.

`GET /live-incidents/{incident_id}/rendezvous` validates the supplied active destination, compares direct patient transport with every approved active rendezvous point, and returns an explainable logistics result. A point is eligible only when an eligible resource can deliver before direct arrival and the modeled added hospital delay remains within the configured limit. The service never chooses or changes the destination hospital.

Set `MAPBOX_ACCESS_TOKEN` in the root `.env` file for backend routing. During local development only, the backend falls back to `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` when no separate routing token is present.

Run the loader test with:

```bash
python -m unittest discover -s tests
```
