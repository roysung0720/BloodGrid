# Implementation Plan

## 1. Foundation and documentation

Create the repository layout, project contract, environment placeholders, and local setup guidance. This milestone is complete when contributors can understand the system boundaries before application code exists.

## 2. Minimal data world - complete

The first versioned scenario, `rural_ga_initial_v1`, includes 8 staging locations, 3 Blood Response Units, 3 hospitals, 30 synthetic demand-proxy incidents, 8 approved rendezvous points, a live incident, and clearly labeled synthetic operational data. Its CSV rules are in `data/schemas/v1/` and its provenance is stored with the scenario.

## 3. Display the world - complete

The Next.js dashboard and FastAPI data service load `rural_ga_initial_v1` through one read-only API. The map displays stations, response units, hospitals, incident-demand proxies, approved rendezvous points, and the simulated blood request. Layer controls, unit status, marker selection, and a persistent synthetic-data label are included. No optimizer or routing logic is included in this phase.

## 4. Routing and baseline coverage - complete

The Mapbox Matrix adapter is isolated behind a provider-neutral routing interface. The baseline coverage service evaluates valid blood, vehicle availability, clinician qualification, and allowable crew status; adds on-call mobilization delay; and compares each synthetic demand point with the scenario's configured target. The dashboard displays covered and uncovered demand points with inspectable timing details.

## 5. Strategic deployment - complete

The OR-Tools CP-SAT deployment model assigns each eligible unit to one active station without exceeding station capacity. It maximizes synthetic demand points reachable within the target, reuses the shared eligibility and routing interfaces, and returns an explainable assignment. The dashboard compares the current baseline with the optimized coverage and can switch its map view between them.

## 6. Live incident and rendezvous - complete

The deterministic live evaluator validates the supplied active hospital record, compares direct transport with nearby meeting spots (mapped public places, known sites, or roadside points; amended 2026-09-27). It includes resource eligibility, on-call mobilization, both vehicles' wait time, time-to-blood, and added hospital delay, then returns the soonest-blood spot that keeps heading toward the hospital, or direct transport. The dashboard shows the options reviewed and marks the selected spot on the map.

## 7. Dynamic availability - complete

Named synthetic availability profiles are stored beside the scenario and applied to an in-memory copy. The dashboard selector refreshes baseline coverage, strategic deployment, and live rendezvous together; resource markers and the unit list visibly identify ineligible units. Profiles cover unavailable vehicle, immediately staffed/on-call status, unavailable blood, and unqualified clinician states while preserving a resettable baseline.

## 8. Data improvement and polish - in progress

Refine the demo while retaining the tested MVP. The synthetic live-incident dataset now contains four cases and the dashboard selector refreshes the selected incident's direct-transport comparison, meeting-spot review, eligible-resource options, and map context while preserving its supplied hospital. A second, additive `echols_valdosta_public_geography_v1` scenario demonstrates the real-geography / synthetic-operations storage pattern with source snapshots and a field-level manifest. Its 30 synthetic demand proxies are now deterministically distributed along saved public Census primary and secondary road geometry rather than a hand-drawn grid. The dashboard's Demo data set selector switches between these complete worlds without a restart, while resetting each scenario to its baseline synthetic operating state. Next, polish the presentation and consider stretch features only after core tests pass.
