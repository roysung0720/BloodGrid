# Backend

This folder contains the FastAPI service and its tests. The first increment is a read-only scenario API for the dashboard. It validates the selected scenario and exposes its stations, units, hospitals, demand points, rendezvous points, and live incidents.

Core modules now: `main.py`, `models.py`, `config.py`, and `scenario_loader.py`.

Future modules: `routing.py`, `coverage.py`, `deployment_optimizer.py`, `rendezvous.py`, and `simulation.py`.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API starts at `http://localhost:8000`. Open `http://localhost:8000/docs` to inspect the current read-only endpoints.

Run the loader test with:

```bash
python -m unittest discover -s tests
```
