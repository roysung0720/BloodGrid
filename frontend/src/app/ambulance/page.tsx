import type { Metadata } from "next";

import { AmbulanceApp } from "../../components/ambulance/AmbulanceApp";

export const metadata: Metadata = {
  title: "BloodGrid Ambulance",
  description: "Crew-facing blood request and navigation view (synthetic demo).",
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AmbulancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  return (
    <AmbulanceApp
      availabilityProfile={first(params.availability_profile) ?? "baseline"}
      scenarioId={first(params.scenario) ?? null}
      simulated={first(params.sim) !== "0"}
      unitId={first(params.unit) ?? null}
    />
  );
}
