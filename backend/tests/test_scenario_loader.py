from __future__ import annotations

import unittest

from app.scenario_loader import load_scenario


class ScenarioLoaderTests(unittest.TestCase):
    def test_initial_scenario_loads_with_expected_records(self) -> None:
        scenario = load_scenario()

        self.assertEqual(scenario.metadata.scenario_id, "rural_ga_initial_v1")
        self.assertEqual(len(scenario.stations), 8)
        self.assertEqual(len(scenario.response_units), 3)
        self.assertEqual(len(scenario.blood_units), 6)
        self.assertEqual(len(scenario.hospitals), 3)
        self.assertEqual(len(scenario.historical_incidents), 30)
        self.assertEqual(len(scenario.rendezvous_points), 8)
        self.assertEqual(len(scenario.live_incidents), 1)
        self.assertEqual(len(scenario.availability_profiles), 5)
        self.assertEqual(scenario.availability_profiles[0].profile_id, "baseline")


if __name__ == "__main__":
    unittest.main()
