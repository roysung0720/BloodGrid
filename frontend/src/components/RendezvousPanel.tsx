import { ArrowRight, MapPin, Route, Timer } from "lucide-react";

import { CATEGORY_LABELS } from "../lib/meetingSpots";
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
  NOT_SELECTED: "Alternative",
  TOO_LATE: "Not sooner",
  WRONG_DIRECTION: "Wrong direction",
  EXCESSIVE_DETOUR: "Too much delay",
  NO_ROUTE: "No road route",
  NO_ELIGIBLE_RESOURCE: "No eligible unit",
};

const REJECTION_LABELS: Record<string, string> = {
  TOO_LATE: "not sooner than the hospital",
  WRONG_DIRECTION: "wrong direction",
  EXCESSIVE_DETOUR: "too much hospital delay",
  NO_ROUTE: "no road route",
  NO_ELIGIBLE_RESOURCE: "no eligible unit",
};

function minutes(value: number | null) {
  return value === null ? "Not available" : `${value} min`;
}

function delay(value: number | null) {
  if (value === null) {
    return "Not available";
  }
  return value <= 0 ? "no added delay" : `+${value} min`;
}

function Heading() {
  return (
    <div className="section-heading">
      <Route size={17} aria-hidden="true" />
      <h2>Live incident evaluation</h2>
    </div>
  );
}

export function RendezvousPanel({ result, error, onSelect }: RendezvousPanelProps) {
  if (error) {
    return (
      <section className="rail-section rendezvous-section">
        <Heading />
        <p className="coverage-error">{error}</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section className="rail-section rendezvous-section">
        <Heading />
        <p className="panel-note panel-note--plain">Checking nearby meeting spots.</p>
      </section>
    );
  }

  const recommended = result.candidates.find((candidate) => candidate.status === "RECOMMENDED");
  const rejected = Object.entries(result.rejected_summary)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${REJECTION_LABELS[status] ?? status.toLowerCase()}`)
    .join(" · ");

  return (
    <section className="rail-section rendezvous-section">
      <Heading />
      <div className="rendezvous-destination">
        <span>Supplied destination</span>
        <strong>{result.destination_hospital_name}</strong>
        <small>{result.destination_trauma_level.replace("_", " ")}</small>
      </div>
      <div className="rendezvous-recommendation">
        <span>{recommended ? "Meet on the way" : "Continue direct"}</span>
        <strong>
          {recommended
            ? `${recommended.resource_id} at ${recommended.rendezvous_name}`
            : result.destination_hospital_name}
        </strong>
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
      {result.candidates.length > 0 ? (
        <div className="rendezvous-candidates">
          <span>Options reviewed</span>
          {result.candidates.map((candidate) => (
            <button
              key={`${candidate.rendezvous_id}-${candidate.resource_id}`}
              className={
                candidate.status === "RECOMMENDED"
                  ? "rendezvous-candidate is-recommended"
                  : "rendezvous-candidate"
              }
              onClick={() => onSelect({ type: "rendezvous", id: candidate.rendezvous_id })}
              type="button"
            >
              <div>
                <strong>
                  {candidate.resource_id} · {candidate.rendezvous_name}
                </strong>
                <span>
                  {STATUS_LABELS[candidate.status]} · {CATEGORY_LABELS[candidate.category]}
                </span>
              </div>
              <span className="rendezvous-candidate__time">
                {candidate.time_to_blood_minutes === null
                  ? candidate.reason
                  : `${minutes(candidate.time_to_blood_minutes)} to blood · ${delay(candidate.added_hospital_delay_minutes)}`}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <p className="panel-note">
        <MapPin size={14} aria-hidden="true" />
        <span>
          {result.spots_considered} of {result.spots_available} nearby places checked
          {rejected ? `. Ruled out: ${rejected}.` : "."} Spots: {result.meeting_spot_source}.
        </span>
      </p>
      <p className="panel-note">
        <Timer size={14} aria-hidden="true" />
        <span>
          Suggested meeting spots keep the ambulance heading toward the supplied destination.
          BloodGrid does not select a hospital; the crew decides where to stop.
        </span>
      </p>
    </section>
  );
}
