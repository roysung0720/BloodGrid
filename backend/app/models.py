from __future__ import annotations

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    min_latitude: float
    max_latitude: float
    min_longitude: float
    max_longitude: float


class ScenarioMetadata(BaseModel):
    scenario_id: str
    name: str
    schema_version: str
    classification: str
    geographic_area: str
    coordinate_system: str
    bounding_box: BoundingBox
    default_live_incident_id: str
    target_coverage_minutes: int = Field(ge=1)
    purpose: str
    limitations: str


class Station(BaseModel):
    station_id: str
    name: str
    latitude: float
    longitude: float
    station_type: str
    active: bool
    capacity: int = Field(ge=0)


class ResponseUnit(BaseModel):
    unit_id: str
    unit_type: str
    home_station_id: str
    current_latitude: float
    current_longitude: float
    vehicle_status: str
    crew_status: str
    crew_level: str
    blood_credentialed: bool
    mobilization_minutes: float = Field(ge=0)
    blood_units_onboard: int = Field(ge=0)
    shift_start: str
    shift_end: str


class BloodUnit(BaseModel):
    blood_unit_id: str
    product_type: str
    current_location_type: str
    current_location_id: str
    expiration_datetime: str
    temperature_status: str
    availability_status: str


class Hospital(BaseModel):
    hospital_id: str
    name: str
    latitude: float
    longitude: float
    trauma_level: str
    active: bool


class HistoricalIncident(BaseModel):
    incident_id: str
    timestamp: str
    latitude: float
    longitude: float
    incident_type: str
    severity_proxy: str
    source: str


class RendezvousPoint(BaseModel):
    rendezvous_id: str
    name: str
    latitude: float
    longitude: float
    location_type: str
    approved: bool
    active: bool


class LiveIncident(BaseModel):
    incident_id: str
    latitude: float
    longitude: float
    destination_hospital_id: str
    blood_requested: bool
    patient_unit_id: str
    status: str
    created_at: str


class ScenarioData(BaseModel):
    metadata: ScenarioMetadata
    stations: list[Station]
    response_units: list[ResponseUnit]
    blood_units: list[BloodUnit]
    hospitals: list[Hospital]
    historical_incidents: list[HistoricalIncident]
    rendezvous_points: list[RendezvousPoint]
    live_incidents: list[LiveIncident]
