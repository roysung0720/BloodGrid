from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


DeploymentCoverageStatus = Literal[
    "COVERED", "UNCOVERED", "NO_ELIGIBLE_RESOURCE", "NO_ROUTE"
]


class StrategicAssignment(BaseModel):
    unit_id: str
    station_id: str
    station_name: str
    mobilization_minutes: float = Field(ge=0)


class StrategicCoveragePoint(BaseModel):
    incident_id: str
    status: DeploymentCoverageStatus
    covered: bool
    best_resource_id: Optional[str] = None
    staged_station_id: Optional[str] = None
    driving_minutes: Optional[float] = Field(default=None, ge=0)
    mobilization_minutes: Optional[float] = Field(default=None, ge=0)
    total_response_minutes: Optional[float] = Field(default=None, ge=0)
    route_distance_miles: Optional[float] = Field(default=None, ge=0)


class StrategicDeploymentResult(BaseModel):
    scenario_id: str
    target_coverage_minutes: int = Field(ge=1)
    routing_provider: str
    routing_profile: str
    solver_status: str
    eligible_resource_count: int = Field(ge=0)
    optimized_covered_demand_count: int = Field(ge=0)
    optimized_uncovered_demand_count: int = Field(ge=0)
    assignments: list[StrategicAssignment]
    demand_points: list[StrategicCoveragePoint]
