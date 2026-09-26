const LEGEND_ITEMS = [
  ["station", "Station"],
  ["unit-available", "Available unit"],
  ["unit-on-call", "On-call unit"],
  ["hospital", "Hospital"],
  ["incident", "Demand proxy"],
  ["rendezvous", "Approved rendezvous"],
  ["live-incident", "Blood requested"],
] as const;

export function ScenarioLegend() {
  return (
    <section className="scenario-legend" aria-label="Map legend">
      <p>Scenario markers</p>
      <div className="scenario-legend__grid">
        {LEGEND_ITEMS.map(([kind, label]) => (
          <div key={kind}>
            <span className={`legend-symbol legend-symbol--${kind}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
