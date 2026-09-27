import { X } from "lucide-react";
import { useState } from "react";

import { formatMinutes } from "../../lib/navigation";
import type { BloodProductOption, HospitalOption } from "../../lib/types";

type RequestSheetProps = {
  products: BloodProductOption[] | null;
  hospitals: HospitalOption[] | null;
  loadError: string | null;
  submitting: boolean;
  submitError: string | null;
  onClose: () => void;
  onRetry: () => void;
  onSubmit: (bloodProduct: string, hospitalId: string) => void;
};

function traumaLabel(level: string) {
  return level === "NONE" ? "No trauma level" : level.replace("LEVEL_", "Level ");
}

export function RequestSheet({
  products,
  hospitals,
  loadError,
  submitting,
  submitError,
  onClose,
  onRetry,
  onSubmit,
}: RequestSheetProps) {
  // Nothing is preselected: the crew makes both choices.
  const [product, setProduct] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const ready = product !== "" && hospitalId !== "" && !submitting;

  return (
    <section className="amb-sheet" aria-label="Blood request">
      <div className="amb-sheet__header">
        <h2>Blood request</h2>
        <button className="amb-icon-button" onClick={onClose} type="button" aria-label="Close without sending">
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      {loadError ? (
        <div className="amb-sheet__error">
          <p className="amb-error">{loadError}</p>
          {/* Without this, a failed load left a dropdown disabled with no way out. */}
          <button className="amb-small-button" onClick={onRetry} type="button">
            Retry
          </button>
        </div>
      ) : null}

      <label className="amb-field">
        <span>Blood product</span>
        <select
          disabled={!products || submitting}
          onChange={(event) => setProduct(event.target.value)}
          value={product}
        >
          <option value="">{products ? "Select product" : "Loading..."}</option>
          {products?.map((option) => (
            <option disabled={!option.available} key={option.product_type} value={option.product_type}>
              {option.label}
              {option.available ? "" : " (none available)"}
            </option>
          ))}
        </select>
      </label>

      <label className="amb-field">
        <span>Destination hospital</span>
        <select
          disabled={!hospitals || submitting}
          onChange={(event) => setHospitalId(event.target.value)}
          value={hospitalId}
        >
          <option value="">{hospitals ? "Select hospital" : "Calculating drive times..."}</option>
          {hospitals?.map((option) => (
            <option disabled={!option.routable} key={option.hospital_id} value={option.hospital_id}>
              {option.name} · {option.routable ? formatMinutes(option.drive_minutes) : "No route"} ·{" "}
              {traumaLabel(option.trauma_level)}
            </option>
          ))}
        </select>
        <small>Listed by road drive time from your location. The choice is yours.</small>
      </label>

      {submitError ? <p className="amb-error">{submitError}</p> : null}

      <button
        className="amb-primary amb-primary--go"
        disabled={!ready}
        onClick={() => onSubmit(product, hospitalId)}
        type="button"
      >
        {submitting ? "Finding blood resource..." : "GO"}
      </button>
    </section>
  );
}
