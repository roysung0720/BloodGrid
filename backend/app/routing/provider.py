from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from .models import Route, RouteEstimate, RoutingLocation


class RoutingProvider(Protocol):
    """Supplies road travel estimates without exposing a specific vendor."""

    provider_name: str
    profile: str

    def get_travel_matrix(
        self,
        origins: Sequence[RoutingLocation],
        destinations: Sequence[RoutingLocation],
    ) -> dict[tuple[str, str], RouteEstimate | None]:
        """Return an estimate for each origin-destination pair when routable."""

    def get_route(
        self, origin: RoutingLocation, destination: RoutingLocation
    ) -> Route | None:
        """Return drawable geometry and turn steps, or None when there is no road route."""

    def get_route_options(
        self, origin: RoutingLocation, destination: RoutingLocation
    ) -> list[Route]:
        """Return the fastest route first, then any alternative roads (may be empty)."""

    def get_route_via(
        self, origin: RoutingLocation, via: RoutingLocation, destination: RoutingLocation
    ) -> Route | None:
        """Return a route that passes through a silent via point, or None if unroutable."""
