from __future__ import annotations

import unittest

from app.routing.mapbox_provider import MapboxMatrixProvider, _matrix_destinations
from app.routing.models import RoutingLocation


class MapboxMatrixProviderTests(unittest.TestCase):
    def test_matrix_payload_becomes_route_estimates(self) -> None:
        provider = MapboxMatrixProvider(
            access_token="test-token",
            profile="mapbox/driving",
            timeout_seconds=1,
        )
        origin = RoutingLocation("BR-01", 34.1, -83.8)
        destination = RoutingLocation("INC-01", 34.2, -83.7)

        provider._store_chunk_results(
            [origin],
            [destination],
            {"code": "Ok", "durations": [[615]], "distances": [[12800]]},
        )
        results = provider.get_travel_matrix([origin], [destination])

        estimate = results[("BR-01", "INC-01")]
        self.assertIsNotNone(estimate)
        assert estimate is not None
        self.assertEqual(estimate.duration_seconds, 615)
        self.assertEqual(estimate.distance_meters, 12800)

    def test_no_route_marks_each_pair_unroutable(self) -> None:
        provider = MapboxMatrixProvider(
            access_token="test-token",
            profile="mapbox/driving",
            timeout_seconds=1,
        )
        origin = RoutingLocation("BR-01", 34.1, -83.8)
        destination = RoutingLocation("INC-01", 34.2, -83.7)

        provider._store_chunk_results(
            [origin], [destination], {"code": "NoRoute"}
        )
        results = provider.get_travel_matrix([origin], [destination])

        self.assertIsNone(results[("BR-01", "INC-01")])

    def test_single_pair_request_is_padded_for_mapbox(self) -> None:
        origin = RoutingLocation("BR-01", 34.1, -83.8)
        destination = RoutingLocation("INC-01", 34.2, -83.7)

        matrix_destinations = _matrix_destinations([origin], [destination])

        self.assertEqual(len(matrix_destinations), 2)
        self.assertEqual(matrix_destinations[0], destination)
        self.assertEqual(matrix_destinations[1].latitude, destination.latitude)
        self.assertEqual(matrix_destinations[1].longitude, destination.longitude)
