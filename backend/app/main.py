from __future__ import annotations

from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import (
    FRONTEND_ORIGINS,
    MAPBOX_ACCESS_TOKEN,
    MAPBOX_ROUTING_PROFILE,
    ROUTING_TIMEOUT_SECONDS,
    SCENARIO_ID,
)
from .availability.service import AvailabilityProfileError, apply_availability_profile
from .coverage.models import BaselineCoverageResult
from .coverage.service import calculate_baseline_coverage
from .deployment.models import StrategicDeploymentResult
from .deployment.service import DeploymentError, calculate_strategic_deployment
from .rendezvous.models import LiveRendezvousResult
from .rendezvous.service import RendezvousError, calculate_live_rendezvous
from .models import (
    AvailabilityProfile,
    BloodUnit,
    HistoricalIncident,
    Hospital,
    LiveIncident,
    RendezvousPoint,
    ResponseUnit,
    ScenarioData,
    ScenarioCatalogEntry,
    ScenarioMetadata,
    Station,
)
from .scenario_loader import ScenarioLoadError, list_scenarios, load_scenario
from .routing.mapbox_provider import MapboxMatrixProvider, RoutingError


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


def get_active_scenario(
    scenario_id: str = SCENARIO_ID, availability_profile: str = "baseline"
) -> ScenarioData:
    try:
        return apply_availability_profile(load_scenario(scenario_id), availability_profile)
    except ScenarioLoadError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except AvailabilityProfileError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@lru_cache
def get_routing_provider() -> MapboxMatrixProvider:
    return MapboxMatrixProvider(
        access_token=MAPBOX_ACCESS_TOKEN or "",
        profile=MAPBOX_ROUTING_PROFILE,
        timeout_seconds=ROUTING_TIMEOUT_SECONDS,
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "scenario_id": SCENARIO_ID}


@app.get("/scenarios", response_model=list[ScenarioCatalogEntry])
def scenarios() -> list[ScenarioCatalogEntry]:
    try:
        return list_scenarios()
    except ScenarioLoadError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/scenario", response_model=ScenarioData)
def scenario(
    scenario_id: str = SCENARIO_ID, availability_profile: str = "baseline"
) -> ScenarioData:
    return get_active_scenario(scenario_id, availability_profile)


@app.get("/availability-profiles", response_model=list[AvailabilityProfile])
def availability_profiles(scenario_id: str = SCENARIO_ID) -> list[AvailabilityProfile]:
    return load_scenario(scenario_id).availability_profiles


@app.get("/scenario/metadata", response_model=ScenarioMetadata)
def scenario_metadata(scenario_id: str = SCENARIO_ID) -> ScenarioMetadata:
    return get_active_scenario(scenario_id).metadata


@app.get("/stations", response_model=list[Station])
def stations(scenario_id: str = SCENARIO_ID) -> list[Station]:
    return get_active_scenario(scenario_id).stations


@app.get("/response-units", response_model=list[ResponseUnit])
def response_units(scenario_id: str = SCENARIO_ID) -> list[ResponseUnit]:
    return get_active_scenario(scenario_id).response_units


@app.get("/blood-units", response_model=list[BloodUnit])
def blood_units(scenario_id: str = SCENARIO_ID) -> list[BloodUnit]:
    return get_active_scenario(scenario_id).blood_units


@app.get("/hospitals", response_model=list[Hospital])
def hospitals(scenario_id: str = SCENARIO_ID) -> list[Hospital]:
    return get_active_scenario(scenario_id).hospitals


@app.get("/historical-incidents", response_model=list[HistoricalIncident])
def historical_incidents(scenario_id: str = SCENARIO_ID) -> list[HistoricalIncident]:
    return get_active_scenario(scenario_id).historical_incidents


@app.get("/rendezvous-points", response_model=list[RendezvousPoint])
def rendezvous_points(scenario_id: str = SCENARIO_ID) -> list[RendezvousPoint]:
    return get_active_scenario(scenario_id).rendezvous_points


@app.get("/live-incidents", response_model=list[LiveIncident])
def live_incidents(scenario_id: str = SCENARIO_ID) -> list[LiveIncident]:
    return get_active_scenario(scenario_id).live_incidents


@app.get("/coverage/baseline", response_model=BaselineCoverageResult)
def baseline_coverage(
    scenario_id: str = SCENARIO_ID, availability_profile: str = "baseline"
) -> BaselineCoverageResult:
    try:
        return calculate_baseline_coverage(
            get_active_scenario(scenario_id, availability_profile), get_routing_provider()
        )
    except (RoutingError, ValueError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.get("/deployment/strategic", response_model=StrategicDeploymentResult)
def strategic_deployment(
    scenario_id: str = SCENARIO_ID,
    availability_profile: str = "baseline",
) -> StrategicDeploymentResult:
    try:
        return calculate_strategic_deployment(
            get_active_scenario(scenario_id, availability_profile), get_routing_provider()
        )
    except (DeploymentError, RoutingError, ValueError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.get(
    "/live-incidents/{incident_id}/rendezvous", response_model=LiveRendezvousResult
)
def live_incident_rendezvous(
    incident_id: str,
    scenario_id: str = SCENARIO_ID,
    availability_profile: str = "baseline",
) -> LiveRendezvousResult:
    try:
        return calculate_live_rendezvous(
            get_active_scenario(scenario_id, availability_profile),
            incident_id,
            get_routing_provider(),
        )
    except RendezvousError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (RoutingError, ValueError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
