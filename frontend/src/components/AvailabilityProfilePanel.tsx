import { SlidersHorizontal } from "lucide-react";

import type { AvailabilityProfile } from "../lib/types";

type AvailabilityProfilePanelProps = {
  profiles: AvailabilityProfile[];
  selectedProfileId: string;
  onChange: (profileId: string) => void;
};

export function AvailabilityProfilePanel({
  profiles,
  selectedProfileId,
  onChange,
}: AvailabilityProfilePanelProps) {
  const activeProfile = profiles.find(
    (profile) => profile.profile_id === selectedProfileId,
  );

  return (
    <section className="rail-section availability-section">
      <div className="section-heading">
        <SlidersHorizontal size={17} aria-hidden="true" />
        <h2>Synthetic operating state</h2>
      </div>
      <label className="availability-select" htmlFor="availability-profile">
        <span>Demo case</span>
        <select
          id="availability-profile"
          onChange={(event) => onChange(event.target.value)}
          value={selectedProfileId}
        >
          {profiles.map((profile) => (
            <option key={profile.profile_id} value={profile.profile_id}>
              {profile.name}
            </option>
          ))}
        </select>
      </label>
      <p className="panel-note panel-note--plain">
        {activeProfile?.description ?? "Loading synthetic operating state."}
      </p>
    </section>
  );
}
