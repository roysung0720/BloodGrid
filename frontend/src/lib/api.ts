import type { ScenarioData } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:8000";

export async function getScenario(): Promise<ScenarioData> {
  const response = await fetch(`${API_BASE_URL}/scenario`);
  if (!response.ok) {
    throw new Error(`The data service returned ${response.status}.`);
  }
  return response.json() as Promise<ScenarioData>;
}
