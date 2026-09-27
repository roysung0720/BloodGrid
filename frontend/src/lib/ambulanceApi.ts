import type {
  AmbulanceOption,
  AmbulanceSettings,
  BloodProductOption,
  BloodRequest,
  CreateBloodRequest,
  HospitalOption,
  RendezvousPoint,
  ResourceOption,
  RouteResult,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:8000";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(errorBody?.detail ?? `BloodGrid returned ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Builds a query string, leaving out empty values (e.g. no scenario = backend default). */
function query(values: Record<string, string | number | null | undefined>) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}

export function getAmbulanceSettings() {
  return requestJson<AmbulanceSettings>("/ambulance/settings");
}

export function getAmbulances(scenarioId: string | null) {
  return requestJson<AmbulanceOption[]>(`/ambulances?${query({ scenario_id: scenarioId })}`);
}

export function getRendezvousPoints(scenarioId: string | null) {
  return requestJson<RendezvousPoint[]>(
    `/rendezvous-points?${query({ scenario_id: scenarioId })}`,
  );
}

export function getHospitalOptions(
  latitude: number,
  longitude: number,
  scenarioId: string | null,
  availabilityProfile: string,
) {
  return requestJson<HospitalOption[]>(
    `/hospital-options?${query({
      lat: latitude,
      lon: longitude,
      scenario_id: scenarioId,
      availability_profile: availabilityProfile,
    })}`,
  );
}

export function getBloodProducts(scenarioId: string | null, availabilityProfile: string) {
  return requestJson<BloodProductOption[]>(
    `/blood-products?${query({ scenario_id: scenarioId, availability_profile: availabilityProfile })}`,
  );
}

export function getResourceOptions(
  latitude: number,
  longitude: number,
  scenarioId: string | null,
  availabilityProfile: string,
) {
  return requestJson<ResourceOption[]>(
    `/resource-options?${query({
      lat: latitude,
      lon: longitude,
      scenario_id: scenarioId,
      availability_profile: availabilityProfile,
    })}`,
  );
}

export function getRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  return requestJson<RouteResult>(
    `/route?${query({
      from_lat: from.latitude,
      from_lon: from.longitude,
      to_lat: to.latitude,
      to_lon: to.longitude,
    })}`,
  );
}

/** Fastest route first, then alternative roads between the same two points. */
export function getRouteOptions(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  return requestJson<RouteResult[]>(
    `/route/options?${query({
      from_lat: from.latitude,
      from_lon: from.longitude,
      to_lat: to.latitude,
      to_lon: to.longitude,
    })}`,
  );
}

export function createBloodRequest(submission: CreateBloodRequest) {
  return post<BloodRequest>("/requests", submission);
}

export function getBloodRequests() {
  return requestJson<BloodRequest[]>("/requests");
}

export function getBloodRequest(requestId: string) {
  return requestJson<BloodRequest>(`/requests/${encodeURIComponent(requestId)}`);
}

export function reportPosition(requestId: string, latitude: number, longitude: number) {
  return post<BloodRequest>(`/requests/${encodeURIComponent(requestId)}/position`, {
    latitude,
    longitude,
  });
}

export function markBloodReceived(requestId: string) {
  return post<BloodRequest>(`/requests/${encodeURIComponent(requestId)}/blood-received`);
}

export function cancelBloodRequest(requestId: string, by: "crew" | "operations") {
  return post<BloodRequest>(
    `/requests/${encodeURIComponent(requestId)}/cancel?${query({ by })}`,
  );
}
