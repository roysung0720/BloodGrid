"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

import type {
  BaselineCoverageResult,
  FeatureSelection,
  LayerKey,
  LayerVisibility,
  ScenarioData,
} from "../lib/types";

type OperationsMapProps = {
  scenario: ScenarioData;
  coverage: BaselineCoverageResult | null;
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

    const coverageByIncident = new Map(
      coverage?.demand_points.map((point) => [point.incident_id, point]),
    );
    const markerDefinitions: MarkerDefinition[] = [
      ...scenario.stations.map((station) => ({
        id: station.station_id,
        layer: "stations" as const,
        longitude: station.longitude,
        latitude: station.latitude,
        title: `${station.name} station`,
        type: "station" as const,
        variant: "station",
      })),
      ...scenario.response_units.map((unit) => ({
        id: unit.unit_id,
        layer: "units" as const,
        longitude: unit.current_longitude,
        latitude: unit.current_latitude,
        title: `${unit.unit_id} Blood Response Unit`,
        type: "unit" as const,
        variant: unit.crew_status === "ON_CALL" ? "unit-on-call" : "unit-available",
      })),
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
            ? `${incident.incident_type.replace("_", " ")} demand proxy: covered`
            : `${incident.incident_type.replace("_", " ")} demand proxy: not covered`
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
        title: `${point.name} rendezvous point`,
        type: "rendezvous" as const,
        variant: "rendezvous",
      })),
      ...scenario.live_incidents.map((incident) => ({
        id: incident.incident_id,
        layer: "liveIncident" as const,
        longitude: incident.longitude,
        latitude: incident.latitude,
        title: `${incident.patient_unit_id} blood request`,
        type: "liveIncident" as const,
        variant: "live-incident",
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
  }, [coverage, scenario, visibleLayers]);

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
