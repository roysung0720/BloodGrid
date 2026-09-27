from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RoutingLocation:
    """A named WGS84 location used as one side of a route lookup."""

    location_id: str
    latitude: float
    longitude: float


@dataclass(frozen=True)
class RouteEstimate:
    """A single road travel estimate returned by a routing provider."""

    origin_id: str
    destination_id: str
    duration_seconds: float
    distance_meters: float


@dataclass(frozen=True)
class RouteStep:
    """One turn-by-turn maneuver along a drawn route."""

    instruction: str
    maneuver_type: str
    modifier: str
    road_name: str
    distance_meters: float
    duration_seconds: float
    longitude: float
    latitude: float


@dataclass(frozen=True)
class Route:
    """A drawable road route with its turn-by-turn steps."""

    duration_seconds: float
    distance_meters: float
    geometry: tuple[tuple[float, float], ...]
    steps: tuple[RouteStep, ...]
