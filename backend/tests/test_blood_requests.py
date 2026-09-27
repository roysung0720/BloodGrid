from __future__ import annotations

import os
import unittest
from datetime import datetime, timezone
from unittest import mock

from app.availability.service import apply_availability_profile
from app.blood_requests.models import CreateBloodRequest
from app.blood_requests.service import (
    BloodRequestError,
    BloodRequestNotFound,
    BloodRequestStore,
    blood_product_options,
    distance_meters,
    hospital_options,
    list_ambulances,
    resource_options,
    route_options_between,
)
from app.config import ambulance_settings
from app.models import Hospital
from app.rendezvous.service import calculate_live_rendezvous
from app.routing.coordinate_keyed import CoordinateKeyedProvider
from app.routing.mapbox_provider import _parse_directions, _parse_directions_options
from app.routing.models import Route, RouteEstimate, RouteStep, RoutingLocation
from app.scenario_loader import load_scenario


def _estimate(origin: RoutingLocation, destination: RoutingLocation, minutes: float) -> RouteEstimate:
    return RouteEstimate(
        origin_id=origin.location_id,
        destination_id=destination.location_id,
        duration_seconds=minutes * 60,
        distance_meters=minutes * 1000,
    )


class DistanceRoutingProvider:
    """Travel time depends only on coordinates (about 40 km/h), never on labels."""

    provider_name = "test-routing"
    profile = "test-driving"

    def get_travel_matrix(self, origins, destinations):  # type: ignore[no-untyped-def]
        return {
            (origin.location_id, destination.location_id): _estimate(
                origin,
                destination,
                distance_meters(
                    origin.latitude, origin.longitude, destination.latitude, destination.longitude
                )
                / 1000
                * 1.5,
            )
            for origin in origins
            for destination in destinations
        }

    def get_route(self, origin, destination):  # type: ignore[no-untyped-def]
        return None


class PrefixRoutingProvider:
    """Every leg takes 5 minutes, except request-to-hospital, which takes direct_minutes."""

    provider_name = "test-routing"
    profile = "test-driving"

    def __init__(self, direct_minutes: float) -> None:
        self.direct_minutes = direct_minutes

    def get_travel_matrix(self, origins, destinations):  # type: ignore[no-untyped-def]
        return {
            (origin.location_id, destination.location_id): _estimate(
                origin,
                destination,
                self.direct_minutes
                if origin.location_id.startswith("REQ")
                and destination.location_id.startswith("destination")
                else 5,
            )
            for origin in origins
            for destination in destinations
        }

    def get_route(self, origin, destination):  # type: ignore[no-untyped-def]
        return None


class LabelCachingProvider(DistanceRoutingProvider):
    """Mimics a provider that caches by location ID, like the Mapbox adapter."""

    def __init__(self) -> None:
        self.cache: dict[tuple[str, str], RouteEstimate] = {}

    def get_travel_matrix(self, origins, destinations):  # type: ignore[no-untyped-def]
        fresh = super().get_travel_matrix(origins, destinations)
        for key, value in fresh.items():
            self.cache.setdefault(key, value)
        return {key: self.cache[key] for key in fresh}


def _fixed_clock() -> datetime:
    return datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)


class AmbulanceOptionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scenario = load_scenario()

    def test_ambulances_come_from_live_incidents(self) -> None:
        ambulances = list_ambulances(self.scenario)

        self.assertEqual(
            [item.unit_id for item in ambulances],
            [incident.patient_unit_id for incident in self.scenario.live_incidents],
        )
        self.assertEqual(ambulances[0].start_incident_id, "LIVE-001")

    def test_hospitals_sort_by_drive_time_then_name_with_unroutable_last(self) -> None:
        hospitals = [
            Hospital(hospital_id="H-A", name="Zeta", latitude=0, longitude=0, trauma_level="NONE", active=True),
            Hospital(hospital_id="H-B", name="Alpha", latitude=0, longitude=0, trauma_level="NONE", active=True),
            Hospital(hospital_id="H-C", name="Beta", latitude=0, longitude=0, trauma_level="NONE", active=True),
            Hospital(hospital_id="H-D", name="Closed", latitude=0, longitude=0, trauma_level="NONE", active=False),
            Hospital(hospital_id="H-E", name="Aardvark", latitude=0, longitude=0, trauma_level="NONE", active=True),
        ]
        scenario = self.scenario.model_copy(update={"hospitals": hospitals})
        minutes = {"H-A": 10, "H-B": 10, "H-C": 4, "H-E": None}

        class Provider(DistanceRoutingProvider):
            def get_travel_matrix(self, origins, destinations):  # type: ignore[no-untyped-def]
                return {
                    (origins[0].location_id, d.location_id): None
                    if minutes[d.location_id] is None
                    else _estimate(origins[0], d, minutes[d.location_id])
                    for d in destinations
                }

        options = hospital_options(scenario, 34.1, -83.5, Provider())

        self.assertEqual([item.hospital_id for item in options], ["H-C", "H-B", "H-A", "H-E"])
        self.assertFalse(options[-1].routable)
        self.assertIsNone(options[-1].drive_minutes)

    def test_blood_products_only_count_eligible_carriers(self) -> None:
        baseline = blood_product_options(self.scenario)
        no_blood = blood_product_options(
            apply_availability_profile(self.scenario, "br_01_no_valid_blood")
        )

        self.assertEqual([(item.product_type, item.eligible_unit_count) for item in baseline], [("O_NEG", 3)])
        self.assertEqual(baseline[0].label, "O negative")
        self.assertEqual(no_blood[0].eligible_unit_count, 2)

    def test_resource_options_include_mobilization_and_skip_ineligible_times(self) -> None:
        scenario = apply_availability_profile(self.scenario, "br_02_out_of_service")
        provider = PrefixRoutingProvider(direct_minutes=60)

        options = {item.unit_id: item for item in resource_options(scenario, 34.1, -83.5, provider)}

        self.assertEqual(options["BR-01"].arrival_minutes, 5)
        self.assertEqual(options["BR-03"].arrival_minutes, 13)
        self.assertFalse(options["BR-02"].eligible)
        self.assertIsNone(options["BR-02"].arrival_minutes)
        self.assertIn("Vehicle is not available", options["BR-02"].reasons)


class BloodRequestStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scenario = load_scenario()
        self.incident = self.scenario.live_incidents[0]
        self.store = BloodRequestStore(clock=_fixed_clock)

    def _submit(self, **overrides: object) -> CreateBloodRequest:
        values: dict[str, object] = {
            "unit_id": self.incident.patient_unit_id,
            "latitude": self.incident.latitude,
            "longitude": self.incident.longitude,
            "blood_product": "O_NEG",
            "destination_hospital_id": self.incident.destination_hospital_id,
        }
        values.update(overrides)
        return CreateBloodRequest(**values)

    def test_request_matches_equivalent_scenario_incident(self) -> None:
        provider = DistanceRoutingProvider()
        expected = calculate_live_rendezvous(self.scenario, self.incident.incident_id, provider)

        request = self.store.create(self.scenario, self._submit(), provider)

        self.assertEqual(request.rendezvous.recommendation, expected.recommendation)
        self.assertEqual(
            request.rendezvous.recommended_rendezvous_id, expected.recommended_rendezvous_id
        )
        self.assertEqual(
            request.rendezvous.direct_transport_minutes, expected.direct_transport_minutes
        )
        self.assertEqual(
            [item.status for item in request.rendezvous.candidates],
            [item.status for item in expected.candidates],
        )

    def test_crew_hospital_is_preserved_and_source_data_unchanged(self) -> None:
        request = self.store.create(
            self.scenario, self._submit(destination_hospital_id="H-03"), DistanceRoutingProvider()
        )

        self.assertEqual(request.destination_hospital_id, "H-03")
        self.assertEqual(request.rendezvous.destination_hospital_id, "H-03")
        self.assertEqual(len(self.scenario.live_incidents), 4)
        self.assertEqual(request.classification, "SIMULATED")

    def test_availability_profile_is_applied(self) -> None:
        scenario = apply_availability_profile(self.scenario, "br_02_out_of_service")

        request = self.store.create(
            scenario, self._submit(availability_profile="br_02_out_of_service"), DistanceRoutingProvider()
        )

        self.assertEqual(request.rendezvous.eligible_resource_count, 2)
        self.assertEqual(request.availability_profile, "br_02_out_of_service")

    def test_rendezvous_lifecycle_through_arrival(self) -> None:
        request = self.store.create(self.scenario, self._submit(), PrefixRoutingProvider(60))
        self.assertEqual(request.status, "ACTIVE_RENDEZVOUS")

        received = self.store.mark_blood_received(request.request_id)
        self.assertEqual(received.status, "BLOOD_RECEIVED")

        far = self.store.update_position(request.request_id, 34.0, -83.9, 150)
        self.assertEqual(far.status, "BLOOD_RECEIVED")
        arrived = self.store.update_position(
            request.request_id, far.destination_latitude, far.destination_longitude, 150
        )
        self.assertEqual(arrived.status, "ARRIVED")

    def test_direct_request_cannot_receive_blood_and_arrives_at_hospital(self) -> None:
        request = self.store.create(self.scenario, self._submit(), PrefixRoutingProvider(5))
        self.assertEqual(request.status, "ACTIVE_DIRECT")
        self.assertEqual(request.rendezvous.recommendation, "DIRECT_TRANSPORT")

        with self.assertRaises(BloodRequestError):
            self.store.mark_blood_received(request.request_id)
        arrived = self.store.update_position(
            request.request_id, request.destination_latitude, request.destination_longitude, 150
        )
        self.assertEqual(arrived.status, "ARRIVED")

    def test_cancel_is_idempotent_and_unknown_ids_are_rejected(self) -> None:
        request = self.store.create(self.scenario, self._submit(), PrefixRoutingProvider(60))

        cancelled = self.store.cancel(request.request_id, "Ended by the crew.")
        again = self.store.cancel(request.request_id, "Cancelled by operations.")

        self.assertEqual(cancelled.status, "CANCELLED")
        self.assertEqual(again.ended_reason, "Ended by the crew.")
        with self.assertRaises(BloodRequestNotFound):
            self.store.get("REQ-999")

    def test_new_request_replaces_the_units_active_request(self) -> None:
        first = self.store.create(self.scenario, self._submit(), PrefixRoutingProvider(60))
        second = self.store.create(self.scenario, self._submit(), PrefixRoutingProvider(60))

        self.assertEqual(self.store.get(first.request_id).status, "CANCELLED")
        self.assertEqual(second.status, "ACTIVE_RENDEZVOUS")
        self.assertEqual([item.request_id for item in self.store.list()], ["REQ-002", "REQ-001"])

    def test_requests_work_in_the_public_geography_scenario(self) -> None:
        scenario = load_scenario("echols_valdosta_public_geography_v1")
        ambulance = list_ambulances(scenario)[0]
        incident = next(
            item for item in scenario.live_incidents if item.patient_unit_id == ambulance.unit_id
        )
        product = blood_product_options(scenario)[0].product_type

        request = self.store.create(
            scenario,
            CreateBloodRequest(
                unit_id=ambulance.unit_id,
                latitude=ambulance.start_latitude,
                longitude=ambulance.start_longitude,
                blood_product=product,
                destination_hospital_id=incident.destination_hospital_id,
                scenario_id=scenario.metadata.scenario_id,
            ),
            DistanceRoutingProvider(),
        )

        self.assertEqual(request.scenario_id, "echols_valdosta_public_geography_v1")
        self.assertEqual(request.rendezvous.scenario_id, "echols_valdosta_public_geography_v1")
        self.assertEqual(request.destination_hospital_id, incident.destination_hospital_id)

    def test_invalid_submissions_are_rejected(self) -> None:
        provider = PrefixRoutingProvider(60)
        for overrides in (
            {"unit_id": "MEDIC-99"},
            {"blood_product": "AB_POS"},
            {"destination_hospital_id": "H-99"},
        ):
            with self.subTest(overrides=overrides), self.assertRaises(BloodRequestError):
                self.store.create(self.scenario, self._submit(**overrides), provider)


class CoordinateKeyedProviderTests(unittest.TestCase):
    def test_shared_labels_do_not_reuse_another_places_cached_time(self) -> None:
        inner = LabelCachingProvider()
        provider = CoordinateKeyedProvider(inner)
        origin = RoutingLocation("RV-03", 34.178, -83.565)
        near = RoutingLocation("destination", 34.2, -83.61)
        far = RoutingLocation("destination", 34.245, -83.41)

        near_minutes = provider.get_travel_matrix([origin], [near])[("RV-03", "destination")]
        far_minutes = provider.get_travel_matrix([origin], [far])[("RV-03", "destination")]
        unwrapped_far = inner.get_travel_matrix([origin], [far])[("RV-03", "destination")]
        unwrapped_near = inner.get_travel_matrix([origin], [near])[("RV-03", "destination")]

        assert near_minutes is not None and far_minutes is not None
        self.assertNotEqual(near_minutes.duration_seconds, far_minutes.duration_seconds)
        # Without the wrapper, the label cache returns the first place's time for both.
        self.assertEqual(unwrapped_far, unwrapped_near)


class DirectionsParsingTests(unittest.TestCase):
    def test_directions_payload_becomes_route_with_steps(self) -> None:
        route = _parse_directions(
            {
                "code": "Ok",
                "routes": [
                    {
                        "duration": 600,
                        "distance": 9000,
                        "geometry": {"coordinates": [[-83.5, 34.1], [-83.55, 34.15], [-83.6, 34.2]]},
                        "legs": [
                            {
                                "steps": [
                                    {
                                        "name": "SR 17",
                                        "distance": 5000,
                                        "duration": 300,
                                        "maneuver": {
                                            "instruction": "Head north on SR 17",
                                            "type": "depart",
                                            "location": [-83.5, 34.1],
                                        },
                                    },
                                    {
                                        "name": "",
                                        "distance": 0,
                                        "duration": 0,
                                        "maneuver": {
                                            "instruction": "You have arrived",
                                            "type": "arrive",
                                            "modifier": "right",
                                            "location": [-83.6, 34.2],
                                        },
                                    },
                                ]
                            }
                        ],
                    }
                ],
            }
        )

        assert isinstance(route, Route)
        self.assertEqual(route.duration_seconds, 600)
        self.assertEqual(len(route.geometry), 3)
        self.assertEqual(route.steps[0].instruction, "Head north on SR 17")
        self.assertEqual(route.steps[1].modifier, "right")

    def test_no_route_payload_returns_none(self) -> None:
        self.assertIsNone(_parse_directions({"code": "NoRoute"}))
        self.assertEqual(_parse_directions_options({"code": "NoRoute"}), [])

    def test_alternatives_keep_fastest_first(self) -> None:
        def route(duration: float, midpoint: list[float]) -> dict[str, object]:
            return {
                "duration": duration,
                "distance": duration * 15,
                "geometry": {"coordinates": [[-83.5, 34.1], midpoint, [-83.6, 34.2]]},
                "legs": [],
            }

        routes = _parse_directions_options(
            {"code": "Ok", "routes": [route(600, [-83.55, 34.15]), route(720, [-83.5, 34.2])]}
        )

        self.assertEqual([item.duration_seconds for item in routes], [600, 720])
        self.assertNotEqual(routes[0].geometry[1], routes[1].geometry[1])

    def test_route_options_offer_three_distinct_roads_between_the_same_points(self) -> None:
        start, end = (-83.5, 34.1), (-83.6, 34.2)

        def road(duration: float, *middle: tuple[float, float], uturn: bool = False) -> Route:
            steps = (
                (RouteStep("Make a U-turn", "turn", "uturn", "", 10, 5, *start),) if uturn else ()
            )
            return Route(duration, duration * 15, (start, *middle, end), steps)

        trip = distance_meters(start[1], start[0], end[1], end[0])

        class Provider(DistanceRoutingProvider):
            def __init__(self) -> None:
                self.via_calls = 0

            def get_route_options(self, origin, destination):  # type: ignore[no-untyped-def]
                # Mapbox-style: recommended road plus a near-duplicate "alternative".
                return [road(600, (-83.55, 34.15)), road(610, (-83.5501, 34.1501))]

            def get_route_via(self, origin, via, destination):  # type: ignore[no-untyped-def]
                # Results depend only on the via point, since requests run in parallel.
                self.via_calls += 1
                detour = (
                    distance_meters(start[1], start[0], via.latitude, via.longitude)
                    + distance_meters(via.latitude, via.longitude, end[1], end[0])
                ) / trip - 1
                # Via points west of the trip line need a U-turn in this fake road network.
                west = (via.longitude - start[0]) * (end[1] - start[1]) - (via.latitude - start[1]) * (end[0] - start[0]) > 0
                return road(600 * (1 + 3 * detour), (via.longitude, via.latitude), uturn=west)

        provider = Provider()
        options = route_options_between(provider, start[1], start[0], end[1], end[0])

        self.assertEqual(len(options), 3)
        self.assertEqual(options[0].duration_minutes, 10)
        self.assertEqual(provider.via_calls, 18)
        # Kept alternatives are the fastest acceptable ones: no U-turn, not over 1.8x.
        self.assertLessEqual(options[1].duration_minutes, options[2].duration_minutes)
        self.assertLessEqual(options[2].duration_minutes, 18)
        for option in options[1:]:
            self.assertFalse(any(step.modifier == "uturn" for step in option.steps))
        for option in options:
            self.assertEqual(option.geometry[0], list(start))
            self.assertEqual(option.geometry[-1], list(end))

    def test_route_options_stop_at_the_provider_alternatives_when_enough(self) -> None:
        start, end = (-83.5, 34.1), (-83.6, 34.2)

        class Provider(DistanceRoutingProvider):
            def get_route_options(self, origin, destination):  # type: ignore[no-untyped-def]
                return [
                    Route(600, 9000, (start, (-83.55, 34.15), end), ()),
                    Route(660, 9500, (start, (-83.62, 34.1), end), ()),
                    Route(700, 9900, (start, (-83.45, 34.22), end), ()),
                ]

            def get_route_via(self, origin, via, destination):  # type: ignore[no-untyped-def]
                raise AssertionError("via routes are not needed when three alternatives exist")

        options = route_options_between(Provider(), start[1], start[0], end[1], end[0])

        self.assertEqual(len(options), 3)


class AmbulanceSettingsTests(unittest.TestCase):
    def test_blank_values_use_defaults_and_zero_is_rejected(self) -> None:
        with mock.patch.dict(os.environ, {"BLOODGRID_AMBULANCE_ARRIVAL_RADIUS_METERS": ""}):
            self.assertEqual(ambulance_settings()["arrival_radius_meters"], 150)
        with mock.patch.dict(os.environ, {"BLOODGRID_AMBULANCE_SIM_SPEED_MULTIPLIER": "8"}):
            self.assertEqual(ambulance_settings()["sim_speed_multiplier"], 8)
        with mock.patch.dict(os.environ, {"BLOODGRID_REQUEST_POLL_SECONDS": "0"}):
            with self.assertRaises(ValueError):
                ambulance_settings()


if __name__ == "__main__":
    unittest.main()
