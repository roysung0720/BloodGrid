from __future__ import annotations

from collections.abc import Sequence

from .models import Route, RouteEstimate, RoutingLocation
from .provider import RoutingProvider


class CoordinateKeyedProvider:
    """Wraps a RoutingProvider so cached results are keyed by coordinates, not labels.

    Providers cache matrix results by location ID. Callers that reuse a generic ID for
    different places (for example "destination" for whichever hospital was supplied)
    could otherwise receive another place's cached travel time.
    """

    def __init__(self, inner: RoutingProvider) -> None:
        self._inner = inner
        self.provider_name = inner.provider_name
        self.profile = inner.profile

    def get_travel_matrix(
        self,
        origins: Sequence[RoutingLocation],
        destinations: Sequence[RoutingLocation],
    ) -> dict[tuple[str, str], RouteEstimate | None]:
        keyed_origins = [_keyed(location) for location in origins]
        keyed_destinations = [_keyed(location) for location in destinations]
        results = self._inner.get_travel_matrix(keyed_origins, keyed_destinations)
        return {
            (origin.location_id, destination.location_id): results.get(
                (keyed_origin.location_id, keyed_destination.location_id)
            )
            for origin, keyed_origin in zip(origins, keyed_origins)
            for destination, keyed_destination in zip(destinations, keyed_destinations)
        }

    def get_route(
        self, origin: RoutingLocation, destination: RoutingLocation
    ) -> Route | None:
        return self._inner.get_route(origin, destination)

    def get_route_options(
        self, origin: RoutingLocation, destination: RoutingLocation
    ) -> list[Route]:
        return self._inner.get_route_options(origin, destination)

    def get_route_via(
        self, origin: RoutingLocation, via: RoutingLocation, destination: RoutingLocation
    ) -> Route | None:
        return self._inner.get_route_via(origin, via, destination)


def _keyed(location: RoutingLocation) -> RoutingLocation:
    return RoutingLocation(
        location_id=f"{location.location_id}@{location.latitude:.5f},{location.longitude:.5f}",
        latitude=location.latitude,
        longitude=location.longitude,
    )
