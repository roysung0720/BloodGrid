from __future__ import annotations

import unittest

from app.availability.service import AvailabilityProfileError, apply_availability_profile
from app.coverage.service import calculate_baseline_coverage
from app.deployment.service import calculate_strategic_deployment
from app.rendezvous.service import calculate_live_rendezvous
from app.routing.models import RouteEstimate, RoutingLocation
from app.scenario_loader import load_scenario


class FakeRoutingProvider:
    provider_name = "test-routing"
    profile = "test-driving"

    def get_travel_matrix(
        self,
        origins: list[RoutingLocation],
        destinations: list[RoutingLocation],
    ) -> dict[tuple[str, str], RouteEstimate | None]:
        return {
            (origin.location_id, destination.location_id): _route_estimate(
                origin.location_id, destination.location_id
            )
            for origin in origins
            for destination in destinations
        }


def _route_estimate(origin_id: str, destination_id: str) -> RouteEstimate:
    if origin_id == "LIVE-001" and destination_id == "destination":
        minutes = 25
    elif origin_id == "LIVE-001":
        minutes = 4
    elif origin_id.startswith("RV-") and destination_id == "destination":
        minutes = 10
    elif origin_id.startswith("BR-") and destination_id.startswith("RV-"):
        minutes = 5
    else:
        minutes = 5
    return RouteEstimate(
        origin_id=origin_id,
        destination_id=destination_id,
        duration_seconds=minutes * 60,
        distance_meters=minutes * 1609.344,
    )


class AvailabilityProfileTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scenario = load_scenario()
        self.provider = FakeRoutingProvider()

    def test_profile_changes_a_copy_without_mutating_the_baseline(self) -> None:
        adjusted = apply_availability_profile(self.scenario, "br_01_no_valid_blood")
        adjusted_unit = next(
            unit for unit in adjusted.response_units if unit.unit_id == "BR-01"
        )
        adjusted_blood = [
            blood_unit
            for blood_unit in adjusted.blood_units
            if blood_unit.current_location_id == "BR-01"
        ]
        baseline_unit = next(
            unit for unit in self.scenario.response_units if unit.unit_id == "BR-01"
        )

        self.assertEqual(adjusted.active_availability_profile_id, "br_01_no_valid_blood")
        self.assertEqual(adjusted_unit.blood_units_onboard, 0)
        self.assertTrue(
            all(blood_unit.availability_status == "UNAVAILABLE" for blood_unit in adjusted_blood)
        )
        self.assertEqual(baseline_unit.blood_units_onboard, 2)

    def test_unavailable_profile_recalculates_all_decision_modes(self) -> None:
        adjusted = apply_availability_profile(self.scenario, "br_02_out_of_service")

        coverage = calculate_baseline_coverage(adjusted, self.provider)
        deployment = calculate_strategic_deployment(adjusted, self.provider)
        rendezvous = calculate_live_rendezvous(adjusted, "LIVE-001", self.provider)

        self.assertEqual(coverage.eligible_resource_count, 2)
        self.assertFalse(
            next(
                assessment
                for assessment in coverage.resource_eligibility
                if assessment.unit_id == "BR-02"
            ).eligible
        )
        self.assertNotIn("BR-02", [assignment.unit_id for assignment in deployment.assignments])
        self.assertTrue(
            all(candidate.resource_id != "BR-02" for candidate in rendezvous.candidates)
        )

    def test_staffed_and_unqualified_profiles_change_br_03_eligibility(self) -> None:
        staffed = apply_availability_profile(self.scenario, "br_03_staffed")
        staffed_unit = next(
            unit for unit in staffed.response_units if unit.unit_id == "BR-03"
        )
        unqualified = apply_availability_profile(self.scenario, "br_03_unqualified")
        unqualified_coverage = calculate_baseline_coverage(unqualified, self.provider)
        unqualified_assessment = next(
            assessment
            for assessment in unqualified_coverage.resource_eligibility
            if assessment.unit_id == "BR-03"
        )

        self.assertEqual(staffed_unit.crew_status, "AVAILABLE")
        self.assertEqual(staffed_unit.mobilization_minutes, 0)
        self.assertFalse(unqualified_assessment.eligible)
        self.assertIn("No qualified blood clinician", unqualified_assessment.reasons)

    def test_unknown_profile_is_rejected(self) -> None:
        with self.assertRaises(AvailabilityProfileError):
            apply_availability_profile(self.scenario, "not-a-profile")


if __name__ == "__main__":
    unittest.main()
