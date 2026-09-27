from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

from ..meeting_spots import MeetingSpotCategory, MeetingSpotSource


RendezvousCandidateStatus = Literal[
    "RECOMMENDED",
    # Passes every rule but another option gets blood sooner.
    "NOT_SELECTED",
    # Blood would not arrive meaningfully sooner than simply reaching the hospital.
    "TOO_LATE",
    # The spot is farther from the hospital than the start, beyond the tolerance.
    "WRONG_DIRECTION",
    # The meet-up adds more hospital delay than allowed.
    "EXCESSIVE_DETOUR",
    "NO_ROUTE",
    "NO_ELIGIBLE_RESOURCE",
]
RendezvousRecommendation = Literal["RENDEZVOUS", "DIRECT_TRANSPORT"]


class RendezvousCandidate(BaseModel):
    """One unit meeting the ambulance at one spot, with every fact behind the decision."""

    rendezvous_id: str
    rendezvous_name: str
    category: MeetingSpotCategory
    source: MeetingSpotSource
    latitude: float
    longitude: float
    area_m2: Optional[float] = Field(default=None, ge=0)
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
    # Kept for compatibility: the rule ranks by time to blood, so this equals it.
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
    # The rule that was applied, so the result explains itself.
    max_added_hospital_delay_minutes: float = Field(ge=0)
    direction_tolerance_minutes: float = Field(ge=0)
    min_blood_gain_minutes: float = Field(ge=0)
    recommendation: RendezvousRecommendation
    recommendation_reason: str
    recommended_rendezvous_id: Optional[str] = None
    # Recommended option first, then the best alternatives, then each unit's best option.
    candidates: list[RendezvousCandidate]
    spots_available: int = Field(ge=0)
    spots_considered: int = Field(ge=0)
    rejected_summary: dict[str, int]
    meeting_spot_source: str
