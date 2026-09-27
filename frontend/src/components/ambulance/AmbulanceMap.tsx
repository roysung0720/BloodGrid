"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

import type { LngLat, Position } from "../../lib/navigation";
import { applyBrandMap, BRAND_MAP_STYLE } from "../../lib/brandMap";
import { Glide, lerpAngle } from "../../lib/glide";
import { formatMinutes } from "../../lib/navigation";
import type { HospitalOption, ResourceOption } from "../../lib/types";

/** The blood unit assigned to the request, shown moving along its own route. */
export type MovingResource = {
  unitId: string;
  longitude: number;
  latitude: number;
  heading: number | null;
  label: string;
};

/**
 * idle: frame the ambulance with nearby resources and hospitals (north up).
 * preview: frame the whole planned route (north up).
 * navigate: follow the vehicle, rotated so travel direction points up.
 * watch: keep both vehicles and the rendezvous point in frame as they move (north up).
 */
export type CameraMode = "idle" | "preview" | "navigate" | "watch";

type AmbulanceMapProps = {
  position: Position | null;
  camera: CameraMode;
  follow: boolean;
  onUserPan: () => void;
  /** Pixels covered by overlays at the top and bottom of the map. */
  insets: { top: number; bottom: number };
  resources: ResourceOption[];
  movingResource: MovingResource | null;
  hospitals: HospitalOption[];
  destinationHospitalId: string | null;
  rendezvousPoint: { longitude: number; latitude: number; name: string } | null;
  activeRoute: LngLat[] | null;
  /** Road already driven: kept on the map in a dull red. */
  drivenRoute: LngLat[][];
  upcomingRoute: LngLat[] | null;
  resourceRoute: LngLat[] | null;
  watchPoints: LngLat[];
};

const ROUTE_SOURCES = ["resource-route", "upcoming-route", "driven-route", "active-route"] as const;
const NAVIGATION_ZOOM = 16;
const NAVIGATION_PITCH = 45;
const SIDE_PADDING = 40;
const ARROW_SVG =
  '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 2 20 21 12 16.5 4 21Z" /></svg>';

function lineFeature(coordinates: LngLat[] | null) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: coordinates ?? [] },
  };
}

function multiLineFeature(lines: LngLat[][]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "MultiLineString" as const, coordinates: lines },
  };
}

function markerElement(className: string, label?: string) {
  const element = document.createElement("div");
  element.className = className;
  if (label) {
    element.textContent = label;
  }
  return element;
}

function mapStyle() {
  return BRAND_MAP_STYLE;
}

export function AmbulanceMap({
  position,
  camera,
  follow,
  onUserPan,
  insets,
  resources,
  movingResource,
  hospitals,
  destinationHospitalId,
  rendezvousPoint,
  activeRoute,
  drivenRoute,
  upcomingRoute,
  resourceRoute,
  watchPoints,
}: AmbulanceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const selfMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resourceMarkersRef = useRef(new Map<string, mapboxgl.Marker>());
  const hospitalMarkersRef = useRef(new Map<string, mapboxgl.Marker>());
  const rendezvousMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const onUserPanRef = useRef(onUserPan);
  const [styleReady, setStyleReady] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    onUserPanRef.current = onUserPan;
  }, [onUserPan]);

  // Create the map once; later effects only move markers, lines, and the camera.
  useEffect(() => {
    if (!containerRef.current || !token) {
      return;
    }
    const map = new mapboxgl.Map({
      accessToken: token,
      container: containerRef.current,
      style: mapStyle(),
      center: [-83.6, 34.15],
      zoom: 11,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    map.on("dragstart", () => onUserPanRef.current());
    map.on("style.load", () => {
      applyBrandMap(map, "subtle");
      for (const sourceId of ROUTE_SOURCES) {
        map.addSource(sourceId, { type: "geojson", data: lineFeature(null) });
      }
      map.addLayer({
        id: "resource-route",
        type: "line",
        source: "resource-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#b39ce6", "line-width": 5, "line-opacity": 0.9, "line-dasharray": [0.8, 1.6] },
      });
      map.addLayer({
        id: "upcoming-route",
        type: "line",
        source: "upcoming-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#d8d8e0", "line-width": 5, "line-opacity": 0.55, "line-dasharray": [1, 1.4] },
      });
      map.addLayer({
        id: "driven-route",
        type: "line",
        source: "driven-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#a3444b", "line-width": 7, "line-opacity": 0.75 },
      });
      map.addLayer({
        id: "active-route-casing",
        type: "line",
        source: "active-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#3d0509", "line-width": 12 },
      });
      map.addLayer({
        id: "active-route",
        type: "line",
        source: "active-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ff4d57", "line-width": 7 },
      });
      setStyleReady(true);
    });
    mapRef.current = map;

    const resourceMarkers = resourceMarkersRef.current;
    const hospitalMarkers = hospitalMarkersRef.current;
    return () => {
      resourceMarkers.clear();
      hospitalMarkers.clear();
      selfMarkerRef.current = null;
      rendezvousMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  // ----- Smooth motion ----------------------------------------------------------
  // Positions arrive a few times a second. Each vehicle glides toward its newest
  // position on every animation frame, so it moves continuously instead of jumping.
  const selfGlide = useRef(new Glide());
  const resourceGlide = useRef(new Glide());
  const movingIdRef = useRef<string | null>(null);
  const viewRef = useRef({ camera, follow, insets });
  useEffect(() => {
    viewRef.current = { camera, follow, insets };
  }, [camera, follow, insets]);

  useEffect(() => {
    if (position) {
      selfGlide.current.setTarget(position);
    }
  }, [position]);

  useEffect(() => {
    movingIdRef.current = movingResource?.unitId ?? null;
    if (movingResource) {
      resourceGlide.current.setTarget(movingResource);
    }
  }, [movingResource]);

  // One frame loop draws the ambulance, the moving blood unit, and the navigate camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    let frame = 0;
    let navigating = false;
    const smoothed = { bearing: 0, zoom: 0, pitch: 0 };

    const step = (now: number) => {
      const self = selfGlide.current.sample(now);
      if (self) {
        if (!selfMarkerRef.current) {
          const element = markerElement("amb-self");
          element.innerHTML = ARROW_SVG;
          // Rotation is relative to the map, so the arrow points along the road.
          selfMarkerRef.current = new mapboxgl.Marker({
            element,
            rotationAlignment: "map",
            pitchAlignment: "map",
          })
            .setLngLat([self.longitude, self.latitude])
            .addTo(map);
        }
        selfMarkerRef.current
          .setLngLat([self.longitude, self.latitude])
          .setRotation(self.heading ?? 0);

        // Navigate camera: heading-up, tilted, vehicle low on screen so the road ahead shows.
        const view = viewRef.current;
        if (view.camera === "navigate" && view.follow) {
          if (!navigating) {
            smoothed.bearing = map.getBearing();
            smoothed.zoom = map.getZoom();
            smoothed.pitch = map.getPitch();
            navigating = true;
          }
          // Ease bearing, zoom, and tilt toward their targets so turns feel gradual.
          smoothed.bearing = lerpAngle(smoothed.bearing, self.heading ?? smoothed.bearing, 0.12);
          smoothed.zoom += (NAVIGATION_ZOOM - smoothed.zoom) * 0.08;
          smoothed.pitch += (NAVIGATION_PITCH - smoothed.pitch) * 0.08;
          const height = map.getContainer().clientHeight;
          const visible = Math.max(0, height - view.insets.top - view.insets.bottom);
          map.jumpTo({
            center: [self.longitude, self.latitude],
            bearing: smoothed.bearing,
            zoom: smoothed.zoom,
            pitch: smoothed.pitch,
            padding: {
              top: view.insets.top + visible * 0.45,
              bottom: view.insets.bottom,
              left: SIDE_PADDING,
              right: SIDE_PADDING,
            },
          });
        } else {
          navigating = false;
        }
      }

      const movingId = movingIdRef.current;
      const resource = movingId ? resourceGlide.current.sample(now) : null;
      if (movingId && resource) {
        resourceMarkersRef.current.get(movingId)?.setLngLat([resource.longitude, resource.latitude]);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [token]);

  // Keep the Mapbox logo and attribution visible above the bottom panel.
  useEffect(() => {
    containerRef.current?.style.setProperty("--amb-bottom-inset", `${insets.bottom}px`);
  }, [insets.bottom]);

  // Watch camera: re-frame both moving vehicles and the meeting point every tick.
  const watchKey = watchPoints.map((point) => point.map((value) => value.toFixed(5)).join(",")).join(";");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow || camera !== "watch" || watchPoints.length === 0) {
      return;
    }
    const bounds = new mapboxgl.LngLatBounds(watchPoints[0], watchPoints[0]);
    for (const point of watchPoints) {
      bounds.extend(point);
    }
    map.fitBounds(bounds, {
      padding: {
        top: insets.top + 40,
        bottom: insets.bottom + 40,
        left: SIDE_PADDING + 30,
        right: SIDE_PADDING + 30,
      },
      bearing: 0,
      pitch: 0,
      maxZoom: 15,
      duration: 300,
      easing: (t) => t,
    });
    // watchKey captures every coordinate change; watchPoints itself is a new array each render.
  }, [watchKey, follow, camera, insets.top, insets.bottom]);

  // Idle and preview cameras: frame everything that matters, north up.
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  const hasPosition = position !== null;
  useEffect(() => {
    const map = mapRef.current;
    const current = positionRef.current;
    if (!map || !current || !follow || camera === "navigate" || camera === "watch") {
      return;
    }
    const bounds = new mapboxgl.LngLatBounds(
      [current.longitude, current.latitude],
      [current.longitude, current.latitude],
    );
    if (camera === "idle") {
      for (const item of [...resources, ...hospitals]) {
        bounds.extend([item.longitude, item.latitude]);
      }
    } else {
      for (const line of [activeRoute, upcomingRoute, resourceRoute]) {
        for (const point of line ?? []) {
          bounds.extend(point);
        }
      }
      if (rendezvousPoint) {
        bounds.extend([rendezvousPoint.longitude, rendezvousPoint.latitude]);
      }
    }
    map.fitBounds(bounds, {
      padding: {
        top: insets.top + 30,
        bottom: insets.bottom + 30,
        left: SIDE_PADDING + 20,
        right: SIDE_PADDING + 20,
      },
      bearing: 0,
      pitch: 0,
      maxZoom: 14,
      duration: 700,
    });
  }, [
    camera,
    follow,
    hasPosition,
    insets.top,
    insets.bottom,
    resources,
    hospitals,
    activeRoute,
    upcomingRoute,
    resourceRoute,
    rendezvousPoint,
  ]);

  // Blood Response Unit blips. The unit assigned to this request moves on its route.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const markers = resourceMarkersRef.current;
    const seen = new Set<string>();
    for (const resource of resources) {
      seen.add(resource.unit_id);
      const moving = movingResource?.unitId === resource.unit_id ? movingResource : null;
      const lngLat: LngLat = moving
        ? [moving.longitude, moving.latitude]
        : [resource.longitude, resource.latitude];
      const popupText = resource.eligible
        ? `${resource.unit_id}: ${formatMinutes(resource.arrival_minutes)} to you` +
          (resource.crew_status === "ON_CALL" ? " (includes on-call mobilization)" : "")
        : `${resource.unit_id}: not eligible. ${resource.reasons.join("; ")}`;

      let marker = markers.get(resource.unit_id);
      if (!marker) {
        marker = new mapboxgl.Marker({ element: markerElement("amb-blip", resource.unit_id) })
          .setLngLat(lngLat)
          .setPopup(new mapboxgl.Popup({ offset: 16, closeButton: false }))
          .addTo(map);
        markers.set(resource.unit_id, marker);
      }
      // Toggle only our own classes; Mapbox keeps its positioning classes on the element.
      const classes = marker.getElement().classList;
      classes.toggle("amb-blip--eligible", resource.eligible && !moving);
      classes.toggle("amb-blip--ineligible", !resource.eligible);
      classes.toggle("amb-blip--assigned", moving !== null);
      // The assigned unit shows its live status, e.g. "BR-02 · 7 min" or "BR-02 · mobilizing".
      const text = moving ? moving.label : resource.unit_id;
      if (marker.getElement().textContent !== text) {
        marker.getElement().textContent = text;
      }
      // The moving unit is positioned by the frame loop (smooth glide); the rest sit still.
      if (!moving) {
        marker.setLngLat(lngLat);
      }
      marker.getPopup()?.setText(popupText);
    }
    for (const [unitId, marker] of markers) {
      if (!seen.has(unitId)) {
        marker.remove();
        markers.delete(unitId);
      }
    }
  }, [resources, movingResource]);

  // Neutral hospital markers; the crew's chosen destination is filled in.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const markers = hospitalMarkersRef.current;
    for (const hospital of hospitals) {
      let marker = markers.get(hospital.hospital_id);
      if (!marker) {
        const element = markerElement("amb-hospital", "H");
        element.title = hospital.name;
        marker = new mapboxgl.Marker({ element })
          .setLngLat([hospital.longitude, hospital.latitude])
          .addTo(map);
        markers.set(hospital.hospital_id, marker);
      }
      marker
        .getElement()
        .classList.toggle("amb-hospital--destination", hospital.hospital_id === destinationHospitalId);
    }
  }, [hospitals, destinationHospitalId]);

  // The meeting spot chosen for this request, when there is one.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    rendezvousMarkerRef.current?.remove();
    rendezvousMarkerRef.current = null;
    if (rendezvousPoint) {
      const element = markerElement("amb-rendezvous", "P");
      element.title = rendezvousPoint.name;
      rendezvousMarkerRef.current = new mapboxgl.Marker({ element })
        .setLngLat([rendezvousPoint.longitude, rendezvousPoint.latitude])
        .addTo(map);
    }
  }, [rendezvousPoint]);

  // Route lines.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) {
      return;
    }
    const data = {
      "active-route": lineFeature(activeRoute),
      "upcoming-route": lineFeature(upcomingRoute),
      "resource-route": lineFeature(resourceRoute),
      "driven-route": multiLineFeature(drivenRoute),
    };
    for (const sourceId of ROUTE_SOURCES) {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined)?.setData(data[sourceId]);
    }
  }, [activeRoute, drivenRoute, upcomingRoute, resourceRoute, styleReady]);

  if (!token) {
    return (
      <div className="map-token-missing">
        Mapbox token not found. Add `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to the project `.env`
        file and restart the frontend.
      </div>
    );
  }

  return <div className="amb-map" ref={containerRef} />;
}
