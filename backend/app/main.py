from __future__ import annotations

from collections.abc import Callable
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
from .deployment.service import (
    DeploymentError,
    apply_strategic_staging,
    calculate_strategic_deployment,
)
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
from .blood_requests.models import (
    AmbulanceOption,
    AmbulanceSettings,
    BloodProductOption,
    BloodRequest,
    CreateBloodRequest,
    HospitalOption,
    PositionUpdate,
    ResourceOption,
    RouteResult,
)
from .blood_requests.service import (
    BloodRequestError,
    BloodRequestNotFound,
    BloodRequestStore,
    blood_product_options,
    hospital_options,
    list_ambulances,
    resource_options,
    route_between,
    route_options_between,
)
from .config import ambulance_settings


app = FastAPI(
    title="BloodGrid API",
    version="0.1.0",
    description="Read-only scenario data for the BloodGrid operations map.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
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
    recommended_staging: bool = False,
) -> LiveRendezvousResult:
    try:
        scenario = get_active_scenario(scenario_id, availability_profile)
        if recommended_staging:
            deployment = calculate_strategic_deployment(scenario, get_routing_provider())
            scenario = apply_strategic_staging(scenario, deployment)
        return calculate_live_rendezvous(
            scenario,
            incident_id,
            get_routing_provider(),
            resource_positioning=(
                "RECOMMENDED_STAGING" if recommended_staging else "CURRENT"
            ),
        )
    except RendezvousError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (DeploymentError, RoutingError, ValueError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


# ----- Ambulance UI -------------------------------------------------------------
# Crew requests live in memory only and are lost when the backend restarts.

BLOOD_REQUESTS = BloodRequestStore()


@app.get("/ambulance/settings", response_model=AmbulanceSettings)
def ambulance_ui_settings() -> AmbulanceSettings:
    try:
        return AmbulanceSettings(**ambulance_settings())
    except ValueError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/ambulances", response_model=list[AmbulanceOption])
def ambulances(scenario_id: str = SCENARIO_ID) -> list[AmbulanceOption]:
    return list_ambulances(get_active_scenario(scenario_id))


@app.get("/hospital-options", response_model=list[HospitalOption])
def ambulance_hospital_options(
    lat: float,
    lon: float,
    scenario_id: str = SCENARIO_ID,
    availability_profile: str = "baseline",
) -> list[HospitalOption]:
    try:
        return hospital_options(
            get_active_scenario(scenario_id, availability_profile),
            lat,
            lon,
            get_routing_provider(),
        )
    except RoutingError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.get("/blood-products", response_model=list[BloodProductOption])
def ambulance_blood_products(
    scenario_id: str = SCENARIO_ID, availability_profile: str = "baseline"
) -> list[BloodProductOption]:
    return blood_product_options(get_active_scenario(scenario_id, availability_profile))


@app.get("/resource-options", response_model=list[ResourceOption])
def ambulance_resource_options(
    lat: float,
    lon: float,
    scenario_id: str = SCENARIO_ID,
    availability_profile: str = "baseline",
) -> list[ResourceOption]:
    try:
        return resource_options(
            get_active_scenario(scenario_id, availability_profile),
            lat,
            lon,
            get_routing_provider(),
        )
    except RoutingError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.get("/route", response_model=RouteResult)
def road_route(
    from_lat: float, from_lon: float, to_lat: float, to_lon: float
) -> RouteResult:
    try:
        route = route_between(get_routing_provider(), from_lat, from_lon, to_lat, to_lon)
    except RoutingError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    if route is None:
        raise HTTPException(status_code=404, detail="No road route is available.")
    return route


@app.get("/route/options", response_model=list[RouteResult])
def road_route_options(
    from_lat: float, from_lon: float, to_lat: float, to_lon: float
) -> list[RouteResult]:
    """Fastest route first, then alternative roads between the same two points (Reroute)."""

    try:
        return route_options_between(get_routing_provider(), from_lat, from_lon, to_lat, to_lon)
    except RoutingError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.post("/requests", response_model=BloodRequest)
def create_blood_request(submission: CreateBloodRequest) -> BloodRequest:
    try:
        return BLOOD_REQUESTS.create(
            get_active_scenario(
                submission.scenario_id or SCENARIO_ID, submission.availability_profile
            ),
            submission,
            get_routing_provider(),
        )
    except (BloodRequestError, RendezvousError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (RoutingError, ValueError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.get("/requests", response_model=list[BloodRequest])
def blood_requests() -> list[BloodRequest]:
    return BLOOD_REQUESTS.list()


@app.get("/requests/{request_id}", response_model=BloodRequest)
def blood_request(request_id: str) -> BloodRequest:
    return _request_action(lambda: BLOOD_REQUESTS.get(request_id))


@app.post("/requests/{request_id}/position", response_model=BloodRequest)
def blood_request_position(request_id: str, position: PositionUpdate) -> BloodRequest:
    radius = ambulance_settings()["arrival_radius_meters"]
    return _request_action(
        lambda: BLOOD_REQUESTS.update_position(
            request_id, position.latitude, position.longitude, radius
        )
    )


@app.post("/requests/{request_id}/blood-received", response_model=BloodRequest)
def blood_request_received(request_id: str) -> BloodRequest:
    return _request_action(lambda: BLOOD_REQUESTS.mark_blood_received(request_id))


@app.post("/requests/{request_id}/cancel", response_model=BloodRequest)
def blood_request_cancel(request_id: str, by: str = "crew") -> BloodRequest:
    reason = "Cancelled by operations." if by == "operations" else "Ended by the crew."
    return _request_action(lambda: BLOOD_REQUESTS.cancel(request_id, reason))


def _request_action(action: Callable[[], BloodRequest]) -> BloodRequest:
    try:
        return action()
    except BloodRequestNotFound as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except BloodRequestError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
