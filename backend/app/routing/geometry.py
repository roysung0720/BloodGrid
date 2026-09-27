"""Provider-neutral geometry for comparing drawn routes. Coordinates are (longitude, latitude)."""

from __future__ import annotations

import math
from collections.abc import Sequence

EARTH_RADIUS_METERS = 6_371_000

LngLat = tuple[float, float]


def distance_meters(a: LngLat, b: LngLat) -> float:
    phi_a, phi_b = math.radians(a[1]), math.radians(b[1])
    delta_phi = phi_b - phi_a
    delta_lambda = math.radians(b[0] - a[0])
    h = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi_a) * math.cos(phi_b) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METERS * math.asin(min(1.0, math.sqrt(h)))


def bearing_degrees(a: LngLat, b: LngLat) -> float:
    phi_a, phi_b = math.radians(a[1]), math.radians(b[1])
    delta_lambda = math.radians(b[0] - a[0])
    y = math.sin(delta_lambda) * math.cos(phi_b)
    x = math.cos(phi_a) * math.sin(phi_b) - math.sin(phi_a) * math.cos(phi_b) * math.cos(delta_lambda)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def offset_point(origin: LngLat, bearing: float, meters: float) -> LngLat:
    """The point `meters` away from `origin` in direction `bearing` (degrees)."""

    angular = meters / EARTH_RADIUS_METERS
    theta = math.radians(bearing)
    phi = math.radians(origin[1])
    lam = math.radians(origin[0])
    phi2 = math.asin(
        math.sin(phi) * math.cos(angular) + math.cos(phi) * math.sin(angular) * math.cos(theta)
    )
    lam2 = lam + math.atan2(
        math.sin(theta) * math.sin(angular) * math.cos(phi),
        math.cos(angular) - math.sin(phi) * math.sin(phi2),
    )
    return (math.degrees(lam2), math.degrees(phi2))


def point_along(geometry: Sequence[LngLat], fraction: float) -> LngLat:
    lengths = [distance_meters(a, b) for a, b in zip(geometry, geometry[1:])]
    target = max(0.0, min(1.0, fraction)) * sum(lengths)
    for (a, b), length in zip(zip(geometry, geometry[1:]), lengths):
        if target <= length and length > 0:
            t = target / length
            return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        target -= length
    return geometry[-1]


def distance_to_route(point: LngLat, geometry: Sequence[LngLat]) -> float:
    """Shortest distance from a point to a polyline (flat projection per segment)."""

    cos_lat = math.cos(math.radians(point[1]))
    best = math.inf
    for a, b in zip(geometry, geometry[1:]):
        ax, bx, px = a[0] * cos_lat, b[0] * cos_lat, point[0] * cos_lat
        dx, dy = bx - ax, b[1] - a[1]
        length_squared = dx * dx + dy * dy or 1e-12
        t = max(0.0, min(1.0, ((px - ax) * dx + (point[1] - a[1]) * dy) / length_squared))
        projected = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        best = min(best, distance_meters(point, projected))
    return best


def routes_differ(
    candidate: Sequence[LngLat], existing: Sequence[LngLat], threshold_meters: float
) -> bool:
    """True when the candidate strays from the existing route somewhere along its length."""

    return any(
        distance_to_route(point_along(candidate, fraction), existing) > threshold_meters
        for fraction in (0.25, 0.5, 0.75)
    )
