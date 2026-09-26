from __future__ import annotations

import unittest

from app.coverage.service import assess_resource_eligibility, calculate_baseline_coverage
from app.models import BloodUnit, HistoricalIncident, ResponseUnit
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
                minutes = self.minutes_by_pair[(origin.location_id, destination.location_id)]
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


class CoverageServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scenario = load_scenario()

    def test_eligibility_requires_every_resource_component(self) -> None:
        unavailable_vehicle = ResponseUnit(
            unit_id="BR-BLOCKED",
            unit_type="SUPERVISOR",
            home_station_id="S-01",
            current_latitude=34.1,
            current_longitude=-83.8,
            vehicle_status="OUT_OF_SERVICE",
            crew_status="AVAILABLE",
            crew_level="PARAMEDIC",
            blood_credentialed=False,
            mobilization_minutes=0,
            blood_units_onboard=1,
            shift_start="07:00",
            shift_end="19:00",
        )
        invalid_blood = BloodUnit(
            blood_unit_id="BU-BLOCKED",
            product_type="O_NEG",
            current_location_type="RESPONSE_UNIT",
            current_location_id="BR-BLOCKED",
            expiration_datetime="2030-10-01T00:00:00Z",
            temperature_status="INVALID",
            availability_status="ONBOARD",
        )

        assessment = assess_resource_eligibility(unavailable_vehicle, [invalid_blood])

        self.assertFalse(assessment.eligible)
        self.assertEqual(assessment.valid_blood_units, 0)
        self.assertEqual(
            assessment.reasons,
            [
                "No usable onboard blood",
                "Vehicle is not available",
                "No qualified blood clinician",
            ],
        )

    def test_on_call_mobilization_changes_the_fastest_resource(self) -> None:
        first_incident = self.scenario.historical_incidents[0]
        routes = {
            ("BR-01", first_incident.incident_id): 20,
            ("BR-02", first_incident.incident_id): 22,
            ("BR-03", first_incident.incident_id): 14,
        }
        provider = FakeRoutingProvider(
            {
                (unit.unit_id, incident.incident_id): routes.get(
                    (unit.unit_id, incident.incident_id), 40
                )
                for unit in self.scenario.response_units
                for incident in self.scenario.historical_incidents
            }
        )

        result = calculate_baseline_coverage(self.scenario, provider)
        first_point = result.demand_points[0]

        self.assertEqual(first_point.best_resource_id, "BR-01")
        self.assertEqual(first_point.driving_minutes, 20)
        self.assertEqual(first_point.mobilization_minutes, 0)
        self.assertTrue(first_point.covered)

    def test_uncovered_point_reports_fastest_eligible_resource(self) -> None:
        provider = FakeRoutingProvider(
            {
                (unit.unit_id, incident.incident_id): 25
                for unit in self.scenario.response_units
                for incident in self.scenario.historical_incidents
            }
        )

        result = calculate_baseline_coverage(self.scenario, provider)
        first_point = result.demand_points[0]

        self.assertEqual(first_point.status, "UNCOVERED")
        self.assertEqual(first_point.best_resource_id, "BR-01")
        self.assertEqual(first_point.total_response_minutes, 25)
        self.assertFalse(first_point.covered)


if __name__ == "__main__":
    unittest.main()
