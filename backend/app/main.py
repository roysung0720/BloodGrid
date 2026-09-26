from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import FRONTEND_ORIGINS, SCENARIO_ID
from .models import (
    BloodUnit,
    HistoricalIncident,
    Hospital,
    LiveIncident,
    RendezvousPoint,
    ResponseUnit,
    ScenarioData,
    ScenarioMetadata,
    Station,
)
from .scenario_loader import ScenarioLoadError, load_scenario


app = FastAPI(
    title="BloodGrid API",
    version="0.1.0",
    description="Read-only scenario data for the BloodGrid operations map.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def get_active_scenario() -> ScenarioData:
    try:
        return load_scenario()
    except ScenarioLoadError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "scenario_id": SCENARIO_ID}


@app.get("/scenario", response_model=ScenarioData)
def scenario() -> ScenarioData:
    return get_active_scenario()


@app.get("/scenario/metadata", response_model=ScenarioMetadata)
def scenario_metadata() -> ScenarioMetadata:
    return get_active_scenario().metadata


@app.get("/stations", response_model=list[Station])
def stations() -> list[Station]:
    return get_active_scenario().stations


@app.get("/response-units", response_model=list[ResponseUnit])
def response_units() -> list[ResponseUnit]:
    return get_active_scenario().response_units


@app.get("/blood-units", response_model=list[BloodUnit])
def blood_units() -> list[BloodUnit]:
    return get_active_scenario().blood_units


@app.get("/hospitals", response_model=list[Hospital])
def hospitals() -> list[Hospital]:
    return get_active_scenario().hospitals


@app.get("/historical-incidents", response_model=list[HistoricalIncident])
def historical_incidents() -> list[HistoricalIncident]:
    return get_active_scenario().historical_incidents


@app.get("/rendezvous-points", response_model=list[RendezvousPoint])
def rendezvous_points() -> list[RendezvousPoint]:
    return get_active_scenario().rendezvous_points


@app.get("/live-incidents", response_model=list[LiveIncident])
def live_incidents() -> list[LiveIncident]:
    return get_active_scenario().live_incidents
