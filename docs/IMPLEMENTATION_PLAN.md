# Implementation Plan

## 1. Foundation and documentation

Create the repository layout, project contract, environment placeholders, and local setup guidance. This milestone is complete when contributors can understand the system boundaries before application code exists.

## 2. Minimal data world - complete

The first versioned scenario, `rural_ga_initial_v1`, includes 8 staging locations, 3 Blood Response Units, 3 hospitals, 30 synthetic demand-proxy incidents, 8 approved rendezvous points, a live incident, and clearly labeled synthetic operational data. Its CSV rules are in `data/schemas/v1/` and its provenance is stored with the scenario.

## 3. Display the world - complete

The Next.js dashboard and FastAPI data service load `rural_ga_initial_v1` through one read-only API. The map displays stations, response units, hospitals, incident-demand proxies, approved rendezvous points, and the simulated blood request. Layer controls, unit status, marker selection, and a persistent synthetic-data label are included. No optimizer or routing logic is included in this phase.

## 4. Routing and baseline coverage

Add the Mapbox routing adapter, verify road travel-time results, and calculate the current eligible-unit coverage baseline.

## 5. Strategic deployment

Implement and test OR-Tools placement recommendations, then display before/after coverage.

## 6. Live incident and rendezvous

Simulate a blood request, compare direct hospital transport with approved intercept candidates, and return an explainable recommendation.

## 7. Dynamic availability

Support unavailable, on-call, unqualified, and no-valid-blood states, and automatically recalculate affected outputs.

## 8. Data improvement and polish

Replace feasible placeholder geography with public real data, document provenance, refine the demo, and consider stretch features only after core tests pass.
