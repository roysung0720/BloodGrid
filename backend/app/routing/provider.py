from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from .models import RouteEstimate, RoutingLocation


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
