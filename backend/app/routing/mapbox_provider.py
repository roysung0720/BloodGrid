from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .models import RouteEstimate, RoutingLocation


class RoutingError(RuntimeError):
    """Raised when a routing provider cannot return a usable result."""


class MapboxMatrixProvider:
    """Mapbox Matrix adapter for batch road-time and distance lookups."""

    provider_name = "mapbox"
    max_coordinates_per_request = 25

    def __init__(self, access_token: str, profile: str, timeout_seconds: float) -> None:
        if not access_token:
            raise RoutingError(
                "Mapbox routing is not configured. Add MAPBOX_ACCESS_TOKEN to the root .env file."
            )
        self._access_token = access_token
        self.profile = profile
        self._timeout_seconds = timeout_seconds
        self._max_coordinates_per_request = (
            10 if profile == "mapbox/driving-traffic" else self.max_coordinates_per_request
        )
        self._cache: dict[tuple[str, str], RouteEstimate | None] = {}

    def get_travel_matrix(
        self,
        origins: Sequence[RoutingLocation],
        destinations: Sequence[RoutingLocation],
    ) -> dict[tuple[str, str], RouteEstimate | None]:
        if not origins or not destinations:
            return {}

        missing_pairs = [
            (origin, destination)
            for origin in origins
            for destination in destinations
            if (origin.location_id, destination.location_id) not in self._cache
        ]
        if missing_pairs:
            self._fetch_missing_pairs(
                origins, _matrix_destinations(origins, destinations)
            )

        return {
            (origin.location_id, destination.location_id): self._cache[
                (origin.location_id, destination.location_id)
            ]
            for origin in origins
            for destination in destinations
        }

    def _fetch_missing_pairs(
        self,
        origins: Sequence[RoutingLocation],
        destinations: Sequence[RoutingLocation],
    ) -> None:
        max_destinations = self._max_coordinates_per_request - len(origins)
        if max_destinations < 1:
            raise RoutingError(
                "Too many route origins for one Mapbox matrix request."
            )

        for start_index in range(0, len(destinations), max_destinations):
            destination_chunk = destinations[start_index : start_index + max_destinations]
            self._fetch_chunk(origins, destination_chunk)

    def _fetch_chunk(
        self,
        origins: Sequence[RoutingLocation],
        destinations: Sequence[RoutingLocation],
    ) -> None:
        locations = [*origins, *destinations]
        coordinates = ";".join(
            f"{location.longitude},{location.latitude}" for location in locations
        )
        source_indices = ";".join(str(index) for index in range(len(origins)))
        destination_indices = ";".join(
            str(index) for index in range(len(origins), len(locations))
        )
        query = urlencode(
            {
                "access_token": self._access_token,
                "annotations": "duration,distance",
                "sources": source_indices,
                "destinations": destination_indices,
            }
        )
        url = (
            "https://api.mapbox.com/directions-matrix/v1/"
            f"{self.profile}/{coordinates}?{query}"
        )

        try:
            request = Request(url, headers={"User-Agent": "BloodGrid-HackGT/0.1"})
            with urlopen(request, timeout=self._timeout_seconds) as response:  # noqa: S310
                payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            detail = _http_error_detail(error)
            raise RoutingError(
                f"Mapbox routing request failed with HTTP {error.code}: {detail}"
            ) from error
        except URLError as error:
            raise RoutingError("Mapbox routing request could not reach the provider.") from error
        except (TimeoutError, json.JSONDecodeError) as error:
            raise RoutingError("Mapbox routing returned an unreadable response.") from error

        self._store_chunk_results(origins, destinations, payload)

    def _store_chunk_results(
        self,
        origins: Sequence[RoutingLocation],
        destinations: Sequence[RoutingLocation],
        payload: dict[str, Any],
    ) -> None:
        response_code = payload.get("code")
        if response_code == "NoRoute":
            for origin in origins:
                for destination in destinations:
                    self._cache[(origin.location_id, destination.location_id)] = None
            return
        if response_code != "Ok":
            message = payload.get("message", "Unknown Mapbox routing error")
            raise RoutingError(f"Mapbox routing returned {response_code}: {message}")

        durations = payload.get("durations")
        distances = payload.get("distances")
        if not isinstance(durations, list) or not isinstance(distances, list):
            raise RoutingError("Mapbox routing response did not include duration and distance matrices.")

        for origin_index, origin in enumerate(origins):
            duration_row = durations[origin_index] if origin_index < len(durations) else []
            distance_row = distances[origin_index] if origin_index < len(distances) else []
            for destination_index, destination in enumerate(destinations):
                duration = (
                    duration_row[destination_index]
                    if destination_index < len(duration_row)
                    else None
                )
                distance = (
                    distance_row[destination_index]
                    if destination_index < len(distance_row)
                    else None
                )
                key = (origin.location_id, destination.location_id)
                if duration is None or distance is None:
                    self._cache[key] = None
                    continue
                self._cache[key] = RouteEstimate(
                    origin_id=origin.location_id,
                    destination_id=destination.location_id,
                    duration_seconds=float(duration),
                    distance_meters=float(distance),
                )


def _http_error_detail(error: HTTPError) -> str:
    """Return a concise provider detail without including request credentials."""

    try:
        payload = json.loads(error.read().decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return "Unknown provider error"
    return str(payload.get("message") or payload.get("code") or "Unknown provider error")


def _matrix_destinations(
    origins: Sequence[RoutingLocation], destinations: Sequence[RoutingLocation]
) -> Sequence[RoutingLocation]:
    """Pad a single-pair request for Mapbox's two-element Matrix API minimum."""

    if len(origins) != 1 or len(destinations) != 1:
        return destinations

    destination = destinations[0]
    return [
        destination,
        RoutingLocation(
            location_id=f"__matrix_padding__{destination.location_id}",
            latitude=destination.latitude,
            longitude=destination.longitude,
        ),
    ]
