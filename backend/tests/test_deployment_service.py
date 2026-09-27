from __future__ import annotations

import unittest

from app.deployment.service import calculate_strategic_deployment
from app.models import ResponseUnit, ScenarioData, Station
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


class StrategicDeploymentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.source = load_scenario()

    def test_optimizer_maximizes_coverage_without_overfilling_a_station(self) -> None:
        scenario = self._scenario(
            units=self.source.response_units[:2],
            stations=self.source.stations[:3],
            incident_count=2,
        )
        first_incident, second_incident = scenario.historical_incidents
        provider = FakeRoutingProvider(
            {
                ("S-01", first_incident.incident_id): 5,
                ("S-01", second_incident.incident_id): 30,
                ("S-02", first_incident.incident_id): 30,
                ("S-02", second_incident.incident_id): 5,
                ("S-03", first_incident.incident_id): 15,
                ("S-03", second_incident.incident_id): 15,
            }
        )

        result = calculate_strategic_deployment(scenario, provider)

        self.assertEqual(result.solver_status, "OPTIMAL")
        self.assertEqual(result.optimized_covered_demand_count, 2)
        self.assertEqual(
            {assignment.station_id for assignment in result.assignments}, {"S-01", "S-02"}
        )
        self.assertEqual(len(result.assignments), 2)

    def test_on_call_delay_can_leave_a_staged_resource_outside_target(self) -> None:
        on_call_unit = self.source.response_units[2]
        scenario = self._scenario(
            units=[on_call_unit],
            stations=[self.source.stations[0]],
            incident_count=1,
        )
        incident = scenario.historical_incidents[0]
        provider = FakeRoutingProvider({("S-01", incident.incident_id): 15})

        result = calculate_strategic_deployment(scenario, provider)
        point = result.demand_points[0]

        self.assertEqual(point.status, "UNCOVERED")
        self.assertEqual(point.best_resource_id, "BR-03")
        self.assertEqual(point.mobilization_minutes, 8)
        self.assertEqual(point.total_response_minutes, 23)

    def test_ineligible_unit_is_not_assigned(self) -> None:
        unavailable_unit: ResponseUnit = self.source.response_units[1].model_copy(
            update={"vehicle_status": "OUT_OF_SERVICE"}
        )
        scenario = self._scenario(
            units=[self.source.response_units[0], unavailable_unit],
            stations=self.source.stations[:2],
            incident_count=1,
        )
        incident = scenario.historical_incidents[0]
        provider = FakeRoutingProvider(
            {
                ("S-01", incident.incident_id): 5,
                ("S-02", incident.incident_id): 5,
            }
        )

        result = calculate_strategic_deployment(scenario, provider)

        self.assertEqual(result.eligible_resource_count, 1)
        self.assertEqual([assignment.unit_id for assignment in result.assignments], ["BR-01"])

    def _scenario(
        self,
        units: list[ResponseUnit],
        stations: list[Station],
        incident_count: int,
    ) -> ScenarioData:
        return self.source.model_copy(
            update={
                "response_units": units,
                "stations": [station.model_copy(update={"capacity": 1}) for station in stations],
                "historical_incidents": self.source.historical_incidents[:incident_count],
            }
        )


if __name__ == "__main__":
    unittest.main()
