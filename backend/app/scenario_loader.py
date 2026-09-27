from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from .config import DATA_SCENARIOS_DIR, SCENARIO_ID
from .models import (
    AvailabilityProfile,
    BloodUnit,
    HistoricalIncident,
    Hospital,
    LiveIncident,
    RendezvousPoint,
    ResponseUnit,
    ScenarioData,
    ScenarioCatalogEntry,
    ScenarioMetadata,
    Station,
)


ModelT = TypeVar("ModelT", bound=BaseModel)


class ScenarioLoadError(ValueError):
    """Raised when a scenario is missing or fails basic data validation."""


def _read_csv(path: Path, model: type[ModelT]) -> list[ModelT]:
    if not path.is_file():
        raise ScenarioLoadError(f"Missing scenario file: {path.name}")

    with path.open(encoding="utf-8", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if reader.fieldnames is None:
            raise ScenarioLoadError(f"Missing header row: {path.name}")

        records: list[ModelT] = []
        for row_number, row in enumerate(reader, start=2):
            try:
                records.append(model.model_validate(row))
            except ValidationError as error:
                raise ScenarioLoadError(
                    f"Invalid row {row_number} in {path.name}: {error.errors()[0]['msg']}"
                ) from error

    if not records:
        raise ScenarioLoadError(f"Scenario file has no data rows: {path.name}")
    return records


def _read_availability_profiles(path: Path) -> list[AvailabilityProfile]:
    if not path.is_file():
        raise ScenarioLoadError(f"Missing scenario file: {path.name}")
    try:
        payload = json.loads(path.read_text())
    except json.JSONDecodeError as error:
        raise ScenarioLoadError(f"Invalid JSON in {path.name}") from error

    profiles = payload.get("profiles")
    if not isinstance(profiles, list) or not profiles:
        raise ScenarioLoadError(f"{path.name} must contain a non-empty profiles list")
    try:
        return [AvailabilityProfile.model_validate(profile) for profile in profiles]
    except ValidationError as error:
        raise ScenarioLoadError(
            f"Invalid availability profile in {path.name}: {error.errors()[0]['msg']}"
        ) from error


def _validate_relationships(data: ScenarioData) -> None:
    station_ids = {station.station_id for station in data.stations}
    unit_ids = {unit.unit_id for unit in data.response_units}
    active_hospital_ids = {
        hospital.hospital_id for hospital in data.hospitals if hospital.active
    }
    profile_ids = {profile.profile_id for profile in data.availability_profiles}
    if len(profile_ids) != len(data.availability_profiles):
        raise ScenarioLoadError("Availability profile IDs must be unique")
    if "baseline" not in profile_ids:
        raise ScenarioLoadError("Availability profiles must include baseline")

    for unit in data.response_units:
        if unit.home_station_id not in station_ids:
            raise ScenarioLoadError(
                f"{unit.unit_id} references unknown station {unit.home_station_id}"
            )

    for blood_unit in data.blood_units:
        if (
            blood_unit.current_location_type == "RESPONSE_UNIT"
            and blood_unit.current_location_id not in unit_ids
        ):
            raise ScenarioLoadError(
                f"{blood_unit.blood_unit_id} references unknown response unit "
                f"{blood_unit.current_location_id}"
            )

    for unit in data.response_units:
        valid_onboard_count = sum(
            blood_unit.current_location_id == unit.unit_id
            and blood_unit.availability_status == "ONBOARD"
            and blood_unit.temperature_status == "VALID"
            for blood_unit in data.blood_units
        )
        if valid_onboard_count != unit.blood_units_onboard:
            raise ScenarioLoadError(
                f"{unit.unit_id} reports {unit.blood_units_onboard} onboard blood units, "
                f"but has {valid_onboard_count} valid onboard records"
            )

    for incident in data.live_incidents:
        if incident.destination_hospital_id not in active_hospital_ids:
            raise ScenarioLoadError(
                f"{incident.incident_id} references an inactive or unknown destination"
            )

    for profile in data.availability_profiles:
        for override in profile.resource_overrides:
            if override.unit_id not in unit_ids:
                raise ScenarioLoadError(
                    f"{profile.profile_id} references unknown response unit {override.unit_id}"
                )


def load_scenario(scenario_id: str = SCENARIO_ID) -> ScenarioData:
    scenario_dir = DATA_SCENARIOS_DIR / scenario_id
    if not scenario_dir.is_dir():
        raise ScenarioLoadError(f"Scenario not found: {scenario_id}")

    metadata_path = scenario_dir / "scenario.json"
    if not metadata_path.is_file():
        raise ScenarioLoadError(f"Missing scenario metadata: {scenario_id}/scenario.json")

    try:
        metadata = ScenarioMetadata.model_validate_json(metadata_path.read_text())
    except ValidationError as error:
        raise ScenarioLoadError(
            f"Invalid scenario metadata: {error.errors()[0]['msg']}"
        ) from error

    if metadata.scenario_id != scenario_id:
        raise ScenarioLoadError(
            f"Scenario folder {scenario_id} does not match metadata ID {metadata.scenario_id}"
        )

    data = ScenarioData(
        metadata=metadata,
        stations=_read_csv(scenario_dir / "stations.csv", Station),
        response_units=_read_csv(scenario_dir / "response_units.csv", ResponseUnit),
        blood_units=_read_csv(scenario_dir / "blood_units.csv", BloodUnit),
        hospitals=_read_csv(scenario_dir / "hospitals.csv", Hospital),
        historical_incidents=_read_csv(
            scenario_dir / "historical_incidents.csv", HistoricalIncident
        ),
        rendezvous_points=_read_csv(
            scenario_dir / "rendezvous_points.csv", RendezvousPoint
        ),
        live_incidents=_read_csv(scenario_dir / "live_incidents.csv", LiveIncident),
        availability_profiles=_read_availability_profiles(
            scenario_dir / "availability_profiles.json"
        ),
    )
    _validate_relationships(data)
    return data


def list_scenarios() -> list[ScenarioCatalogEntry]:
    """List validated metadata for the versioned scenarios the API can load."""

    entries: list[ScenarioCatalogEntry] = []
    for scenario_dir in sorted(DATA_SCENARIOS_DIR.iterdir()):
        if not scenario_dir.is_dir():
            continue

        metadata_path = scenario_dir / "scenario.json"
        if not metadata_path.is_file():
            continue
        try:
            metadata = ScenarioMetadata.model_validate_json(metadata_path.read_text())
        except ValidationError as error:
            raise ScenarioLoadError(
                f"Invalid scenario metadata: {scenario_dir.name}/scenario.json"
            ) from error

        if metadata.scenario_id != scenario_dir.name:
            raise ScenarioLoadError(
                f"Scenario folder {scenario_dir.name} does not match metadata ID "
                f"{metadata.scenario_id}"
            )
        entries.append(
            ScenarioCatalogEntry(
                metadata=metadata,
                is_default=metadata.scenario_id == SCENARIO_ID,
            )
        )

    if not entries:
        raise ScenarioLoadError("No scenarios were found")
    return sorted(
        entries,
        key=lambda entry: (
            not entry.is_default,
            entry.metadata.name,
        ),
    )
