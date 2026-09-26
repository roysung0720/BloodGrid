from __future__ import annotations

from dataclasses import dataclass

from ..config import coverage_target_minutes
from ..models import BloodUnit, ResponseUnit, ScenarioData
from ..routing.models import RouteEstimate, RoutingLocation
from ..routing.provider import RoutingProvider
from .models import (
    BaselineCoveragePoint,
    BaselineCoverageResult,
    ResourceEligibility,
)


VALID_BLOOD_AVAILABILITY = "ONBOARD"
VALID_TEMPERATURE_STATUS = "VALID"
ELIGIBLE_VEHICLE_STATUS = "AVAILABLE"
ELIGIBLE_CREW_STATUSES = {"AVAILABLE", "ON_CALL"}
METERS_PER_MILE = 1609.344


@dataclass(frozen=True)
class EligibleResource:
    unit: ResponseUnit
    valid_blood_units: int


def assess_resource_eligibility(
    unit: ResponseUnit, blood_units: list[BloodUnit]
) -> ResourceEligibility:
    valid_blood_units = sum(
        blood_unit.current_location_type == "RESPONSE_UNIT"
        and blood_unit.current_location_id == unit.unit_id
        and blood_unit.availability_status == VALID_BLOOD_AVAILABILITY
        and blood_unit.temperature_status == VALID_TEMPERATURE_STATUS
        for blood_unit in blood_units
    )
    reasons: list[str] = []
    if valid_blood_units < 1:
        reasons.append("No usable onboard blood")
    if unit.vehicle_status != ELIGIBLE_VEHICLE_STATUS:
        reasons.append("Vehicle is not available")
    if unit.crew_status not in ELIGIBLE_CREW_STATUSES:
        reasons.append("Crew is not available for response")
    if not unit.blood_credentialed:
        reasons.append("No qualified blood clinician")

    return ResourceEligibility(
        unit_id=unit.unit_id,
        eligible=not reasons,
        valid_blood_units=valid_blood_units,
        reasons=reasons,
    )


def calculate_baseline_coverage(
    scenario: ScenarioData, routing_provider: RoutingProvider
) -> BaselineCoverageResult:
    """Calculate road-based access from eligible units to synthetic demand points."""

    eligibility = [
        assess_resource_eligibility(unit, scenario.blood_units)
        for unit in scenario.response_units
    ]
    eligibility_by_unit = {assessment.unit_id: assessment for assessment in eligibility}
    eligible_resources = [
        EligibleResource(
            unit=unit,
            valid_blood_units=eligibility_by_unit[unit.unit_id].valid_blood_units,
        )
        for unit in scenario.response_units
        if eligibility_by_unit[unit.unit_id].eligible
    ]
    target_minutes = coverage_target_minutes(scenario.metadata.target_coverage_minutes)

    origins = [
        RoutingLocation(
            location_id=resource.unit.unit_id,
            latitude=resource.unit.current_latitude,
            longitude=resource.unit.current_longitude,
        )
        for resource in eligible_resources
    ]
    destinations = [
        RoutingLocation(
            location_id=incident.incident_id,
            latitude=incident.latitude,
            longitude=incident.longitude,
        )
        for incident in scenario.historical_incidents
    ]
    route_estimates = routing_provider.get_travel_matrix(origins, destinations)

    points = [
        _coverage_point(
            incident_id=incident.incident_id,
            eligible_resources=eligible_resources,
            route_estimates=route_estimates,
            target_minutes=target_minutes,
        )
        for incident in scenario.historical_incidents
    ]
    covered_count = sum(point.covered for point in points)

    return BaselineCoverageResult(
        scenario_id=scenario.metadata.scenario_id,
        target_coverage_minutes=target_minutes,
        routing_provider=routing_provider.provider_name,
        routing_profile=routing_provider.profile,
        eligible_resource_count=len(eligible_resources),
        covered_demand_count=covered_count,
        uncovered_demand_count=len(points) - covered_count,
        resource_eligibility=eligibility,
        demand_points=points,
    )


def _coverage_point(
    incident_id: str,
    eligible_resources: list[EligibleResource],
    route_estimates: dict[tuple[str, str], RouteEstimate | None],
    target_minutes: int,
) -> BaselineCoveragePoint:
    if not eligible_resources:
        return BaselineCoveragePoint(
            incident_id=incident_id,
            status="NO_ELIGIBLE_RESOURCE",
            covered=False,
        )

    candidates: list[tuple[float, EligibleResource, RouteEstimate]] = []
    for resource in eligible_resources:
        estimate = route_estimates.get((resource.unit.unit_id, incident_id))
        if estimate is None:
            continue
        total_minutes = estimate.duration_seconds / 60 + resource.unit.mobilization_minutes
        candidates.append((total_minutes, resource, estimate))

    if not candidates:
        return BaselineCoveragePoint(
            incident_id=incident_id,
            status="NO_ROUTE",
            covered=False,
        )

    total_minutes, resource, estimate = min(candidates, key=lambda candidate: candidate[0])
    return BaselineCoveragePoint(
        incident_id=incident_id,
        status="COVERED" if total_minutes <= target_minutes else "UNCOVERED",
        covered=total_minutes <= target_minutes,
        best_resource_id=resource.unit.unit_id,
        driving_minutes=round(estimate.duration_seconds / 60, 1),
        mobilization_minutes=resource.unit.mobilization_minutes,
        total_response_minutes=round(total_minutes, 1),
        route_distance_miles=round(estimate.distance_meters / METERS_PER_MILE, 1),
    )
