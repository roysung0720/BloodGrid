from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_SCENARIOS_DIR = PROJECT_ROOT / "data" / "scenarios"
SCENARIO_ID = os.getenv("BLOODGRID_SCENARIO", "rural_ga_initial_v1")
FRONTEND_ORIGINS = ["http://localhost:3000", "http://localhost:3001"]
