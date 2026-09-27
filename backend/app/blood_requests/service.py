from __future__ import annotations

import math
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Lock

from ..coverage.service import (
    METERS_PER_MILE,
    VALID_BLOOD_AVAILABILITY,
    VALID_TEMPERATURE_STATUS,
    assess_resource_eligibility,
    eligible_response_units,
)
from ..models import Hospital, LiveIncident, ScenarioData
from ..rendezvous.service import calculate_live_rendezvous
from ..config import (
    ROUTE_OPTION_COUNT,
    ROUTE_OPTION_DIFFERENT_METERS,
    ROUTE_OPTION_MAX_DURATION_RATIO,
    ROUTE_OPTION_MAX_VIA_METERS,
    ROUTE_OPTION_MIN_VIA_METERS,
    ROUTE_OPTION_VIA_OFFSETS,
    ROUTE_OPTION_VIA_POSITIONS,
)
from ..routing.coordinate_keyed import CoordinateKeyedProvider
from ..routing.geometry import (
    bearing_degrees,
    offset_point,
    point_along,
    routes_differ,
)
from ..routing.geometry import distance_meters as geometry_distance_meters
from ..routing.models import Route, RoutingLocation
from ..routing.provider import RoutingProvider
from .models import (
    AmbulanceOption,
    BloodProductOption,
    BloodRequest,
    BloodRequestStatus,
    CreateBloodRequest,
    HospitalOption,
    ResourceOption,
    RouteResult,
    RouteStepResult,
)


PRODUCT_LABELS = {
    "O_NEG": "O negative",
    "O_POS": "O positive",
    "LTOWB": "Low-titer O whole blood",
}
ENDED_STATUSES: set[BloodRequestStatus] = {"ARRIVED", "CANCELLED"}
VIA_REQUEST_WORKERS = 6
EARTH_RADIUS_METERS = 6_371_000


class BloodRequestError(ValueError):
    """Raised when a crew request cannot be accepted as submitted."""


class BloodRequestNotFound(LookupError):
    """Raised when a request ID is unknown."""


def list_ambulances(scenario: ScenarioData) -> list[AmbulanceOption]:
    """Transporting ambulances, derived from the synthetic live incidents."""

    ambulances: dict[str, AmbulanceOption] = {}
    for incident in scenario.live_incidents:
        ambulances.setdefault(
            incident.patient_unit_id,
            AmbulanceOption(
                unit_id=incident.patient_unit_id,
                start_incident_id=incident.incident_id,
                start_latitude=incident.latitude,
                start_longitude=incident.longitude,
            ),
        )
    return list(ambulances.values())


def hospital_options(
    scenario: ScenarioData,
    latitude: float,
    longitude: float,
    routing_provider: RoutingProvider,
) -> list[HospitalOption]:
    """Active hospitals ordered only by road drive time from the ambulance."""

    origin = _point_location("AMBULANCE", latitude, longitude)
    hospitals = [hospital for hospital in scenario.hospitals if hospital.active]
    estimates = routing_provider.get_travel_matrix(
        [origin], [_hospital_location(hospital) for hospital in hospitals]
    )

    options = []
    for hospital in hospitals:
        estimate = estimates.get((origin.location_id, hospital.hospital_id))
        options.append(
            HospitalOption(
                hospital_id=hospital.hospital_id,
                name=hospital.name,
                trauma_level=hospital.trauma_level,
                latitude=hospital.latitude,
                longitude=hospital.longitude,
                routable=estimate is not None,
                drive_minutes=None
                if estimate is None
                else round(estimate.duration_seconds / 60, 1),
                distance_miles=None
                if estimate is None
                else round(estimate.distance_meters / METERS_PER_MILE, 1),
            )
        )
    return sorted(
        options,
        key=lambda option: (
            not option.routable,
            option.drive_minutes if option.drive_minutes is not None else math.inf,
            option.name,
        ),
    )


def blood_product_options(scenario: ScenarioData) -> list[BloodProductOption]:
    """Product types in field inventory, flagged by whether an eligible unit carries them."""

    eligible_ids = {unit.unit_id for unit in eligible_response_units(scenario)}
    units_by_product: dict[str, set[str]] = {}
    for blood_unit in scenario.blood_units:
        if blood_unit.current_location_type != "RESPONSE_UNIT":
            continue
        carriers = units_by_product.setdefault(blood_unit.product_type, set())
        if (
            blood_unit.current_location_id in eligible_ids
            and blood_unit.availability_status == VALID_BLOOD_AVAILABILITY
            and blood_unit.temperature_status == VALID_TEMPERATURE_STATUS
        ):
            carriers.add(blood_unit.current_location_id)

    return [
        BloodProductOption(
            product_type=product_type,
            label=PRODUCT_LABELS.get(product_type, product_type.replace("_", " ")),
            available=bool(carriers),
            eligible_unit_count=len(carriers),
        )
        for product_type, carriers in sorted(units_by_product.items())
    ]


def resource_options(
    scenario: ScenarioData,
    latitude: float,
    longitude: float,
    routing_provider: RoutingProvider,
) -> list[ResourceOption]:
    """Every Blood Response Unit with its eligibility and, if eligible, arrival time."""

    ambulance = _point_location("AMBULANCE", latitude, longitude)
    eligible_units = eligible_response_units(scenario)
    estimates = routing_provider.get_travel_matrix(
        [
            RoutingLocation(unit.unit_id, unit.current_latitude, unit.current_longitude)
            for unit in eligible_units
        ],
        [ambulance],
    )

    options = []
    for unit in sorted(scenario.response_units, key=lambda item: item.unit_id):
        eligibility = assess_resource_eligibility(unit, scenario.blood_units)
        estimate = estimates.get((unit.unit_id, ambulance.location_id))
        options.append(
            ResourceOption(
                unit_id=unit.unit_id,
                latitude=unit.current_latitude,
                longitude=unit.current_longitude,
                eligible=eligibility.eligible,
                reasons=eligibility.reasons,
                crew_status=unit.crew_status,
                arrival_minutes=None
                if not eligibility.eligible or estimate is None
                else round(estimate.duration_seconds / 60 + unit.mobilization_minutes, 1),
            )
        )
    return options


def route_between(
    routing_provider: RoutingProvider,
    from_latitude: float,
    from_longitude: float,
    to_latitude: float,
    to_longitude: float,
) -> RouteResult | None:
    route = routing_provider.get_route(
        RoutingLocation("from", from_latitude, from_longitude),
        RoutingLocation("to", to_latitude, to_longitude),
    )
    return None if route is None else _route_result(route)


def route_options_between(
    routing_provider: RoutingProvider,
    from_latitude: float,
    from_longitude: float,
    to_latitude: float,
    to_longitude: float,
) -> list[RouteResult]:
    """Same endpoints, up to ROUTE_OPTION_COUNT distinct roads; the recommended route first.

    Uses the provider's own alternatives first. If there are too few distinct ones, it asks
    (in parallel) for routes through silent via points offset to either side of the
    recommended route, and keeps the fastest acceptable ones. Options that are much slower
    than the recommended road, or that need a U-turn, are skipped.
    """

    origin = RoutingLocation("from", from_latitude, from_longitude)
    destination = RoutingLocation("to", to_latitude, to_longitude)
    candidates = routing_provider.get_route_options(origin, destination)
    if not candidates:
        return []
    recommended = candidates[0]
    chosen = [recommended]

    def consider(route: Route | None) -> None:
        if route is None or len(chosen) >= ROUTE_OPTION_COUNT:
            return
        if route.duration_seconds > ROUTE_OPTION_MAX_DURATION_RATIO * recommended.duration_seconds:
            return
        if any(step.modifier == "uturn" or step.maneuver_type == "uturn" for step in route.steps):
            return
        if all(
            routes_differ(route.geometry, other.geometry, ROUTE_OPTION_DIFFERENT_METERS)
            for other in chosen
        ):
            chosen.append(route)

    for route in candidates[1:]:
        consider(route)
    if len(chosen) >= ROUTE_OPTION_COUNT:
        return [_route_result(route) for route in chosen]

    start = (from_longitude, from_latitude)
    end = (to_longitude, to_latitude)
    trip_meters = geometry_distance_meters(start, end)
    trip_bearing = bearing_degrees(start, end)
    via_points = []
    for position in ROUTE_OPTION_VIA_POSITIONS:
        anchor = point_along(recommended.geometry, position)
        for fraction in ROUTE_OPTION_VIA_OFFSETS:
            offset = min(
                ROUTE_OPTION_MAX_VIA_METERS,
                max(ROUTE_OPTION_MIN_VIA_METERS, fraction * trip_meters),
            )
            for side in (90, -90):
                via_longitude, via_latitude = offset_point(anchor, trip_bearing + side, offset)
                via_points.append(RoutingLocation("via", via_latitude, via_longitude))

    with ThreadPoolExecutor(max_workers=VIA_REQUEST_WORKERS) as pool:
        via_routes = list(
            pool.map(lambda via: routing_provider.get_route_via(origin, via, destination), via_points)
        )
    for route in sorted(
        (route for route in via_routes if route is not None),
        key=lambda route: route.duration_seconds,
    ):
        consider(route)

    return [_route_result(route) for route in chosen]


def _route_result(route: Route) -> RouteResult:
    return RouteResult(
        duration_minutes=round(route.duration_seconds / 60, 1),
        distance_miles=round(route.distance_meters / METERS_PER_MILE, 1),
        geometry=[[longitude, latitude] for longitude, latitude in route.geometry],
        steps=[
            RouteStepResult(
                instruction=step.instruction,
                maneuver_type=step.maneuver_type,
                modifier=step.modifier,
                road_name=step.road_name,
                distance_meters=step.distance_meters,
                duration_seconds=step.duration_seconds,
                longitude=step.longitude,
                latitude=step.latitude,
            )
            for step in route.steps
        ],
    )


class BloodRequestStore:
    """In-memory crew requests. Contents are lost when the backend restarts."""

    def __init__(self, clock: Callable[[], datetime] | None = None) -> None:
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._requests: dict[str, BloodRequest] = {}
        self._next_number = 1
        self._lock = Lock()

    def create(
        self,
        scenario: ScenarioData,
        submission: CreateBloodRequest,
        routing_provider: RoutingProvider,
    ) -> BloodRequest:
        if submission.unit_id not in {item.unit_id for item in list_ambulances(scenario)}:
            raise BloodRequestError(f"Unknown ambulance {submission.unit_id}.")
        known_products = {option.product_type for option in blood_product_options(scenario)}
        if submission.blood_product not in known_products:
            raise BloodRequestError(
                f"Blood product {submission.blood_product} is not in field inventory."
            )
        destination = _active_hospital(scenario, submission.destination_hospital_id)

        with self._lock:
            request_id = f"REQ-{self._next_number:03d}"
            self._next_number += 1
        now = self._timestamp()
        incident = LiveIncident(
            incident_id=request_id,
            latitude=submission.latitude,
            longitude=submission.longitude,
            destination_hospital_id=destination.hospital_id,
            blood_requested=True,
            patient_unit_id=submission.unit_id,
            status="OPEN",
            created_at=now,
        )
        # Evaluate on a copy so source scenario data are never modified. The existing
        # evaluator is reused unchanged; coordinate keys keep each hospital's times separate.
        evaluation_scenario = scenario.model_copy(
            update={"live_incidents": [*scenario.live_incidents, incident]}
        )
        rendezvous = calculate_live_rendezvous(
            evaluation_scenario, request_id, CoordinateKeyedProvider(routing_provider)
        )

        with self._lock:
            for existing in self._requests.values():
                if existing.unit_id == submission.unit_id and existing.status not in ENDED_STATUSES:
                    self._requests[existing.request_id] = existing.model_copy(
                        update={
                            "status": "CANCELLED",
                            "ended_reason": "Replaced by a newer request from this ambulance.",
                            "updated_at": now,
                        }
                    )

            request = BloodRequest(
                request_id=request_id,
                scenario_id=scenario.metadata.scenario_id,
                unit_id=submission.unit_id,
                blood_product=submission.blood_product,
                destination_hospital_id=destination.hospital_id,
                destination_hospital_name=destination.name,
                destination_latitude=destination.latitude,
                destination_longitude=destination.longitude,
                availability_profile=submission.availability_profile,
                status="ACTIVE_RENDEZVOUS"
                if rendezvous.recommendation == "RENDEZVOUS"
                else "ACTIVE_DIRECT",
                latitude=submission.latitude,
                longitude=submission.longitude,
                created_at=now,
                updated_at=now,
                rendezvous=rendezvous,
            )
            self._requests[request_id] = request
            return request

    def get(self, request_id: str) -> BloodRequest:
        request = self._requests.get(request_id)
        if request is None:
            raise BloodRequestNotFound(f"Request {request_id} was not found.")
        return request

    def list(self) -> list[BloodRequest]:
        return sorted(
            self._requests.values(), key=lambda request: request.request_id, reverse=True
        )

    def update_position(
        self,
        request_id: str,
        latitude: float,
        longitude: float,
        arrival_radius_meters: float,
    ) -> BloodRequest:
        with self._lock:
            request = self.get(request_id)
            if request.status in ENDED_STATUSES:
                return request
            status = request.status
            if status in ("ACTIVE_DIRECT", "BLOOD_RECEIVED") and (
                distance_meters(
                    latitude,
                    longitude,
                    request.destination_latitude,
                    request.destination_longitude,
                )
                <= arrival_radius_meters
            ):
                status = "ARRIVED"
            return self._save(
                request, latitude=latitude, longitude=longitude, status=status
            )

    def mark_blood_received(self, request_id: str) -> BloodRequest:
        with self._lock:
            request = self.get(request_id)
            if request.status != "ACTIVE_RENDEZVOUS":
                raise BloodRequestError(
                    f"{request_id} is not waiting at a rendezvous (status {request.status})."
                )
            return self._save(request, status="BLOOD_RECEIVED")

    def cancel(self, request_id: str, reason: str) -> BloodRequest:
        with self._lock:
            request = self.get(request_id)
            if request.status in ENDED_STATUSES:
                return request
            return self._save(request, status="CANCELLED", ended_reason=reason)

    def _save(self, request: BloodRequest, **updates: object) -> BloodRequest:
        updated = request.model_copy(update={**updates, "updated_at": self._timestamp()})
        self._requests[request.request_id] = updated
        return updated

    def _timestamp(self) -> str:
        return self._clock().isoformat(timespec="seconds")


def distance_meters(
    latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float
) -> float:
    """Great-circle distance, used only for the arrival geofence."""

    phi_a, phi_b = math.radians(latitude_a), math.radians(latitude_b)
    delta_phi = phi_b - phi_a
    delta_lambda = math.radians(longitude_b - longitude_a)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi_a) * math.cos(phi_b) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METERS * math.asin(math.sqrt(a))


def _point_location(prefix: str, latitude: float, longitude: float) -> RoutingLocation:
    # The matrix cache is keyed by location ID, so a moving point needs a coordinate-based ID.
    rounded_latitude, rounded_longitude = round(latitude, 4), round(longitude, 4)
    return RoutingLocation(
        location_id=f"{prefix}@{rounded_latitude},{rounded_longitude}",
        latitude=rounded_latitude,
        longitude=rounded_longitude,
    )


def _hospital_location(hospital: Hospital) -> RoutingLocation:
    return RoutingLocation(hospital.hospital_id, hospital.latitude, hospital.longitude)


def _active_hospital(scenario: ScenarioData, hospital_id: str) -> Hospital:
    hospital = next(
        (
            item
            for item in scenario.hospitals
            if item.hospital_id == hospital_id and item.active
        ),
        None,
    )
    if hospital is None:
        raise BloodRequestError(f"{hospital_id} is not an active hospital.")
    return hospital
