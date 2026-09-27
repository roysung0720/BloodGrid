import type { CoverageView } from "../lib/types";

const BASE_LEGEND_ITEMS = [
  ["station", "Station"],
  ["unit-available", "Available unit"],
  ["unit-on-call", "On-call unit"],
  ["hospital", "Hospital"],
  ["incident-covered", "Covered demand"],
  ["incident-uncovered", "Uncovered demand"],
  ["rendezvous", "Approved rendezvous"],
  ["live-incident", "Blood requested"],
] as const;

type ScenarioLegendProps = {
  coverageView: CoverageView;
};

export function ScenarioLegend({ coverageView }: ScenarioLegendProps) {
  const legendItems =
    coverageView === "strategic"
      ? ([
          ["station", "Station"],
          ["station-recommended", "Recommended staging"],
          ...BASE_LEGEND_ITEMS.slice(1),
        ] as const)
      : BASE_LEGEND_ITEMS;

  return (
    <section className="scenario-legend" aria-label="Map legend">
      <p>Scenario markers</p>
      <div className="scenario-legend__grid">
        {legendItems.map(([kind, label]) => (
          <div key={kind}>
            <span className={`legend-symbol legend-symbol--${kind}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
