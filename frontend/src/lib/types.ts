export type BoundingBox = {
  min_latitude: number;
  max_latitude: number;
  min_longitude: number;
  max_longitude: number;
};

export type ScenarioMetadata = {
  scenario_id: string;
  name: string;
  schema_version: string;
  classification: string;
  geographic_area: string;
  coordinate_system: string;
  bounding_box: BoundingBox;
  default_live_incident_id: string;
  target_coverage_minutes: number;
  purpose: string;
  limitations: string;
};

export type Station = {
  station_id: string;
  name: string;
  latitude: number;
  longitude: number;
  station_type: string;
  active: boolean;
  capacity: number;
};

export type ResponseUnit = {
  unit_id: string;
  unit_type: string;
  home_station_id: string;
  current_latitude: number;
  current_longitude: number;
  vehicle_status: string;
  crew_status: string;
  crew_level: string;
  blood_credentialed: boolean;
  mobilization_minutes: number;
  blood_units_onboard: number;
  shift_start: string;
  shift_end: string;
};

export type BloodUnit = {
  blood_unit_id: string;
  product_type: string;
  current_location_type: string;
  current_location_id: string;
  expiration_datetime: string;
  temperature_status: string;
  availability_status: string;
};

export type Hospital = {
  hospital_id: string;
  name: string;
  latitude: number;
  longitude: number;
  trauma_level: string;
  active: boolean;
};

export type HistoricalIncident = {
  incident_id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  incident_type: string;
  severity_proxy: string;
  source: string;
};

export type RendezvousPoint = {
  rendezvous_id: string;
  name: string;
  latitude: number;
  longitude: number;
  location_type: string;
  approved: boolean;
  active: boolean;
};

export type LiveIncident = {
  incident_id: string;
  latitude: number;
  longitude: number;
  destination_hospital_id: string;
  blood_requested: boolean;
  patient_unit_id: string;
  status: string;
  created_at: string;
};

export type ScenarioData = {
  metadata: ScenarioMetadata;
  stations: Station[];
  response_units: ResponseUnit[];
  blood_units: BloodUnit[];
  hospitals: Hospital[];
  historical_incidents: HistoricalIncident[];
  rendezvous_points: RendezvousPoint[];
  live_incidents: LiveIncident[];
};

export type LayerKey =
  | "stations"
  | "units"
  | "hospitals"
  | "incidents"
  | "rendezvous"
  | "liveIncident";

export type LayerVisibility = Record<LayerKey, boolean>;

export type FeatureSelection = {
  type: "station" | "unit" | "hospital" | "incident" | "rendezvous" | "liveIncident";
  id: string;
};
