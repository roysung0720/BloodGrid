from __future__ import annotations

import os
import unittest
from unittest import mock

from app.config import coverage_target_minutes


ENV_KEY = "BLOODGRID_COVERAGE_TARGET_MINUTES"


class CoverageTargetConfigTests(unittest.TestCase):
    def test_unset_override_uses_scenario_default(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop(ENV_KEY, None)
            self.assertEqual(coverage_target_minutes(20), 20)

    def test_blank_override_uses_scenario_default(self) -> None:
        with mock.patch.dict(os.environ, {ENV_KEY: ""}):
            self.assertEqual(coverage_target_minutes(20), 20)
        with mock.patch.dict(os.environ, {ENV_KEY: "   "}):
            self.assertEqual(coverage_target_minutes(20), 20)

    def test_numeric_override_replaces_scenario_default(self) -> None:
        with mock.patch.dict(os.environ, {ENV_KEY: "15"}):
            self.assertEqual(coverage_target_minutes(20), 15)

    def test_override_below_one_is_rejected(self) -> None:
        with mock.patch.dict(os.environ, {ENV_KEY: "0"}):
            with self.assertRaises(ValueError):
                coverage_target_minutes(20)


if __name__ == "__main__":
    unittest.main()
