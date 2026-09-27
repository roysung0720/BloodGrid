from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from ..rendezvous.models import LiveRendezvousResult


BloodRequestStatus = Literal[
    "ACTIVE_RENDEZVOUS", "ACTIVE_DIRECT", "BLOOD_RECEIVED", "ARRIVED", "CANCELLED"
]


class AmbulanceOption(BaseModel):
    unit_id: str
    start_incident_id: str
    start_latitude: float
    start_longitude: float


class HospitalOption(BaseModel):
    hospital_id: str
    name: str
    trauma_level: str
    latitude: float
    longitude: float
    routable: bool
    drive_minutes: Optional[float] = Field(default=None, ge=0)
    distance_miles: Optional[float] = Field(default=None, ge=0)


class BloodProductOption(BaseModel):
    product_type: str
    label: str
    available: bool
    eligible_unit_count: int = Field(ge=0)


class ResourceOption(BaseModel):
    unit_id: str
    latitude: float
    longitude: float
    eligible: bool
    reasons: list[str]
    crew_status: str
    arrival_minutes: Optional[float] = Field(default=None, ge=0)


class RouteStepResult(BaseModel):
    instruction: str
    maneuver_type: str
    modifier: str
    road_name: str
    distance_meters: float = Field(ge=0)
    duration_seconds: float = Field(ge=0)
    longitude: float
    latitude: float


class RouteResult(BaseModel):
    duration_minutes: float = Field(ge=0)
    distance_miles: float = Field(ge=0)
    geometry: list[list[float]]
    steps: list[RouteStepResult]


class CreateBloodRequest(BaseModel):
    unit_id: str
    latitude: float
    longitude: float
    blood_product: str
    destination_hospital_id: str
    availability_profile: str = "baseline"
    # Which versioned scenario the crew is in; defaults to the backend's startup scenario.
    scenario_id: Optional[str] = None


class PositionUpdate(BaseModel):
    latitude: float
    longitude: float


class BloodRequest(BaseModel):
    request_id: str
    classification: Literal["SIMULATED"] = "SIMULATED"
    scenario_id: str
    unit_id: str
    blood_product: str
    destination_hospital_id: str
    destination_hospital_name: str
    destination_latitude: float
    destination_longitude: float
    availability_profile: str
    status: BloodRequestStatus
    ended_reason: Optional[str] = None
    latitude: float
    longitude: float
    created_at: str
    updated_at: str
    rendezvous: LiveRendezvousResult


class AmbulanceSettings(BaseModel):
    arrival_radius_meters: float = Field(gt=0)
    eta_refresh_seconds: float = Field(gt=0)
    position_report_seconds: float = Field(gt=0)
    request_poll_seconds: float = Field(gt=0)
    sim_speed_multiplier: float = Field(gt=0)
