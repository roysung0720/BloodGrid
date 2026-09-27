import type { CoverageView } from "../lib/types";

type LegendItem = [string, string];

const BASE_LEGEND_ITEMS: LegendItem[] = [
  ["station", "Station"],
  ["unit-available", "Available unit"],
  ["unit-on-call", "On-call unit"],
  ["unit-unavailable", "Unavailable unit"],
  ["hospital", "Hospital"],
  ["incident-covered", "Covered demand"],
  ["incident-uncovered", "Uncovered demand"],
  ["rendezvous", "Known meeting site"],
  ["live-incident", "Blood requested"],
];

type ScenarioLegendProps = {
  coverageView: CoverageView;
  recommendedRendezvousId: string | null;
};

export function ScenarioLegend({
  coverageView,
  recommendedRendezvousId,
}: ScenarioLegendProps) {
  const strategicLegendItems: LegendItem[] =
    coverageView === "strategic"
      ? [["station-recommended", "Recommended staging"]]
      : [];
  const rendezvousLegendItems: LegendItem[] = recommendedRendezvousId
    ? [["rendezvous-recommended", "Recommended meeting spot"]]
    : [];
  const legendItems: LegendItem[] = [
    ...BASE_LEGEND_ITEMS.slice(0, 1),
    ...strategicLegendItems,
    ...BASE_LEGEND_ITEMS.slice(1, 8),
    ...rendezvousLegendItems,
    ...BASE_LEGEND_ITEMS.slice(8),
  ];

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
