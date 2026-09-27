"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

import { getRoute } from "../lib/api";
import type {
  BaselineCoverageResult,
  CoverageView,
  FeatureSelection,
  LayerKey,
  LayerVisibility,
  LiveRendezvousResult,
  ScenarioData,
  StrategicDeploymentResult,
  RouteResult,
} from "../lib/types";

type OperationsMapProps = {
  scenario: ScenarioData;
  coverage: BaselineCoverageResult | null;
  deployment: StrategicDeploymentResult | null;
  rendezvous: LiveRendezvousResult | null;
  selectedLiveIncidentId: string | null;
  coverageView: CoverageView;
  visibleLayers: LayerVisibility;
  showRoutePreview: boolean;
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

type RoutePreview = {
  ambulanceToRendezvous: RouteResult | null;
  ambulanceToHospital: RouteResult | null;
  resourceToRendezvous: RouteResult | null;
};

const ROUTE_SOURCE_IDS = {
  ambulanceToRendezvous: "system-ambulance-to-rendezvous",
  ambulanceToHospital: "system-ambulance-to-hospital",
  resourceToRendezvous: "system-resource-to-rendezvous",
} as const;

function lineFeature(coordinates: RouteResult["geometry"] | null) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: coordinates ?? [] },
  };
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
  showRoutePreview,
  onFeatureSelect,
}: OperationsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onFeatureSelectRef = useRef(onFeatureSelect);
  const [styleReady, setStyleReady] = useState(false);
  const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);

  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect;
  }, [onFeatureSelect]);

  useEffect(() => {
    let cancelled = false;
    setRoutePreview(null);
    const selectedRendezvous = rendezvous;

    const incident = scenario.live_incidents.find(
      (item) => item.incident_id === selectedLiveIncidentId,
    );
    const hospital = incident
      ? scenario.hospitals.find(
          (item) => item.hospital_id === incident.destination_hospital_id,
        )
      : null;

    if (!showRoutePreview || !incident || !hospital || !selectedRendezvous) {
      return () => {
        cancelled = true;
      };
    }
    const routeRendezvous: LiveRendezvousResult = selectedRendezvous;

    const incidentLocation = {
      latitude: incident.latitude,
      longitude: incident.longitude,
    };
    const hospitalLocation = {
      latitude: hospital.latitude,
      longitude: hospital.longitude,
    };

    async function loadRoutePreview() {
      if (
        routeRendezvous.recommendation !== "RENDEZVOUS" ||
        !routeRendezvous.recommended_rendezvous_id
      ) {
        const directRoute = await getRoute(incidentLocation, hospitalLocation);
        if (!cancelled) {
          setRoutePreview({
            ambulanceToRendezvous: null,
            ambulanceToHospital: directRoute,
            resourceToRendezvous: null,
          });
        }
        return;
      }

      const rendezvousPoint = scenario.rendezvous_points.find(
        (point) => point.rendezvous_id === routeRendezvous.recommended_rendezvous_id,
      );
      const recommendedCandidate = routeRendezvous.candidates.find(
        (candidate) =>
          candidate.rendezvous_id === routeRendezvous.recommended_rendezvous_id,
      );
      const resource = recommendedCandidate?.resource_id
        ? scenario.response_units.find(
            (unit) => unit.unit_id === recommendedCandidate.resource_id,
          )
        : null;

      if (!rendezvousPoint) {
        return;
      }

      const rendezvousLocation = {
        latitude: rendezvousPoint.latitude,
        longitude: rendezvousPoint.longitude,
      };
      const [ambulanceToRendezvous, ambulanceToHospital, resourceToRendezvous] =
        await Promise.all([
          getRoute(incidentLocation, rendezvousLocation),
          getRoute(rendezvousLocation, hospitalLocation),
          resource
            ? getRoute(
                {
                  latitude: resource.current_latitude,
                  longitude: resource.current_longitude,
                },
                rendezvousLocation,
              )
            : Promise.resolve(null),
        ]);

      if (!cancelled) {
        setRoutePreview({
          ambulanceToRendezvous,
          ambulanceToHospital,
          resourceToRendezvous,
        });
      }
    }

    loadRoutePreview().catch(() => {
      if (!cancelled) {
        setRoutePreview(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [rendezvous, scenario, selectedLiveIncidentId, showRoutePreview]);

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
    map.on("style.load", () => setStyleReady(true));
    mapRef.current = map;

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
      mapRef.current = null;
      setStyleReady(false);
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) {
      return;
    }

    const routeEntries = [
      {
        sourceId: ROUTE_SOURCE_IDS.ambulanceToRendezvous,
        route: routePreview?.ambulanceToRendezvous ?? null,
        color: "#2f86eb",
        width: 6,
      },
      {
        sourceId: ROUTE_SOURCE_IDS.ambulanceToHospital,
        route: routePreview?.ambulanceToHospital ?? null,
        color: "#2f86eb",
        width: 5,
        dasharray: [1.2, 1.2],
      },
      {
        sourceId: ROUTE_SOURCE_IDS.resourceToRendezvous,
        route: routePreview?.resourceToRendezvous ?? null,
        color: "#087f76",
        width: 5,
        dasharray: [0.8, 1.2],
      },
    ];

    for (const entry of routeEntries) {
      const data = lineFeature(entry.route?.geometry ?? null);
      const source = map.getSource(entry.sourceId) as mapboxgl.GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
      } else {
        map.addSource(entry.sourceId, { type: "geojson", data });
        map.addLayer({
          id: entry.sourceId,
          type: "line",
          source: entry.sourceId,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": entry.color,
            "line-width": entry.width,
            "line-opacity": 0.86,
            ...(entry.dasharray ? { "line-dasharray": entry.dasharray } : {}),
          },
        });
      }
    }

    const routeCoordinates = routeEntries.flatMap(
      (entry) => entry.route?.geometry ?? [],
    );
    if (routeCoordinates.length > 1) {
      const bounds = new mapboxgl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]);
      routeCoordinates.slice(1).forEach((coordinate) => bounds.extend(coordinate));
      map.fitBounds(bounds, {
        padding: { top: 48, right: 44, bottom: 48, left: 224 },
        maxZoom: 13,
        duration: 700,
      });
    }
  }, [routePreview, styleReady]);

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
