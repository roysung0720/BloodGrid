import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const scenarioDir = resolve(
  projectRoot,
  "data/scenarios/echols_valdosta_public_geography_v1",
);
const processedDir = resolve(
  projectRoot,
  "data/processed/echols_valdosta_public_geography_v1",
);
const bounds = {
  minLatitude: 30.5,
  maxLatitude: 31.12,
  minLongitude: -83.42,
  maxLongitude: -82.52,
};

function readGeoJson(relativePath) {
  return JSON.parse(readFileSync(resolve(projectRoot, relativePath), "utf8"));
}

function isInBounds([longitude, latitude]) {
  return (
    latitude >= bounds.minLatitude &&
    latitude <= bounds.maxLatitude &&
    longitude >= bounds.minLongitude &&
    longitude <= bounds.maxLongitude
  );
}

function buildCandidates(featureCollection, roadClass) {
  return featureCollection.features
    .filter((feature) => feature.geometry.type === "LineString")
    .flatMap((feature) => {
      const roadName = feature.properties.NAME ?? feature.properties.BASENAME ?? "Unnamed road";
      const points = feature.geometry.coordinates.filter(isInBounds);
      return points.map((coordinate, pointIndex) => ({
        coordinate,
        pointIndex,
        roadClass,
        roadName,
        sourceOid: feature.properties.OID,
      }));
    });
}

function sampleCandidates(candidates, count, seed) {
  const samples = [];
  let state = seed;
  const candidatesByRoad = new Map();

  for (const candidate of candidates) {
    const roadCandidates = candidatesByRoad.get(candidate.roadName) ?? [];
    roadCandidates.push(candidate);
    candidatesByRoad.set(candidate.roadName, roadCandidates);
  }
  const roadNames = [...candidatesByRoad.keys()].sort();
  for (let index = roadNames.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [roadNames[index], roadNames[swapIndex]] = [
      roadNames[swapIndex],
      roadNames[index],
    ];
  }
  const usedCandidates = new Set();

  while (samples.length < count) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const roadName = roadNames[samples.length % roadNames.length];
    const roadCandidates = candidatesByRoad.get(roadName);
    const candidateIndex = state % roadCandidates.length;
    const candidate = roadCandidates[candidateIndex];
    const candidateKey = `${candidate.sourceOid}:${candidate.pointIndex}`;
    if (usedCandidates.has(candidateKey)) {
      continue;
    }
    usedCandidates.add(candidateKey);
    samples.push(candidate);
  }
  return samples;
}

function offsetCoordinate([longitude, latitude], index) {
  const angle = ((index * 137.5) % 360) * (Math.PI / 180);
  const offsetMeters = 12 + ((index * 17) % 43);
  const latitudeOffset = (Math.cos(angle) * offsetMeters) / 111_320;
  const longitudeOffset =
    (Math.sin(angle) * offsetMeters) / (111_320 * Math.cos((latitude * Math.PI) / 180));
  return [longitude + longitudeOffset, latitude + latitudeOffset, Math.round(offsetMeters)];
}

function csvEscape(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const primaryRoads = readGeoJson(
  "data/raw/census_tiger_2026_roads/echols_valdosta_primary_roads.geojson",
);
const secondaryRoads = readGeoJson(
  "data/raw/census_tiger_2026_roads/echols_valdosta_secondary_roads.geojson",
);
const primaryCandidates = buildCandidates(primaryRoads, "PRIMARY");
const secondaryCandidates = buildCandidates(secondaryRoads, "SECONDARY");
const samples = [
  ...sampleCandidates(primaryCandidates, 18, 13_101),
  ...sampleCandidates(secondaryCandidates, 12, 31_601),
].map((sample, index) => {
  const [longitude, latitude, offsetMeters] = offsetCoordinate(sample.coordinate, index + 1);
  return {
    ...sample,
    incidentId: `DP-EV-${String(index + 1).padStart(3, "0")}`,
    latitude,
    longitude,
    offsetMeters,
  };
});

const severityCycle = ["HIGH", "MEDIUM", "CRITICAL", "MEDIUM", "HIGH"];
const runtimeHeader = [
  "incident_id",
  "timestamp",
  "latitude",
  "longitude",
  "incident_type",
  "severity_proxy",
  "source",
];
const runtimeRows = samples.map((sample, index) => {
  const day = 20 + Math.floor(index / 6);
  const hour = 8 + ((index * 3) % 10);
  return [
    sample.incidentId,
    `2026-09-${day}T${String(hour).padStart(2, "0")}:00:00Z`,
    sample.latitude.toFixed(6),
    sample.longitude.toFixed(6),
    "SYNTHETIC_ROAD_ALIGNED_DEMAND_PROXY",
    severityCycle[index % severityCycle.length],
    "SYNTHETIC_ROAD_ALIGNED_DEMAND_PROXY",
  ];
});

const referenceHeader = [
  "incident_id",
  "source_road_name",
  "source_road_class",
  "source_road_oid",
  "source_vertex_index",
  "latitude",
  "longitude",
  "centerline_offset_meters",
  "classification",
  "method",
];
const referenceRows = samples.map((sample) => [
  sample.incidentId,
  sample.roadName,
  sample.roadClass,
  sample.sourceOid,
  sample.pointIndex,
  sample.latitude.toFixed(6),
  sample.longitude.toFixed(6),
  sample.offsetMeters,
  "SYNTHETIC_ROAD_ALIGNED_DEMAND_PROXY",
  "Deterministic sample from public Census road centerline with a 12-54 meter synthetic offset",
]);

function writeCsv(path, header, rows) {
  writeFileSync(
    path,
    [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n",
  );
}

writeCsv(resolve(scenarioDir, "historical_incidents.csv"), runtimeHeader, runtimeRows);
writeCsv(
  resolve(processedDir, "road_aligned_demand_proxies.csv"),
  referenceHeader,
  referenceRows,
);
