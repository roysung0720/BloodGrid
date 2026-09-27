// Shared BloodGrid map look: Mapbox's free dark base map, recolored so it matches the
// app theme exactly (near-black land, dark water, grey labels) with the road network
// in brand reds, echoing the "red roads on black" deck background.

import type mapboxgl from "mapbox-gl";

export const BRAND_MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

/** Base-map colors, matched to the theme tokens in globals.css (--bg, --panel, ...). */
const BASE = {
  land: "#08080a",
  landcover: "#0c0c0f",
  park: "#0d100e",
  water: "#0f1116",
  waterway: "#141821",
  building: "#141418",
  boundary: "#3a3a44",
  label: "#8a8a96",
  labelMajor: "#b4b4be",
  labelHalo: "#060608",
};

/**
 * full: the System UI's regional view, roads glowing red like the deck.
 * subtle: the Ambulance UI, darker red roads so the bright route line stands out.
 */
const ROAD_COLORS = {
  full: { major: "#c21a24", minor: "#6b161c" },
  subtle: { major: "#5c2226", minor: "#33191c" },
} as const;

const ROAD_LAYER = /road|bridge|tunnel/;
const NOT_A_ROAD_LINE = /label|shield|path|pedestrian|steps|rail|ferry|aerialway/;
const MAJOR_ROAD = /motorway|trunk|primary/;
const MAJOR_LABEL = /country|state|settlement-major|settlement-subdivision|place-city/;

function safePaint(map: mapboxgl.Map, layerId: string, property: string, value: string) {
  try {
    map.setPaintProperty(layerId, property as never, value as never);
  } catch {
    // Some layers do not support a given property; leave them as the style defines.
  }
}

/** Recolor the whole base map to the BloodGrid theme. Call after the style has loaded. */
export function applyBrandMap(map: mapboxgl.Map, intensity: keyof typeof ROAD_COLORS) {
  const roads = ROAD_COLORS[intensity];
  for (const layer of map.getStyle()?.layers ?? []) {
    const id = layer.id;
    switch (layer.type) {
      case "background":
        safePaint(map, id, "background-color", BASE.land);
        break;
      case "fill":
        if (/water/.test(id)) safePaint(map, id, "fill-color", BASE.water);
        else if (/building/.test(id)) safePaint(map, id, "fill-color", BASE.building);
        else if (/park|national|pitch|golf|wood|grass|scrub|crop/.test(id)) safePaint(map, id, "fill-color", BASE.park);
        else if (/land/.test(id)) safePaint(map, id, "fill-color", BASE.landcover);
        break;
      case "line":
        if (/waterway|water/.test(id)) {
          safePaint(map, id, "line-color", BASE.waterway);
        } else if (/admin|boundary/.test(id)) {
          safePaint(map, id, "line-color", BASE.boundary);
        } else if (ROAD_LAYER.test(id) && !NOT_A_ROAD_LINE.test(id)) {
          // Casings (road outlines) stay near-black so the red reads as a glow.
          safePaint(
            map,
            id,
            "line-color",
            id.includes("case") ? BASE.land : MAJOR_ROAD.test(id) ? roads.major : roads.minor,
          );
        }
        break;
      case "symbol":
        safePaint(map, id, "text-color", MAJOR_LABEL.test(id) ? BASE.labelMajor : BASE.label);
        safePaint(map, id, "text-halo-color", BASE.labelHalo);
        break;
      default:
        break;
    }
  }
}
