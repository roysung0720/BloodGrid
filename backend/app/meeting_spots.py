"""Public meeting-spot catalog (parking lots, gas stations, and similar places).

Built by scripts/build_meeting_spots.mjs from OpenStreetMap and stored in
data/meeting_spots/<region>.csv. The catalog is shared across scenarios and selected by
map area, so versioned scenario files stay unchanged.
OpenStreetMap data is (c) OpenStreetMap contributors, under the ODbL.
"""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, ValidationError

from .config import MEETING_SPOTS_DIR
from .models import BoundingBox, RendezvousPoint

MeetingSpotCategory = Literal[
    "KNOWN_SITE",
    "PARKING",
    "FUEL_STATION",
    "FIRE_STATION",
    "PLACE_OF_WORSHIP",
    "SCHOOL",
    "ROADSIDE",
]
MeetingSpotSource = Literal["SCENARIO", "OPENSTREETMAP", "ROUTE"]

# When two spots give the same timing, prefer the more suitable kind of place.
CATEGORY_PREFERENCE: dict[str, int] = {
    "KNOWN_SITE": 0,
    "PARKING": 1,
    "FUEL_STATION": 2,
    "FIRE_STATION": 3,
    "PLACE_OF_WORSHIP": 4,
    "SCHOOL": 5,
    "ROADSIDE": 6,
}
CATALOG_BUFFER_DEGREES = 0.15
CATALOG_SOURCE_NOTE = "OpenStreetMap contributors (ODbL) and scenario known sites"


class MeetingSpotCatalogError(ValueError):
    """Raised when a catalog file is malformed."""


class MeetingSpot(BaseModel):
    spot_id: str
    name: str
    category: MeetingSpotCategory
    latitude: float
    longitude: float
    area_m2: Optional[float] = Field(default=None, ge=0)
    source: MeetingSpotSource = "OPENSTREETMAP"


@lru_cache
def _catalog(directory: Path = MEETING_SPOTS_DIR) -> tuple[MeetingSpot, ...]:
    spots: list[MeetingSpot] = []
    if not directory.is_dir():
        return ()
    for path in sorted(directory.glob("*.csv")):
        with path.open(encoding="utf-8", newline="") as csv_file:
            for row_number, row in enumerate(csv.DictReader(csv_file), start=2):
                try:
                    spots.append(
                        MeetingSpot(
                            spot_id=row["spot_id"],
                            name=row["name"],
                            category=row["category"],
                            latitude=float(row["latitude"]),
                            longitude=float(row["longitude"]),
                            area_m2=float(row["area_m2"]) if row.get("area_m2") else None,
                        )
                    )
                except (KeyError, ValueError, ValidationError) as error:
                    raise MeetingSpotCatalogError(
                        f"Invalid row {row_number} in {path.name}: {error}"
                    ) from error
    return tuple(spots)


def catalog_spots(bounds: BoundingBox, directory: Path = MEETING_SPOTS_DIR) -> list[MeetingSpot]:
    """Catalog spots inside the scenario's area plus a buffer."""

    return [
        spot
        for spot in _catalog(directory)
        if bounds.min_latitude - CATALOG_BUFFER_DEGREES <= spot.latitude <= bounds.max_latitude + CATALOG_BUFFER_DEGREES
        and bounds.min_longitude - CATALOG_BUFFER_DEGREES <= spot.longitude <= bounds.max_longitude + CATALOG_BUFFER_DEGREES
    ]


def known_site_spots(points: list[RendezvousPoint]) -> list[MeetingSpot]:
    """The scenario's own named sites, kept as preferred meeting spots when active."""

    return [
        MeetingSpot(
            spot_id=point.rendezvous_id,
            name=point.name,
            category="KNOWN_SITE",
            latitude=point.latitude,
            longitude=point.longitude,
            source="SCENARIO",
        )
        for point in points
        if point.active
    ]
