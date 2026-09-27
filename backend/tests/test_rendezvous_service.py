from __future__ import annotations

import unittest

from app.models import RendezvousPoint, ResponseUnit, ScenarioData
from app.rendezvous.service import calculate_live_rendezvous
from app.routing.models import RouteEstimate, RoutingLocation
from app.scenario_loader import load_scenario


class FakeRoutingProvider:
    provider_name = "test-routing"
    profile = "test-driving"

    def __init__(self, minutes_by_pair: dict[tuple[str, str], float | None]) -> None:
        self.minutes_by_pair = minutes_by_pair

    def get_travel_matrix(
        self,
        origins: list[RoutingLocation],
        destinations: list[RoutingLocation],
    ) -> dict[tuple[str, str], RouteEstimate | None]:
        results: dict[tuple[str, str], RouteEstimate | None] = {}
        for origin in origins:
            for destination in destinations:
                minutes = self.minutes_by_pair.get(
                    (origin.location_id, destination.location_id), 60
                )
                results[(origin.location_id, destination.location_id)] = (
                    None
                    if minutes is None
                    else RouteEstimate(
                        origin_id=origin.location_id,
                        destination_id=destination.location_id,
                        duration_seconds=minutes * 60,
                        distance_meters=minutes * 1609.344,
                    )
                )
        return results


class LiveRendezvousTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = load_scenario()
        self.incident = self.source.live_incidents[0]
        self.point = self.source.rendezvous_points[0]

    def test_recommends_best_approved_point_with_explainable_wait_times(self) -> None:
        scenario = self._scenario(
            units=self.source.response_units[:2], points=[self.point]
        )
        provider = self._provider(
            {
                (self.incident.incident_id, "destination"): 16,
                (self.incident.incident_id, self.point.rendezvous_id): 3,
                (self.point.rendezvous_id, "destination"): 12,
                ("BR-01", self.point.rendezvous_id): 5,
                ("BR-02", self.point.rendezvous_id): 8,
            }
        )

        result = calculate_live_rendezvous(
            scenario, self.incident.incident_id, provider
        )
        candidate = result.candidates[0]

        self.assertTrue(result.destination_valid)
        self.assertEqual(result.destination_hospital_id, "H-01")
        self.assertEqual(result.recommendation, "RENDEZVOUS")
        self.assertEqual(result.recommended_rendezvous_id, self.point.rendezvous_id)
        self.assertEqual(candidate.status, "RECOMMENDED")
        self.assertEqual(candidate.resource_id, "BR-01")
        self.assertEqual(candidate.patient_wait_minutes, 2)
        self.assertEqual(candidate.resource_wait_minutes, 0)
        self.assertEqual(candidate.time_to_blood_minutes, 5)
        self.assertEqual(candidate.added_hospital_delay_minutes, 1)

    def test_direct_transport_wins_when_resource_cannot_arrive_before_hospital(self) -> None:
        scenario = self._scenario(units=self.source.response_units[:1], points=[self.point])
        provider = self._provider(
            {
                (self.incident.incident_id, "destination"): 8,
                (self.incident.incident_id, self.point.rendezvous_id): 4,
                (self.point.rendezvous_id, "destination"): 3,
                ("BR-01", self.point.rendezvous_id): 9,
            }
        )

        result = calculate_live_rendezvous(
            scenario, self.incident.incident_id, provider

        )

        self.assertEqual(result.recommendation, "DIRECT_TRANSPORT")
        self.assertIsNone(result.recommended_rendezvous_id)
        self.assertEqual(result.candidates[0].status, "TOO_LATE")

    def test_on_call_mobilization_is_included_in_time_to_blood(self) -> None:
        on_call_unit = self.source.response_units[2]
        scenario = self._scenario(units=[on_call_unit], points=[self.point])
        provider = self._provider(
            {
                (self.incident.incident_id, "destination"): 30,
                (self.incident.incident_id, self.point.rendezvous_id): 4,
                (self.point.rendezvous_id, "destination"): 15,
                ("BR-03", self.point.rendezvous_id): 10,
            }
        )

        result = calculate_live_rendezvous(
            scenario, self.incident.incident_id, provider
        )
        candidate = result.candidates[0]

        self.assertEqual(candidate.status, "RECOMMENDED")
        self.assertEqual(candidate.mobilization_minutes, 8)
        self.assertEqual(candidate.resource_arrival_minutes, 18)
        self.assertEqual(candidate.time_to_blood_minutes, 18)

    def test_direct_transport_wins_when_rendezvous_exceeds_detour_limit(self) -> None:
        scenario = self._scenario(units=self.source.response_units[:1], points=[self.point])
        provider = self._provider(
            {
                (self.incident.incident_id, "destination"): 30,
                (self.incident.incident_id, self.point.rendezvous_id): 5,
                (self.point.rendezvous_id, "destination"): 35,
                ("BR-01", self.point.rendezvous_id): 8,
            }
        )

        result = calculate_live_rendezvous(
            scenario, self.incident.incident_id, provider
        )

        self.assertEqual(result.recommendation, "DIRECT_TRANSPORT")
        self.assertEqual(result.candidates[0].status, "EXCESSIVE_DETOUR")

    def test_unapproved_point_and_ineligible_resources_are_not_recommended(self) -> None:
        unapproved_point: RendezvousPoint = self.point.model_copy(
            update={"approved": False}
        )
        unavailable_unit: ResponseUnit = self.source.response_units[0].model_copy(
            update={"vehicle_status": "OUT_OF_SERVICE"}
        )
        scenario = self._scenario(units=[unavailable_unit], points=[unapproved_point])
        provider = self._provider(
            {(self.incident.incident_id, "destination"): 15}
        )

        result = calculate_live_rendezvous(
            scenario, self.incident.incident_id, provider
        )

        self.assertEqual(result.eligible_resource_count, 0)
        self.assertEqual(result.recommendation, "DIRECT_TRANSPORT")
        self.assertEqual(result.candidates[0].status, "INELIGIBLE_POINT")

    def test_each_incident_preserves_its_own_supplied_destination(self) -> None:
        alternate_incident = next(
            incident
            for incident in self.source.live_incidents
            if incident.incident_id == "LIVE-003"
        )
        first_point, second_point = self.source.rendezvous_points[:2]
        scenario = self._scenario(
            units=self.source.response_units[:1], points=[first_point, second_point]
        )
        provider = self._provider(
            {
                (self.incident.incident_id, "destination"): 16,
                (self.incident.incident_id, first_point.rendezvous_id): 3,
                (first_point.rendezvous_id, "destination"): 12,
                ("BR-01", first_point.rendezvous_id): 5,
                (alternate_incident.incident_id, "destination"): 18,
                (alternate_incident.incident_id, second_point.rendezvous_id): 4,
                (second_point.rendezvous_id, "destination"): 10,
                ("BR-01", second_point.rendezvous_id): 6,
            }
        )

        first_result = calculate_live_rendezvous(
            scenario, self.incident.incident_id, provider
        )
        alternate_result = calculate_live_rendezvous(
            scenario, alternate_incident.incident_id, provider
        )

        self.assertEqual(first_result.incident_id, "LIVE-001")
        self.assertEqual(first_result.destination_hospital_id, "H-01")
        self.assertEqual(alternate_result.incident_id, "LIVE-003")
        self.assertEqual(alternate_result.destination_hospital_id, "H-03")
        self.assertEqual(alternate_result.destination_hospital_name, "East Ridge Community Hospital")
        self.assertTrue(alternate_result.destination_valid)

    def _provider(
        self, minutes_by_pair: dict[tuple[str, str], float | None]
    ) -> FakeRoutingProvider:
        return FakeRoutingProvider(minutes_by_pair)

    def _scenario(
        self, units: list[ResponseUnit], points: list[RendezvousPoint]
    ) -> ScenarioData:
        return self.source.model_copy(
            update={"response_units": units, "rendezvous_points": points}
        )


if __name__ == "__main__":
    unittest.main()
