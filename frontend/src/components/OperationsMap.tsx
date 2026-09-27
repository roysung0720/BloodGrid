"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

import { getRoute } from "../lib/api";
import { applyBrandMap, BRAND_MAP_STYLE } from "../lib/brandMap";
import { CATEGORY_LABELS } from "../lib/meetingSpots";

import type {
  BaselineCoverageResult,
  CoverageView,
  FeatureSelection,
  LayerKey,
  LayerVisibility,
  LiveRendezvousResult,
  MeetingSpot,
  ScenarioData,
  StrategicDeploymentResult,
  RouteResult,
} from "../lib/types";

type OperationsMapProps = {
  scenario: ScenarioData;
  coverage: BaselineCoverageResult | null;
  deployment: StrategicDeploymentResult | null;
  rendezvous: LiveRendezvousResult | null;
  meetingSpots: MeetingSpot[];
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

const MEETING_SPOT_LAYER = "system-meeting-spots";

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function meetingSpotCollection(spots: MeetingSpot[]) {
  return {
    type: "FeatureCollection" as const,
    features: spots.map((spot) => ({
      type: "Feature" as const,
      properties: { name: spot.name, category: spot.category },
      geometry: { type: "Point" as const, coordinates: [spot.longitude, spot.latitude] },
    })),
  };
}

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
  meetingSpots,
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
  // The map is rebuilt when its inputs change; routes may only be drawn once *that* map's style loads.
  const loadedMapRef = useRef<mapboxgl.Map | null>(null);
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

    if (!showRoutePreview || !incident || !hospital) {
      return () => {
        cancelled = true;
      };
    }

    const incidentLocation = {
      latitude: incident.latitude,
      longitude: incident.longitude,
    };
    const hospitalLocation = {
      latitude: hospital.latitude,
      longitude: hospital.longitude,
    };

    async function loadRoutePreview() {
      // Current view is intentionally an honest direct-transport display. The more
      // elaborate meeting plan is only simulated after units are staged as recommended.
      if (coverageView === "baseline") {
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

      if (!selectedRendezvous) {
        return;
      }
      const routeRendezvous: LiveRendezvousResult = selectedRendezvous;
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

      // Meeting spots can be any mapped place, so use the recommended option's own location.
      const recommendedCandidate = routeRendezvous.candidates.find(
        (candidate) => candidate.status === "RECOMMENDED",
      );
      const resource = recommendedCandidate?.resource_id
        ? scenario.response_units.find(
            (unit) => unit.unit_id === recommendedCandidate.resource_id,
          )
        : null;
      const assignedStationId = recommendedCandidate?.resource_id
        ? deployment?.assignments.find(
            (assignment) => assignment.unit_id === recommendedCandidate.resource_id,
          )?.station_id
        : null;
      const assignedStation = assignedStationId
        ? scenario.stations.find((station) => station.station_id === assignedStationId)
        : null;

      if (!recommendedCandidate) {
        return;
      }

      const rendezvousLocation = {
        latitude: recommendedCandidate.latitude,
        longitude: recommendedCandidate.longitude,
      };
      const [ambulanceToRendezvous, ambulanceToHospital, resourceToRendezvous] =
        await Promise.all([
          getRoute(incidentLocation, rendezvousLocation),
          getRoute(rendezvousLocation, hospitalLocation),
          resource
            ? getRoute(
                {
                  latitude: assignedStation?.latitude ?? resource.current_latitude,
                  longitude: assignedStation?.longitude ?? resource.current_longitude,
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
  }, [coverageView, deployment, rendezvous, scenario, selectedLiveIncidentId, showRoutePreview]);

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
    map.on("style.load", () => {
      loadedMapRef.current = map;
      setStyleReady(true);
    });
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
    const assignmentByUnit = new Map(
      deployment?.assignments.map((assignment) => [assignment.unit_id, assignment.station_id]) ?? [],
    );
    const stationById = new Map(
      scenario.stations.map((station) => [station.station_id, station]),
    );
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
        const stagedStation =
          coverageView === "strategic"
            ? stationById.get(assignmentByUnit.get(unit.unit_id) ?? "")
            : null;
        return {
          id: unit.unit_id,
          layer: "units" as const,
          longitude: stagedStation?.longitude ?? unit.current_longitude,
          latitude: stagedStation?.latitude ?? unit.current_latitude,
          title: unavailable
            ? `${unit.unit_id} not eligible: ${eligibility?.reasons[0]}`
            : stagedStation
              ? `${unit.unit_id} simulated at ${stagedStation.name} recommended staging`
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
      // Every meeting spot is a purple dot (see the meeting-spot layer); only the
      // recommended one also gets a highlighted marker.
      ...(recommendedSpot
        ? [
            {
              id: recommendedSpot.rendezvous_id,
              layer: "rendezvous" as const,
              longitude: recommendedSpot.longitude,
              latitude: recommendedSpot.latitude,
              title: `${recommendedSpot.rendezvous_name} recommended meeting spot`,
              type: "rendezvous" as const,
              variant:
                coverageView === "strategic" && showRoutePreview
                  ? "rendezvous-active"
                  : "rendezvous-recommended",
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
    showRoutePreview,
    visibleLayers,
  ]);

  // Every catalog meeting spot as a purple dot. A map layer, not DOM markers, so thousands
  // of places stay fast and never drift while panning.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || loadedMapRef.current !== map) {
      return;
    }
    const data = meetingSpotCollection(visibleLayers.rendezvous ? meetingSpots : []);
    const source = map.getSource(MEETING_SPOT_LAYER) as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource(MEETING_SPOT_LAYER, { type: "geojson", data });
    map.addLayer(
      {
        id: MEETING_SPOT_LAYER,
        type: "circle",
        source: MEETING_SPOT_LAYER,
        paint: {
          "circle-color": "#9d80d8",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 1.6, 11, 2.6, 14, 4.5, 17, 7],
          "circle-opacity": 0.85,
          "circle-stroke-color": "#1a1024",
          "circle-stroke-width": 0.6,
        },
      },
      // Keep the dots under any route lines already drawn.
      Object.values(ROUTE_SOURCE_IDS).find((id) => map.getLayer(id)),
    );
    map.on("mouseenter", MEETING_SPOT_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", MEETING_SPOT_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("click", MEETING_SPOT_LAYER, (event) => {
      const feature = event.features?.[0] as unknown as
        | { geometry: { coordinates: [number, number] }; properties: { name?: string; category?: MeetingSpot["category"] } }
        | undefined;
      if (!feature) return;
      const category = (feature.properties.category && CATEGORY_LABELS[feature.properties.category]) || "Meeting spot";
      const name = feature.properties.name || category;
      new mapboxgl.Popup({ className: "meeting-spot-popup", closeButton: false, offset: 8 })
        .setLngLat(feature.geometry.coordinates)
        .setHTML(
          `<strong>${escapeHtml(name)}</strong><span>${escapeHtml(category)} · possible meeting spot</span>`,
        )
        .addTo(map);
    });
  }, [meetingSpots, styleReady, visibleLayers.rendezvous]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || loadedMapRef.current !== map) {
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
        color: routePreview?.ambulanceToRendezvous ? "#8b5cf6" : "#2f86eb",
        width: 5,
        dasharray: routePreview?.ambulanceToRendezvous ? [1.2, 1.2] : undefined,
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
        // A leg's look depends on the plan (e.g. purple after a meeting spot), so refresh it.
        map.setPaintProperty(entry.sourceId, "line-color", entry.color);
        map.setPaintProperty(entry.sourceId, "line-width", entry.width);
        map.setPaintProperty(entry.sourceId, "line-dasharray", entry.dasharray ?? undefined);
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

  const directRoute = routePreview?.ambulanceToHospital;
  const hasRendezvousRoute = Boolean(routePreview?.ambulanceToRendezvous);
  const recommendedCandidate = rendezvous?.candidates.find(
    (candidate) => candidate.status === "RECOMMENDED",
  );
  const ambulanceToMeetingMinutes =
    recommendedCandidate?.patient_to_rendezvous_minutes ??
    routePreview?.ambulanceToRendezvous?.duration_minutes;
  const meetingToHospitalMinutes =
    recommendedCandidate?.rendezvous_to_hospital_minutes ?? directRoute?.duration_minutes;

  return (
    <>
      <div className="map-canvas" ref={containerRef} />
      {showRoutePreview && routePreview ? (
        <div className="map-route-key" aria-label="Selected incident route preview">
          {hasRendezvousRoute ? (
            <>
              <strong className="map-route-key__mode">Recommended staging simulation</strong>
              <span className="map-route-key__row">
                <i className="map-route-key__line map-route-key__line--ambulance" />
                <span>Ambulance to meeting spot</span>
                <b>{ambulanceToMeetingMinutes} min</b>
              </span>
              <span className="map-route-key__row">
                <i className="map-route-key__line map-route-key__line--hospital" />
                <span>Meeting spot to hospital</span>
                <b>{meetingToHospitalMinutes} min</b>
              </span>
            </>
          ) : (
            <span className="map-route-key__row">
              <i className="map-route-key__line map-route-key__line--ambulance" />
              <span>Ambulance to hospital</span>
              <b>{directRoute?.duration_minutes} min</b>
            </span>
          )}
        </div>
      ) : null}
    </>
  );
}
