"""Where should a blood unit meet the ambulance?

Rule: among meeting spots that keep the ambulance heading in the general direction of the
supplied hospital, choose the unit and spot where blood reaches the patient soonest.
Direct transport wins when no spot gets blood meaningfully sooner.

Meeting spots are public places (parking lots, gas stations, and similar) from the
OpenStreetMap catalog, plus the scenario's known sites, plus roadside points on the route
when mapped places are scarce. The hospital is always supplied input; BloodGrid never
chooses or changes it.
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass

from ..config import meeting_rule_settings
from ..coverage.service import METERS_PER_MILE, eligible_response_units
from ..meeting_spots import (
    CATALOG_SOURCE_NOTE,
    CATEGORY_PREFERENCE,
    MeetingSpot,
    catalog_spots,
    known_site_spots,
)
from ..models import Hospital, LiveIncident, ResponseUnit, ScenarioData
from ..routing.coordinate_keyed import CoordinateKeyedProvider
from ..routing.geometry import distance_meters, distance_to_route, point_along
from ..routing.models import RouteEstimate, RoutingLocation
from ..routing.provider import RoutingProvider
from .models import LiveRendezvousResult, RendezvousCandidate, ResourcePositioning


class RendezvousError(ValueError):
    """Raised when a live incident cannot be evaluated safely from its data."""


LngLat = tuple[float, float]

# How many alternatives to report after the recommended option.
MAX_ALTERNATIVES = 4
# Spots per matrix request (the routing provider limits coordinates per request).
MATRIX_CHUNK = 20
UNITS_PER_MATRIX_REQUEST = 4
# Corridor lines are thinned to this many points before distance checks.
CORRIDOR_LINE_POINTS = 80
# Extra shortlist places reserved per unit, so every unit's best option can be explained.
PER_UNIT_SHORTLIST = 8
ROADSIDE_FRACTIONS_AMBULANCE = (0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85)
ROADSIDE_FRACTIONS_UNIT = (0.25, 0.5, 0.75)


@dataclass(frozen=True)
class _Option:
    spot: MeetingSpot
    unit: ResponseUnit
    candidate: RendezvousCandidate

    def rank(self) -> tuple:
        c = self.candidate
        return (
            c.time_to_blood_minutes if c.time_to_blood_minutes is not None else math.inf,
            c.added_hospital_delay_minutes if c.added_hospital_delay_minutes is not None else math.inf,
            CATEGORY_PREFERENCE.get(self.spot.category, 99),
            -(self.spot.area_m2 or 0),
            self.spot.spot_id,
            self.unit.unit_id,
        )


def calculate_live_rendezvous(
    scenario: ScenarioData,
    incident_id: str,
    routing_provider: RoutingProvider,
    meeting_spots: list[MeetingSpot] | None = None,
    resource_positioning: ResourcePositioning = "CURRENT",
) -> LiveRendezvousResult:
    """Compare meeting spots with direct transport for an authorized blood request."""

    settings = meeting_rule_settings()
    # Coordinate keys keep every place's cached travel time separate, whatever its label.
    provider = CoordinateKeyedProvider(routing_provider)

    incident = _find_incident(scenario, incident_id)
    if not incident.blood_requested:
        raise RendezvousError(f"{incident.incident_id} has no authorized blood request to evaluate.")
    destination = _find_destination(scenario, incident)
    ambulance = RoutingLocation(incident.incident_id, incident.latitude, incident.longitude)
    hospital = RoutingLocation(destination.hospital_id, destination.latitude, destination.longitude)

    direct = provider.get_travel_matrix([ambulance], [hospital]).get(
        (ambulance.location_id, hospital.location_id)
    )
    if direct is None:
        raise RendezvousError(
            f"No road route is available from {incident.incident_id} to its supplied destination."
        )
    direct_minutes = direct.duration_seconds / 60
    delay_cap = max(settings["min_delay_cap_minutes"], settings["max_delay_fraction"] * direct_minutes)

    if meeting_spots is None:
        meeting_spots = known_site_spots(scenario.rendezvous_points) + catalog_spots(
            scenario.metadata.bounding_box
        )
    units = sorted(eligible_response_units(scenario), key=lambda unit: unit.unit_id)

    def result(
        recommended: _Option | None,
        candidates: list[RendezvousCandidate],
        considered: int,
        rejected: dict[str, int],
        reason: str,
    ) -> LiveRendezvousResult:
        return LiveRendezvousResult(
            scenario_id=scenario.metadata.scenario_id,
            incident_id=incident.incident_id,
            patient_unit_id=incident.patient_unit_id,
            destination_hospital_id=destination.hospital_id,
            destination_hospital_name=destination.name,
            destination_trauma_level=destination.trauma_level,
            destination_valid=True,
            routing_provider=provider.provider_name,
            routing_profile=provider.profile,
            resource_positioning=resource_positioning,
            eligible_resource_count=len(units),
            direct_transport_minutes=round(direct_minutes, 1),
            direct_route_distance_miles=round(direct.distance_meters / METERS_PER_MILE, 1),
            max_added_hospital_delay_minutes=round(delay_cap, 1),
            direction_tolerance_minutes=settings["direction_tolerance_minutes"],
            min_blood_gain_minutes=settings["min_blood_gain_minutes"],
            recommendation="RENDEZVOUS" if recommended else "DIRECT_TRANSPORT",
            recommendation_reason=reason,
            recommended_rendezvous_id=recommended.spot.spot_id if recommended else None,
            candidates=candidates,
            spots_available=len(meeting_spots),
            spots_considered=considered,
            rejected_summary=rejected,
            meeting_spot_source=CATALOG_SOURCE_NOTE,
        )

    if not units:
        return result(
            None,
            [],
            0,
            {"NO_ELIGIBLE_RESOURCE": 1},
            "Continue to the supplied destination: no eligible Blood Response Unit is available.",
        )

    # 1. The corridor: the ambulance's route to the hospital and each unit's road toward it.
    corridor = [_route_line(provider, ambulance, hospital)] + [
        _route_line(provider, _unit_location(unit), ambulance) for unit in units
    ]

    # 2. Shortlist spots near the corridor that do not head away from the hospital.
    shortlist = _shortlist(meeting_spots, corridor, ambulance, hospital, units, settings)
    if len(shortlist) < settings["min_corridor_spots"]:
        shortlist += _roadside_spots(corridor, units)

    # 3. Time the shortlist with the routing provider.
    spot_locations = [RoutingLocation(s.spot_id, s.latitude, s.longitude) for s in shortlist]
    ambulance_times = _matrix_many_destinations(provider, [ambulance], spot_locations)
    unit_times: dict[tuple[str, str], RouteEstimate | None] = {}
    unit_locations = [_unit_location(unit) for unit in units]
    for start in range(0, len(unit_locations), UNITS_PER_MATRIX_REQUEST):
        unit_times.update(
            _matrix_many_destinations(
                provider, unit_locations[start : start + UNITS_PER_MATRIX_REQUEST], spot_locations
            )
        )
    to_hospital: dict[tuple[str, str], RouteEstimate | None] = {}
    for start in range(0, len(spot_locations), MATRIX_CHUNK):
        to_hospital.update(
            provider.get_travel_matrix(spot_locations[start : start + MATRIX_CHUNK], [hospital])
        )

    # 4. Apply the rule to every unit at every shortlisted spot.
    options: list[_Option] = []
    for spot in shortlist:
        patient = ambulance_times.get((ambulance.location_id, spot.spot_id))
        onward = to_hospital.get((spot.spot_id, hospital.location_id))
        for unit in units:
            resource = unit_times.get((unit.unit_id, spot.spot_id))
            options.append(
                _Option(
                    spot,
                    unit,
                    _evaluate(spot, unit, patient, resource, onward, direct_minutes, delay_cap, settings),
                )
            )

    feasible = sorted((o for o in options if o.candidate.status == "NOT_SELECTED"), key=_Option.rank)
    rejected = dict(sorted(Counter(o.candidate.status for o in options if o.candidate.status != "NOT_SELECTED").items()))

    recommended = feasible[0] if feasible else None
    candidates: list[RendezvousCandidate] = []
    shown_spots: set[str] = set()
    shown_units: set[str] = set()
    if recommended:
        candidates.append(
            recommended.candidate.model_copy(
                update={"status": "RECOMMENDED", "reason": "Soonest blood among spots that keep heading toward the hospital."}
            )
        )
        shown_spots.add(recommended.spot.spot_id)
        shown_units.add(recommended.unit.unit_id)
    for option in feasible[1:]:
        if len(candidates) > MAX_ALTERNATIVES:
            break
        if option.spot.spot_id not in shown_spots:
            candidates.append(option.candidate)
            shown_spots.add(option.spot.spot_id)
            shown_units.add(option.unit.unit_id)
    # Each unit's best option, even if it failed a rule, so the choice explains itself.
    for unit in units:
        if unit.unit_id in shown_units:
            continue
        own = [o for o in options if o.unit.unit_id == unit.unit_id and o.candidate.time_to_blood_minutes is not None]
        if own:
            best = min(own, key=lambda o: (o.candidate.status != "NOT_SELECTED", *o.rank()))
            candidates.append(best.candidate)
            shown_units.add(unit.unit_id)

    if recommended:
        c = recommended.candidate
        gain = direct_minutes - (c.time_to_blood_minutes or 0)
        reason = (
            f"{recommended.unit.unit_id} can meet the ambulance at {recommended.spot.name}: blood in "
            f"{c.time_to_blood_minutes} min, {gain:.1f} min sooner than reaching the hospital, "
            f"while still heading toward it."
        )
    else:
        reason = (
            "Continue to the supplied destination: no meeting spot gets blood at least "
            f"{settings['min_blood_gain_minutes']:g} min sooner while keeping the ambulance heading "
            "toward the hospital."
        )
    return result(recommended, candidates, len(shortlist), rejected, reason)


def _evaluate(
    spot: MeetingSpot,
    unit: ResponseUnit,
    patient: RouteEstimate | None,
    resource: RouteEstimate | None,
    onward: RouteEstimate | None,
    direct_minutes: float,
    delay_cap: float,
    settings: dict[str, float],
) -> RendezvousCandidate:
    base = {
        "rendezvous_id": spot.spot_id,
        "rendezvous_name": spot.name,
        "category": spot.category,
        "source": spot.source,
        "latitude": spot.latitude,
        "longitude": spot.longitude,
        "area_m2": spot.area_m2,
        "resource_id": unit.unit_id,
    }
    if patient is None or onward is None or resource is None:
        return RendezvousCandidate(
            **base, status="NO_ROUTE", reason="A required road route to this spot is not available."
        )

    patient_minutes = patient.duration_seconds / 60
    onward_minutes = onward.duration_seconds / 60
    arrival = resource.duration_seconds / 60 + unit.mobilization_minutes
    time_to_blood = max(patient_minutes, arrival)
    hospital_arrival = time_to_blood + onward_minutes
    added_delay = hospital_arrival - direct_minutes
    facts = {
        "patient_to_rendezvous_minutes": round(patient_minutes, 1),
        "resource_driving_minutes": round(resource.duration_seconds / 60, 1),
        "mobilization_minutes": unit.mobilization_minutes,
        "resource_arrival_minutes": round(arrival, 1),
        "patient_wait_minutes": round(max(arrival - patient_minutes, 0), 1),
        "resource_wait_minutes": round(max(patient_minutes - arrival, 0), 1),
        "time_to_blood_minutes": round(time_to_blood, 1),
        "rendezvous_to_hospital_minutes": round(onward_minutes, 1),
        "hospital_arrival_minutes": round(hospital_arrival, 1),
        # "+ 0.0" turns a rounded -0.0 into 0.0.
        "added_hospital_delay_minutes": round(added_delay, 1) + 0.0,
    }

    if onward_minutes > direct_minutes + settings["direction_tolerance_minutes"]:
        status, reason = "WRONG_DIRECTION", "This spot is farther from the hospital than the ambulance's starting point."
    elif time_to_blood > direct_minutes - settings["min_blood_gain_minutes"]:
        status, reason = "TOO_LATE", "Blood would not arrive meaningfully sooner than reaching the hospital."
    elif added_delay > delay_cap:
        status, reason = "EXCESSIVE_DETOUR", "The meet-up adds more hospital delay than the rule allows."
    else:
        status, reason = "NOT_SELECTED", "Keeps heading toward the hospital; another option gets blood sooner."
    return RendezvousCandidate(**base, **facts, status=status, reason=reason, score=round(time_to_blood, 1))


def _shortlist(
    spots: list[MeetingSpot],
    corridor: list[list[LngLat]],
    ambulance: RoutingLocation,
    hospital: RoutingLocation,
    units: list[ResponseUnit],
    settings: dict[str, float],
) -> list[MeetingSpot]:
    """Spots near the corridor, not clearly heading away, best rough estimates first."""

    corridor_m = settings["corridor_meters"]
    speed_m_per_min = settings["estimate_speed_kmh"] * 1000 / 60
    start = (ambulance.longitude, ambulance.latitude)
    end = (hospital.longitude, hospital.latitude)
    start_to_hospital = distance_meters(start, end)
    # Straight-line version of the direction rule, with slack; the real check uses road times.
    max_to_hospital = start_to_hospital + settings["direction_tolerance_minutes"] * speed_m_per_min + 2000
    boxes = [_padded_box(line, corridor_m) for line in corridor]

    nearby: list[MeetingSpot] = []
    for spot in spots:
        point = (spot.longitude, spot.latitude)
        if distance_meters(point, end) > max_to_hospital:
            continue
        if not any(
            box[0] <= point[0] <= box[2] and box[1] <= point[1] <= box[3]
            and distance_to_route(point, line) <= corridor_m
            for box, line in zip(boxes, corridor)
        ):
            continue
        nearby.append(spot)

    def estimate(spot: MeetingSpot, unit: ResponseUnit) -> float:
        point = (spot.longitude, spot.latitude)
        patient = distance_meters(start, point) / speed_m_per_min
        resource = distance_meters((unit.current_longitude, unit.current_latitude), point) / speed_m_per_min
        return max(patient, resource + unit.mobilization_minutes)

    def order(key) -> list[MeetingSpot]:
        return sorted(nearby, key=lambda s: (key(s), CATEGORY_PREFERENCE.get(s.category, 99), s.spot_id))

    limit = int(settings["max_candidates"])
    chosen: dict[str, MeetingSpot] = {}
    for spot in order(lambda s: min(estimate(s, u) for u in units))[:limit]:
        chosen[spot.spot_id] = spot
    for unit in units:
        for spot in order(lambda s, u=unit: estimate(s, u))[:PER_UNIT_SHORTLIST]:
            chosen.setdefault(spot.spot_id, spot)
    return list(chosen.values())


def _roadside_spots(corridor: list[list[LngLat]], units: list[ResponseUnit]) -> list[MeetingSpot]:
    """Fallback points on the routes themselves, for stretches with no mapped places."""

    spots = []
    for index, fraction in enumerate(ROADSIDE_FRACTIONS_AMBULANCE, start=1):
        longitude, latitude = point_along(corridor[0], fraction)
        spots.append(_roadside(f"ROADSIDE-AMB-{index}", latitude, longitude))
    for unit, line in zip(units, corridor[1:]):
        for index, fraction in enumerate(ROADSIDE_FRACTIONS_UNIT, start=1):
            longitude, latitude = point_along(line, fraction)
            spots.append(_roadside(f"ROADSIDE-{unit.unit_id}-{index}", latitude, longitude))
    return spots


def _roadside(spot_id: str, latitude: float, longitude: float) -> MeetingSpot:
    return MeetingSpot(
        spot_id=spot_id,
        name="Roadside pull-off",
        category="ROADSIDE",
        latitude=round(latitude, 6),
        longitude=round(longitude, 6),
        source="ROUTE",
    )


def _route_line(provider: RoutingProvider, origin: RoutingLocation, destination: RoutingLocation) -> list[LngLat]:
    """Road geometry between two places, thinned; a straight line if no route is available."""

    straight = [(origin.longitude, origin.latitude), (destination.longitude, destination.latitude)]
    try:
        route = provider.get_route(origin, destination)
    except (AttributeError, NotImplementedError):
        return straight
    if route is None or len(route.geometry) < 2:
        return straight
    geometry = list(route.geometry)
    step = max(1, math.ceil(len(geometry) / CORRIDOR_LINE_POINTS))
    thinned = geometry[::step]
    if thinned[-1] != geometry[-1]:
        thinned.append(geometry[-1])
    return thinned


def _padded_box(line: list[LngLat], meters: float) -> tuple[float, float, float, float]:
    latitudes = [point[1] for point in line]
    longitudes = [point[0] for point in line]
    lat_pad = meters / 111_320
    lng_pad = meters / (111_320 * max(0.2, math.cos(math.radians(sum(latitudes) / len(latitudes)))))
    return (min(longitudes) - lng_pad, min(latitudes) - lat_pad, max(longitudes) + lng_pad, max(latitudes) + lat_pad)


def _matrix_many_destinations(
    provider: RoutingProvider, origins: list[RoutingLocation], destinations: list[RoutingLocation]
) -> dict[tuple[str, str], RouteEstimate | None]:
    results: dict[tuple[str, str], RouteEstimate | None] = {}
    for start in range(0, len(destinations), MATRIX_CHUNK):
        results.update(provider.get_travel_matrix(origins, destinations[start : start + MATRIX_CHUNK]))
    return results


def _unit_location(unit: ResponseUnit) -> RoutingLocation:
    return RoutingLocation(unit.unit_id, unit.current_latitude, unit.current_longitude)


def _find_incident(scenario: ScenarioData, incident_id: str) -> LiveIncident:
    incident = next((item for item in scenario.live_incidents if item.incident_id == incident_id), None)
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
        raise RendezvousError(f"{incident.incident_id} has an inactive or unknown supplied destination.")
    return destination
