from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


CoverageStatus = Literal["COVERED", "UNCOVERED", "NO_ELIGIBLE_RESOURCE", "NO_ROUTE"]


class ResourceEligibility(BaseModel):
    unit_id: str
    eligible: bool
    valid_blood_units: int = Field(ge=0)
    reasons: list[str]


class BaselineCoveragePoint(BaseModel):
    incident_id: str
    status: CoverageStatus
    covered: bool
    best_resource_id: Optional[str] = None
    driving_minutes: Optional[float] = Field(default=None, ge=0)
    mobilization_minutes: Optional[float] = Field(default=None, ge=0)
    total_response_minutes: Optional[float] = Field(default=None, ge=0)
    route_distance_miles: Optional[float] = Field(default=None, ge=0)


class BaselineCoverageResult(BaseModel):
    scenario_id: str
    target_coverage_minutes: int = Field(ge=1)
    routing_provider: str
    routing_profile: str
    eligible_resource_count: int = Field(ge=0)
    covered_demand_count: int = Field(ge=0)
    uncovered_demand_count: int = Field(ge=0)
    resource_eligibility: list[ResourceEligibility]
    demand_points: list[BaselineCoveragePoint]
