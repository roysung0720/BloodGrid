"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AmbulanceApp } from "../../components/ambulance/AmbulanceApp";

export default function AmbulancePage() {
  return (
    <Suspense fallback={null}>
      <AmbulancePageContent />
    </Suspense>
  );
}

function AmbulancePageContent() {
  const searchParams = useSearchParams();

  return (
    <AmbulanceApp
      availabilityProfile={searchParams.get("availability_profile") ?? "baseline"}
      scenarioId={searchParams.get("scenario")}
      simulated={searchParams.get("sim") !== "0"}
      unitId={searchParams.get("unit")}
    />
  );
}
