from __future__ import annotations

from dataclasses import dataclass

from ..config import (
    rendezvous_hospital_delay_weight,
    rendezvous_max_added_hospital_delay_minutes,
)
from ..coverage.service import METERS_PER_MILE, eligible_response_units
from ..models import Hospital, LiveIncident, RendezvousPoint, ResponseUnit, ScenarioData
from ..routing.models import RouteEstimate, RoutingLocation
from ..routing.provider import RoutingProvider
from .models import LiveRendezvousResult, RendezvousCandidate


class RendezvousError(ValueError):
    """Raised when a live incident cannot be evaluated safely from its data."""


@dataclass(frozen=True)
class CandidateResource:
    unit: ResponseUnit
    estimate: RouteEstimate
    arrival_minutes: float


def calculate_live_rendezvous(
    scenario: ScenarioData, incident_id: str, routing_provider: RoutingProvider
) -> LiveRendezvousResult:
    """Compare approved intercepts with direct transport for an authorized request."""

    incident = _find_incident(scenario, incident_id)
    if not incident.blood_requested:
        raise RendezvousError(
            f"{incident.incident_id} has no authorized blood request to evaluate."
        )
    destination = _find_destination(scenario, incident)
    patient_location = _incident_location(incident)
    destination_location = _hospital_location(destination)
    direct_estimate = routing_provider.get_travel_matrix(
        [patient_location], [destination_location]
    )[(patient_location.location_id, destination_location.location_id)]
    if direct_estimate is None:
        raise RendezvousError(
            f"No road route is available from {incident.incident_id} to its supplied destination."
        )

    eligible_units = sorted(eligible_response_units(scenario), key=lambda unit: unit.unit_id)
    candidate_points = sorted(scenario.rendezvous_points, key=lambda point: point.rendezvous_id)
    valid_points = [
        point for point in candidate_points if point.approved and point.active
    ]
    direct_minutes = direct_estimate.duration_seconds / 60
    max_delay = rendezvous_max_added_hospital_delay_minutes()
    delay_weight = rendezvous_hospital_delay_weight()

    patient_to_points = routing_provider.get_travel_matrix(
        [patient_location], [_rendezvous_location(point) for point in valid_points]
    )
    points_to_destination = routing_provider.get_travel_matrix(
        [_rendezvous_location(point) for point in valid_points], [destination_location]
    )
    resources_to_points = routing_provider.get_travel_matrix(
        [_resource_location(unit) for unit in eligible_units],
        [_rendezvous_location(point) for point in valid_points],
    )

    candidates = [
        _evaluate_candidate(
            point,
            incident,
            eligible_units,
            patient_to_points,
            points_to_destination,
            resources_to_points,
            direct_minutes,
            max_delay,
            delay_weight,
        )
        for point in candidate_points
    ]
    feasible_candidates = [
        candidate for candidate in candidates if candidate.status == "NOT_SELECTED"
    ]
    if feasible_candidates:
        selected = min(
            feasible_candidates,
            key=lambda candidate: (
                candidate.score if candidate.score is not None else float("inf"),
                candidate.time_to_blood_minutes
                if candidate.time_to_blood_minutes is not None
                else float("inf"),
                candidate.rendezvous_id,
            ),
        )
        selected.status = "RECOMMENDED"
        selected.reason = "Best feasible approved rendezvous by the configured logistics score."
        recommendation = "RENDEZVOUS"
        recommendation_reason = (
            "An approved rendezvous can deliver the requested resource before "
            "direct hospital arrival within the configured detour limit."
        )
        selected_id = selected.rendezvous_id
    else:
        recommendation = "DIRECT_TRANSPORT"
        recommendation_reason = (
            "Continue to the supplied destination: no approved rendezvous can "
            "deliver the requested resource before direct arrival within the "
            "configured detour limit."
        )
        selected_id = None

    return LiveRendezvousResult(
        scenario_id=scenario.metadata.scenario_id,
        incident_id=incident.incident_id,
        patient_unit_id=incident.patient_unit_id,
        destination_hospital_id=destination.hospital_id,
        destination_hospital_name=destination.name,
        destination_trauma_level=destination.trauma_level,
        destination_valid=True,
        routing_provider=routing_provider.provider_name,
        routing_profile=routing_provider.profile,
        eligible_resource_count=len(eligible_units),
        direct_transport_minutes=round(direct_minutes, 1),
        direct_route_distance_miles=round(
            direct_estimate.distance_meters / METERS_PER_MILE, 1
        ),
        max_added_hospital_delay_minutes=max_delay,
        hospital_delay_weight=delay_weight,
        recommendation=recommendation,
        recommendation_reason=recommendation_reason,
        recommended_rendezvous_id=selected_id,
        candidates=candidates,
    )


def _evaluate_candidate(
    point: RendezvousPoint,
    incident: LiveIncident,
    eligible_units: list[ResponseUnit],
    patient_to_points: dict[tuple[str, str], RouteEstimate | None],
    points_to_destination: dict[tuple[str, str], RouteEstimate | None],
    resources_to_points: dict[tuple[str, str], RouteEstimate | None],
    direct_minutes: float,
    max_delay: float,
    delay_weight: float,
) -> RendezvousCandidate:
    if not point.approved or not point.active:
        return RendezvousCandidate(
            rendezvous_id=point.rendezvous_id,
            rendezvous_name=point.name,
            status="INELIGIBLE_POINT",
            reason="Point is not both approved and active for this evaluation.",
        )
    patient_estimate = patient_to_points.get((incident.incident_id, point.rendezvous_id))
    hospital_estimate = points_to_destination.get((point.rendezvous_id, "destination"))
    if patient_estimate is None or hospital_estimate is None:
        return RendezvousCandidate(
            rendezvous_id=point.rendezvous_id,
            rendezvous_name=point.name,
            status="NO_ROUTE",
            reason="A required patient route is not available for this point.",
        )

    patient_minutes = patient_estimate.duration_seconds / 60
    hospital_minutes = hospital_estimate.duration_seconds / 60
    resource = _fastest_resource_for_point(eligible_units, point, resources_to_points)
    if resource is None:
        return RendezvousCandidate(
            rendezvous_id=point.rendezvous_id,
            rendezvous_name=point.name,
            status="NO_ELIGIBLE_RESOURCE" if not eligible_units else "NO_ROUTE",
            reason=(
                "No eligible Blood Response Unit is available for this incident."
                if not eligible_units
                else "No eligible Blood Response Unit has a road route to this point."
            ),
            patient_to_rendezvous_minutes=round(patient_minutes, 1),
            rendezvous_to_hospital_minutes=round(hospital_minutes, 1),
        )

    time_to_blood = max(patient_minutes, resource.arrival_minutes)
    patient_wait = max(resource.arrival_minutes - patient_minutes, 0)
    resource_wait = max(patient_minutes - resource.arrival_minutes, 0)
    hospital_arrival = time_to_blood + hospital_minutes
    added_delay = hospital_arrival - direct_minutes
    details = {
        "resource_id": resource.unit.unit_id,
        "patient_to_rendezvous_minutes": round(patient_minutes, 1),
        "resource_driving_minutes": round(resource.estimate.duration_seconds / 60, 1),
        "mobilization_minutes": resource.unit.mobilization_minutes,
        "resource_arrival_minutes": round(resource.arrival_minutes, 1),
        "patient_wait_minutes": round(patient_wait, 1),
        "resource_wait_minutes": round(resource_wait, 1),
        "time_to_blood_minutes": round(time_to_blood, 1),
        "rendezvous_to_hospital_minutes": round(hospital_minutes, 1),
        "hospital_arrival_minutes": round(hospital_arrival, 1),
        "added_hospital_delay_minutes": round(added_delay, 1),
    }
    if time_to_blood >= direct_minutes:
        return RendezvousCandidate(
            rendezvous_id=point.rendezvous_id,
            rendezvous_name=point.name,
            status="TOO_LATE",
            reason="Resource arrival would not beat direct transport to the supplied destination.",
            **details,
        )
    if added_delay > max_delay:
        return RendezvousCandidate(
            rendezvous_id=point.rendezvous_id,
            rendezvous_name=point.name,
            status="EXCESSIVE_DETOUR",
            reason="Rendezvous exceeds the configured maximum added hospital delay.",
            **details,
        )
    return RendezvousCandidate(
        rendezvous_id=point.rendezvous_id,
        rendezvous_name=point.name,
        status="NOT_SELECTED",
        reason="Approved, routable, and within the configured delivery and detour limits.",
        score=round(time_to_blood + delay_weight * max(added_delay, 0), 1),
        **details,
    )


def _fastest_resource_for_point(
    eligible_units: list[ResponseUnit],
    point: RendezvousPoint,
    resources_to_points: dict[tuple[str, str], RouteEstimate | None],
) -> CandidateResource | None:
    candidates = []
    for unit in eligible_units:
        estimate = resources_to_points.get((unit.unit_id, point.rendezvous_id))
        if estimate is None:
            continue
        candidates.append(
            CandidateResource(
                unit=unit,
                estimate=estimate,
                arrival_minutes=estimate.duration_seconds / 60 + unit.mobilization_minutes,
            )
        )
    if not candidates:
        return None
    return min(
        candidates,
        key=lambda candidate: (candidate.arrival_minutes, candidate.unit.unit_id),
    )


def _find_incident(scenario: ScenarioData, incident_id: str) -> LiveIncident:
    incident = next(
        (item for item in scenario.live_incidents if item.incident_id == incident_id), None
    )
    if incident is None:
        raise RendezvousError(f"Live incident {incident_id} was not found.")
    return incident


def _find_destination(scenario: ScenarioData, incident: LiveIncident) -> Hospital:
    destination = next(
        (
            hospital
            for hospital in scenario.hospitals
            if hospital.hospital_id == incident.destination_hospital_id and hospital.active
        ),
        None,
    )
    if destination is None:
        raise RendezvousError(
            f"{incident.incident_id} has an inactive or unknown supplied destination."
        )
    return destination


def _incident_location(incident: LiveIncident) -> RoutingLocation:
    return RoutingLocation(
        location_id=incident.incident_id,
        latitude=incident.latitude,
        longitude=incident.longitude,
    )


def _hospital_location(hospital: Hospital) -> RoutingLocation:
    return RoutingLocation(
        location_id="destination",
        latitude=hospital.latitude,
        longitude=hospital.longitude,
    )


def _resource_location(unit: ResponseUnit) -> RoutingLocation:
    return RoutingLocation(
        location_id=unit.unit_id,
        latitude=unit.current_latitude,
        longitude=unit.current_longitude,
    )


def _rendezvous_location(point: RendezvousPoint) -> RoutingLocation:
    return RoutingLocation(
        location_id=point.rendezvous_id,
        latitude=point.latitude,
        longitude=point.longitude,
    )
