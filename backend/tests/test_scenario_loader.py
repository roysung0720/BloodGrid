from __future__ import annotations

import csv
import hashlib
import json
import unittest
from pathlib import Path

from app.scenario_loader import list_scenarios, load_scenario


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
        self.assertEqual(len(scenario.live_incidents), 4)
        self.assertEqual(
            [incident.incident_id for incident in scenario.live_incidents],
            ["LIVE-001", "LIVE-002", "LIVE-003", "LIVE-004"],
        )
        self.assertEqual(
            [incident.destination_hospital_id for incident in scenario.live_incidents],
            ["H-01", "H-01", "H-03", "H-02"],
        )
        self.assertEqual(len(scenario.availability_profiles), 5)
        self.assertEqual(scenario.availability_profiles[0].profile_id, "baseline")

    def test_public_geography_scenario_loads_with_labeled_sources(self) -> None:
        scenario = load_scenario("echols_valdosta_public_geography_v1")

        self.assertEqual(
            scenario.metadata.classification,
            "HYBRID_PUBLIC_GEOGRAPHY_SYNTHETIC_OPERATIONS",
        )
        self.assertEqual(len(scenario.stations), 6)
        self.assertEqual(len(scenario.response_units), 3)
        self.assertEqual(len(scenario.blood_units), 6)
        self.assertEqual(len(scenario.hospitals), 2)
        self.assertEqual(
            [hospital.hospital_id for hospital in scenario.hospitals],
            ["H-EV-01", "H-EV-02"],
        )
        self.assertEqual(len(scenario.historical_incidents), 30)
        self.assertTrue(
            all(
                incident.source == "SYNTHETIC_ROAD_ALIGNED_DEMAND_PROXY"
                for incident in scenario.historical_incidents
            )
        )
        self.assertEqual(len(scenario.rendezvous_points), 8)
        self.assertEqual(len(scenario.live_incidents), 4)
        self.assertTrue(
            all(
                incident.patient_unit_id.startswith("SYNTHETIC-")
                for incident in scenario.live_incidents
            )
        )
        self.assertEqual(len(scenario.availability_profiles), 5)

        project_root = Path(__file__).resolve().parents[2]
        scenario_dir = project_root / "data" / "scenarios" / scenario.metadata.scenario_id
        sources = json.loads((scenario_dir / "sources.json").read_text())
        self.assertEqual(sources["scenario_id"], scenario.metadata.scenario_id)
        self.assertEqual(
            {source["classification"] for source in sources["sources"]},
            {"REAL", "REFERENCE_ONLY"},
        )
        for source in sources["sources"]:
            if source["raw_path"] is None:
                self.assertIsNone(source["sha256"])
                continue

            raw_file = project_root / source["raw_path"]
            self.assertTrue(raw_file.is_file())
            self.assertEqual(
                hashlib.sha256(raw_file.read_bytes()).hexdigest(),
                source["sha256"],
            )

        reference_path = (
            project_root
            / "data"
            / "processed"
            / scenario.metadata.scenario_id
            / "road_aligned_demand_proxies.csv"
        )
        with reference_path.open(encoding="utf-8", newline="") as source_file:
            demand_references = list(csv.DictReader(source_file))
        self.assertEqual(len(demand_references), 30)
        self.assertEqual(
            {row["incident_id"] for row in demand_references},
            {incident.incident_id for incident in scenario.historical_incidents},
        )
        self.assertEqual(
            sum(row["source_road_class"] == "PRIMARY" for row in demand_references),
            18,
        )
        self.assertEqual(
            sum(
                row["source_road_class"] == "SECONDARY" for row in demand_references
            ),
            12,
        )
        self.assertGreaterEqual(
            len({row["source_road_name"] for row in demand_references}),
            10,
        )

    def test_scenario_catalog_lists_both_versioned_demo_worlds(self) -> None:
        catalog = list_scenarios()

        self.assertEqual(
            [entry.metadata.scenario_id for entry in catalog],
            ["rural_ga_initial_v1", "echols_valdosta_public_geography_v1"],
        )
        default_entry = next(entry for entry in catalog if entry.is_default)
        self.assertEqual(default_entry.metadata.scenario_id, "rural_ga_initial_v1")


if __name__ == "__main__":
    unittest.main()
