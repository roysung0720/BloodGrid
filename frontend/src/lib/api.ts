import type {
  BaselineCoverageResult,
  LiveRendezvousResult,
  RouteResult,
  ScenarioCatalogEntry,
  ScenarioData,
  StrategicDeploymentResult,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:8000";

function scenarioQuery(scenarioId: string, availabilityProfile: string) {
  const query = new URLSearchParams({
    scenario_id: scenarioId,
    availability_profile: availabilityProfile,
  });
  return `?${query.toString()}`;
}

export async function getScenarioCatalog(): Promise<ScenarioCatalogEntry[]> {
  const response = await fetch(`${API_BASE_URL}/scenarios`);
  if (!response.ok) {
    throw new Error(`The data service returned ${response.status}.`);
  }
  return response.json() as Promise<ScenarioCatalogEntry[]>;
}

export async function getScenario(
  scenarioId: string,
  availabilityProfile = "baseline",
): Promise<ScenarioData> {
  const response = await fetch(
    `${API_BASE_URL}/scenario${scenarioQuery(scenarioId, availabilityProfile)}`,
  );
  if (!response.ok) {
    throw new Error(`The data service returned ${response.status}.`);
  }
  return response.json() as Promise<ScenarioData>;
}

export async function getBaselineCoverage(
  scenarioId: string,
  availabilityProfile = "baseline",
): Promise<BaselineCoverageResult> {
  const response = await fetch(
    `${API_BASE_URL}/coverage/baseline${scenarioQuery(scenarioId, availabilityProfile)}`,
  );
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(errorBody?.detail ?? `Coverage service returned ${response.status}.`);
  }
  return response.json() as Promise<BaselineCoverageResult>;
}

export async function getStrategicDeployment(
  scenarioId: string,
  availabilityProfile = "baseline",
): Promise<StrategicDeploymentResult> {
  const response = await fetch(
    `${API_BASE_URL}/deployment/strategic${scenarioQuery(scenarioId, availabilityProfile)}`,
  );
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(errorBody?.detail ?? `Deployment service returned ${response.status}.`);
  }
  return response.json() as Promise<StrategicDeploymentResult>;
}

export async function getLiveRendezvous(
  incidentId: string,
  scenarioId: string,
  availabilityProfile = "baseline",
  recommendedStaging = false,
): Promise<LiveRendezvousResult> {
  const query = new URLSearchParams({
    scenario_id: scenarioId,
    availability_profile: availabilityProfile,
    ...(recommendedStaging ? { recommended_staging: "true" } : {}),
  });
  const response = await fetch(
    `${API_BASE_URL}/live-incidents/${encodeURIComponent(incidentId)}/rendezvous?${query.toString()}`,
  );
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(errorBody?.detail ?? `Rendezvous service returned ${response.status}.`);
  }
  return response.json() as Promise<LiveRendezvousResult>;
}

export async function getRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): Promise<RouteResult> {
  const query = new URLSearchParams({
    from_lat: String(from.latitude),
    from_lon: String(from.longitude),
    to_lat: String(to.latitude),
    to_lon: String(to.longitude),
  });
  const response = await fetch(`${API_BASE_URL}/route?${query.toString()}`);
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(errorBody?.detail ?? `Route service returned ${response.status}.`);
  }
  return response.json() as Promise<RouteResult>;
}
