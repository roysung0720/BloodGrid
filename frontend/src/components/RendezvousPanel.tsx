import { ArrowRight, Route, Timer } from "lucide-react";

import type {
  FeatureSelection,
  LiveRendezvousResult,
  RendezvousCandidate,
} from "../lib/types";

type RendezvousPanelProps = {
  result: LiveRendezvousResult | null;
  error: string | null;
  onSelect: (selection: FeatureSelection) => void;
};

const STATUS_LABELS: Record<RendezvousCandidate["status"], string> = {
  RECOMMENDED: "Recommended",
  NOT_SELECTED: "Eligible alternative",
  INELIGIBLE_POINT: "Not available",
  NO_ELIGIBLE_RESOURCE: "No eligible resource",
  NO_ROUTE: "No road route",
  TOO_LATE: "Too late",
  EXCESSIVE_DETOUR: "Excessive detour",
};

function minutes(value: number | null) {
  return value === null ? "Not available" : `${value} min`;
}

function delay(value: number | null) {
  if (value === null) {
    return "Not available";
  }
  return value <= 0 ? "No added delay" : `+${value} min`;
}

export function RendezvousPanel({
  result,
  error,
  onSelect,
}: RendezvousPanelProps) {
  if (error) {
    return (
      <section className="rail-section rendezvous-section">
        <div className="section-heading">
          <Route size={17} aria-hidden="true" />
          <h2>Live incident evaluation</h2>
        </div>
        <p className="coverage-error">{error}</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="rail-section rendezvous-section">
        <div className="section-heading">
          <Route size={17} aria-hidden="true" />
          <h2>Live incident evaluation</h2>
        </div>
        <p className="panel-note panel-note--plain">Comparing approved rendezvous points.</p>
      </section>
    );
  }

  const recommended = result.candidates.find(
    (candidate) => candidate.rendezvous_id === result.recommended_rendezvous_id,
  );

  return (
    <section className="rail-section rendezvous-section">
      <div className="section-heading">
        <Route size={17} aria-hidden="true" />
        <h2>Live incident evaluation</h2>
      </div>
      <div className="rendezvous-destination">
        <span>Supplied destination</span>
        <strong>{result.destination_hospital_name}</strong>
        <small>{result.destination_trauma_level.replace("_", " ")}</small>
      </div>
      <div className="rendezvous-recommendation">
        <span>
          {result.recommendation === "RENDEZVOUS"
            ? "Rendezvous recommended"
            : "Continue direct"}
        </span>
        <strong>{recommended?.rendezvous_name ?? result.destination_hospital_name}</strong>
        <p>{result.recommendation_reason}</p>
      </div>
      <div className="rendezvous-timings">
        <div>
          <span>Direct hospital</span>
          <strong>{minutes(result.direct_transport_minutes)}</strong>
        </div>
        {recommended ? (
          <>
            <ArrowRight size={16} aria-hidden="true" />
            <div>
              <span>Blood reaches unit</span>
              <strong>{minutes(recommended.time_to_blood_minutes)}</strong>
            </div>
          </>
        ) : null}
      </div>
      <div className="rendezvous-candidates">
        <span>Approved-point review</span>
        {result.candidates.map((candidate) => (
          <button
            key={candidate.rendezvous_id}
            className={
              candidate.status === "RECOMMENDED"
                ? "rendezvous-candidate is-recommended"
                : "rendezvous-candidate"
            }
            onClick={() => onSelect({ type: "rendezvous", id: candidate.rendezvous_id })}
            type="button"
          >
            <div>
              <strong>{candidate.rendezvous_name}</strong>
              <span>{STATUS_LABELS[candidate.status]}</span>
            </div>
            <span className="rendezvous-candidate__time">
              {candidate.time_to_blood_minutes === null
                ? candidate.reason
                : `${minutes(candidate.time_to_blood_minutes)} to blood · ${delay(candidate.added_hospital_delay_minutes)}`}
            </span>
          </button>
        ))}
      </div>
      <p className="panel-note">
        <Timer size={14} aria-hidden="true" />
        <span>
          BloodGrid validates the supplied destination but does not select a hospital.
        </span>
      </p>
    </section>
  );
}
