import { Clock3, Route, ShieldCheck } from "lucide-react";

import type { BaselineCoverageResult } from "../lib/types";

type CoveragePanelProps = {
  coverage: BaselineCoverageResult | null;
  error: string | null;
};

export function CoveragePanel({ coverage, error }: CoveragePanelProps) {
  return (
    <section className="rail-section coverage-section">
      <div className="section-heading">
        <Route size={17} aria-hidden="true" />
        <h2>Baseline coverage</h2>
      </div>
      {coverage ? (
        <>
          <div className="coverage-summary">
            <div>
              <span>Demand points covered</span>
              <strong>
                {coverage.covered_demand_count}/{coverage.demand_points.length}
              </strong>
            </div>
            <div>
              <span>Coverage target</span>
              <strong>{coverage.target_coverage_minutes} min</strong>
            </div>
          </div>
          <div className="panel-note">
            <ShieldCheck size={14} aria-hidden="true" />
            <span>{coverage.eligible_resource_count} eligible response units</span>
          </div>
          <div className="panel-note">
            <Clock3 size={14} aria-hidden="true" />
            <span>Road time includes on-call mobilization when needed.</span>
          </div>
        </>
      ) : error ? (
        <p className="coverage-error">{error}</p>
      ) : (
        <p className="panel-note panel-note--plain">Calculating road-based coverage.</p>
      )}
    </section>
  );
}
