import { AlertTriangle, Building2, Radio } from "lucide-react";

import type { FeatureSelection, ScenarioData } from "../lib/types";

type IncidentPanelProps = {
  scenario: ScenarioData;
  selectedIncidentId: string | null;
  onChange: (incidentId: string) => void;
  onSelect: (selection: FeatureSelection) => void;
};

export function IncidentPanel({
  scenario,
  selectedIncidentId,
  onChange,
  onSelect,
}: IncidentPanelProps) {
  const incident = scenario.live_incidents.find(
    (item) => item.incident_id === selectedIncidentId,
  ) ?? scenario.live_incidents.find(
    (item) => item.incident_id === scenario.metadata.default_live_incident_id,
  );
  const destination = scenario.hospitals.find(
    (hospital) => hospital.hospital_id === incident?.destination_hospital_id,
  );

  if (!incident) {
    return null;
  }

  return (
    <section className="rail-section incident-section">
      <div className="section-heading section-heading--alert">
        <AlertTriangle size={17} aria-hidden="true" />
        <h2>Simulated incident</h2>
      </div>
      <label className="incident-select" htmlFor="live-incident">
        <span>Demo case</span>
        <select
          id="live-incident"
          onChange={(event) => onChange(event.target.value)}
          value={incident.incident_id}
        >
          {scenario.live_incidents.map((item) => (
            <option key={item.incident_id} value={item.incident_id}>
              {item.incident_id} - {item.patient_unit_id}
            </option>
          ))}
        </select>
      </label>
      <button
        className="incident-summary"
        onClick={() => onSelect({ type: "liveIncident", id: incident.incident_id })}
        type="button"
      >
        <span className="incident-summary__status">
          <Radio size={14} aria-hidden="true" />
          Blood requested
        </span>
        <strong>{incident.patient_unit_id}</strong>
        <span className="incident-summary__destination">
          <Building2 size={14} aria-hidden="true" />
          {destination?.name ?? incident.destination_hospital_id}
        </span>
      </button>
      <p className="panel-note panel-note--plain">
        This synthetic request keeps its supplied destination. BloodGrid evaluates
        logistics only and does not select a hospital.
      </p>
    </section>
  );
}
