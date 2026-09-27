from __future__ import annotations

from ..models import AvailabilityProfile, ScenarioData


class AvailabilityProfileError(ValueError):
    """Raised when a requested synthetic operating state is unavailable."""


def apply_availability_profile(
    scenario: ScenarioData, profile_id: str = "baseline"
) -> ScenarioData:
    """Apply a named synthetic operating state without mutating scenario source data."""

    profile = get_availability_profile(scenario, profile_id)
    overrides_by_unit = {
        override.unit_id: override for override in profile.resource_overrides
    }
    response_units = []
    for unit in scenario.response_units:
        override = overrides_by_unit.get(unit.unit_id)
        if override is None:
            response_units.append(unit)
            continue
        updates = {
            field: getattr(override, field)
            for field in (
                "vehicle_status",
                "crew_status",
                "blood_credentialed",
                "mobilization_minutes",
                "blood_units_onboard",
            )
            if getattr(override, field) is not None
        }
        response_units.append(unit.model_copy(update=updates))

    blood_units = []
    for blood_unit in scenario.blood_units:
        override = overrides_by_unit.get(blood_unit.current_location_id)
        if (
            blood_unit.current_location_type != "RESPONSE_UNIT"
            or override is None
        ):
            blood_units.append(blood_unit)
            continue
        updates = {
            field: getattr(override, field)
            for field in ("blood_availability_status", "blood_temperature_status")
            if getattr(override, field) is not None
        }
        translated_updates = {
            field.removeprefix("blood_"): value for field, value in updates.items()
        }
        blood_units.append(blood_unit.model_copy(update=translated_updates))

    return scenario.model_copy(
        update={
            "response_units": response_units,
            "blood_units": blood_units,
            "active_availability_profile_id": profile.profile_id,
        }
    )


def get_availability_profile(
    scenario: ScenarioData, profile_id: str
) -> AvailabilityProfile:
    profile = next(
        (item for item in scenario.availability_profiles if item.profile_id == profile_id),
        None,
    )
    if profile is None:
        raise AvailabilityProfileError(
            f"Synthetic operating state {profile_id!r} was not found."
        )
    return profile
