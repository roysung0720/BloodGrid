"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

import { applyBrandMap, BRAND_MAP_STYLE } from "../lib/brandMap";

import type {
  BaselineCoverageResult,
  CoverageView,
  FeatureSelection,
  LayerKey,
  LayerVisibility,
  LiveRendezvousResult,
  ScenarioData,
  StrategicDeploymentResult,
} from "../lib/types";

type OperationsMapProps = {
  scenario: ScenarioData;
  coverage: BaselineCoverageResult | null;
  deployment: StrategicDeploymentResult | null;
  rendezvous: LiveRendezvousResult | null;
  selectedLiveIncidentId: string | null;
  coverageView: CoverageView;
  visibleLayers: LayerVisibility;
  onFeatureSelect: (selection: FeatureSelection) => void;
};

type MarkerDefinition = {
  id: string;
  layer: LayerKey;
  longitude: number;
  latitude: number;
  title: string;
  type: FeatureSelection["type"];
  variant: string;
};

function createMarkerElement(
  definition: MarkerDefinition,
  onFeatureSelect: (selection: FeatureSelection) => void,
) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `map-marker map-marker--${definition.variant}`;
  element.title = definition.title;
  element.setAttribute("aria-label", definition.title);
  element.addEventListener("click", () => {
    onFeatureSelect({ type: definition.type, id: definition.id });
  });
  return element;
}

export function OperationsMap({
  scenario,
  coverage,
  deployment,
  rendezvous,
  selectedLiveIncidentId,
  coverageView,
  visibleLayers,
  onFeatureSelect,
}: OperationsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onFeatureSelectRef = useRef(onFeatureSelect);

  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect;
  }, [onFeatureSelect]);

  useEffect(() => {
    const mapToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!containerRef.current || !mapToken) {
      return;
    }

    const { bounding_box: bounds } = scenario.metadata;
    const map = new mapboxgl.Map({
      accessToken: mapToken,
      container: containerRef.current,
      style: BRAND_MAP_STYLE,
      // Open framed on the scenario's own area, so every data set fills the map.
      bounds: [
        [bounds.min_longitude, bounds.min_latitude],
        [bounds.max_longitude, bounds.max_latitude],
      ],
      fitBoundsOptions: { padding: { top: 90, bottom: 60, left: 240, right: 60 } },
      attributionControl: false,
    });

    map.on("style.load", () => applyBrandMap(map, "full"));
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    const activeCoverage =
      coverageView === "strategic" && deployment
        ? deployment.demand_points
        : coverage?.demand_points;
    const coverageByIncident = new Map(
      activeCoverage?.map((point) => [point.incident_id, point]),
    );
    const assignmentsByStation = new Map<string, string[]>(
      deployment?.assignments.reduce((assignments, assignment) => {
        const units = assignments.get(assignment.station_id) ?? [];
        units.push(assignment.unit_id);
        assignments.set(assignment.station_id, units);
        return assignments;
      }, new Map<string, string[]>()) ?? new Map<string, string[]>(),
    );
    const recommendedRendezvousId = rendezvous?.recommended_rendezvous_id;
    const recommendedSpot = rendezvous?.candidates.find(
      (candidate) => candidate.status === "RECOMMENDED",
    );
    const eligibilityByUnit = new Map(
      coverage?.resource_eligibility.map((assessment) => [
        assessment.unit_id,
        assessment,
      ]),
    );
    const markerDefinitions: MarkerDefinition[] = [
      ...scenario.stations.map((station) => ({
        id: station.station_id,
        layer: "stations" as const,
        longitude: station.longitude,
        latitude: station.latitude,
        title:
          coverageView === "strategic" && assignmentsByStation.has(station.station_id)
            ? `${station.name} recommended staging for ${assignmentsByStation
                .get(station.station_id)
                ?.join(", ")}`
            : `${station.name} station`,
        type: "station" as const,
        variant:
          coverageView === "strategic" && assignmentsByStation.has(station.station_id)
            ? "station-recommended"
            : "station",
      })),
      ...scenario.response_units.map((unit) => {
        const eligibility = eligibilityByUnit.get(unit.unit_id);
        const unavailable = eligibility ? !eligibility.eligible : false;
        return {
          id: unit.unit_id,
          layer: "units" as const,
          longitude: unit.current_longitude,
          latitude: unit.current_latitude,
          title: unavailable
            ? `${unit.unit_id} not eligible: ${eligibility?.reasons[0]}`
            : `${unit.unit_id} Blood Response Unit`,
          type: "unit" as const,
          variant: unavailable
            ? "unit-unavailable"
            : unit.crew_status === "ON_CALL"
              ? "unit-on-call"
              : "unit-available",
        };
      }),
      ...scenario.hospitals.map((hospital) => ({
        id: hospital.hospital_id,
        layer: "hospitals" as const,
        longitude: hospital.longitude,
        latitude: hospital.latitude,
        title: `${hospital.name} hospital`,
        type: "hospital" as const,
        variant: "hospital",
      })),
      ...scenario.historical_incidents.map((incident) => ({
        id: incident.incident_id,
        layer: "incidents" as const,
        longitude: incident.longitude,
        latitude: incident.latitude,
        title: coverageByIncident.has(incident.incident_id)
          ? coverageByIncident.get(incident.incident_id)?.covered
            ? `${incident.incident_type.replace("_", " ")} demand proxy: ${coverageView} coverage`
            : `${incident.incident_type.replace("_", " ")} demand proxy: outside ${coverageView} target`
          : `${incident.incident_type.replace("_", " ")} demand proxy: coverage unavailable`,
        type: "incident" as const,
        variant: coverageByIncident.get(incident.incident_id)?.covered
          ? "incident-covered"
          : coverageByIncident.has(incident.incident_id)
            ? "incident-uncovered"
            : "incident",
      })),
      ...scenario.rendezvous_points.map((point) => ({
        id: point.rendezvous_id,
        layer: "rendezvous" as const,
        longitude: point.longitude,
        latitude: point.latitude,
        title:
          point.rendezvous_id === recommendedRendezvousId
            ? `${point.name} recommended meeting spot`
            : `${point.name} known meeting site`,
        type: "rendezvous" as const,
        variant:
          point.rendezvous_id === recommendedRendezvousId
            ? "rendezvous-recommended"
            : "rendezvous",
      })),
      // The rule may pick any public place (e.g. a parking lot), not only a known site.
      ...(recommendedSpot &&
      !scenario.rendezvous_points.some((point) => point.rendezvous_id === recommendedSpot.rendezvous_id)
        ? [
            {
              id: recommendedSpot.rendezvous_id,
              layer: "rendezvous" as const,
              longitude: recommendedSpot.longitude,
              latitude: recommendedSpot.latitude,
              title: `${recommendedSpot.rendezvous_name} recommended meeting spot`,
              type: "rendezvous" as const,
              variant: "rendezvous-recommended",
            },
          ]
        : []),
      ...scenario.live_incidents.map((incident) => ({
        id: incident.incident_id,
        layer: "liveIncident" as const,
        longitude: incident.longitude,
        latitude: incident.latitude,
        title:
          incident.incident_id === selectedLiveIncidentId
            ? `${incident.patient_unit_id} selected blood request`
            : `${incident.patient_unit_id} blood request`,
        type: "liveIncident" as const,
        variant:
          incident.incident_id === selectedLiveIncidentId
            ? "live-incident-selected"
            : "live-incident",
      })),
    ];

    const markers = markerDefinitions
      .filter((definition) => visibleLayers[definition.layer])
      .map((definition) => {
        const element = createMarkerElement(definition, (selection) =>
          onFeatureSelectRef.current(selection),
        );
        return new mapboxgl.Marker({ element, anchor: "center" })
          .setLngLat([definition.longitude, definition.latitude])
          .addTo(map);
      });

    return () => {
      markers.forEach((marker) => marker.remove());
      map.remove();
    };
  }, [
    coverage,
    coverageView,
    deployment,
    rendezvous,
    scenario,
    selectedLiveIncidentId,
    visibleLayers,
  ]);

  if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
    return (
      <div className="map-token-missing">
        Mapbox token not found. Add `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to the
        project `.env` file and restart the frontend.
      </div>
    );
  }

  return <div className="map-canvas" ref={containerRef} />;
}
