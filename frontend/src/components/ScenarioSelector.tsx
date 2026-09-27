import { Database } from "lucide-react";

import type { ScenarioCatalogEntry } from "../lib/types";

type ScenarioSelectorProps = {
  scenarios: ScenarioCatalogEntry[];
  selectedScenarioId: string | null;
  onChange: (scenarioId: string) => void;
};

function classificationLabel(classification: string) {
  return classification === "SYNTHETIC"
    ? "Synthetic operations"
    : "Public geography + synthetic operations";
}

export function ScenarioSelector({
  scenarios,
  selectedScenarioId,
  onChange,
}: ScenarioSelectorProps) {
  const selectedScenario = scenarios.find(
    (scenario) => scenario.metadata.scenario_id === selectedScenarioId,
  );
  const classification = selectedScenario?.metadata.classification ?? "SYNTHETIC";

  return (
    <div className="scenario-selector">
      <label className="scenario-select" htmlFor="scenario-selector">
        <span>Demo data set</span>
        <select
          id="scenario-selector"
          onChange={(event) => onChange(event.target.value)}
          value={selectedScenarioId ?? ""}
        >
          {scenarios.map((scenario) => (
            <option
              key={scenario.metadata.scenario_id}
              value={scenario.metadata.scenario_id}
            >
              {scenario.metadata.name}
            </option>
          ))}
        </select>
      </label>
      <span
        className={`scenario-pill ${classification === "SYNTHETIC" ? "" : "scenario-pill--hybrid"}`}
      >
        <Database size={14} aria-hidden="true" />
        {classificationLabel(classification)}
      </span>
    </div>
  );
}
