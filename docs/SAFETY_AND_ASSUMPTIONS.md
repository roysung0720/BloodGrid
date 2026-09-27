# Safety and Assumptions

## Product boundary

BloodGrid accepts an already-authorized request for blood from dispatch or on-scene clinicians. It provides logistics recommendations only.

It must not decide whether blood is medically indicated, select a product or dose, diagnose a patient, set treatment protocol, choose a hospital based on medical judgment, or replace clinical direction.

## Operational assumptions

- A destination hospital is supplied to the live-incident workflow.
- Patient transport should continue generally toward definitive care.
- Meeting spots come from mapped public places (parking lots, gas stations, fire stations, churches, and school lots from OpenStreetMap), the scenario's known sites, or, where mapped places are scarce, a roadside point on the route. The earlier "approved dataset only" rule was retired by 2026-09-27 team decision. A spot is a suggestion; the crew decides where it is safe to stop.
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

## Live rendezvous assumptions

- A live evaluation starts only after the synthetic incident already records an authorized blood request.
- The incident's hospital is supplied input. BloodGrid validates that it is an active known record, displays its recorded trauma level as context, and never selects, replaces, or clinically evaluates a destination.
- Candidate spots are those near the ambulance's route to the supplied hospital or near an eligible unit's road toward the ambulance. The rule picks the unit and spot where blood arrives soonest among spots that keep the ambulance heading in the general direction of the hospital: no more than a few minutes farther from the hospital than the start, a bounded added hospital delay (a share of the direct trip), and blood arriving meaningfully sooner than simply reaching the hospital. Otherwise the result is direct transport.
- A mapped place is not verified as open, safe, large enough, or accessible at any given moment, and it is not an agency-approved site. OpenStreetMap coverage is incomplete in rural areas.
- A point must deliver an eligible resource before the modeled direct-hospital arrival and remain within the configured maximum added hospital-delay limit. Otherwise, the transparent result is direct transport.
- The score is a logistics comparison: `time_to_blood + hospital_delay_weight * added_hospital_delay`. It does not determine treatment, transfusion, or clinical benefit.

## Dynamic availability assumptions

- Operating states are named, versioned, and explicitly labeled synthetic demo profiles. They are not a live CAD, staffing, credentialing, blood-bank, or dispatch feed.
- A profile changes only an in-memory copy of the selected scenario. It never writes operational status back to source data or sends a recommendation to a field unit.
- Every profile reuses the same explicit eligibility rule. A changed vehicle, crew, credential, mobilization, or blood status affects coverage, deployment, and rendezvous calculations consistently.

## Ambulance UI assumptions

- **Make Request** records a request the crew has already decided to make under its own protocol. BloodGrid never prompts for, suggests, or evaluates the need for blood.
- The crew chooses the blood product and the destination hospital, and nothing is preselected.
  - Hospitals are listed only by modeled road drive time, with their recorded trauma level as plain text. They are never labelled recommended, best, or closest.
  - The product is recorded, not recommended.
- **Go** runs the same deterministic live evaluator as the System UI. Direct transport is always compared and may win, and the screen then says so.
- Turn-by-turn guidance is a display aid from normal-driving routes. It does not model emergency driving, traffic, or closures, and road rules, agency policy, and crew judgment take precedence.
- The screen is designed for the attending crew member or partner, not the driver while the vehicle is moving.
- Crew requests and positions are simulated demo records held in memory. The location is simulated by default. Nothing is sent to a real CAD, blood bank, or field unit.

## Explainability

Every recommendation should expose the calculated facts behind it: eligible status, travel times, time-to-blood, wait times, direct-hospital baseline, and added hospital delay. The MVP does not require an LLM to explain these results.
