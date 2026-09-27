import { Crosshair, MapPin, ShieldCheck } from "lucide-react";

import type {
  BaselineCoverageResult,
  CoverageView,
  FeatureSelection,
  ScenarioData,
  StrategicDeploymentResult,
} from "../lib/types";

type FeatureDetailsProps = {
  scenario: ScenarioData;
  coverage: BaselineCoverageResult | null;
  deployment: StrategicDeploymentResult | null;
  coverageView: CoverageView;
  selection: FeatureSelection | null;
};

type Detail = {
  title: string;
  subtitle: string;
  entries: Array<[string, string]>;
};

function findDetails(
  scenario: ScenarioData,
  coverage: BaselineCoverageResult | null,
  deployment: StrategicDeploymentResult | null,
  coverageView: CoverageView,
  selection: FeatureSelection,
): Detail | null {
  if (selection.type === "station") {
    const station = scenario.stations.find((item) => item.station_id === selection.id);
    const assignedUnits = deployment?.assignments
      .filter((assignment) => assignment.station_id === selection.id)
      .map((assignment) => assignment.unit_id);
    const recommendationEntries: Array<[string, string]> =
      coverageView === "strategic" && assignedUnits?.length
        ? [["Recommendation", assignedUnits.join(", ")]]
        : [];
    return station
      ? {
          title: station.name,
          subtitle: station.station_id,
          entries: [
            ["Type", station.station_type.replace("_", " ")],
            ["Capacity", `${station.capacity} unit`],
            ["Status", station.active ? "Active" : "Inactive"],
            ...recommendationEntries,
          ],
        }
      : null;
  }

  if (selection.type === "unit") {
    const unit = scenario.response_units.find((item) => item.unit_id === selection.id);
    return unit
      ? {
          title: unit.unit_id,
          subtitle: "Blood Response Unit",
          entries: [
            ["Vehicle", unit.vehicle_status.replace("_", " ")],
            ["Crew", unit.crew_status.replace("_", " ")],
            ["Blood onboard", `${unit.blood_units_onboard} valid units`],
            ["Mobilization", `${unit.mobilization_minutes} minutes`],
          ],
        }
      : null;
  }

  if (selection.type === "hospital") {
    const hospital = scenario.hospitals.find((item) => item.hospital_id === selection.id);
    return hospital
      ? {
          title: hospital.name,
          subtitle: hospital.hospital_id,
          entries: [
            ["Trauma level", hospital.trauma_level.replace("_", " ")],
            ["Status", hospital.active ? "Active" : "Inactive"],
          ],
        }
      : null;
  }

  if (selection.type === "incident") {
    const incident = scenario.historical_incidents.find(
      (item) => item.incident_id === selection.id,
    );
    const coveragePoints =
      coverageView === "strategic" && deployment
        ? deployment.demand_points
        : coverage?.demand_points;
    const coveragePoint = coveragePoints?.find(
      (item) => item.incident_id === selection.id,
    );
    const stagedStationId =
      coverageView === "strategic"
        ? deployment?.demand_points.find((item) => item.incident_id === selection.id)
            ?.staged_station_id
        : null;
    const stagedStationEntries: Array<[string, string]> =
      stagedStationId
        ? [["Staged at", stagedStationId]]
        : [];
    const coverageEntries: Array<[string, string]> = coveragePoint
      ? [
          ["Coverage", coveragePoint.covered ? "Covered" : "Not covered"],
          ["View", coverageView === "strategic" ? "Recommended staging" : "Current staging"],
          ["Fastest resource", coveragePoint.best_resource_id ?? "None"],
          ...stagedStationEntries,
          [
            "Response estimate",
            coveragePoint.total_response_minutes === null
              ? "No road route"
              : `${coveragePoint.total_response_minutes} min`,
          ],
          [
            "Drive time",
            coveragePoint.driving_minutes === null
              ? "Not available"
              : `${coveragePoint.driving_minutes} min`,
          ],
          [
            "Mobilization",
            coveragePoint.mobilization_minutes === null
              ? "Not available"
              : `${coveragePoint.mobilization_minutes} min`,
          ],
        ]
      : [];
    return incident
      ? {
          title: incident.incident_type.replace("_", " "),
          subtitle: incident.incident_id,
          entries: [
            ["Severity proxy", incident.severity_proxy],
            ["Source", incident.source.replaceAll("_", " ")],
            ["Recorded", incident.timestamp.slice(0, 10)],
            ...coverageEntries,
          ],
        }
      : null;
  }

  if (selection.type === "rendezvous") {
    const point = scenario.rendezvous_points.find(
      (item) => item.rendezvous_id === selection.id,
    );
    return point
      ? {
          title: point.name,
          subtitle: point.rendezvous_id,
          entries: [
            ["Type", point.location_type.replaceAll("_", " ")],
            ["Approval", point.approved ? "Approved" : "Not approved"],
            ["Status", point.active ? "Active" : "Inactive"],
          ],
        }
      : null;
  }

  const liveIncident = scenario.live_incidents.find(
    (item) => item.incident_id === selection.id,
  );
  return liveIncident
    ? {
        title: "Blood request",
        subtitle: liveIncident.incident_id,
        entries: [
          ["Transport unit", liveIncident.patient_unit_id],
          ["Destination", liveIncident.destination_hospital_id],
          ["Status", liveIncident.status],
        ],
      }
    : null;
}

export function FeatureDetails({
  scenario,
  coverage,
  deployment,
  coverageView,
  selection,
}: FeatureDetailsProps) {
  const detail = selection
    ? findDetails(scenario, coverage, deployment, coverageView, selection)
    : null;

  return (
    <section className="rail-section feature-section">
      <div className="section-heading">
        <Crosshair size={17} aria-hidden="true" />
        <h2>Selected location</h2>
      </div>
      {detail ? (
        <div className="feature-detail">
          <div>
            <strong>{detail.title}</strong>
            <span>{detail.subtitle}</span>
          </div>
          <dl>
            {detail.entries.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div className="empty-selection">
          <MapPin size={18} aria-hidden="true" />
          <span>Select a map marker or response unit to inspect it.</span>
          <ShieldCheck size={18} aria-hidden="true" />
        </div>
      )}
    </section>
  );
}
