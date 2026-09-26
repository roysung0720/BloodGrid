# Backend

This folder contains the FastAPI service and its tests. It validates the selected scenario, exposes the read-only map data, and calculates road-based baseline coverage for its synthetic demand points.

Core modules now: `main.py`, `models.py`, `config.py`, `scenario_loader.py`, `routing/`, and `coverage/`.

Future modules: `deployment_optimizer.py`, `rendezvous.py`, and `simulation.py`.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API starts at `http://localhost:8000`. Open `http://localhost:8000/docs` to inspect the endpoints. `GET /coverage/baseline` uses the configured Mapbox Matrix provider to calculate road distance and driving time from each eligible response unit to each synthetic demand point. It adds an on-call unit's mobilization delay before comparing the result with the selected scenario's target time.

Set `MAPBOX_ACCESS_TOKEN` in the root `.env` file for backend routing. During local development only, the backend falls back to `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` when no separate routing token is present.

Run the loader test with:

```bash
python -m unittest discover -s tests
```
