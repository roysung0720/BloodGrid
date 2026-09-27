from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")

DATA_SCENARIOS_DIR = PROJECT_ROOT / "data" / "scenarios"
SCENARIO_ID = os.getenv("BLOODGRID_SCENARIO", "rural_ga_initial_v1")
FRONTEND_ORIGINS = ["http://localhost:3000", "http://localhost:3001"]
MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN") or os.getenv(
    "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN"
)
MAPBOX_ROUTING_PROFILE = os.getenv("MAPBOX_ROUTING_PROFILE", "mapbox/driving")
ROUTING_TIMEOUT_SECONDS = float(os.getenv("ROUTING_TIMEOUT_SECONDS", "12"))


def coverage_target_minutes(scenario_target_minutes: int) -> int:
    """Use a local override when configured; otherwise keep the scenario default."""

    configured_target = os.getenv("BLOODGRID_COVERAGE_TARGET_MINUTES")
    if configured_target is None:
        return scenario_target_minutes

    target_minutes = int(configured_target)
    if target_minutes < 1:
        raise ValueError("BLOODGRID_COVERAGE_TARGET_MINUTES must be at least 1")
    return target_minutes


def rendezvous_max_added_hospital_delay_minutes() -> float:
    """Return the largest modeled hospital-arrival delay allowed for an intercept."""

    return _nonnegative_float(
        "BLOODGRID_RENDEZVOUS_MAX_ADDED_HOSPITAL_DELAY_MINUTES", "10"
    )


def rendezvous_hospital_delay_weight() -> float:
    """Return the configured score penalty for modeled hospital-arrival delay."""

    return _nonnegative_float("BLOODGRID_RENDEZVOUS_HOSPITAL_DELAY_WEIGHT", "0.5")


def _nonnegative_float(variable_name: str, default: str) -> float:
    value = float(os.getenv(variable_name, default))
    if value < 0:
        raise ValueError(f"{variable_name} must be zero or greater")
    return value
