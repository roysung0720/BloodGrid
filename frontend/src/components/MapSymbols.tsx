import { Eye, EyeOff, Layers3 } from "lucide-react";

import type { CoverageView, LayerKey, LayerVisibility } from "../lib/types";

type SymbolVariant = {
  kind: string;
  label: string;
};

type SymbolGroup = {
  key: LayerKey;
  kind: string;
  label: string;
  variants?: SymbolVariant[];
};

const SYMBOL_GROUPS: SymbolGroup[] = [
  {
    key: "stations",
    kind: "station",
    label: "Stations",
  },
  {
    key: "units",
    kind: "unit-available",
    label: "Response units",
    variants: [
      { kind: "unit-available", label: "Available" },
      { kind: "unit-on-call", label: "On call" },
      { kind: "unit-unavailable", label: "Unavailable" },
    ],
  },
  { key: "hospitals", kind: "hospital", label: "Hospitals" },
  {
    key: "incidents",
    kind: "incident-covered",
    label: "Demand coverage",
    variants: [
      { kind: "incident-covered", label: "Covered" },
      { kind: "incident-uncovered", label: "Outside target" },
    ],
  },
  { key: "rendezvous", kind: "rendezvous", label: "Rendezvous" },
  { key: "liveIncident", kind: "live-incident", label: "Blood requests" },
];

type MapSymbolsProps = {
  coverageView: CoverageView;
  visibleLayers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
};

export function MapSymbols({
  coverageView,
  visibleLayers,
  onChange,
}: MapSymbolsProps) {
  function toggleLayer(layer: LayerKey) {
    onChange({ ...visibleLayers, [layer]: !visibleLayers[layer] });
  }

  return (
    <section className="map-symbols" aria-label="Map symbols and visibility">
      <div className="map-overlay__heading">
        <Layers3 size={16} aria-hidden="true" />
        <span>Map symbols</span>
      </div>
      <div className="map-symbols__items">
        {SYMBOL_GROUPS.map((group) => {
          const visible = visibleLayers[group.key];
          const variants = [
            ...(group.variants ?? []),
            ...(group.key === "stations" && coverageView === "strategic"
              ? [{ kind: "station-recommended", label: "Recommended staging" }]
              : []),
          ];

          return (
            <button
              aria-pressed={visible}
              className={`map-symbol${visible ? "" : " is-hidden"}`}
              key={group.key}
              onClick={() => toggleLayer(group.key)}
              title={`${visible ? "Hide" : "Show"} ${group.label}`}
              type="button"
            >
              <span className="map-symbol__primary">
                <span
                  aria-hidden="true"
                  className={`map-symbol__shape map-symbol__shape--${group.kind}`}
                />
                <span>{group.label}</span>
              </span>
              {visible ? (
                <Eye size={15} aria-hidden="true" />
              ) : (
                <EyeOff size={15} aria-hidden="true" />
              )}
              {variants.length > 0 ? (
                <span className="map-symbol__variants">
                  {variants.map((variant) => (
                    <span className="map-symbol__variant" key={variant.kind}>
                      <span
                        aria-hidden="true"
                        className={`map-symbol__shape map-symbol__shape--${variant.kind}`}
                      />
                      {variant.label}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
