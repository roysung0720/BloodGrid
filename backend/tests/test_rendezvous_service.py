from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.meeting_spots import (
    MeetingSpot,
    MeetingSpotCatalogError,
    _catalog,
    catalog_spots,
    known_site_spots,
)
from app.models import ResponseUnit, ScenarioData
from app.rendezvous.service import calculate_live_rendezvous
from app.routing.models import RouteEstimate, RoutingLocation
from app.scenario_loader import load_scenario


def _base(location_id: str) -> str:
    # The evaluator keys locations by coordinates ("ID@lat,lon"); tests key by plain ID.
    return location_id.split("@")[0]


class FakeRoutingProvider:
    """Travel minutes by (origin ID, destination ID); anything unlisted takes `default`.

    It has no get_route, so the evaluator falls back to straight-line corridors.
    """

    provider_name = "test-routing"
    profile = "test-driving"

    def __init__(self, minutes: dict[tuple[str, str], float | None], default: float | None = 60) -> None:
        self.minutes = minutes
        self.default = default

    def get_travel_matrix(self, origins, destinations):  # type: ignore[no-untyped-def]
        results: dict[tuple[str, str], RouteEstimate | None] = {}
        for origin in origins:
            for destination in destinations:
                value = self.minutes.get((_base(origin.location_id), _base(destination.location_id)), self.default)
                results[(origin.location_id, destination.location_id)] = (
                    None
                    if value is None
                    else RouteEstimate(origin.location_id, destination.location_id, value * 60, value * 1000)
                )
        return results


def _between(a: tuple[float, float], b: tuple[float, float], fraction: float) -> tuple[float, float]:
    return (a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction)


class MeetingRuleTests(unittest.TestCase):
    """LIVE-001 is at (34.12, -83.515); its supplied hospital H-01 is at (34.2, -83.61)."""

    def setUp(self) -> None:
        self.source = load_scenario()
        self.incident = self.source.live_incidents[0]
        self.ambulance = (self.incident.latitude, self.incident.longitude)
        self.hospital = (34.2, -83.61)
        self.units = {unit.unit_id: unit for unit in self.source.response_units}

    def spot(self, spot_id: str, fraction: float, category: str = "PARKING", toward=None) -> MeetingSpot:
        """A spot part-way from the ambulance toward the hospital (or toward another point)."""

        latitude, longitude = _between(self.ambulance, toward or self.hospital, fraction)
        return MeetingSpot(spot_id=spot_id, name=spot_id, category=category, latitude=latitude, longitude=longitude)

    def evaluate(self, units: list[ResponseUnit], spots: list[MeetingSpot], minutes, default=60):
        scenario: ScenarioData = self.source.model_copy(update={"response_units": units})
        return calculate_live_rendezvous(
            scenario, self.incident.incident_id, FakeRoutingProvider(minutes, default), spots
        )

    def test_the_unit_that_gets_blood_soonest_wins_with_explainable_facts(self) -> None:
        near, far = self.spot("NEAR", 0.4), self.spot("FAR", 0.8)
        result = self.evaluate(
            [self.units["BR-01"], self.units["BR-02"]],
            [near, far],
            {
                ("LIVE-001", "H-01"): 30,
                ("LIVE-001", "NEAR"): 8, ("NEAR", "H-01"): 20,
                ("LIVE-001", "FAR"): 16, ("FAR", "H-01"): 12,
                ("BR-01", "NEAR"): 10, ("BR-01", "FAR"): 25,
                ("BR-02", "NEAR"): 22, ("BR-02", "FAR"): 18,
            },
        )
        best = result.candidates[0]

        self.assertEqual(result.recommendation, "RENDEZVOUS")
        self.assertEqual(result.recommended_rendezvous_id, "NEAR")
        self.assertEqual(best.status, "RECOMMENDED")
        self.assertEqual(best.resource_id, "BR-01")
        self.assertEqual(best.time_to_blood_minutes, 10)
        self.assertEqual(best.patient_wait_minutes, 2)
        self.assertEqual(best.resource_wait_minutes, 0)
        self.assertEqual(best.hospital_arrival_minutes, 30)
        self.assertEqual(best.added_hospital_delay_minutes, 0)
        self.assertEqual(result.destination_hospital_id, "H-01")

    def test_result_labels_a_recommended_staging_simulation(self) -> None:
        result = calculate_live_rendezvous(
            self.source,
            self.incident.incident_id,
            FakeRoutingProvider({("LIVE-001", "H-01"): 30}, default=6),
            [],
            resource_positioning="RECOMMENDED_STAGING",
        )

        self.assertEqual(result.resource_positioning, "RECOMMENDED_STAGING")

    def test_the_ambulance_may_swing_toward_a_unit_on_the_units_road(self) -> None:
        br01 = self.units["BR-01"]
        on_unit_road = self.spot("UNIT-ROAD", 0.3, toward=(br01.current_latitude, br01.current_longitude))
        result = self.evaluate(
            [br01],
            [on_unit_road],
            {("LIVE-001", "H-01"): 30, ("LIVE-001", "UNIT-ROAD"): 7, ("UNIT-ROAD", "H-01"): 26, ("BR-01", "UNIT-ROAD"): 9},
        )

        self.assertEqual(result.recommendation, "RENDEZVOUS")
        self.assertEqual(result.candidates[0].time_to_blood_minutes, 9)
        self.assertEqual(result.candidates[0].added_hospital_delay_minutes, 5)

    def test_a_spot_farther_from_the_hospital_than_the_start_is_wrong_direction(self) -> None:
        behind = self.spot("BEHIND", 0.2)
        result = self.evaluate(
            [self.units["BR-01"]],
            [behind],
            {("LIVE-001", "H-01"): 30, ("LIVE-001", "BEHIND"): 3, ("BEHIND", "H-01"): 34, ("BR-01", "BEHIND"): 4},
        )

        self.assertEqual(result.recommendation, "DIRECT_TRANSPORT")
        self.assertEqual(result.candidates[0].status, "WRONG_DIRECTION")

    def test_direct_transport_wins_when_blood_is_not_meaningfully_sooner(self) -> None:
        result = self.evaluate(
            [self.units["BR-01"]],
            [self.spot("LATE", 0.5)],
            {("LIVE-001", "H-01"): 12, ("LIVE-001", "LATE"): 6, ("LATE", "H-01"): 6, ("BR-01", "LATE"): 10},
        )

        self.assertEqual(result.recommendation, "DIRECT_TRANSPORT")
        self.assertIsNone(result.recommended_rendezvous_id)
        self.assertEqual(result.candidates[0].status, "TOO_LATE")

    def test_a_meet_up_with_too_much_hospital_delay_is_rejected(self) -> None:
        result = self.evaluate(
            [self.units["BR-01"]],
            [self.spot("SLOW", 0.5)],
            # Blood at 12 of a 40-minute trip, but hospital arrival 12 + 38 = 50 (+10 > the 10 cap).
            {("LIVE-001", "H-01"): 40, ("LIVE-001", "SLOW"): 6, ("SLOW", "H-01"): 38.5, ("BR-01", "SLOW"): 12},
        )

        self.assertEqual(result.max_added_hospital_delay_minutes, 10)
        self.assertEqual(result.candidates[0].status, "EXCESSIVE_DETOUR")
        self.assertEqual(result.recommendation, "DIRECT_TRANSPORT")

    def test_on_call_mobilization_is_included_in_time_to_blood(self) -> None:
        on_call = self.units["BR-03"]
        result = self.evaluate(
            [on_call],
            [self.spot("MID", 0.5)],
            {("LIVE-001", "H-01"): 30, ("LIVE-001", "MID"): 5, ("MID", "H-01"): 15, ("BR-03", "MID"): 10},
        )
        candidate = result.candidates[0]

        self.assertEqual(candidate.mobilization_minutes, 8)
        self.assertEqual(candidate.resource_arrival_minutes, 18)
        self.assertEqual(candidate.time_to_blood_minutes, 18)

    def test_ineligible_units_are_never_used(self) -> None:
        unavailable = self.units["BR-01"].model_copy(update={"vehicle_status": "OUT_OF_SERVICE"})
        result = self.evaluate([unavailable], [self.spot("MID", 0.5)], {("LIVE-001", "H-01"): 30}, default=5)

        self.assertEqual(result.eligible_resource_count, 0)
        self.assertEqual(result.recommendation, "DIRECT_TRANSPORT")
        self.assertEqual(result.candidates, [])

    def test_equal_timing_prefers_the_more_suitable_kind_of_place(self) -> None:
        lot = self.spot("LOT", 0.5, category="PARKING")
        known = self.spot("KNOWN", 0.5, category="KNOWN_SITE")
        minutes = {("LIVE-001", "H-01"): 30}
        for spot_id in ("LOT", "KNOWN"):
            minutes.update({("LIVE-001", spot_id): 8, (spot_id, "H-01"): 15, ("BR-01", spot_id): 8})
        result = self.evaluate([self.units["BR-01"]], [lot, known], minutes)

        self.assertEqual(result.recommended_rendezvous_id, "KNOWN")

    def test_roadside_points_are_used_when_no_mapped_places_are_nearby(self) -> None:
        result = self.evaluate([self.units["BR-01"]], [], {("LIVE-001", "H-01"): 40}, default=6)

        self.assertEqual(result.recommendation, "RENDEZVOUS")
        self.assertEqual(result.candidates[0].category, "ROADSIDE")
        self.assertEqual(result.candidates[0].source, "ROUTE")

    def test_spots_far_from_every_route_are_not_considered(self) -> None:
        far_away = MeetingSpot(spot_id="ATLANTA", name="Atlanta lot", category="PARKING", latitude=33.75, longitude=-84.39)
        result = self.evaluate(
            [self.units["BR-01"]],
            [far_away, self.spot("MID", 0.5)],
            {("LIVE-001", "H-01"): 30, ("LIVE-001", "MID"): 6, ("MID", "H-01"): 16, ("BR-01", "MID"): 8},
        )

        self.assertNotIn("ATLANTA", [candidate.rendezvous_id for candidate in result.candidates])
        self.assertEqual(result.spots_available, 2)
        self.assertEqual(result.recommended_rendezvous_id, "MID")

    def test_each_units_best_option_is_reported_even_when_rejected(self) -> None:
        result = self.evaluate(
            [self.units["BR-01"], self.units["BR-02"]],
            [self.spot("MID", 0.5)],
            {("LIVE-001", "H-01"): 30, ("LIVE-001", "MID"): 6, ("MID", "H-01"): 16, ("BR-01", "MID"): 8, ("BR-02", "MID"): 29},
        )
        by_unit = {candidate.resource_id: candidate.status for candidate in result.candidates}

        self.assertEqual(by_unit, {"BR-01": "RECOMMENDED", "BR-02": "TOO_LATE"})
        # With a single mapped spot, roadside fallback points are also timed and counted.
        self.assertEqual(result.rejected_summary["TOO_LATE"], 1)

    def test_each_incident_preserves_its_own_supplied_destination(self) -> None:
        provider = FakeRoutingProvider({}, default=20)
        scenario = self.source.model_copy(update={"response_units": [self.units["BR-01"]]})
        first = calculate_live_rendezvous(scenario, "LIVE-001", provider, [])
        other = calculate_live_rendezvous(scenario, "LIVE-003", provider, [])

        self.assertEqual(first.destination_hospital_id, "H-01")
        self.assertEqual(other.destination_hospital_id, "H-03")
        self.assertEqual(other.destination_hospital_name, "East Ridge Community Hospital")


class MeetingSpotCatalogTests(unittest.TestCase):
    def test_catalog_is_selected_by_scenario_area(self) -> None:
        rural = catalog_spots(load_scenario().metadata.bounding_box)
        echols = catalog_spots(load_scenario("echols_valdosta_public_geography_v1").metadata.bounding_box)

        self.assertGreater(len(rural), 1000)
        self.assertGreater(len(echols), 500)
        self.assertTrue(all(33.7 <= spot.latitude <= 34.6 for spot in rural))
        self.assertTrue(all(30.3 <= spot.latitude <= 31.3 for spot in echols))
        self.assertTrue({spot.category for spot in rural} >= {"PARKING", "FUEL_STATION"})

    def test_map_endpoint_returns_the_same_catalog_the_rule_uses(self) -> None:
        from app.main import meeting_spots

        scenario = load_scenario("echols_valdosta_public_geography_v1")
        served = meeting_spots("echols_valdosta_public_geography_v1")
        used = known_site_spots(scenario.rendezvous_points) + catalog_spots(scenario.metadata.bounding_box)

        self.assertEqual([spot.spot_id for spot in served], [spot.spot_id for spot in used])

    def test_known_sites_are_kept_only_when_active(self) -> None:
        points = load_scenario().rendezvous_points
        closed = points[0].model_copy(update={"active": False})
        spots = known_site_spots([closed, *points[1:]])

        self.assertNotIn(closed.rendezvous_id, [spot.spot_id for spot in spots])
        self.assertTrue(all(spot.category == "KNOWN_SITE" for spot in spots))

    def test_malformed_catalog_rows_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "bad.csv").write_text(
                "spot_id,name,category,latitude,longitude,area_m2\nX,Lot,SPACESHIP,34.1,-83.5,\n",
                encoding="utf-8",
            )
            with self.assertRaises(MeetingSpotCatalogError):
                _catalog(Path(directory))


if __name__ == "__main__":
    unittest.main()
