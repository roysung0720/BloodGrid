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

export type CoverageStatus =
  | "COVERED"
  | "UNCOVERED"
  | "NO_ELIGIBLE_RESOURCE"
  | "NO_ROUTE";

export type ResourceEligibility = {
  unit_id: string;
  eligible: boolean;
  valid_blood_units: number;
  reasons: string[];
};

export type BaselineCoveragePoint = {
  incident_id: string;
  status: CoverageStatus;
  covered: boolean;
  best_resource_id: string | null;
  driving_minutes: number | null;
  mobilization_minutes: number | null;
  total_response_minutes: number | null;
  route_distance_miles: number | null;
};

export type BaselineCoverageResult = {
  scenario_id: string;
  target_coverage_minutes: number;
  routing_provider: string;
  routing_profile: string;
  eligible_resource_count: number;
  covered_demand_count: number;
  uncovered_demand_count: number;
  resource_eligibility: ResourceEligibility[];
  demand_points: BaselineCoveragePoint[];
};

export type StrategicAssignment = {
  unit_id: string;
  station_id: string;
  station_name: string;
  mobilization_minutes: number;
};

export type StrategicCoveragePoint = {
  incident_id: string;
  status: CoverageStatus;
  covered: boolean;
  best_resource_id: string | null;
  staged_station_id: string | null;
  driving_minutes: number | null;
  mobilization_minutes: number | null;
  total_response_minutes: number | null;
  route_distance_miles: number | null;
};

export type StrategicDeploymentResult = {
  scenario_id: string;
  target_coverage_minutes: number;
  routing_provider: string;
  routing_profile: string;
  solver_status: string;
  eligible_resource_count: number;
  optimized_covered_demand_count: number;
  optimized_uncovered_demand_count: number;
  assignments: StrategicAssignment[];
  demand_points: StrategicCoveragePoint[];
};

export type CoverageView = "baseline" | "strategic";

export type RendezvousCandidateStatus =
  | "RECOMMENDED"
  | "NOT_SELECTED"
  | "INELIGIBLE_POINT"
  | "NO_ELIGIBLE_RESOURCE"
  | "NO_ROUTE"
  | "TOO_LATE"
  | "EXCESSIVE_DETOUR";

export type RendezvousCandidate = {
  rendezvous_id: string;
  rendezvous_name: string;
  status: RendezvousCandidateStatus;
  reason: string;
  resource_id: string | null;
  patient_to_rendezvous_minutes: number | null;
  resource_driving_minutes: number | null;
  mobilization_minutes: number | null;
  resource_arrival_minutes: number | null;
  patient_wait_minutes: number | null;
  resource_wait_minutes: number | null;
  time_to_blood_minutes: number | null;
  rendezvous_to_hospital_minutes: number | null;
  hospital_arrival_minutes: number | null;
  added_hospital_delay_minutes: number | null;
  score: number | null;
};

export type LiveRendezvousResult = {
  scenario_id: string;
  incident_id: string;
  patient_unit_id: string;
  destination_hospital_id: string;
  destination_hospital_name: string;
  destination_trauma_level: string;
  destination_valid: boolean;
  routing_provider: string;
  routing_profile: string;
  eligible_resource_count: number;
  direct_transport_minutes: number;
  direct_route_distance_miles: number;
  max_added_hospital_delay_minutes: number;
  hospital_delay_weight: number;
  recommendation: "RENDEZVOUS" | "DIRECT_TRANSPORT";
  recommendation_reason: string;
  recommended_rendezvous_id: string | null;
  candidates: RendezvousCandidate[];
};
