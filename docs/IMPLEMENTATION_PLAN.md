# Implementation Plan

## 1. Foundation and documentation

Create the repository layout, project contract, environment placeholders, and local setup guidance. This milestone is complete when contributors can understand the system boundaries before application code exists.

## 2. Minimal data world

Create 5-10 staging locations, 2-3 Blood Response Units, 1-3 hospitals, roughly 30 demand-proxy incidents, approved rendezvous points, and clearly labeled synthetic operational fields.

## 3. Display the world

Build the dashboard map and display stations, units, hospitals, incidents, and availability state. Do not wait for the optimizer.

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
