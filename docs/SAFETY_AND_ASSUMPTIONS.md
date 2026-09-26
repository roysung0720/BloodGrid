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

## Explainability

Every recommendation should expose the calculated facts behind it: eligible status, travel times, time-to-blood, wait times, direct-hospital baseline, and added hospital delay. The MVP does not require an LLM to explain these results.
