// Display helpers for meeting spots chosen by the backend rule.

import type { MeetingSpotCategory, RendezvousCandidate } from "./types";

export const CATEGORY_LABELS: Record<MeetingSpotCategory, string> = {
  KNOWN_SITE: "Known site",
  PARKING: "Parking lot",
  FUEL_STATION: "Gas station",
  FIRE_STATION: "Fire station",
  PLACE_OF_WORSHIP: "Church lot",
  SCHOOL: "School lot",
  ROADSIDE: "Roadside pull-off",
};

/**
 * A readable spot name. Unnamed places ("Parking lot") gain the road they sit on when a
 * drawn route to them is known, e.g. "Parking lot on GA 211".
 */
export function spotLabel(candidate: RendezvousCandidate, roadName?: string | null) {
  const generic = Object.values(CATEGORY_LABELS).includes(candidate.rendezvous_name);
  if (generic && roadName) {
    return `${candidate.rendezvous_name} on ${roadName}`;
  }
  return candidate.rendezvous_name;
}
