import { ArrowRight, MapPinned, Target } from "lucide-react";

import type {
  BaselineCoverageResult,
  CoverageView,
  StrategicDeploymentResult,
} from "../lib/types";

type DeploymentPanelProps = {
  baseline: BaselineCoverageResult | null;
  deployment: StrategicDeploymentResult | null;
  error: string | null;
  view: CoverageView;
  onViewChange: (view: CoverageView) => void;
};

export function DeploymentPanel({
  baseline,
  deployment,
  error,
  view,
  onViewChange,
}: DeploymentPanelProps) {
  return (
    <section className="rail-section deployment-section">
      <div className="section-heading">
        <Target size={17} aria-hidden="true" />
        <h2>Strategic deployment</h2>
      </div>
      {deployment ? (
        <>
          <div className="view-toggle" role="group" aria-label="Coverage view">
            <button
              aria-pressed={view === "baseline"}
              className={view === "baseline" ? "view-toggle__button is-active" : "view-toggle__button"}
              onClick={() => onViewChange("baseline")}
              type="button"
            >
              Current
            </button>
            <button
              aria-pressed={view === "strategic"}
              className={view === "strategic" ? "view-toggle__button is-active" : "view-toggle__button"}
              onClick={() => onViewChange("strategic")}
              type="button"
            >
              Recommended
            </button>
          </div>
          <div className="deployment-comparison">
            <div>
              <span>Current</span>
              <strong>
                {baseline?.covered_demand_count ?? "-"}/{baseline?.demand_points.length ?? "-"}
              </strong>
            </div>
            <ArrowRight size={17} aria-hidden="true" />
            <div>
              <span>Recommended</span>
              <strong>
                {deployment.optimized_covered_demand_count}/{deployment.demand_points.length}
              </strong>
            </div>
          </div>
          <div className="deployment-assignments">
            {deployment.assignments.map((assignment) => (
              <div key={assignment.unit_id}>
                <strong>{assignment.unit_id}</strong>
                <span>{assignment.station_name}</span>
              </div>
            ))}
          </div>
          <div className="panel-note">
            <MapPinned size={14} aria-hidden="true" />
            <span>Recommended view updates demand coverage and staging markers.</span>
          </div>
        </>
      ) : error ? (
        <p className="coverage-error">{error}</p>
      ) : (
        <p className="panel-note panel-note--plain">Optimizing eligible unit staging.</p>
      )}
    </section>
  );
}
