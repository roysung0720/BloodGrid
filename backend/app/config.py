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

    # A blank value (as shipped in .env.example) means "no override".
    configured_target = os.getenv("BLOODGRID_COVERAGE_TARGET_MINUTES", "").strip()
    if not configured_target:
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


def ambulance_settings() -> dict[str, float]:
    """Return the Ambulance UI timing and geofence settings.

    A blank value in .env means "use the default", so copying .env.example is safe.
    """

    return {
        "arrival_radius_meters": _positive_setting(
            "BLOODGRID_AMBULANCE_ARRIVAL_RADIUS_METERS", 150
        ),
        "eta_refresh_seconds": _positive_setting(
            "BLOODGRID_AMBULANCE_ETA_REFRESH_SECONDS", 60
        ),
        "position_report_seconds": _positive_setting(
            "BLOODGRID_AMBULANCE_POSITION_REPORT_SECONDS", 5
        ),
        "request_poll_seconds": _positive_setting("BLOODGRID_REQUEST_POLL_SECONDS", 3),
        "sim_speed_multiplier": _positive_setting(
            "BLOODGRID_AMBULANCE_SIM_SPEED_MULTIPLIER", 5
        ),
    }


def _positive_setting(variable_name: str, default: float) -> float:
    configured = os.getenv(variable_name, "").strip()
    if not configured:
        return default
    value = float(configured)
    if value <= 0:
        raise ValueError(f"{variable_name} must be greater than zero")
    return value


# Reroute options for the Ambulance UI. These shape which alternative roads are offered;
# they never change the rendezvous decision.
ROUTE_OPTION_COUNT = 3
# A route counts as different when it strays this far from every other offered route.
ROUTE_OPTION_DIFFERENT_METERS = 120
# Alternatives slower than this multiple of the fastest road are not offered.
ROUTE_OPTION_MAX_DURATION_RATIO = 1.8
# When Mapbox offers too few distinct roads, routes are also requested through silent via
# points: placed at these fractions along the recommended route, offset sideways by these
# fractions of the straight-line trip, on both sides. The fastest acceptable ones are kept.
ROUTE_OPTION_VIA_POSITIONS = (0.33, 0.5, 0.67)
ROUTE_OPTION_VIA_OFFSETS = (0.15, 0.25, 0.45)
ROUTE_OPTION_MIN_VIA_METERS = 800
ROUTE_OPTION_MAX_VIA_METERS = 8000
