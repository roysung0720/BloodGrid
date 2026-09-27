"use client";

import { Activity, Database, Layers3, MapPinned } from "lucide-react";
import { useEffect, useState } from "react";

import { FeatureDetails } from "../components/FeatureDetails";
import { CoveragePanel } from "../components/CoveragePanel";
import { AvailabilityProfilePanel } from "../components/AvailabilityProfilePanel";
import { DeploymentPanel } from "../components/DeploymentPanel";
import { IncidentPanel } from "../components/IncidentPanel";
import { LayerControls } from "../components/LayerControls";
import { OperationsMap } from "../components/OperationsMap";
import { ResourcePanel } from "../components/ResourcePanel";
import { RendezvousPanel } from "../components/RendezvousPanel";
import { ScenarioLegend } from "../components/ScenarioLegend";
import {
  getBaselineCoverage,
  getLiveRendezvous,
  getScenario,
  getStrategicDeployment,
} from "../lib/api";
import type {
  BaselineCoverageResult,
  CoverageView,
  FeatureSelection,
  LayerVisibility,
  LiveRendezvousResult,
  ScenarioData,
  StrategicDeploymentResult,
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
  const [coverage, setCoverage] = useState<BaselineCoverageResult | null>(null);
  const [deployment, setDeployment] = useState<StrategicDeploymentResult | null>(null);
  const [rendezvous, setRendezvous] = useState<LiveRendezvousResult | null>(null);
  const [availabilityProfileId, setAvailabilityProfileId] = useState("baseline");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [coverageView, setCoverageView] = useState<CoverageView>("baseline");
  const [selectedFeature, setSelectedFeature] = useState<FeatureSelection | null>(
    null,
  );
  const [visibleLayers, setVisibleLayers] =
    useState<LayerVisibility>(DEFAULT_LAYERS);
  const [error, setError] = useState<string | null>(null);
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [rendezvousError, setRendezvousError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCoverage(null);
    setDeployment(null);
    setCoverageError(null);
    setDeploymentError(null);
    setSelectedFeature(null);

    getScenario(availabilityProfileId)
      .then((loadedScenario) => {
        if (!cancelled) {
          setScenario(loadedScenario);
          setSelectedIncidentId((currentIncidentId) =>
            loadedScenario.live_incidents.some(
              (incident) => incident.incident_id === currentIncidentId,
            )
              ? currentIncidentId
              : loadedScenario.metadata.default_live_incident_id,
          );
        }
      })
      .catch((requestError: Error) => {
        if (!cancelled) {
          setError(requestError.message);
        }
      });
    getBaselineCoverage(availabilityProfileId)
      .then((result) => {
        if (!cancelled) {
          setCoverage(result);
        }
      })
      .catch((requestError: Error) => {
        if (!cancelled) {
          setCoverageError(requestError.message);
        }
      });
    getStrategicDeployment(availabilityProfileId)
      .then((result) => {
        if (!cancelled) {
          setDeployment(result);
        }
      })
      .catch((requestError: Error) => {
        if (!cancelled) {
          setDeploymentError(requestError.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [availabilityProfileId]);

  const selectedIncident = scenario?.live_incidents.find(
    (incident) => incident.incident_id === selectedIncidentId,
  ) ?? scenario?.live_incidents.find(
    (incident) => incident.incident_id === scenario.metadata.default_live_incident_id,
  );

  useEffect(() => {
    if (!selectedIncident) {
      return;
    }

    let cancelled = false;
    setRendezvous(null);
    setRendezvousError(null);

    getLiveRendezvous(selectedIncident.incident_id, availabilityProfileId)
      .then((result) => {
        if (!cancelled) {
          setRendezvous(result);
        }
      })
      .catch((requestError: Error) => {
        if (!cancelled) {
          setRendezvousError(requestError.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [availabilityProfileId, selectedIncident]);

  function selectLiveIncident(incidentId: string) {
    setSelectedIncidentId(incidentId);
    setSelectedFeature({ type: "liveIncident", id: incidentId });
  }

  function selectMapFeature(selection: FeatureSelection) {
    setSelectedFeature(selection);
    if (selection.type === "liveIncident") {
      setSelectedIncidentId(selection.id);
    }
  }

  const activeUnitCount = coverage ? coverage.eligible_resource_count : "-";

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
            coverage={coverage}
            deployment={deployment}
            rendezvous={rendezvous}
            selectedLiveIncidentId={selectedIncident?.incident_id ?? null}
            coverageView={coverageView}
            visibleLayers={visibleLayers}
            onFeatureSelect={selectMapFeature}
          />
          <div className="map-title">
            <MapPinned size={17} aria-hidden="true" />
            <span>{scenario.metadata.geographic_area}</span>
          </div>
          <LayerControls
            visibleLayers={visibleLayers}
            onChange={setVisibleLayers}
          />
          <ScenarioLegend
            coverageView={coverageView}
            recommendedRendezvousId={rendezvous?.recommended_rendezvous_id ?? null}
          />
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

          <AvailabilityProfilePanel
            profiles={scenario.availability_profiles}
            selectedProfileId={availabilityProfileId}
            onChange={setAvailabilityProfileId}
          />
          <CoveragePanel coverage={coverage} error={coverageError} />
          <DeploymentPanel
            baseline={coverage}
            deployment={deployment}
            error={deploymentError}
            view={coverageView}
            onViewChange={setCoverageView}
          />
          <ResourcePanel
            scenario={scenario}
            coverage={coverage}
            onSelect={setSelectedFeature}
          />
          <IncidentPanel
            scenario={scenario}
            selectedIncidentId={selectedIncident?.incident_id ?? null}
            onChange={selectLiveIncident}
            onSelect={setSelectedFeature}
          />
          <RendezvousPanel
            result={rendezvous}
            error={rendezvousError}
            onSelect={setSelectedFeature}
          />
          <FeatureDetails
            scenario={scenario}
            coverage={coverage}
            deployment={deployment}
            rendezvous={rendezvous}
            coverageView={coverageView}
            selection={selectedFeature}
          />
        </aside>
      </section>
    </main>
  );
}
