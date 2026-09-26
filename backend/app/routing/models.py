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
