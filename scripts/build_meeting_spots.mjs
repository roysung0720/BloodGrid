// Builds the public meeting-spot catalog used by the rendezvous evaluator.
//
// For each demo region it downloads parking lots, gas stations, fire stations, places of
// worship, and schools from OpenStreetMap (Overpass API), keeps an untouched raw snapshot
// with its SHA-256, filters out places two vehicles cannot use, and writes
// data/meeting_spots/<region>.csv plus data/meeting_spots/sources.json.
//
// Usage:  node scripts/build_meeting_spots.mjs            (download missing snapshots)
//         node scripts/build_meeting_spots.mjs --refresh  (download all snapshots again)
//         node scripts/build_meeting_spots.mjs --offline  (rebuild from saved snapshots)
//
// OpenStreetMap data is (c) OpenStreetMap contributors, available under the ODbL.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SNAPSHOT_DATE = "2026-09-27";
const rawDir = resolve(projectRoot, `data/raw/openstreetmap_meeting_spots_${SNAPSHOT_DATE}`);
const outDir = resolve(projectRoot, "data/meeting_spots");
const offline = process.argv.includes("--offline");

// Each region is a scenario bounding box plus a buffer, so routes near the edge still have spots.
const BUFFER_DEGREES = 0.15;
const REGIONS = [
  {
    regionId: "rural_ga_jackson_barrow_hall",
    scenarioIds: ["rural_ga_initial_v1"],
    bounds: { minLatitude: 33.95, maxLatitude: 34.36, minLongitude: -83.95, maxLongitude: -83.38 },
  },
  {
    regionId: "south_ga_echols_valdosta",
    scenarioIds: ["echols_valdosta_public_geography_v1"],
    bounds: { minLatitude: 30.5, maxLatitude: 31.12, minLongitude: -83.42, maxLongitude: -82.52 },
  },
];

// Filters. Places two vehicles cannot pull into and park side by side are excluded.
const MIN_LOT_AREA_M2 = 400; // roughly 15 car spaces
const EXCLUDED_ACCESS = new Set(["private", "no"]);
const EXCLUDED_PARKING_TYPES = new Set(["multi-storey", "underground", "rooftop"]);
const CATEGORY_BY_AMENITY = {
  parking: "PARKING",
  fuel: "FUEL_STATION",
  fire_station: "FIRE_STATION",
  place_of_worship: "PLACE_OF_WORSHIP",
  school: "SCHOOL",
};
const DEFAULT_NAMES = {
  PARKING: "Parking lot",
  FUEL_STATION: "Gas station",
  FIRE_STATION: "Fire station",
  PLACE_OF_WORSHIP: "Church lot",
  SCHOOL: "School lot",
};

function expanded(bounds) {
  return {
    minLatitude: +(bounds.minLatitude - BUFFER_DEGREES).toFixed(4),
    maxLatitude: +(bounds.maxLatitude + BUFFER_DEGREES).toFixed(4),
    minLongitude: +(bounds.minLongitude - BUFFER_DEGREES).toFixed(4),
    maxLongitude: +(bounds.maxLongitude + BUFFER_DEGREES).toFixed(4),
  };
}

function overpassQuery(b) {
  const box = `${b.minLatitude},${b.minLongitude},${b.maxLatitude},${b.maxLongitude}`;
  const amenities = Object.keys(CATEGORY_BY_AMENITY).join("|");
  // `bb` returns each area's bounding box: its middle is the location, its size bounds the area.
  // (Overpass allows one geometry option, so `center` is derived from the box instead.)
  return `[out:json][timeout:180];(nwr["amenity"~"^(${amenities})$"](${box}););out bb tags;`;
}

// Area of a latitude/longitude bounding box in square meters (an upper bound for the lot).
function boundingBoxArea(bounds) {
  if (!bounds) return null;
  const latMeters = 111_320;
  const midLat = ((bounds.minlat + bounds.maxlat) / 2) * (Math.PI / 180);
  const height = (bounds.maxlat - bounds.minlat) * latMeters;
  const width = (bounds.maxlon - bounds.minlon) * latMeters * Math.cos(midLat);
  return Math.round(height * width);
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toSpot(element) {
  const tags = element.tags ?? {};
  const category = CATEGORY_BY_AMENITY[tags.amenity];
  if (!category) return null;
  if (EXCLUDED_ACCESS.has(tags.access)) return { rejected: "private_or_no_access" };
  if (category === "PARKING" && EXCLUDED_PARKING_TYPES.has(tags.parking)) {
    return { rejected: "garage_or_underground" };
  }
  const box = element.bounds;
  const latitude = element.lat ?? element.center?.lat ?? (box ? (box.minlat + box.maxlat) / 2 : undefined);
  const longitude = element.lon ?? element.center?.lon ?? (box ? (box.minlon + box.maxlon) / 2 : undefined);
  if (latitude === undefined || longitude === undefined) return { rejected: "no_location" };

  const areaM2 = element.type === "node" ? null : boundingBoxArea(element.bounds);
  if (category === "PARKING" && areaM2 !== null && areaM2 < MIN_LOT_AREA_M2) {
    return { rejected: "too_small" };
  }
  const capacity = Number.parseInt(tags.capacity ?? "", 10);
  if (category === "PARKING" && element.type === "node" && Number.isFinite(capacity) && capacity < 15) {
    return { rejected: "too_small" };
  }
  return {
    spot_id: `OSM-${element.type[0].toUpperCase()}${element.id}`,
    name: (tags.name ?? tags.brand ?? DEFAULT_NAMES[category]).trim(),
    category,
    latitude: +latitude.toFixed(6),
    longitude: +longitude.toFixed(6),
    area_m2: areaM2 ?? "",
    osm_type: element.type,
    osm_id: element.id,
  };
}

// The public Overpass servers rate-limit back-to-back requests, so retry with a pause and
// fall back to a mirror. A response only counts if it is valid Overpass JSON.
const OVERPASS_MIRRORS = [OVERPASS_URL, "https://overpass.kumi.systems/api/interpreter"];

async function download(query) {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const url = OVERPASS_MIRRORS[attempt % OVERPASS_MIRRORS.length];
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "BloodGrid-HackGT/0.1" },
        body: `data=${encodeURIComponent(query)}`,
      });
      const text = await response.text();
      if (response.ok && Array.isArray(JSON.parse(text).elements)) {
        return text;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    console.log(`  attempt ${attempt + 1} failed (${lastError.message}); waiting before retrying...`);
    await new Promise((done) => setTimeout(done, 20_000 * (attempt + 1)));
  }
  throw new Error(`Overpass download failed: ${lastError?.message}`);
}

mkdirSync(rawDir, { recursive: true });
mkdirSync(outDir, { recursive: true });
const manifestSources = [];

for (const region of REGIONS) {
  const bounds = expanded(region.bounds);
  const query = overpassQuery(bounds);
  const rawPath = resolve(rawDir, `${region.regionId}.json`);
  const relativeRawPath = `data/raw/openstreetmap_meeting_spots_${SNAPSHOT_DATE}/${region.regionId}.json`;

  let rawText;
  const refresh = process.argv.includes("--refresh");
  if (offline || (existsSync(rawPath) && !refresh)) {
    // Reuse the saved snapshot (use --refresh to download it again).
    if (!existsSync(rawPath)) throw new Error(`No saved snapshot for ${region.regionId}; run without --offline.`);
    rawText = readFileSync(rawPath, "utf8");
    console.log(`Using saved snapshot for ${region.regionId}`);
  } else {
    console.log(`Downloading ${region.regionId} from OpenStreetMap...`);
    rawText = await download(query);
    writeFileSync(rawPath, rawText);
  }
  const sha256 = createHash("sha256").update(rawText).digest("hex");
  const elements = JSON.parse(rawText).elements ?? [];

  const rejected = {};
  const spots = [];
  for (const element of elements) {
    const result = toSpot(element);
    if (!result) continue;
    if (result.rejected) {
      rejected[result.rejected] = (rejected[result.rejected] ?? 0) + 1;
      continue;
    }
    spots.push(result);
  }
  spots.sort((a, b) => a.spot_id.localeCompare(b.spot_id));

  const header = ["spot_id", "name", "category", "latitude", "longitude", "area_m2", "osm_type", "osm_id"];
  const csv = [header.join(","), ...spots.map((spot) => header.map((key) => csvCell(spot[key])).join(","))].join("\n");
  writeFileSync(resolve(outDir, `${region.regionId}.csv`), `${csv}\n`);

  const byCategory = {};
  for (const spot of spots) byCategory[spot.category] = (byCategory[spot.category] ?? 0) + 1;
  console.log(`${region.regionId}: ${spots.length} spots kept`, byCategory, "rejected", rejected);

  manifestSources.push({
    source_id: `osm_meeting_spots_${region.regionId}`,
    classification: "REAL",
    publisher: "OpenStreetMap contributors (via the Overpass API)",
    title: `Parking lots, gas stations, fire stations, places of worship, and schools: ${region.regionId}`,
    url: `${OVERPASS_URL}?data=${encodeURIComponent(query)}`,
    accessed_at: `${SNAPSHOT_DATE}T00:00:00Z`,
    raw_path: relativeRawPath,
    sha256,
    license: "Open Database License (ODbL) 1.0; (c) OpenStreetMap contributors",
    region: { region_id: region.regionId, scenario_ids: region.scenarioIds, bounding_box: bounds },
    used_fields: ["type", "id", "lat", "lon", "center", "bounds", "tags.amenity", "tags.name", "tags.brand", "tags.access", "tags.parking", "tags.capacity"],
    transformations:
      `Kept amenity=${Object.keys(CATEGORY_BY_AMENITY).join("/")}. Dropped access=private/no, ` +
      `multi-storey/underground/rooftop parking, parking areas under ${MIN_LOT_AREA_M2} m2 (bounding-box area), ` +
      "and parking nodes with capacity under 15. " +
      "Location is the node, or the middle of the area's bounding box. Unnamed places get a generic name by category.",
    counts: { kept: spots.length, by_category: byCategory, rejected },
    limitations:
      "OpenStreetMap coverage is incomplete in rural areas. A mapped place is not verified as open, safe, " +
      "large enough, or accessible at any given time, and it is not an agency-approved rendezvous site. " +
      "Locations are area centers, not verified entrances. Spots are suggestions; the crew decides.",
  });
}

writeFileSync(
  resolve(outDir, "sources.json"),
  `${JSON.stringify({ manifest_version: "v1", catalog: "meeting_spots", sources: manifestSources }, null, 2)}\n`,
);
console.log("Wrote data/meeting_spots/*.csv and sources.json");
