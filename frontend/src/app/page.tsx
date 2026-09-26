"use client";

import { Activity, Database, Layers3, MapPinned } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FeatureDetails } from "../components/FeatureDetails";
import { IncidentPanel } from "../components/IncidentPanel";
import { LayerControls } from "../components/LayerControls";
import { OperationsMap } from "../components/OperationsMap";
import { ResourcePanel } from "../components/ResourcePanel";
import { ScenarioLegend } from "../components/ScenarioLegend";
import { getScenario } from "../lib/api";
import type {
  FeatureSelection,
  LayerVisibility,
  ScenarioData,
} from "../lib/types";

const DEFAULT_LAYERS: LayerVisibility = {
  stations: true,
  units: true,
  hospitals: true,
  incidents: true,
  rendezvous: true,
  liveIncident: true,
};

export default function HomePage() {
  const [scenario, setScenario] = useState<ScenarioData | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<FeatureSelection | null>(
    null,
  );
  const [visibleLayers, setVisibleLayers] =
    useState<LayerVisibility>(DEFAULT_LAYERS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getScenario()
      .then(setScenario)
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  const activeUnitCount = useMemo(
    () =>
      scenario?.response_units.filter(
        (unit) =>
          unit.vehicle_status === "AVAILABLE" &&
          ["AVAILABLE", "ON_CALL"].includes(unit.crew_status),
      ).length ?? 0,
    [scenario],
  );

  if (error) {
    return (
      <main className="startup-state">
        <div className="startup-state__content">
          <Activity aria-hidden="true" size={28} />
          <h1>BloodGrid is not connected to the local data service.</h1>
          <p>{error}</p>
          <p className="startup-state__hint">
            Start the backend on port 8000, then refresh this page.
          </p>
        </div>
      </main>
    );
  }

  if (!scenario) {
    return (
      <main className="startup-state">
        <div className="startup-state__content">
          <Activity className="pulse" aria-hidden="true" size={28} />
          <h1>Loading the operations map</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <Activity size={21} strokeWidth={2.4} />
          </div>
          <div>
            <p className="eyebrow">Rural EMS logistics</p>
            <h1>BloodGrid</h1>
          </div>
        </div>

        <div className="topbar__context">
          <span className="scenario-pill">
            <Database size={14} aria-hidden="true" />
            Synthetic demo data
          </span>
          <span className="scenario-name">{scenario.metadata.name}</span>
        </div>
      </header>

      <section className="operations-layout" aria-label="Operations dashboard">
        <section className="map-stage" aria-label="Regional operations map">
          <OperationsMap
            scenario={scenario}
            visibleLayers={visibleLayers}
            onFeatureSelect={setSelectedFeature}
          />
          <div className="map-title">
            <MapPinned size={17} aria-hidden="true" />
            <span>{scenario.metadata.geographic_area}</span>
          </div>
          <LayerControls
            visibleLayers={visibleLayers}
            onChange={setVisibleLayers}
          />
          <ScenarioLegend />
        </section>

        <aside className="operations-rail" aria-label="Current scenario details">
          <section className="rail-section overview-section">
            <div className="section-heading">
              <Layers3 size={17} aria-hidden="true" />
              <h2>Regional overview</h2>
            </div>
            <div className="overview-grid">
              <div>
                <span>Eligible now</span>
                <strong>{activeUnitCount}</strong>
              </div>
              <div>
                <span>Demand points</span>
                <strong>{scenario.historical_incidents.length}</strong>
              </div>
              <div>
                <span>Rendezvous</span>
                <strong>{scenario.rendezvous_points.length}</strong>
              </div>
            </div>
          </section>

          <ResourcePanel scenario={scenario} onSelect={setSelectedFeature} />
          <IncidentPanel scenario={scenario} onSelect={setSelectedFeature} />
          <FeatureDetails scenario={scenario} selection={selectedFeature} />
        </aside>
      </section>
    </main>
  );
}
