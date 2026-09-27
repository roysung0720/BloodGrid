// Display-only geometry for the Ambulance UI: where the vehicle is along a drawn
// route and which turn comes next. No logistics decisions are made here.

import type { RouteResult, RouteStep } from "./types";

export type LngLat = [number, number];

export type Position = {
  latitude: number;
  longitude: number;
  heading: number | null;
};

export type PreparedRoute = {
  route: RouteResult;
  cumulativeMeters: number[];
  lengthMeters: number;
  stepStartMeters: number[];
};

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function distanceMeters(a: LngLat, b: LngLat) {
  const phiA = toRadians(a[1]);
  const phiB = toRadians(b[1]);
  const deltaPhi = phiB - phiA;
  const deltaLambda = toRadians(b[0] - a[0]);
  const h =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phiA) * Math.cos(phiB) * Math.sin(deltaLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(a: LngLat, b: LngLat) {
  const phiA = toRadians(a[1]);
  const phiB = toRadians(b[1]);
  const deltaLambda = toRadians(b[0] - a[0]);
  const y = Math.sin(deltaLambda) * Math.cos(phiB);
  const x =
    Math.cos(phiA) * Math.sin(phiB) -
    Math.sin(phiA) * Math.cos(phiB) * Math.cos(deltaLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function prepareRoute(route: RouteResult): PreparedRoute {
  const cumulativeMeters = [0];
  for (let index = 1; index < route.geometry.length; index += 1) {
    cumulativeMeters.push(
      cumulativeMeters[index - 1] +
        distanceMeters(route.geometry[index - 1], route.geometry[index]),
    );
  }
  const lengthMeters = cumulativeMeters[cumulativeMeters.length - 1] || 1;
  // Scale provider step distances onto the drawn geometry so both agree.
  const stepTotal =
    route.steps.reduce((total, step) => total + step.distance_meters, 0) || lengthMeters;
  const stepStartMeters: number[] = [];
  let running = 0;
  for (const step of route.steps) {
    stepStartMeters.push((running / stepTotal) * lengthMeters);
    running += step.distance_meters;
  }
  return { route, cumulativeMeters, lengthMeters, stepStartMeters };
}

const HEADING_LOOKAHEAD_METERS = 40;

/** Point at a fraction (0-1) of the way along the route, facing a point slightly ahead. */
export function pointAlong(prepared: PreparedRoute, fraction: number): Position {
  const here = rawPointAlong(prepared, fraction);
  const ahead = rawPointAlong(
    prepared,
    fraction + HEADING_LOOKAHEAD_METERS / prepared.lengthMeters,
  );
  const separation = distanceMeters(
    [here.longitude, here.latitude],
    [ahead.longitude, ahead.latitude],
  );
  return separation < 1
    ? here
    : {
        ...here,
        heading: bearingDegrees([here.longitude, here.latitude], [ahead.longitude, ahead.latitude]),
      };
}

function rawPointAlong(prepared: PreparedRoute, fraction: number): Position {
  const { route, cumulativeMeters, lengthMeters } = prepared;
  const target = Math.max(0, Math.min(1, fraction)) * lengthMeters;
  let index = 1;
  while (index < cumulativeMeters.length - 1 && cumulativeMeters[index] < target) {
    index += 1;
  }
  const start = route.geometry[index - 1];
  const end = route.geometry[index];
  const segment = cumulativeMeters[index] - cumulativeMeters[index - 1] || 1;
  const t = Math.max(0, Math.min(1, (target - cumulativeMeters[index - 1]) / segment));
  return {
    longitude: start[0] + (end[0] - start[0]) * t,
    latitude: start[1] + (end[1] - start[1]) * t,
    heading: bearingDegrees(start, end),
  };
}

/** Meters travelled along the route, by projecting a position onto its nearest segment. */
export function progressMeters(prepared: PreparedRoute, position: LngLat) {
  return projectOntoRoute(prepared, position).progress;
}

/** Split a route at a distance along it into the part already driven and the part ahead. */
export function splitRoute(prepared: PreparedRoute, progress: number): [LngLat[], LngLat[]] {
  const { route, cumulativeMeters, lengthMeters } = prepared;
  const target = Math.max(0, Math.min(lengthMeters, progress));
  let index = 1;
  while (index < cumulativeMeters.length - 1 && cumulativeMeters[index] < target) {
    index += 1;
  }
  const here = rawPointAlong(prepared, target / lengthMeters);
  const cut: LngLat = [here.longitude, here.latitude];
  return [
    [...route.geometry.slice(0, index), cut],
    [cut, ...route.geometry.slice(index)],
  ];
}

const DIFFERENT_ROUTE_METERS = 120;

/** True when a candidate route leaves the current route somewhere along its length. */
export function routeDiffers(candidate: RouteResult, current: PreparedRoute) {
  const prepared = prepareRoute(candidate);
  return [0.25, 0.5, 0.75].some((fraction) => {
    const sample = pointAlong(prepared, fraction);
    return (
      projectOntoRoute(current, [sample.longitude, sample.latitude]).offRouteMeters >
      DIFFERENT_ROUTE_METERS
    );
  });
}

function projectOntoRoute(prepared: PreparedRoute, position: LngLat) {
  const { route, cumulativeMeters } = prepared;
  const cosLat = Math.cos(toRadians(position[1]));
  let best = { distance: Infinity, progress: 0 };
  for (let index = 1; index < route.geometry.length; index += 1) {
    const a = route.geometry[index - 1];
    const b = route.geometry[index];
    // Flat projection is accurate enough over one road segment.
    const ax = a[0] * cosLat;
    const bx = b[0] * cosLat;
    const px = position[0] * cosLat;
    const dx = bx - ax;
    const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (position[1] - a[1]) * dy) / lengthSquared));
    const projected: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const offRoute = distanceMeters(position, projected);
    if (offRoute < best.distance) {
      best = {
        distance: offRoute,
        progress:
          cumulativeMeters[index - 1] + (cumulativeMeters[index] - cumulativeMeters[index - 1]) * t,
      };
    }
  }
  return { progress: best.progress, offRouteMeters: best.distance };
}

export type UpcomingManeuver = {
  step: RouteStep | null;
  metersToManeuver: number;
  remainingFraction: number;
};

export function upcomingManeuver(prepared: PreparedRoute, progress: number): UpcomingManeuver {
  const { route, stepStartMeters, lengthMeters } = prepared;
  const nextIndex = stepStartMeters.findIndex(
    (start, index) => index > 0 && start > progress + 5,
  );
  const remainingFraction = Math.max(0, 1 - progress / lengthMeters);
  if (nextIndex === -1) {
    const last = route.steps[route.steps.length - 1] ?? null;
    return { step: last, metersToManeuver: Math.max(0, lengthMeters - progress), remainingFraction };
  }
  return {
    step: route.steps[nextIndex],
    metersToManeuver: stepStartMeters[nextIndex] - progress,
    remainingFraction,
  };
}

export function formatDistance(meters: number) {
  const miles = meters / METERS_PER_MILE;
  if (miles >= 0.1) {
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
  }
  return `${Math.max(50, Math.round((meters * FEET_PER_METER) / 50) * 50)} ft`;
}

export function formatMinutes(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) {
    return "--";
  }
  return minutes < 1 ? "<1 min" : `${Math.round(minutes)} min`;
}
