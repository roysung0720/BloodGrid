"use client";

import { Ambulance } from "lucide-react";
import { useEffect, useState } from "react";

import { cancelBloodRequest, getAmbulanceSettings, getBloodRequests } from "../lib/ambulanceApi";
import type { BloodRequest, BloodRequestStatus } from "../lib/types";

const CONFIRM_MILLISECONDS = 3000;

const STATUS_LABELS: Record<BloodRequestStatus, string> = {
  ACTIVE_RENDEZVOUS: "En route to rendezvous",
  ACTIVE_DIRECT: "Direct to hospital",
  BLOOD_RECEIVED: "Blood received",
  ARRIVED: "Arrived",
  CANCELLED: "Ended",
};

function planSummary(request: BloodRequest) {
  const { rendezvous } = request;
  const candidate = rendezvous.candidates.find((item) => item.status === "RECOMMENDED");
  if (rendezvous.recommendation === "RENDEZVOUS" && candidate) {
    return `${candidate.resource_id} at ${candidate.rendezvous_name} · blood in ${candidate.time_to_blood_minutes} min`;
  }
  return `Direct transport · ${rendezvous.direct_transport_minutes} min`;
}

/** Lists crew requests for the demo data set currently selected in the System UI. */
export function AmbulanceRequestsPanel({ scenarioId }: { scenarioId: string | null }) {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | undefined;
    const refresh = () =>
      getBloodRequests()
        .then((result) => {
          if (!cancelled) {
            setRequests(result);
            setError(null);
          }
        })
        .catch((requestError: Error) => !cancelled && setError(requestError.message));

    getAmbulanceSettings()
      .then((settings) => settings.request_poll_seconds)
      .catch(() => 3)
      .then((seconds) => {
        if (cancelled) return;
        refresh();
        intervalId = window.setInterval(refresh, seconds * 1000);
      });
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // Cancelling needs two taps: the first arms that request's button for a few seconds.
  useEffect(() => {
    if (!armedId) return;
    const id = window.setTimeout(() => setArmedId(null), CONFIRM_MILLISECONDS);
    return () => window.clearTimeout(id);
  }, [armedId]);

  async function cancel(request: BloodRequest) {
    if (armedId !== request.request_id) {
      setArmedId(request.request_id);
      return;
    }
    setArmedId(null);
    const updated = await cancelBloodRequest(request.request_id, "operations");
    setRequests((current) =>
      current.map((item) => (item.request_id === updated.request_id ? updated : item)),
    );
  }

  const visibleRequests = requests.filter(
    (request) => scenarioId === null || request.scenario_id === scenarioId,
  );

  return (
    <section className="rail-section ambulance-requests-section">
      <div className="section-heading">
        <Ambulance size={17} aria-hidden="true" />
        <h2>Ambulance requests</h2>
      </div>
      {error ? <p className="coverage-error">{error}</p> : null}
      {visibleRequests.length === 0 && !error ? (
        <p className="panel-note panel-note--plain">
          No crew requests yet. Open the Ambulance view to send one.
        </p>
      ) : null}
      <div className="ambulance-requests">
        {visibleRequests.map((request) => {
          const ended = request.status === "CANCELLED" || request.status === "ARRIVED";
          return (
            <div className={ended ? "ambulance-request is-ended" : "ambulance-request"} key={request.request_id}>
              <div>
                <strong>
                  {request.request_id} · {request.unit_id}
                </strong>
                <span className="ambulance-request__status">{STATUS_LABELS[request.status]}</span>
              </div>
              <span>To {request.destination_hospital_name} · {request.blood_product.replace("_", " ")}</span>
              <span>{planSummary(request)}</span>
              {ended ? (
                request.ended_reason ? <small>{request.ended_reason}</small> : null
              ) : (
                <button
                  className={
                    armedId === request.request_id
                      ? "ambulance-request__cancel is-armed"
                      : "ambulance-request__cancel"
                  }
                  onClick={() => void cancel(request)}
                  type="button"
                >
                  {armedId === request.request_id ? "Tap again to cancel" : "Cancel request"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="panel-note panel-note--plain">
        Simulated crew requests, held in memory until the backend restarts.
      </p>
    </section>
  );
}
