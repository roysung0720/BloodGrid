import { Ambulance, Clock3, Droplets } from "lucide-react";

import type { FeatureSelection, ScenarioData } from "../lib/types";

type ResourcePanelProps = {
  scenario: ScenarioData;
  onSelect: (selection: FeatureSelection) => void;
};

export function ResourcePanel({ scenario, onSelect }: ResourcePanelProps) {
  return (
    <section className="rail-section resource-section">
      <div className="section-heading">
        <Ambulance size={17} aria-hidden="true" />
        <h2>Blood Response Units</h2>
      </div>
      <div className="resource-list">
        {scenario.response_units.map((unit) => {
          const isOnCall = unit.crew_status === "ON_CALL";
          return (
            <button
              className="resource-row"
              key={unit.unit_id}
              onClick={() => onSelect({ type: "unit", id: unit.unit_id })}
              type="button"
            >
              <span
                className={`status-dot ${isOnCall ? "status-dot--on-call" : ""}`}
              />
              <span className="resource-row__content">
                <strong>{unit.unit_id}</strong>
                <span>
                  {isOnCall
                    ? `On call · ${unit.mobilization_minutes} min mobilization`
                    : "Staffed and available"}
                </span>
              </span>
              <span className="resource-row__inventory">
                <Droplets size={14} aria-hidden="true" />
                {unit.blood_units_onboard}
              </span>
            </button>
          );
        })}
      </div>
      <div className="panel-note">
        <Clock3 size={14} aria-hidden="true" />
        <span>On-call mobilization is shown now and used later in routing.</span>
      </div>
    </section>
  );
}
