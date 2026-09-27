"use client";

import { Activity, Ambulance, Layers3, MapPinned } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AmbulanceRequestsPanel } from "../components/AmbulanceRequestsPanel";
import { FeatureDetails } from "../components/FeatureDetails";
import { CoveragePanel } from "../components/CoveragePanel";
import { AvailabilityProfilePanel } from "../components/AvailabilityProfilePanel";
import { DeploymentPanel } from "../components/DeploymentPanel";
import { IncidentPanel } from "../components/IncidentPanel";
import { MapSymbols } from "../components/MapSymbols";
import { OperationsMap } from "../components/OperationsMap";
import { ResourcePanel } from "../components/ResourcePanel";
import { RendezvousPanel } from "../components/RendezvousPanel";
import { ScenarioSelector } from "../components/ScenarioSelector";
import {
  getBaselineCoverage,
  getLiveRendezvous,
  getScenario,
  getScenarioCatalog,
  getStrategicDeployment,
} from "../lib/api";
import type {
  BaselineCoverageResult,
  CoverageView,
  FeatureSelection,
  LayerVisibility,
  LiveRendezvousResult,
  ScenarioCatalogEntry,
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
  const [scenarioCatalog, setScenarioCatalog] = useState<ScenarioCatalogEntry[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
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

    getScenarioCatalog()
      .then((catalog) => {
        if (cancelled) {
          return;
        }
        setScenarioCatalog(catalog);
        setSelectedScenarioId(
          catalog.find((entry) => entry.is_default)?.metadata.scenario_id ??
            catalog[0]?.metadata.scenario_id ??
            null,
        );
      })
      .catch((requestError: Error) => {
        if (!cancelled) {
          setError(requestError.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedScenarioId) {
      return;
    }

    let cancelled = false;
    setScenario(null);
    setCoverage(null);
    setDeployment(null);
    setRendezvous(null);
    setError(null);
    setCoverageError(null);
    setDeploymentError(null);
    setRendezvousError(null);
    setSelectedFeature(null);

    getScenario(selectedScenarioId, availabilityProfileId)
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
    getBaselineCoverage(selectedScenarioId, availabilityProfileId)
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
    getStrategicDeployment(selectedScenarioId, availabilityProfileId)
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
  }, [availabilityProfileId, selectedScenarioId]);

  const selectedIncident = scenario?.live_incidents.find(
    (incident) => incident.incident_id === selectedIncidentId,
  ) ?? scenario?.live_incidents.find(
    (incident) => incident.incident_id === scenario.metadata.default_live_incident_id,
  );

  useEffect(() => {
    if (!selectedIncident || !selectedScenarioId) {
      return;
    }

    let cancelled = false;
    setRendezvous(null);
    setRendezvousError(null);

    getLiveRendezvous(
      selectedIncident.incident_id,
      selectedScenarioId,
      availabilityProfileId,
    )
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
  }, [availabilityProfileId, selectedIncident, selectedScenarioId]);

  function selectScenario(scenarioId: string) {
    setSelectedScenarioId(scenarioId);
    setAvailabilityProfileId("baseline");
    setSelectedIncidentId(null);
    setSelectedFeature(null);
  }

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
          <ScenarioSelector
            scenarios={scenarioCatalog}
            selectedScenarioId={selectedScenarioId}
            onChange={selectScenario}
          />
          <Link
            className="view-switch"
            href={
              selectedScenarioId
                ? `/ambulance?scenario=${encodeURIComponent(selectedScenarioId)}`
                : "/ambulance"
            }
          >
            <Ambulance size={15} aria-hidden="true" />
            Ambulance view
          </Link>
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
          <MapSymbols
            visibleLayers={visibleLayers}
            onChange={setVisibleLayers}
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
          <AmbulanceRequestsPanel scenarioId={selectedScenarioId} />
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
