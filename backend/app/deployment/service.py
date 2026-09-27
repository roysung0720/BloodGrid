from __future__ import annotations

from dataclasses import dataclass

from ortools.sat.python import cp_model

from ..config import coverage_target_minutes
from ..coverage.service import METERS_PER_MILE, eligible_response_units
from ..models import ResponseUnit, ScenarioData, Station
from ..routing.models import RouteEstimate, RoutingLocation
from ..routing.provider import RoutingProvider
from .models import (
    StrategicAssignment,
    StrategicCoveragePoint,
    StrategicDeploymentResult,
)


class DeploymentError(RuntimeError):
    """Raised when a strategic staging model cannot be solved."""


@dataclass(frozen=True)
class AssignedResource:
    unit: ResponseUnit
    station: Station


def calculate_strategic_deployment(
    scenario: ScenarioData, routing_provider: RoutingProvider
) -> StrategicDeploymentResult:
    """Assign eligible units to active stations to maximize target-time coverage."""

    eligible_units = sorted(eligible_response_units(scenario), key=lambda unit: unit.unit_id)
    active_stations = sorted(
        (station for station in scenario.stations if station.active and station.capacity > 0),
        key=lambda station: station.station_id,
    )
    target_minutes = coverage_target_minutes(scenario.metadata.target_coverage_minutes)

    if not eligible_units:
        points = [
            StrategicCoveragePoint(
                incident_id=incident.incident_id,
                status="NO_ELIGIBLE_RESOURCE",
                covered=False,
            )
            for incident in scenario.historical_incidents
        ]
        return _result(
            scenario,
            routing_provider,
            target_minutes,
            "NO_ELIGIBLE_RESOURCES",
            [],
            points,
        )
    if not active_stations:
        raise DeploymentError("No active stations with staging capacity are available.")

    station_locations = [
        RoutingLocation(
            location_id=station.station_id,
            latitude=station.latitude,
            longitude=station.longitude,
        )
        for station in active_stations
    ]
    demand_locations = [
        RoutingLocation(
            location_id=incident.incident_id,
            latitude=incident.latitude,
            longitude=incident.longitude,
        )
        for incident in scenario.historical_incidents
    ]
    route_estimates = routing_provider.get_travel_matrix(
        station_locations, demand_locations
    )

    assignments = _solve_assignments(
        eligible_units,
        active_stations,
        scenario,
        route_estimates,
        target_minutes,
    )
    points = [
        _deployment_point(
            incident.incident_id, assignments, route_estimates, target_minutes
        )
        for incident in scenario.historical_incidents
    ]
    return _result(
        scenario,
        routing_provider,
        target_minutes,
        "OPTIMAL",
        assignments,
        points,
    )


def _solve_assignments(
    eligible_units: list[ResponseUnit],
    active_stations: list[Station],
    scenario: ScenarioData,
    route_estimates: dict[tuple[str, str], RouteEstimate | None],
    target_minutes: int,
) -> list[AssignedResource]:
    model = cp_model.CpModel()
    assign = {
        (unit.unit_id, station.station_id): model.new_bool_var(
            f"assign_{unit.unit_id}_{station.station_id}"
        )
        for unit in eligible_units
        for station in active_stations
    }

    for unit in eligible_units:
        model.add(
            sum(assign[(unit.unit_id, station.station_id)] for station in active_stations)
            == 1
        )
    for station in active_stations:
        model.add(
            sum(assign[(unit.unit_id, station.station_id)] for unit in eligible_units)
            <= station.capacity
        )

    covered = {}
    for incident in scenario.historical_incidents:
        coverage_variables = [
            assign[(unit.unit_id, station.station_id)]
            for unit in eligible_units
            for station in active_stations
            if _within_target(
                unit,
                route_estimates.get((station.station_id, incident.incident_id)),
                target_minutes,
            )
        ]
        covered[incident.incident_id] = model.new_bool_var(
            f"covered_{incident.incident_id}"
        )
        if coverage_variables:
            model.add(covered[incident.incident_id] <= sum(coverage_variables))
        else:
            model.add(covered[incident.incident_id] == 0)

    # Coverage is the primary objective. This small secondary term makes ties stable.
    coverage_weight = len(eligible_units) * len(active_stations) + 1
    tie_breaker = sum(
        (station_index + 1) * assign[(unit.unit_id, station.station_id)]
        for unit in eligible_units
        for station_index, station in enumerate(active_stations)
    )
    model.maximize(coverage_weight * sum(covered.values()) - tie_breaker)

    solver = cp_model.CpSolver()
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise DeploymentError(f"Strategic deployment solver returned {solver.status_name(status)}.")

    return [
        AssignedResource(unit=unit, station=station)
        for unit in eligible_units
        for station in active_stations
        if solver.value(assign[(unit.unit_id, station.station_id)])
    ]


def _within_target(
    unit: ResponseUnit, estimate: RouteEstimate | None, target_minutes: int
) -> bool:
    if estimate is None:
        return False
    return estimate.duration_seconds / 60 + unit.mobilization_minutes <= target_minutes


def _deployment_point(
    incident_id: str,
    assignments: list[AssignedResource],
    route_estimates: dict[tuple[str, str], RouteEstimate | None],
    target_minutes: int,
) -> StrategicCoveragePoint:
    candidates: list[tuple[float, AssignedResource, RouteEstimate]] = []
    for assignment in assignments:
        estimate = route_estimates.get((assignment.station.station_id, incident_id))
        if estimate is None:
            continue
        total_minutes = estimate.duration_seconds / 60 + assignment.unit.mobilization_minutes
        candidates.append((total_minutes, assignment, estimate))

    if not candidates:
        return StrategicCoveragePoint(
            incident_id=incident_id,
            status="NO_ROUTE",
            covered=False,
        )

    total_minutes, assignment, estimate = min(candidates, key=lambda candidate: candidate[0])
    return StrategicCoveragePoint(
        incident_id=incident_id,
        status="COVERED" if total_minutes <= target_minutes else "UNCOVERED",
        covered=total_minutes <= target_minutes,
        best_resource_id=assignment.unit.unit_id,
        staged_station_id=assignment.station.station_id,
        driving_minutes=round(estimate.duration_seconds / 60, 1),
        mobilization_minutes=assignment.unit.mobilization_minutes,
        total_response_minutes=round(total_minutes, 1),
        route_distance_miles=round(estimate.distance_meters / METERS_PER_MILE, 1),
    )


def _result(
    scenario: ScenarioData,
    routing_provider: RoutingProvider,
    target_minutes: int,
    solver_status: str,
    assignments: list[AssignedResource],
    points: list[StrategicCoveragePoint],
) -> StrategicDeploymentResult:
    covered_count = sum(point.covered for point in points)
    return StrategicDeploymentResult(
        scenario_id=scenario.metadata.scenario_id,
        target_coverage_minutes=target_minutes,
        routing_provider=routing_provider.provider_name,
        routing_profile=routing_provider.profile,
        solver_status=solver_status,
        eligible_resource_count=len(assignments),
        optimized_covered_demand_count=covered_count,
        optimized_uncovered_demand_count=len(points) - covered_count,
        assignments=[
            StrategicAssignment(
                unit_id=assignment.unit.unit_id,
                station_id=assignment.station.station_id,
                station_name=assignment.station.name,
                mobilization_minutes=assignment.unit.mobilization_minutes,
            )
            for assignment in assignments
        ],
        demand_points=points,
    )
