"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

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

const COLLOCATED_MARKER_OFFSETS: Array<[number, number]> = [
  [-10, 0],
  [10, 0],
  [0, -10],
  [0, 10],
  [-8, -8],
  [8, -8],
  [-8, 8],
  [8, 8],
];

function coordinateKey(definition: MarkerDefinition) {
  return `${definition.longitude},${definition.latitude}`;
}

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
      style: "mapbox://styles/mapbox/standard",
      center: [
        (bounds.min_longitude + bounds.max_longitude) / 2,
        (bounds.min_latitude + bounds.max_latitude) / 2,
      ],
      zoom: 8.15,
      attributionControl: false,
    });

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
            ? `${point.name} recommended approved rendezvous point`
            : `${point.name} rendezvous point`,
        type: "rendezvous" as const,
        variant:
          point.rendezvous_id === recommendedRendezvousId
            ? "rendezvous-recommended"
            : "rendezvous",
      })),
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

    const markerGroups = new Map<string, MarkerDefinition[]>();
    markerDefinitions.forEach((definition) => {
      const key = coordinateKey(definition);
      markerGroups.set(key, [...(markerGroups.get(key) ?? []), definition]);
    });

    const markers = markerDefinitions
      .filter((definition) => visibleLayers[definition.layer])
      .map((definition) => {
        const element = createMarkerElement(definition, (selection) =>
          onFeatureSelectRef.current(selection),
        );
        const colocatedMarkers = markerGroups.get(coordinateKey(definition)) ?? [];
        const colocatedIndex = colocatedMarkers.indexOf(definition);
        const offset: [number, number] =
          colocatedMarkers.length > 1
            ? (COLLOCATED_MARKER_OFFSETS[
                colocatedIndex % COLLOCATED_MARKER_OFFSETS.length
              ] ?? [0, 0])
            : [0, 0];

        return new mapboxgl.Marker({ element, anchor: "center", offset })
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
