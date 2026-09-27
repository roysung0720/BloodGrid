import { Eye, EyeOff, Layers3 } from "lucide-react";

import type { LayerKey, LayerVisibility } from "../lib/types";

const LAYERS: Array<{ key: LayerKey; label: string; color: string }> = [
  { key: "stations", label: "Stations", color: "var(--station)" },
  { key: "units", label: "Response units", color: "var(--unit-available)" },
  { key: "hospitals", label: "Hospitals", color: "var(--hospital)" },
  { key: "incidents", label: "Demand coverage", color: "var(--coverage-covered)" },
  { key: "rendezvous", label: "Meeting spots", color: "var(--rendezvous)" },
  { key: "liveIncident", label: "Live incident", color: "var(--live-incident)" },
];

type LayerControlsProps = {
  visibleLayers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
};

export function LayerControls({
  visibleLayers,
  onChange,
}: LayerControlsProps) {
  function toggleLayer(layer: LayerKey) {
    onChange({ ...visibleLayers, [layer]: !visibleLayers[layer] });
  }

  return (
    <section className="layer-controls" aria-label="Map layers">
      <div className="map-overlay__heading">
        <Layers3 size={16} aria-hidden="true" />
        <span>Map layers</span>
      </div>
      <div className="layer-controls__items">
        {LAYERS.map((layer) => {
          const visible = visibleLayers[layer.key];
          return (
            <button
              aria-pressed={visible}
              className="layer-control"
              key={layer.key}
              onClick={() => toggleLayer(layer.key)}
              title={`${visible ? "Hide" : "Show"} ${layer.label}`}
              type="button"
            >
              <span
                className="layer-control__swatch"
                style={{ backgroundColor: layer.color }}
              />
              <span>{layer.label}</span>
              {visible ? (
                <Eye size={15} aria-hidden="true" />
              ) : (
                <EyeOff size={15} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
