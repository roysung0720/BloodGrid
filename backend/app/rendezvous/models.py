from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


RendezvousCandidateStatus = Literal[
    "RECOMMENDED",
    "NOT_SELECTED",
    "INELIGIBLE_POINT",
    "NO_ELIGIBLE_RESOURCE",
    "NO_ROUTE",
    "TOO_LATE",
    "EXCESSIVE_DETOUR",
]
RendezvousRecommendation = Literal["RENDEZVOUS", "DIRECT_TRANSPORT"]


class RendezvousCandidate(BaseModel):
    rendezvous_id: str
    rendezvous_name: str
    status: RendezvousCandidateStatus
    reason: str
    resource_id: Optional[str] = None
    patient_to_rendezvous_minutes: Optional[float] = Field(default=None, ge=0)
    resource_driving_minutes: Optional[float] = Field(default=None, ge=0)
    mobilization_minutes: Optional[float] = Field(default=None, ge=0)
    resource_arrival_minutes: Optional[float] = Field(default=None, ge=0)
    patient_wait_minutes: Optional[float] = Field(default=None, ge=0)
    resource_wait_minutes: Optional[float] = Field(default=None, ge=0)
    time_to_blood_minutes: Optional[float] = Field(default=None, ge=0)
    rendezvous_to_hospital_minutes: Optional[float] = Field(default=None, ge=0)
    hospital_arrival_minutes: Optional[float] = Field(default=None, ge=0)
    added_hospital_delay_minutes: Optional[float] = Field(default=None)
    score: Optional[float] = Field(default=None, ge=0)


class LiveRendezvousResult(BaseModel):
    scenario_id: str
    incident_id: str
    patient_unit_id: str
    destination_hospital_id: str
    destination_hospital_name: str
    destination_trauma_level: str
    destination_valid: bool
    routing_provider: str
    routing_profile: str
    eligible_resource_count: int = Field(ge=0)
    direct_transport_minutes: float = Field(ge=0)
    direct_route_distance_miles: float = Field(ge=0)
    max_added_hospital_delay_minutes: float = Field(ge=0)
    hospital_delay_weight: float = Field(ge=0)
    recommendation: RendezvousRecommendation
    recommendation_reason: str
    recommended_rendezvous_id: Optional[str] = None
    candidates: list[RendezvousCandidate]
