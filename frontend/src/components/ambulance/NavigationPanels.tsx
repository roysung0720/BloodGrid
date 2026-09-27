import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronUp,
  CircleCheck,
  CornerUpLeft,
  CornerUpRight,
  Droplets,
  Flag,
  Hospital,
  Navigation,
  Shuffle,
  Undo2,
  X,
} from "lucide-react";

import type { UpcomingManeuver } from "../../lib/navigation";
import { formatDistance, formatMinutes } from "../../lib/navigation";
import type { BloodRequest, RendezvousCandidate } from "../../lib/types";

function ManeuverIcon({ type, modifier }: { type: string; modifier: string }) {
  const props = { size: 26, "aria-hidden": true } as const;
  if (type === "arrive") return <Flag {...props} />;
  if (modifier === "uturn") return <Undo2 {...props} />;
  if (modifier === "sharp left" || modifier === "left") return <CornerUpLeft {...props} />;
  if (modifier === "sharp right" || modifier === "right") return <CornerUpRight {...props} />;
  if (modifier === "slight left") return <ArrowLeft {...props} />;
  if (modifier === "slight right") return <ArrowRight {...props} />;
  return <ArrowUp {...props} />;
}

export function ManeuverBanner({ maneuver }: { maneuver: UpcomingManeuver | null }) {
  const step = maneuver?.step;
  return (
    <div className="amb-maneuver" role="status">
      {step ? <ManeuverIcon type={step.maneuver_type} modifier={step.modifier} /> : <ArrowUp size={26} aria-hidden="true" />}
      <div>
        {step && maneuver ? (
          <>
            <span className="amb-maneuver__distance">{formatDistance(maneuver.metersToManeuver)}</span>
            <strong>{step.instruction}</strong>
          </>
        ) : (
          <strong>Loading route...</strong>
        )}
      </div>
    </div>
  );
}

function Eta({
  icon,
  label,
  minutes,
  note,
}: {
  icon: "blood" | "hospital";
  label: string;
  minutes: number | null;
  note?: string;
}) {
  return (
    <div className={`amb-eta amb-eta--${icon}`}>
      {icon === "blood" ? <Droplets size={16} aria-hidden="true" /> : <Hospital size={16} aria-hidden="true" />}
      <div>
        <span>{label}</span>
        <strong>{formatMinutes(minutes)}</strong>
        {note ? <small>{note}</small> : null}
      </div>
    </div>
  );
}

type RouteOverviewCardProps = {
  request: BloodRequest;
  candidate: RendezvousCandidate | null;
  routesReady: boolean;
  busy: boolean;
  endArmed: boolean;
  onStart: () => void;
  onCancel: () => void;
};

/** Shown after GO: the whole plan on the map, and nothing moves until Start. */
export function RouteOverviewCard({
  request,
  candidate,
  routesReady,
  busy,
  endArmed,
  onStart,
  onCancel,
}: RouteOverviewCardProps) {
  const { rendezvous } = request;
  const intercept = rendezvous.recommendation === "RENDEZVOUS" && candidate;
  const delay = candidate?.added_hospital_delay_minutes ?? 0;
  return (
    <section className="amb-panel" aria-label="Route overview">
      <div className="amb-panel__head">
        <p>
          Route overview · {request.request_id}
        </p>
        {endArmed ? (
          <button className="amb-small-button amb-small-button--danger" disabled={busy} onClick={onCancel} type="button">
            Tap again to cancel
          </button>
        ) : (
          <button className="amb-icon-button amb-icon-button--small" disabled={busy} onClick={onCancel} type="button" aria-label="Cancel request">
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <h2>
        {intercept
          ? `Meet ${candidate.resource_id} at ${candidate.rendezvous_name}`
          : `Direct to ${request.destination_hospital_name}`}
      </h2>
      <div className="amb-etas">
        {intercept ? (
          <>
            <Eta icon="blood" label="Blood point" minutes={candidate.patient_to_rendezvous_minutes} note={
              (candidate.patient_wait_minutes ?? 0) > 0
                ? `then wait ${formatMinutes(candidate.patient_wait_minutes)}`
                : undefined
            } />
            <Eta icon="hospital" label="Hospital" minutes={candidate.hospital_arrival_minutes} note={
              delay > 0 ? `+${delay} min vs direct` : "no added delay"
            } />
          </>
        ) : (
          <Eta icon="hospital" label="Hospital" minutes={rendezvous.direct_transport_minutes} note="direct" />
        )}
      </div>
      {!intercept ? (
        <details className="amb-why">
          <summary>Why no rendezvous?</summary>
          {rendezvous.recommendation_reason}
        </details>
      ) : null}
      <button className="amb-primary amb-primary--start" disabled={!routesReady || busy} onClick={onStart} type="button">
        <Navigation size={20} aria-hidden="true" />
        {routesReady ? "Start navigation" : "Loading route..."}
      </button>
    </section>
  );
}

export type RouteChoice = {
  key: string;
  label: string;
  minutes: number;
  miles: number;
  fastest: boolean;
  current: boolean;
};

type RouteMenuProps = {
  loading: boolean;
  choices: RouteChoice[] | null;
  onPick: (key: string) => void;
  onClose: () => void;
};

/** Reroute dropdown: the same destination by up to three different roads, with times. */
function RouteMenu({ loading, choices, onPick, onClose }: RouteMenuProps) {
  return (
    <div className="amb-routes" role="listbox" aria-label="Route options">
      <div className="amb-routes__head">
        <strong>Choose a route</strong>
        <button className="amb-icon-button amb-icon-button--small" onClick={onClose} type="button" aria-label="Close route options">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {loading ? <p className="amb-routes__note">Finding routes...</p> : null}
      {!loading && choices?.length === 0 ? (
        <p className="amb-routes__note">No road route found from here.</p>
      ) : null}
      {!loading && choices
        ? choices.map((choice, index) => (
            <button
              aria-selected={choice.current}
              className={choice.current ? "amb-route-option is-current" : "amb-route-option"}
              disabled={choice.current}
              key={choice.key}
              onClick={() => onPick(choice.key)}
              role="option"
              type="button"
            >
              <span className="amb-route-option__letter">{String.fromCharCode(65 + index)}</span>
              <span className="amb-route-option__label">
                {choice.label}
                <small>
                  {choice.miles} mi
                  {choice.fastest ? " · fastest" : ""}
                  {choice.current ? " · current" : ""}
                </small>
              </span>
              <strong>{formatMinutes(choice.minutes)}</strong>
            </button>
          ))
        : null}
      {!loading && choices && choices.length > 0 && choices.length < 3 ? (
        <p className="amb-routes__note">Only {choices.length} distinct road{choices.length === 1 ? "" : "s"} found from here.</p>
      ) : null}
    </div>
  );
}

type NavBarProps = {
  request: BloodRequest;
  candidate: RendezvousCandidate | null;
  onRendezvousLeg: boolean;
  bloodPointMinutes: number | null;
  resourceMinutes: number | null;
  hospitalMinutes: number | null;
  busy: boolean;
  endArmed: boolean;
  routeMenuOpen: boolean;
  routeMenuLoading: boolean;
  routeChoices: RouteChoice[] | null;
  onBloodReceived: () => void;
  onToggleRouteMenu: () => void;
  onPickRoute: (key: string) => void;
  onEnd: () => void;
};

/** Compact bar shown while driving. */
export function NavBar({
  request,
  candidate,
  onRendezvousLeg,
  bloodPointMinutes,
  resourceMinutes,
  hospitalMinutes,
  busy,
  endArmed,
  routeMenuOpen,
  routeMenuLoading,
  routeChoices,
  onBloodReceived,
  onToggleRouteMenu,
  onPickRoute,
  onEnd,
}: NavBarProps) {
  const direct = request.rendezvous.recommendation === "DIRECT_TRANSPORT";
  return (
    <section className="amb-panel amb-panel--nav" aria-label="Navigation">
      {routeMenuOpen ? (
        <RouteMenu
          choices={routeChoices}
          loading={routeMenuLoading}
          onClose={onToggleRouteMenu}
          onPick={onPickRoute}
        />
      ) : null}
      <div className="amb-etas">
        {onRendezvousLeg && candidate ? (
          <Eta
            icon="blood"
            label="Blood point"
            minutes={bloodPointMinutes}
            note={
              resourceMinutes !== null && resourceMinutes > (bloodPointMinutes ?? 0)
                ? `${candidate.resource_id} in ${formatMinutes(resourceMinutes)}`
                : `${candidate.resource_id} ${resourceMinutes === 0 ? "there" : "on time"}`
            }
          />
        ) : null}
        <Eta
          icon="hospital"
          label="Hospital"
          minutes={hospitalMinutes}
          note={direct ? "direct" : onRendezvousLeg ? "after pickup" : "blood received"}
        />
        <div className="amb-panel__actions">
          <button
            aria-expanded={routeMenuOpen}
            className={routeMenuOpen ? "amb-small-button is-open" : "amb-small-button"}
            disabled={busy}
            onClick={onToggleRouteMenu}
            type="button"
          >
            <Shuffle size={15} aria-hidden="true" />
            Reroute
            <ChevronUp className="amb-small-button__chevron" size={14} aria-hidden="true" />
          </button>
          {onRendezvousLeg ? (
            <button className="amb-small-button amb-small-button--go" disabled={busy} onClick={onBloodReceived} type="button">
              <CircleCheck size={16} aria-hidden="true" />
              Blood received
            </button>
          ) : null}
          <button
            className={endArmed ? "amb-small-button amb-small-button--danger" : "amb-small-button"}
            disabled={busy}
            onClick={onEnd}
            type="button"
            aria-label={endArmed ? "Tap again to end the request" : "End request"}
          >
            {endArmed ? "Tap again to end" : "End"}
          </button>
        </div>
      </div>
      <p className="amb-panel__sub">
        {onRendezvousLeg && candidate
          ? `Meet ${candidate.resource_id} at ${candidate.rendezvous_name}`
          : `To ${request.destination_hospital_name}`}
      </p>
    </section>
  );
}

export function ArrivedBar({ request, onDone }: { request: BloodRequest; onDone: () => void }) {
  return (
    <section className="amb-panel amb-panel--nav" aria-label="Arrived">
      <div className="amb-etas">
        <div className="amb-eta amb-eta--hospital">
          <Hospital size={16} aria-hidden="true" />
          <div>
            <span>Arrived · {request.request_id}</span>
            <strong>{request.destination_hospital_name}</strong>
          </div>
        </div>
        <div className="amb-panel__actions">
          <button className="amb-small-button" onClick={onDone} type="button">
            Done
          </button>
        </div>
      </div>
    </section>
  );
}
