import type { BaselineCoverageResult, ScenarioData } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:8000";

export async function getScenario(): Promise<ScenarioData> {
  const response = await fetch(`${API_BASE_URL}/scenario`);
  if (!response.ok) {
    throw new Error(`The data service returned ${response.status}.`);
  }
  return response.json() as Promise<ScenarioData>;
}

export async function getBaselineCoverage(): Promise<BaselineCoverageResult> {
  const response = await fetch(`${API_BASE_URL}/coverage/baseline`);
  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(errorBody?.detail ?? `Coverage service returned ${response.status}.`);
  }
  return response.json() as Promise<BaselineCoverageResult>;
}
