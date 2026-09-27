# Safety and Assumptions

## Product boundary

BloodGrid accepts an already-authorized request for blood from dispatch or on-scene clinicians. It provides logistics recommendations only.

It must not decide whether blood is medically indicated, select a product or dose, diagnose a patient, set treatment protocol, choose a hospital based on medical judgment, or replace clinical direction.

## Operational assumptions

- A destination hospital is supplied to the live-incident workflow.
- Patient transport should continue generally toward definitive care.
- Rendezvous points must come from the approved dataset, not arbitrary map coordinates.
- Direct hospital transport is always considered and may be the recommended option.
- Availability, credentialing, valid blood, storage status, and on-call mobilization time materially affect recommendations.
- Results are prototype decision support and remain subject to local EMS protocols and medical direction in real deployment.

## Baseline coverage assumptions

- Baseline coverage uses the fastest estimated road response from a currently eligible response unit to each synthetic historical demand proxy.
- An `ON_CALL` unit's configured mobilization time is added to its driving estimate before comparison with the coverage target.
- The selected scenario supplies the default target coverage time; a local environment override is for demo exploration only.
- Mapbox's `mapbox/driving` Matrix profile supplies estimated road duration and distance. The MVP does not model emergency vehicle driving privileges, live traffic, road closures, weather, dispatch workload, handoff time, or clinical readiness beyond the explicit synthetic records.
- A covered result means only that the modeled unit meets the configured synthetic logistics target. It is not a dispatch order, clinical assessment, guarantee, or real-world service-level claim.

## Strategic deployment assumptions

- The strategic plan is a planning comparison for the synthetic scenario, not a live reallocation order.
- Every currently eligible unit is assigned to one active station, and station capacity is enforced.
- The first objective maximizes modeled target-time demand coverage only. Severity weighting, repositioning burden, fairness, time-of-day demand, expiration risk, and real operational approval are outside this MVP step.
- The existing on-call mobilization delay remains attached to the unit even when the optimizer changes its staging location.

## Explainability

Every recommendation should expose the calculated facts behind it: eligible status, travel times, time-to-blood, wait times, direct-hospital baseline, and added hospital delay. The MVP does not require an LLM to explain these results.
