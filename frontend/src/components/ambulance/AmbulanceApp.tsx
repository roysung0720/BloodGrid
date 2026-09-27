"use client";

import {
  Ambulance,
  Database,
  Eye,
  LayoutDashboard,
  LocateFixed,
  Navigation,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  cancelBloodRequest,
  createBloodRequest,
  getAmbulanceSettings,
  getAmbulances,
  getBloodProducts,
  getBloodRequest,
  getHospitalOptions,
  getResourceOptions,
  getRoute,
  getRouteOptions,
  markBloodReceived,
  reportPosition,
} from "../../lib/ambulanceApi";
import type { LngLat, Position, PreparedRoute } from "../../lib/navigation";
import {
  bearingDegrees,
  distanceMeters,
  formatMinutes,
  pointAlong,
  prepareRoute,
  progressMeters,
  routeDiffers,
  upcomingManeuver,
} from "../../lib/navigation";
import type {
  AmbulanceOption,
  AmbulanceSettings,
  BloodProductOption,
  BloodRequest,
  HospitalOption,
  ResourceOption,
  RouteResult,
} from "../../lib/types";
import type { CameraMode, MovingResource } from "./AmbulanceMap";
import { spotLabel } from "../../lib/meetingSpots";
import { BrandLogo } from "../BrandLogo";
import { AmbulanceMap } from "./AmbulanceMap";
import type { RouteChoice } from "./NavigationPanels";
import { ArrivedBar, ManeuverBanner, NavBar, RouteOverviewCard } from "./NavigationPanels";
import { RequestSheet } from "./RequestSheet";

type AmbulanceAppProps = {
  unitId: string | null;
  simulated: boolean;
  availabilityProfile: string;
  /** Versioned scenario (null = the backend's startup default). */
  scenarioId: string | null;
};

type Phase = "idle" | "sheet" | "preview" | "navigating" | "arrived";
type Leg = "rendezvous" | "hospital";

/**
 * Leg timing comes from the backend evaluator, so ETAs match the System UI plan.
 * startSim is the simulation-clock second at which this leg began.
 */
type ActiveLeg = { leg: Leg; route: PreparedRoute; minutes: number; startSim: number };

/**
 * Simulation clock in modeled seconds since Start navigation. Changing the demo speed
 * re-anchors it, so neither vehicle jumps when the speed changes.
 */
type SimClock = { baseSeconds: number; since: number; multiplier: number };

function simSeconds(clock: SimClock | null, now: number) {
  return clock ? clock.baseSeconds + ((now - clock.since) / 1000) * clock.multiplier : 0;
}

const MANEUVER_BANNER_INSET = 84;
const REUSE_ROUTE_WITHIN_METERS = 150;
const DEMO_SPEEDS = [1, 2, 5, 10];
const TOAST_MILLISECONDS = 5000;
const END_CONFIRM_MILLISECONDS = 3000;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useGeolocation(enabled: boolean) {
  const [state, setState] = useState<{ position: Position | null; error: string | null }>({
    position: null,
    error: null,
  });
  const previous = useRef<Position | null>(null);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (!navigator.geolocation) {
      setState({ position: null, error: "This browser has no location service." });
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (reading) => {
        const next: LngLat = [reading.coords.longitude, reading.coords.latitude];
        const last = previous.current;
        // Prefer the device heading; otherwise derive it from movement.
        let heading = reading.coords.heading ?? null;
        if (heading === null && last) {
          heading =
            distanceMeters([last.longitude, last.latitude], next) > 5
              ? bearingDegrees([last.longitude, last.latitude], next)
              : last.heading;
        }
        const position = { latitude: next[1], longitude: next[0], heading };
        previous.current = position;
        setState({ position, error: null });
      },
      (error) =>
        setState((current) => ({
          ...current,
          error:
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied. GPS also needs HTTPS or localhost."
              : "Location unavailable.",
        })),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);
  return state;
}

/** Tracks an overlay's height so the map can keep the vehicle out from under it. */
function useElementHeight<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, height] as const;
}

export function AmbulanceApp({
  unitId,
  simulated,
  availabilityProfile,
  scenarioId,
}: AmbulanceAppProps) {
  const [settings, setSettings] = useState<AmbulanceSettings | null>(null);
  const [ambulances, setAmbulances] = useState<AmbulanceOption[] | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [hospitals, setHospitals] = useState<HospitalOption[] | null>(null);
  const [products, setProducts] = useState<BloodProductOption[] | null>(null);
  const [sheetLoadError, setSheetLoadError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [request, setRequest] = useState<BloodRequest | null>(null);
  const [routeToPoint, setRouteToPoint] = useState<PreparedRoute | null>(null);
  const [routeToHospital, setRouteToHospital] = useState<PreparedRoute | null>(null);
  const [resourceRoute, setResourceRoute] = useState<PreparedRoute | null>(null);
  const [activeLeg, setActiveLeg] = useState<ActiveLeg | null>(null);
  const [clock, setClock] = useState<SimClock | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeMenu, setRouteMenu] = useState<{
    loading: boolean;
    from: Position;
    options: RouteResult[];
    choices: RouteChoice[] | null;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [demoSpeed, setDemoSpeed] = useState<number | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [watchResource, setWatchResource] = useState(false);
  const [endArmed, setEndArmed] = useState(false);

  const [anchor, setAnchor] = useState<Position | null>(null);
  const [follow, setFollow] = useState(true);
  const [bottomRef, bottomHeight] = useElementHeight<HTMLDivElement>();

  const ambulance = ambulances?.find((item) => item.unit_id === unitId) ?? null;
  // GPS always runs in real time; the demo speed only affects simulated driving.
  const speed = simulated ? demoSpeed ?? settings?.sim_speed_multiplier ?? 5 : 1;
  const now = useNow(phase === "navigating" ? 250 : 1000);
  const simNow = simSeconds(clock, now);
  const clockRef = useRef(clock);
  useEffect(() => {
    clockRef.current = clock;
  }, [clock]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MILLISECONDS);
    return () => window.clearTimeout(id);
  }, [toast]);

  // An armed End button quietly disarms if the second tap does not come.
  useEffect(() => {
    if (!endArmed) return;
    const id = window.setTimeout(() => setEndArmed(false), END_CONFIRM_MILLISECONDS);
    return () => window.clearTimeout(id);
  }, [endArmed]);

  function changeSpeed(next: number) {
    setDemoSpeed(next);
    setDemoOpen(false);
    const at = Date.now();
    setClock((current) =>
      current ? { baseSeconds: simSeconds(current, at), since: at, multiplier: next } : current,
    );
  }
  const gps = useGeolocation(!simulated);

  const candidate =
    request?.rendezvous.candidates.find((item) => item.status === "RECOMMENDED") ?? null;
  const isIntercept = request?.rendezvous.recommendation === "RENDEZVOUS" && candidate !== null;
  // The meeting spot comes straight from the backend rule's recommended option.
  const spotRoad =
    routeToPoint?.route.steps
      .slice()
      .reverse()
      .find((step) => step.road_name)?.road_name ?? null;
  const displayCandidate = candidate
    ? { ...candidate, rendezvous_name: spotLabel(candidate, spotRoad) }
    : null;
  const rendezvousPoint =
    request && isIntercept && displayCandidate
      ? {
          latitude: displayCandidate.latitude,
          longitude: displayCandidate.longitude,
          name: displayCandidate.rendezvous_name,
        }
      : null;

  // ----- Initial data -------------------------------------------------------------
  useEffect(() => {
    Promise.all([getAmbulanceSettings(), getAmbulances(scenarioId)])
      .then(([loadedSettings, loadedAmbulances]) => {
        setSettings(loadedSettings);
        setAmbulances(loadedAmbulances);
      })
      .catch((error: Error) => setConnectionError(error.message));
  }, [scenarioId]);

  useEffect(() => {
    if (ambulance && !anchor) {
      setAnchor({
        latitude: ambulance.start_latitude,
        longitude: ambulance.start_longitude,
        heading: null,
      });
    }
  }, [ambulance, anchor]);

  // ----- Where the ambulance is ----------------------------------------------------
  const legFraction = activeLeg
    ? (simNow - activeLeg.startSim) / Math.max(1, activeLeg.minutes * 60)
    : null;

  const simPosition = useMemo<Position | null>(() => {
    if (activeLeg && legFraction !== null) {
      if (legFraction >= 1 && activeLeg.leg === "hospital" && request) {
        // The simulated vehicle pulls into the hospital entrance at the end of the route.
        return {
          latitude: request.destination_latitude,
          longitude: request.destination_longitude,
          heading: pointAlong(activeLeg.route, 1).heading,
        };
      }
      return pointAlong(activeLeg.route, legFraction);
    }
    return anchor;
  }, [activeLeg, anchor, legFraction, request]);

  const position = simulated ? simPosition : gps.position;
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  const hasPosition = position !== null;

  // ----- Nearby resources (blips) and hospital markers --------------------------
  useEffect(() => {
    if (!settings || !hasPosition) {
      return;
    }
    let cancelled = false;
    const refresh = () => {
      const current = positionRef.current;
      if (!current) return;
      getResourceOptions(current.latitude, current.longitude, scenarioId, availabilityProfile)
        .then((result) => !cancelled && setResources(result))
        .catch(() => undefined);
    };
    refresh();
    const id = window.setInterval(refresh, settings.eta_refresh_seconds * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [settings, hasPosition, scenarioId, availabilityProfile]);

  useEffect(() => {
    const current = positionRef.current;
    if (!hasPosition || !current || hospitals) {
      return;
    }
    getHospitalOptions(current.latitude, current.longitude, scenarioId, availabilityProfile)
      .then(setHospitals)
      .catch(() => undefined);
  }, [hasPosition, hospitals, scenarioId, availabilityProfile]);

  // ----- Request sheet --------------------------------------------------------------
  const loadSheetOptions = useCallback(() => {
    const current = positionRef.current;
    if (!current) return;
    setSheetLoadError(null);
    getBloodProducts(scenarioId, availabilityProfile)
      .then(setProducts)
      .catch((error: Error) => setSheetLoadError(error.message));
    getHospitalOptions(current.latitude, current.longitude, scenarioId, availabilityProfile)
      .then(setHospitals)
      .catch((error: Error) => setSheetLoadError(error.message));
  }, [scenarioId, availabilityProfile]);

  function openSheet() {
    setNotice(null);
    setSubmitError(null);
    setProducts(null);
    setHospitals(null);
    setPhase("sheet");
    loadSheetOptions();
  }

  useEffect(() => {
    if (phase !== "sheet" || !settings) return;
    const id = window.setInterval(loadSheetOptions, settings.eta_refresh_seconds * 1000);
    return () => window.clearInterval(id);
  }, [phase, settings, loadSheetOptions]);

  // ----- GO: create the request, then show the whole route before driving --------
  async function submitRequest(bloodProduct: string, hospitalId: string) {
    const current = positionRef.current;
    if (!unitId || !current) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createBloodRequest({
        unit_id: unitId,
        latitude: current.latitude,
        longitude: current.longitude,
        blood_product: bloodProduct,
        destination_hospital_id: hospitalId,
        availability_profile: availabilityProfile,
        scenario_id: scenarioId,
      });
      setRequest(created);
      setAnchor(current);
      setFollow(true);
      setRouteError(null);
      setPhase("preview");
      await loadPlanRoutes(created, current);
    } catch (error) {
      setSubmitError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function loadPlanRoutes(created: BloodRequest, from: Position) {
    const hospitalTarget = {
      latitude: created.destination_latitude,
      longitude: created.destination_longitude,
    };
    const plannedCandidate = created.rendezvous.candidates.find(
      (item) => item.status === "RECOMMENDED",
    );
    const point = plannedCandidate
      ? { latitude: plannedCandidate.latitude, longitude: plannedCandidate.longitude }
      : null;
    try {
      if (created.status === "ACTIVE_RENDEZVOUS" && point && plannedCandidate) {
        const unit = resources.find((item) => item.unit_id === plannedCandidate.resource_id);
        const [toPoint, toHospital, unitRoute] = await Promise.all([
          getRoute(from, point),
          getRoute(point, hospitalTarget),
          unit ? getRoute(unit, point) : Promise.resolve(null),
        ]);
        setRouteToPoint(prepareRoute(toPoint));
        setRouteToHospital(prepareRoute(toHospital));
        setResourceRoute(unitRoute ? prepareRoute(unitRoute) : null);
      } else {
        setRouteToPoint(null);
        setResourceRoute(null);
        setRouteToHospital(prepareRoute(await getRoute(from, hospitalTarget)));
      }
    } catch (error) {
      setRouteError((error as Error).message);
    }
  }

  // ----- Start navigation: only now does anything move --------------------------
  function startNavigation() {
    if (!request) return;
    setClock({ baseSeconds: 0, since: Date.now(), multiplier: speed });
    setRouteMenu(null);
    setWatchResource(false);
    setFollow(true);
    if (isIntercept && candidate && routeToPoint) {
      setActiveLeg({
        leg: "rendezvous",
        route: routeToPoint,
        minutes: candidate.patient_to_rendezvous_minutes ?? routeToPoint.route.duration_minutes,
        startSim: 0,
      });
    } else if (routeToHospital) {
      setActiveLeg({
        leg: "hospital",
        route: routeToHospital,
        minutes: request.rendezvous.direct_transport_minutes,
        startSim: 0,
      });
    }
    setPhase("navigating");
  }

  // ----- Reroute: same destination for this leg, a choice of different roads -------
  async function toggleRouteMenu() {
    if (routeMenu) {
      setRouteMenu(null);
      return;
    }
    const current = positionRef.current;
    if (!activeLeg || !current || !request) return;
    const target =
      activeLeg.leg === "rendezvous" && rendezvousPoint
        ? rendezvousPoint
        : { latitude: request.destination_latitude, longitude: request.destination_longitude };
    setRouteMenu({ loading: true, from: current, options: [], choices: null });
    try {
      const options = await getRouteOptions(current, target);
      // Keep the evaluator's calibration: its remaining time for this leg, scaled by how
      // long each road takes relative to the recommended road from this same spot.
      const remainingNow =
        activeLeg.minutes *
        upcomingManeuver(activeLeg.route, progressMeters(activeLeg.route, [current.longitude, current.latitude]))
          .remainingFraction;
      const reference = Math.max(0.1, options[0]?.duration_minutes ?? 1);
      const minutesFor = options.map((option) => remainingNow * (option.duration_minutes / reference));
      const fastest = Math.min(...minutesFor);
      const roadsFor = options.map(
        (option) => new Set(option.steps.map((step) => step.road_name).filter(Boolean)),
      );
      const choices: RouteChoice[] = options
        .map((option, index) => {
          // Label each option by a road that no other option uses.
          const others = new Set(roadsFor.filter((_, other) => other !== index).flatMap((set) => [...set]));
          const unique = option.steps.find((step) => step.road_name && !others.has(step.road_name));
          const main = option.steps.reduce(
            (best, step) => (step.road_name && step.distance_meters > best.distance ? { name: step.road_name, distance: step.distance_meters } : best),
            { name: "", distance: 0 },
          );
          return {
            key: String(index),
            label: `via ${unique?.road_name || main.name || "local roads"}`,
            minutes: minutesFor[index],
            miles: option.distance_miles,
            fastest: minutesFor[index] === fastest,
            current: !routeDiffers(option, activeLeg.route),
          };
        })
        .sort((a, b) => a.minutes - b.minutes);
      setRouteMenu((menu) => (menu ? { loading: false, from: current, options, choices } : menu));
    } catch (error) {
      setRouteMenu(null);
      setToast((error as Error).message);
    }
  }

  function pickRoute(key: string) {
    if (!routeMenu || !activeLeg) return;
    const choice = routeMenu.choices?.find((item) => item.key === key);
    const option = routeMenu.options[Number(key)];
    if (!choice || !option) return;
    // The chosen road starts where the options were looked up.
    setAnchor(routeMenu.from);
    setActiveLeg({
      leg: activeLeg.leg,
      route: prepareRoute(option),
      minutes: choice.minutes,
      startSim: simSeconds(clockRef.current, Date.now()),
    });
    setRouteMenu(null);
    setToast(`Rerouted ${choice.label}: ${formatMinutes(choice.minutes)}.`);
  }

  const resetToIdle = useCallback((message: string | null) => {
    setAnchor(positionRef.current);
    setRequest(null);
    setRouteToPoint(null);
    setRouteToHospital(null);
    setResourceRoute(null);
    setActiveLeg(null);
    setClock(null);
    setRouteMenu(null);
    setRouteError(null);
    setHospitals(null);
    setPhase("idle");
    setNotice(message);
  }, []);

  async function confirmBloodReceived() {
    if (!request) return;
    setBusy(true);
    try {
      const updated = await markBloodReceived(request.request_id);
      setRouteMenu(null);
      setRequest(updated);
      setWatchResource(false);
      const current = positionRef.current;
      const hospitalTarget = {
        latitude: updated.destination_latitude,
        longitude: updated.destination_longitude,
      };
      // Reuse the planned rendezvous-to-hospital route when the vehicle is at the point.
      let route = routeToHospital;
      let minutes = candidate?.rendezvous_to_hospital_minutes ?? route?.route.duration_minutes ?? 0;
      const planStart = route?.route.geometry[0];
      if (
        !route ||
        !current ||
        !planStart ||
        distanceMeters(planStart, [current.longitude, current.latitude]) > REUSE_ROUTE_WITHIN_METERS
      ) {
        const fresh = await getRoute(current ?? hospitalTarget, hospitalTarget);
        route = prepareRoute(fresh);
        minutes = fresh.duration_minutes;
        setRouteToHospital(route);
      }
      setAnchor(current);
      setActiveLeg({ leg: "hospital", route, minutes, startSim: simSeconds(clockRef.current, Date.now()) });
    } catch (error) {
      setRouteError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // End needs two taps: the first arms the button for a few seconds, the second ends it.
  async function endRequest() {
    if (!request) return;
    if (!endArmed) {
      setEndArmed(true);
      return;
    }
    setEndArmed(false);
    setBusy(true);
    try {
      await cancelBloodRequest(request.request_id, "crew");
      resetToIdle("Request ended.");
    } catch (error) {
      setRouteError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ----- Keep BloodGrid informed, and notice changes made by operations ----------
  const requestId = request?.request_id ?? null;
  const applyServerState = useCallback(
    (updated: BloodRequest) => {
      setRequest(updated);
      if (updated.status === "ARRIVED") {
        setPhase("arrived");
      } else if (updated.status === "CANCELLED") {
        resetToIdle(
          updated.ended_reason === "Cancelled by operations."
            ? "Request cancelled by operations."
            : updated.ended_reason,
        );
      }
    },
    [resetToIdle],
  );

  useEffect(() => {
    if (phase !== "navigating" || !settings || !requestId) return;
    const id = window.setInterval(() => {
      const current = positionRef.current;
      if (!current) return;
      reportPosition(requestId, current.latitude, current.longitude)
        .then(applyServerState)
        .catch(() => undefined);
    }, settings.position_report_seconds * 1000);
    return () => window.clearInterval(id);
  }, [phase, settings, requestId, applyServerState]);

  useEffect(() => {
    if ((phase !== "navigating" && phase !== "preview") || !settings || !requestId) return;
    const id = window.setInterval(() => {
      getBloodRequest(requestId).then(applyServerState).catch(() => undefined);
    }, settings.request_poll_seconds * 1000);
    return () => window.clearInterval(id);
  }, [phase, settings, requestId, applyServerState]);

  // ----- Derived navigation display -------------------------------------------
  const onRendezvousLeg = activeLeg?.leg === "rendezvous";
  const maneuver =
    activeLeg && position
      ? upcomingManeuver(activeLeg.route, progressMeters(activeLeg.route, [position.longitude, position.latitude]))
      : null;
  const legRemainingMinutes =
    activeLeg && maneuver ? activeLeg.minutes * maneuver.remainingFraction : null;

  // The resource's clock starts with navigation, matching the evaluator's plan.
  const simMinutesSinceStart =
    simNow / 60;
  // The assigned blood unit: it waits out its mobilization, drives its own route to the
  // point on the evaluator's timeline, and stays parked there after the handoff.
  let movingResource: MovingResource | null = null;
  let resourceMinutes: number | null = null;
  if (isIntercept && candidate?.resource_id && resourceRoute) {
    const mobilization = candidate.mobilization_minutes ?? 0;
    const driving = Math.max(0.1, candidate.resource_driving_minutes ?? 0);
    const handedOff = (phase === "navigating" || phase === "arrived") && !onRendezvousLeg;
    resourceMinutes = handedOff
      ? 0
      : Math.max(0, (candidate.resource_arrival_minutes ?? 0) - simMinutesSinceStart);
    const fraction = handedOff ? 1 : Math.max(0, simMinutesSinceStart - mobilization) / driving;
    const point = pointAlong(resourceRoute, fraction);
    const status = handedOff
      ? "handed off"
      : phase === "preview"
        ? "ready"
        : simMinutesSinceStart < mobilization
          ? "mobilizing"
          : resourceMinutes > 0
            ? formatMinutes(resourceMinutes)
            : "at point";
    movingResource = {
      unitId: candidate.resource_id,
      longitude: point.longitude,
      latitude: point.latitude,
      heading: fraction > 0 && fraction < 1 ? point.heading : null,
      label: `${candidate.resource_id} · ${status}`,
    };
  }
  const canWatchResource =
    phase === "navigating" && onRendezvousLeg && movingResource !== null;

  // ETA to the blood point is your own arrival there; blood is handed over once both are there.
  const bloodPointMinutes = onRendezvousLeg ? legRemainingMinutes : null;
  const hospitalMinutes =
    onRendezvousLeg && candidate
      ? Math.max(legRemainingMinutes ?? 0, resourceMinutes ?? 0) +
        (candidate.rendezvous_to_hospital_minutes ?? 0)
      : legRemainingMinutes;

  // Which lines to draw: blue = the leg being driven (or first leg in the overview).
  const showPlan = phase === "preview" || phase === "navigating" || phase === "arrived";
  const blueRoute = !showPlan
    ? null
    : activeLeg
      ? activeLeg.route.route.geometry
      : (routeToPoint ?? routeToHospital)?.route.geometry ?? null;
  const dashedRoute =
    showPlan && isIntercept && (phase === "preview" || onRendezvousLeg)
      ? routeToHospital?.route.geometry ?? null
      : null;
  const purpleRoute =
    showPlan && isIntercept && (phase === "preview" || onRendezvousLeg)
      ? resourceRoute?.route.geometry ?? null
      : null;

  const camera: CameraMode =
    canWatchResource && watchResource
      ? "watch"
      : phase === "navigating" || phase === "arrived"
        ? "navigate"
        : phase === "preview"
          ? "preview"
          : "idle";
  // What the "watch" camera keeps in frame: both vehicles and where they meet.
  const watchPoints: LngLat[] = [
    ...(position ? [[position.longitude, position.latitude] as LngLat] : []),
    ...(movingResource ? [[movingResource.longitude, movingResource.latitude] as LngLat] : []),
    ...(rendezvousPoint ? [[rendezvousPoint.longitude, rendezvousPoint.latitude] as LngLat] : []),
  ];
  const insets = {
    top: phase === "navigating" ? MANEUVER_BANNER_INSET : 0,
    bottom: bottomHeight + 14,
  };

  const locationChip = simulated
    ? "Simulated location"
    : gps.position
      ? "GPS"
      : "Location unavailable";

  // ----- Screens ----------------------------------------------------------------------
  const topbar = (
    <header className="amb-topbar">
      <div className="amb-topbar__unit">
        <BrandLogo size={34} />
        <div>
          <span className="amb-topbar__brand">BloodGrid</span>
          <strong>{unitId ?? "Ambulance"}</strong>
        </div>
      </div>
      <div className="amb-topbar__meta">
        <span className="scenario-pill">
          <Database size={13} aria-hidden="true" />
          Synthetic demo
        </span>
        {unitId ? (
          <span className={position ? "amb-chip" : "amb-chip amb-chip--warn"}>
            <LocateFixed size={13} aria-hidden="true" />
            {locationChip}
          </span>
        ) : null}
      </div>
      {unitId ? (
        <div className="amb-demo">
          <button
            aria-expanded={demoOpen}
            className="amb-switch"
            onClick={() => setDemoOpen((open) => !open)}
            type="button"
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Demo{simulated ? ` x${speed}` : ""}
          </button>
          {demoOpen ? (
            <div className="amb-demo__menu" role="menu">
              <p>Simulation speed</p>
              <div className="amb-demo__speeds">
                {DEMO_SPEEDS.map((option) => (
                  <button
                    aria-pressed={speed === option}
                    className={speed === option ? "is-active" : ""}
                    disabled={!simulated}
                    key={option}
                    onClick={() => changeSpeed(option)}
                    type="button"
                  >
                    x{option}
                  </button>
                ))}
              </div>
              <small>
                {simulated
                  ? "Demo only. Both the ambulance and the blood unit move at this speed; ETAs stay in real road minutes."
                  : "Using GPS, so movement is real time. Open without ?sim=0 to simulate."}
              </small>
            </div>
          ) : null}
        </div>
      ) : null}
      <Link className="amb-switch" href="/">
        <LayoutDashboard size={16} aria-hidden="true" />
        System view
      </Link>
    </header>
  );

  if (connectionError) {
    return (
      <main className="amb-shell">
        {topbar}
        <div className="amb-center-message">
          <h1>Not connected to BloodGrid</h1>
          <p>{connectionError}</p>
          <p>Start the backend on port 8000, then refresh this page.</p>
        </div>
      </main>
    );
  }

  if (!ambulances) {
    return (
      <main className="amb-shell">
        {topbar}
        <div className="amb-center-message">
          <h1>Loading...</h1>
        </div>
      </main>
    );
  }

  if (!ambulance) {
    const extra = `${simulated ? "" : "&sim=0"}${
      availabilityProfile === "baseline" ? "" : `&availability_profile=${availabilityProfile}`
    }${scenarioId ? `&scenario=${encodeURIComponent(scenarioId)}` : ""}`;
    return (
      <main className="amb-shell">
        {topbar}
        <div className="amb-picker">
          <h1>Choose your ambulance</h1>
          {unitId ? <p className="amb-error">Unknown ambulance {unitId}.</p> : null}
          <p>Synthetic demo units. Each starts at its simulated incident scene.</p>
          {ambulances.map((item) => (
            <Link
              className="amb-picker__option"
              href={`/ambulance?unit=${encodeURIComponent(item.unit_id)}${extra}`}
              key={item.unit_id}
            >
              <Ambulance size={22} aria-hidden="true" />
              <strong>{item.unit_id}</strong>
              <span>Scene of {item.start_incident_id}</span>
            </Link>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="amb-shell">
      {topbar}
      <div className={phase === "navigating" ? "amb-stage amb-stage--navigating" : "amb-stage"}>
        <AmbulanceMap
          activeRoute={blueRoute}
          camera={camera}
          destinationHospitalId={request?.destination_hospital_id ?? null}
          follow={follow}
          hospitals={hospitals ?? []}
          insets={insets}
          movingResource={movingResource}
          onUserPan={() => setFollow(false)}
          position={position}
          rendezvousPoint={showPlan && (phase === "preview" || onRendezvousLeg) ? rendezvousPoint : null}
          resourceRoute={purpleRoute}
          resources={resources}
          upcomingRoute={dashedRoute}
          watchPoints={watchPoints}
        />

        {phase === "navigating" ? <ManeuverBanner maneuver={maneuver} /> : null}

        <div className="amb-map-buttons">
          {canWatchResource && candidate?.resource_id ? (
            <button
              aria-pressed={watchResource}
              className={watchResource ? "amb-map-button is-active" : "amb-map-button"}
              onClick={() => {
                setWatchResource((watching) => !watching);
                setFollow(true);
              }}
              type="button"
            >
              {watchResource ? <Navigation size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              {watchResource ? "Back to driving" : `Watch ${candidate.resource_id}`}
            </button>
          ) : null}
          {!follow ? (
            <button className="amb-map-button" onClick={() => setFollow(true)} type="button">
              <Navigation size={16} aria-hidden="true" />
              Recenter
            </button>
          ) : null}
        </div>

        <div className="amb-bottom" ref={bottomRef}>
          {!simulated && gps.error ? <p className="amb-toast amb-toast--warn">{gps.error}</p> : null}
          {notice && phase === "idle" ? <p className="amb-toast">{notice}</p> : null}
          {routeError && phase !== "idle" ? <p className="amb-toast amb-toast--warn">{routeError}</p> : null}
          {toast && phase === "navigating" ? <p className="amb-toast">{toast}</p> : null}

          {phase === "idle" ? (
            <button
              className="amb-primary amb-primary--request"
              disabled={!position}
              onClick={openSheet}
              type="button"
            >
              MAKE REQUEST
            </button>
          ) : null}

          {phase === "sheet" ? (
            <RequestSheet
              hospitals={hospitals}
              loadError={sheetLoadError}
              onClose={() => setPhase("idle")}
              onRetry={loadSheetOptions}
              onSubmit={submitRequest}
              products={products}
              submitError={submitError}
              submitting={submitting}
            />
          ) : null}

          {phase === "preview" && request ? (
            <RouteOverviewCard
              busy={busy}
              candidate={displayCandidate}
              endArmed={endArmed}
              onCancel={endRequest}
              onStart={startNavigation}
              request={request}
              routesReady={isIntercept ? routeToPoint !== null : routeToHospital !== null}
            />
          ) : null}

          {phase === "navigating" && request ? (
            <NavBar
              bloodPointMinutes={bloodPointMinutes}
              busy={busy}
              candidate={displayCandidate}
              hospitalMinutes={hospitalMinutes}
              onBloodReceived={confirmBloodReceived}
              endArmed={endArmed}
              onEnd={endRequest}
              onToggleRouteMenu={toggleRouteMenu}
              onPickRoute={pickRoute}
              routeMenuOpen={routeMenu !== null}
              routeMenuLoading={routeMenu?.loading ?? false}
              routeChoices={routeMenu?.choices ?? null}
              onRendezvousLeg={onRendezvousLeg}
              request={request}
              resourceMinutes={resourceMinutes}
            />
          ) : null}

          {phase === "arrived" && request ? (
            <ArrivedBar onDone={() => resetToIdle(null)} request={request} />
          ) : null}
        </div>
      </div>
    </main>
  );
}
