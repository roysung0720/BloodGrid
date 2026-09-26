# BloodGrid Product & Implementation Specification

**Project type:** HackGT hackathon prototype  
**Audience:** Codex / coding agents, project teammates, and future contributors  
**Status:** Build-ready specification; several parameters are intentionally configurable  

---

## 1. Project Context

BloodGrid is a software prototype for **rural EMS prehospital-blood logistics**.

The team consists of two HackGT participants with limited traditional programming experience. Coding agents such as Codex will be used heavily. Therefore:

- Prefer the **simplest architecture that works**.
- Explain implementation choices clearly in repository documentation.
- Avoid unnecessary frameworks, paid services, or premature complexity.
- Preserve a working MVP before attempting stretch features.
- Keep core medical/logistics rules explicit in code instead of letting an LLM invent them.
- The project must be understandable enough that the team can explain and demo it confidently.

The project should be designed as a **decision-support and optimization prototype**, not a clinical decision-maker.

---

## 2. Product Summary

BloodGrid answers two operational questions:

1. **Strategic deployment:** Where should scarce blood-capable EMS resources normally be positioned across a rural region so that severe-trauma incidents can access prehospital blood quickly?
2. **Live incident response:** Once blood is requested for a specific patient, which available blood-capable resource should respond, and where should it rendezvous with the transporting ambulance so blood can reach the patient quickly without unnecessarily delaying transport to the relevant hospital/trauma center?

Core concept:

> Existing systems can track where blood is. BloodGrid focuses on where blood-capable resources **should be positioned** and how they should **move during an emergency**.

---

## 3. Primary Users

### Primary user

- EMS operations leadership
- EMS dispatch / communications center personnel
- Regional EMS planners

### Not primary users

- Patients
- General public
- Individual EMTs making independent clinical decisions
- Blood-bank staff using BloodGrid as their inventory system

BloodGrid should complement existing EMS/CAD/blood-management systems rather than replace them.

---

## 4. Clinical and Safety Boundary

BloodGrid **must not decide whether a patient medically needs blood**.

A blood request is assumed to come from one of two sources:

1. **Dispatch / communications:** call information meets an agency-defined trigger or protocol for sending a blood-capable resource.
2. **First responders / clinicians on scene:** the crew observes the patient and requests a blood-capable resource according to local protocols.

Once blood has been requested, BloodGrid solves only the logistics problem:

> Which eligible blood-capable resource can reach the patient fastest, and what movement/rendezvous plan best balances time-to-blood with continued progress toward definitive care?

BloodGrid does **not** make decisions about:

- whether transfusion is medically indicated;
- blood-product selection;
- transfusion volume or dose;
- when transfusion should stop;
- treatment protocols;
- diagnosis;
- destination selection based on medical judgment beyond the destination supplied to the system.

All real-world use would remain subject to local EMS protocols, medical direction, blood-bank procedures, state scope-of-practice rules, and agency credentialing.

---

## 5. Definition of a Blood-Capable Resource

BloodGrid must not treat “blood” alone as a usable response resource.

For the MVP, an eligible blood-capable resource requires all of the following:

1. **Usable blood is available.**
2. **An eligible EMS response vehicle is available.**
3. **An appropriately credentialed clinician is available** to provide prehospital blood under the agency's rules.
4. **Blood storage/transport status is valid** for the prototype model.

Conceptually:

```text
usable blood-capable resource
    = valid blood
    + eligible vehicle
    + qualified clinician
    + valid operational status
```

If any component is missing, the resource must not be considered eligible for a blood response.

---

## 6. Staffing and Availability Model

### Preferred operational model

The main BloodGrid model should use **dedicated or supervisor-style Blood Response Units** that are normally staffed by an appropriately credentialed paramedic and carry temperature-controlled prehospital blood.

Example:

```text
Blood Response Unit BR-02
vehicle_type = supervisor
qualified_clinician = true
blood_units_onboard = 2
status = AVAILABLE
```

### On-call personnel

BloodGrid should also support a fallback **ON_CALL** model, especially for rural systems.

An on-call clinician may be available to respond but not physically at the response vehicle. Therefore BloodGrid must include a **mobilization delay**.

Example:

```text
crew_status = ON_CALL
estimated_mobilization_minutes = 8
vehicle_status = READY
blood_units_onboard = 2
```

For an on-call unit:

```text
time_to_patient = mobilization_delay + driving_time
```

A farther continuously staffed unit may therefore be preferable to a geographically closer on-call unit.

### Resource statuses

At minimum, support:

```text
AVAILABLE
ON_CALL
RESPONDING
WITH_PATIENT
RESTOCKING
OUT_OF_SERVICE
NO_QUALIFIED_CLINICIAN
```

Only eligible states may be used for live response recommendations.

### 24/7 concept

The long-term system should be capable of evaluating coverage by time of day / shift rather than assuming every blood-capable unit is always staffed.

For HackGT, a simplified shift/availability model is acceptable, but the data schema should be compatible with future 24/7 scheduling data.

---

## 7. Blood Storage and Deployment Model

### MVP model

Use two main blood-storage states:

#### A. Reserve supply

Primary reserve source:

- hospital / trauma-center blood bank

This is the source from which field units are supplied or restocked.

#### B. Mobile field supply

Active Blood Response Units carry one or more units in validated temperature-controlled storage.

For the prototype, model:

- blood unit ID;
- product type;
- current location;
- expiration time/date;
- temperature/storage status;
- availability status.

### Optional / future stationary caches

Future deployments could include compliant fixed caches at approved EMS/fire bases, but these should **not be required for the MVP**.

Blood should not be modeled as stored at arbitrary public locations such as pharmacies, police stations, or unrelated public buildings.

---

## 8. Blood Lifecycle Model

The MVP should represent a simple but realistic lifecycle:

```text
RESERVE
  -> ASSIGNED_TO_RESPONSE_UNIT
  -> ONBOARD
      -> TRANSFUSED
      -> RETURNED_TO_BLOOD_BANK
      -> REASSIGNED
      -> UNAVAILABLE / EXPIRED
```

The hackathon version does not need to replicate a full blood-bank information system. It only needs enough lifecycle state to determine whether a blood unit is usable by the optimizer.

---

## 9. Core Product Modes

BloodGrid has two main operating modes.

### Mode A — Strategic Deployment Optimizer

Question:

> Where should available Blood Response Units normally stage to maximize timely geographic access to prehospital blood?

Inputs may include:

- candidate EMS stations / staging locations;
- available Blood Response Units;
- staffing/availability;
- historical severe-trauma geography;
- road travel times;
- blood inventory;
- optional expiration risk;
- optional time-of-day demand.

Primary MVP objective:

> Maximize the proportion of modeled severe-trauma incidents reachable by an eligible blood-capable resource within a configurable target time, e.g. 20 minutes.

Potential secondary objectives / penalties:

- minimize uncovered high-risk incidents;
- reduce geographic concentration of all resources;
- minimize blood-expiration risk;
- reduce repositioning distance;
- support rural/equity-focused minimum coverage.

### Mode B — Live Incident / Rendezvous Optimizer

Question:

> Blood has been requested. Which eligible resource should respond, and where should it meet the patient ambulance?

The patient ambulance should normally continue generally toward the relevant hospital/trauma center.

BloodGrid should compare at least:

1. **Direct hospital transport** with no intercept.
2. **Mobile blood intercept**, where a Blood Response Unit moves toward the patient ambulance.
3. Optional future: approved stationary blood pickup/cache.

The live optimizer should consider:

- patient ambulance position;
- patient destination;
- blood-resource locations;
- resource availability;
- mobilization delay;
- candidate rendezvous points;
- road travel times;
- patient wait time;
- blood-resource wait time;
- added hospital delay.

---

## 10. Rendezvous Rules

A rendezvous should **not** be an arbitrary midpoint between vehicles.

### Candidate points

BloodGrid should evaluate **approved candidate rendezvous locations** stored in the data model.

Examples could include:

- EMS/fire stations;
- highway interchanges;
- large safe staging areas;
- agency-approved parking/staging locations;
- other approved points near common transport corridors.

### Geographic constraint

Candidate rendezvous points should be:

- on or near the patient's route to the supplied hospital/trauma center;
- reachable safely by both vehicles;
- not require a large unnecessary detour from definitive care.

### Tentative scoring concept

For each candidate point:

```text
time_to_blood
added_hospital_delay
blood_vehicle_travel_time
patient_vehicle_wait_time
blood_vehicle_wait_time
```

A simple MVP score can be:

```text
score = time_to_blood + alpha * added_hospital_delay
```

where `alpha` is configurable.

The exact weighting is **not yet frozen** and should be easy to adjust.

The system should also be allowed to conclude:

> No rendezvous recommended; continue directly to hospital.

---

## 11. Strategic Optimization Approach

Use **Google OR-Tools** in Python.

OR-Tools is a mathematical optimization library, not an LLM.

The strategic deployment problem is naturally integer/discrete:

- assign a Blood Response Unit to Station A? yes/no;
- assign it to Station B? yes/no;
- incident covered within target time? yes/no.

Use OR-Tools with an appropriate integer solver, likely **CP-SAT**.

### Example decision variable

```text
x[u,s] = 1 if response unit u is assigned to station s
         0 otherwise
```

### Example constraints

- each available unit is assigned to at most one staging location;
- ineligible units cannot be assigned;
- station capacity may be limited;
- available blood inventory cannot be exceeded.

### Example objective

Maximize:

```text
number / weighted number of historical severe incidents
reachable within TARGET_COVERAGE_MINUTES
```

The optimizer should expose configuration values rather than burying them in code.

---

## 12. Live Rendezvous Optimization Approach

The live rendezvous MVP does **not** need to use OR-Tools.

Simpler approach:

1. Get approved candidate rendezvous points near the route.
2. Use the routing provider to calculate:
   - patient ambulance -> rendezvous;
   - blood resource -> rendezvous;
   - rendezvous -> hospital;
   - patient direct -> hospital.
3. Calculate time-to-blood and added hospital delay.
4. Eliminate infeasible points.
5. Score remaining candidates.
6. Choose the best candidate or recommend direct hospital transport.

This should be deterministic and easy to inspect/debug.

---

## 13. Routing and Mapping

### HackGT routing provider

Use **Mapbox** for the MVP.

Mapbox should provide:

- route geometry;
- driving duration;
- driving distance;
- travel-time matrix calculations when useful.

### Important architecture requirement

Do **not** tightly mix Mapbox-specific code into the optimizer.

Create a generic routing interface such as:

```python
get_route(origin, destination)
get_travel_time(origin, destination)
get_travel_time_matrix(origins, destinations)
```

The MVP implementation can use Mapbox behind that interface.

Future providers could include:

- EMS agency GIS / CAD routing;
- Google Routes;
- OpenRouteService;
- self-hosted OSRM / OpenStreetMap routing.

The optimization code should not need major changes if the routing provider changes.

---

## 14. Data Strategy

Use a **hybrid real + synthetic dataset**.

### Real data where practical

Prefer real sources for:

- geography;
- road network / travel times;
- EMS station locations;
- Georgia trauma-center locations/levels;
- historical severe-crash geography or another defensible public proxy for severe-trauma demand;
- population/geographic boundaries if useful.

### Synthetic data where real operational data are not public

Likely synthetic for the prototype:

- exact blood inventory;
- blood expiration dates;
- current ambulance availability;
- which vehicles carry blood;
- paramedic credentialing;
- shift schedules;
- live 911 incidents;
- exact hemorrhage-demand data.

### Design principle

Even synthetic data must use fields that resemble what real EMS/CAD/blood-management systems could provide.

The system must be designed so synthetic demo data can later be replaced by real professional data without redesigning the entire application.

---

## 15. Initial Data Schemas

These schemas may evolve, but the MVP should start close to the following.

### `response_units.csv`

```text
unit_id
unit_type
home_station_id
current_latitude
current_longitude
vehicle_status
crew_status
crew_level
blood_credentialed
mobilization_minutes
blood_units_onboard
shift_start
shift_end
```

### `blood_units.csv`

```text
blood_unit_id
product_type
current_location_type
current_location_id
expiration_datetime
temperature_status
availability_status
```

### `stations.csv`

```text
station_id
name
latitude
longitude
station_type
active
capacity
```

### `hospitals.csv`

```text
hospital_id
name
latitude
longitude
trauma_level
active
```

### `historical_incidents.csv`

```text
incident_id
timestamp
latitude
longitude
incident_type
severity_proxy
source
```

### `rendezvous_points.csv`

```text
rendezvous_id
name
latitude
longitude
location_type
approved
active
```

### `live_incidents.csv` or in-memory equivalent

```text
incident_id
latitude
longitude
destination_hospital_id
blood_requested
patient_unit_id
status
created_at
```

---

## 16. Data Provenance Requirements

Each dataset must have documentation containing:

- source;
- URL / provider;
- download date;
- geographic coverage;
- important fields;
- transformations performed;
- limitations;
- whether values are real or synthetic.

Example:

```text
EMS station coordinates
REAL
Source: federal/public station dataset

Historical incidents
REAL public crash locations
Used only as a proxy for severe-trauma geography

Blood inventory
SYNTHETIC
Created for HackGT demo
```

Never present synthetic values as real operational EMS data.

---

## 17. Tech Stack

Use the following MVP stack.

### Frontend

**Next.js**

Purpose:

- web interface;
- dashboard;
- map page;
- control buttons;
- metrics;
- incident/rendezvous display.

### Map visualization

Use either:

- Mapbox's frontend mapping library, or
- Leaflet / MapLibre if easier.

The exact display library may be chosen during implementation, but Mapbox remains the routing provider.

### Backend

**Python + FastAPI**

Purpose:

- load data;
- expose API endpoints to frontend;
- call routing service;
- run strategic optimizer;
- run rendezvous calculations;
- return structured results.

### Optimization

**Google OR-Tools**

Purpose:

- strategic staging / resource-placement optimization.

### Initial persistence

**CSV / JSON files**

Do not require a database for the MVP.

### Optional later database

Supabase or another database may be added only if core functionality is already stable.

### OpenAI API

Optional stretch use only.

Potential use:

- explain optimization results in plain language;
- generate a dispatcher-friendly summary.

Do **not** use the OpenAI API for the core mathematical optimization or clinical decisions.

---

## 18. Repository Structure

Use approximately this structure:

```text
BloodGrid/
│
├── AGENTS.md
├── README.md
├── .env.example
├── .gitignore
│
├── docs/
│   ├── PROJECT_CONTEXT.md
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── DATA_SOURCES.md
│   ├── SAFETY_AND_ASSUMPTIONS.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── DEMO_PLAN.md
│
├── frontend/
│   ├── README.md
│   ├── package.json
│   └── src/
│       ├── app/
│       │   └── page.tsx
│       ├── components/
│       │   ├── Map.tsx
│       │   ├── ControlPanel.tsx
│       │   ├── Metrics.tsx
│       │   ├── ResourcePanel.tsx
│       │   └── IncidentPanel.tsx
│       └── lib/
│           └── api.ts
│
├── backend/
│   ├── README.md
│   ├── requirements.txt
│   └── app/
│       ├── main.py
│       ├── models.py
│       ├── config.py
│       ├── routing.py
│       ├── deployment_optimizer.py
│       ├── rendezvous.py
│       ├── coverage.py
│       └── simulation.py
│
├── data/
│   ├── README.md
│   ├── raw/
│   ├── processed/
│   ├── synthetic/
│   └── schemas/
│
├── scripts/
│   ├── README.md
│   ├── download_data.py
│   ├── preprocess_data.py
│   └── generate_demo_scenario.py
│
└── tests/
    ├── test_optimizer.py
    ├── test_rendezvous.py
    ├── test_coverage.py
    └── test_availability.py
```

---

## 19. Repository Documentation Philosophy

### `AGENTS.md`

Short instructions for Codex / agents:

- read `docs/PROJECT_CONTEXT.md` first;
- read `docs/PRODUCT_SPEC.md` before making architectural changes;
- prioritize MVP functionality;
- do not introduce paid services without explicit approval;
- do not change safety rules;
- keep code understandable for beginner developers;
- update relevant documentation when architecture changes.

### `PROJECT_CONTEXT.md`

Include:

- team background;
- limited coding experience;
- HackGT time constraints;
- Codex-heavy workflow;
- zero/near-zero software budget;
- explanation style should be accessible;
- do not overengineer.

### Folder READMEs

Each major folder should explain:

- what belongs there;
- important files;
- how to run/test that part;
- dependencies.

---

## 20. Backend Responsibilities

### `main.py`

FastAPI entry point.

Responsibilities:

- expose API endpoints;
- load config/data;
- call appropriate modules;
- return JSON responses.

### `models.py`

Define structured application models, ideally using Pydantic.

Examples:

- ResponseUnit
- BloodUnit
- Station
- Hospital
- HistoricalIncident
- RendezvousPoint
- LiveIncident

### `config.py`

Store configurable settings such as:

```text
TARGET_COVERAGE_MINUTES
RENDEZVOUS_HOSPITAL_DELAY_WEIGHT
MAX_ALLOWED_RENDEZVOUS_DETOUR
MAPBOX_TOKEN
```

Avoid hardcoding these values throughout the codebase.

### `routing.py`

Provide generic routing functions.

MVP implementation uses Mapbox.

### `deployment_optimizer.py`

OR-Tools strategic placement logic.

Inputs:

- eligible response units;
- candidate staging locations;
- historical incidents;
- travel-time matrix;
- configuration.

Outputs:

- recommended unit placements;
- before/after coverage;
- uncovered incidents;
- optional summary metrics.

### `rendezvous.py`

Live incident intercept logic.

Responsibilities:

- evaluate eligible Blood Response Units;
- evaluate approved rendezvous candidates;
- compare candidate intercepts;
- calculate direct-hospital baseline;
- output recommended strategy and metrics.

### `coverage.py`

Calculate metrics such as:

- percentage of incidents reachable within target time;
- average modeled time to blood;
- number of uncovered incidents;
- optional population/geographic metrics later.

### `simulation.py`

Support controlled HackGT scenarios such as:

- generate a major MVC;
- mark a unit unavailable;
- change staffing status;
- remove blood inventory;
- later simulate road disruption.

---

## 21. Initial API Endpoints

Suggested endpoints:

```text
GET  /health
GET  /stations
GET  /hospitals
GET  /response-units
GET  /blood-units
GET  /historical-incidents
GET  /rendezvous-points

POST /optimize-deployment
POST /simulate-incident
POST /calculate-rendezvous
POST /update-unit-status
```

Potential response for `/optimize-deployment`:

```json
{
  "assignments": [
    {"unit_id": "BR-1", "station_id": "S-3"},
    {"unit_id": "BR-2", "station_id": "S-7"}
  ],
  "coverage_before": 0.43,
  "coverage_after": 0.71,
  "target_minutes": 20
}
```

Potential response for `/calculate-rendezvous`:

```json
{
  "recommendation": "INTERCEPT",
  "blood_unit_id": "BR-2",
  "rendezvous_id": "RV-14",
  "time_to_blood_minutes": 12.0,
  "added_hospital_delay_minutes": 1.8,
  "direct_hospital_baseline_minutes": 31.0
}
```

---

## 22. Frontend Requirements

The MVP should ideally be a single main dashboard rather than many pages.

### Main map

Display:

- EMS stations;
- Blood Response Units;
- hospitals / trauma centers;
- historical incident points or heat/coverage layer;
- approved rendezvous points when relevant;
- live simulated incident;
- routes during live incident mode.

### Controls

At minimum:

```text
Optimize Deployment
Reset Scenario
Simulate Incident
Recalculate Rendezvous
Change Unit Status
```

### Metrics panel

Strategic mode:

- number of eligible blood-capable units;
- target coverage time;
- modeled coverage before optimization;
- modeled coverage after optimization;
- optional uncovered incident count.

Incident mode:

- direct hospital ETA;
- best blood intercept ETA;
- time-to-blood;
- added hospital delay;
- responding resource;
- selected rendezvous point.

### Explainability

The UI should make it obvious **why** an option was recommended.

Example:

```text
BR-2 selected because:
- already staffed and available
- 2 valid blood units onboard
- reaches rendezvous in 10.8 min
- produces only +1.8 min hospital delay
```

This explanation can be generated deterministically from calculated values; OpenAI is not required.

---

## 23. MVP Requirements

These are the **must-have features**.

1. Working web dashboard.
2. Real geographic map.
3. EMS stations / staging locations.
4. Blood Response Units with availability state.
5. Historical severe-trauma proxy locations.
6. Real road-based travel times through Mapbox.
7. Strategic deployment optimizer using OR-Tools.
8. Before/after coverage metric.
9. Simulated live incident.
10. Direct-hospital baseline.
11. Approved-rendezvous evaluation.
12. Mobile blood intercept recommendation.
13. Qualified-clinician/resource eligibility constraint.
14. Ability to mark a resource unavailable and recalculate.
15. Clear distinction between real and synthetic data.

Do not sacrifice these features for stretch functionality.

---

## 24. Stretch Features

Only implement after the MVP is stable.

Possible stretch features:

- blood expiration / rotation optimization;
- detailed 24/7 shift coverage;
- on-call mobilization visualization;
- road closures;
- multiple simultaneous incidents;
- dynamic ambulance animation;
- OpenAI-generated natural-language explanation;
- database / Supabase;
- population-weighted equity analysis;
- configurable hospital destinations;
- real-time dashboard replay;
- fixed EMS blood caches;
- blood-demand forecasting.

---

## 25. Implementation Sequence

Build in this order.

### Phase 0 — Repository and documentation

- create repository structure;
- add `AGENTS.md`;
- add project context;
- add `.env.example`;
- verify Python + Node environments.

### Phase 1 — Minimal data world

Create a small initial dataset:

- 5–10 staging locations;
- 2–3 Blood Response Units;
- 1–3 hospitals;
- ~30 historical incidents;
- approved rendezvous candidates.

Synthetic is acceptable initially.

### Phase 2 — Display the world

Build Next.js dashboard and map.

Show:

- stations;
- units;
- hospitals;
- incidents.

No optimizer yet.

### Phase 3 — Routing

Connect Mapbox.

Verify the backend can return:

- A -> B route;
- driving duration;
- distance;
- travel-time matrix.

### Phase 4 — Coverage calculations

Before OR-Tools, calculate baseline coverage.

Example:

> 42% of incidents are within 20 minutes of a current eligible resource.

### Phase 5 — Strategic optimizer

Implement OR-Tools placement model.

Verify:

- eligible resources only;
- correct assignment constraints;
- coverage improves in known test scenarios.

### Phase 6 — Simulated incident

Add one simulated blood-request incident.

Show:

- patient ambulance;
- hospital destination;
- blood-capable resources.

### Phase 7 — Rendezvous optimizer

Evaluate approved points.

Compare:

- direct hospital;
- mobile intercept.

Return best option or recommend no intercept.

### Phase 8 — Availability constraints

Support:

- unavailable unit;
- on-call mobilization delay;
- no qualified clinician;
- no usable blood.

Recalculate automatically.

### Phase 9 — Replace synthetic geography with real data

Bring in public real-world datasets where feasible.

Keep operational data synthetic if unavailable.

### Phase 10 — Polish

Only after stable core behavior:

- animations;
- charts;
- explanation text;
- improved styling;
- optional OpenAI feature.

---

## 26. Testing Requirements

Codex must create deterministic tests for core logic.

### Strategic optimizer tests

Example:

```text
Only one response unit.
Station A reaches 8/10 incidents within 20 min.
Station B reaches 3/10.
Expected optimizer output: choose Station A.
```

Test that:

- unavailable units are never assigned;
- no-qualified-clinician units are never eligible;
- unit counts are respected;
- assignment count is valid;
- coverage calculation matches expected values.

### Rendezvous tests

Example:

```text
RV-A gives blood in 10 min and +2 min hospital delay.
RV-B gives blood in 8 min and +12 min hospital delay.
```

Verify behavior using configured scoring.

Also test:

- direct hospital chosen when intercept is not beneficial;
- unavailable resources are ignored;
- on-call mobilization delay is included;
- unapproved rendezvous points are never selected.

### API tests

At minimum:

- `/health` works;
- optimization endpoint returns valid structured output;
- rendezvous endpoint returns valid structured output.

---

## 27. Tentative Hackathon Demo Flow

**This is a target, not a frozen requirement.**

### Part 1 — Regional problem

Show initial map and current deployment.

Example:

```text
3 Blood Response Units
8 staging locations
20-minute modeled coverage: 43%
```

### Part 2 — Strategic optimization

Press:

```text
Optimize Deployment
```

Units move to recommended locations.

Example:

```text
Coverage: 43% -> 71%
```

### Part 3 — Emergency

Press:

```text
Simulate Major MVC
```

Display:

- patient ambulance;
- destination trauma center;
- blood-response units.

### Part 4 — Rendezvous

BloodGrid calculates:

```text
Direct hospital:
first blood around 31 min

BR-2 intercept:
time to blood 12 min
added hospital delay +1.8 min
```

Show selected approved rendezvous and both routes.

### Part 5 — Disruption

Mark BR-2:

```text
OUT_OF_SERVICE
```

Re-run recommendation.

BloodGrid chooses another feasible plan.

This demonstrates the optimizer is dynamic rather than a scripted visualization.

---

## 28. Non-Goals for HackGT

Do not attempt to build:

- a real clinical transfusion protocol engine;
- blood compatibility matching;
- patient diagnosis;
- real EMS CAD integration;
- hospital EHR integration;
- a full blood-bank inventory platform;
- medical-device hardware;
- live dispatch system;
- production cybersecurity/compliance infrastructure;
- autonomous clinical decision-making.

These are outside the hackathon scope.

---

## 29. Budget / Dependency Rules

The team does not want to spend extra money on software services.

Requirements:

- prefer free/open-source tools;
- use Mapbox only within available free usage;
- do not add paid services without explicit user approval;
- use HackGT-provided OpenAI API credits only for optional AI features;
- no paid database required;
- no paid hosting required for initial local demo.

The application must be runnable locally on the team's laptops.

---

## 30. Local Development Experience

The project should be easy to run.

Target workflow:

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Then open the local frontend URL in a browser.

Codex should document exact setup steps in the root `README.md`.

---

## 31. Environment Variables

Create `.env.example` containing names only, not real secrets.

Example:

```text
MAPBOX_ACCESS_TOKEN=
OPENAI_API_KEY=
BACKEND_BASE_URL=http://localhost:8000
```

OpenAI should remain optional.

Never commit actual API keys.

---

## 32. Acceptance Criteria

The MVP is considered successful when all of the following are true:

1. The frontend map loads correctly.
2. Stations, hospitals, historical incidents, and Blood Response Units appear.
3. Backend and frontend communicate successfully.
4. Mapbox routing returns realistic road travel times.
5. Current deployment coverage can be calculated.
6. OR-Tools produces a valid deployment recommendation.
7. The UI shows coverage before and after optimization.
8. A simulated incident can be created.
9. The system identifies eligible blood-capable resources.
10. Unqualified/unavailable resources are excluded.
11. Approved rendezvous candidates can be evaluated.
12. Time-to-blood and added hospital delay are calculated.
13. The system can recommend an intercept or direct hospital transport.
14. Changing resource availability changes the output when appropriate.
15. Core optimizer and rendezvous tests pass.
16. Real vs synthetic data are clearly labeled/documented.
17. No clinical treatment decision is made by BloodGrid.

---

## 33. Configurable / Not Yet Frozen Decisions

These decisions should remain easy to change:

- exact rural Georgia demo region;
- target coverage threshold (e.g. 15 vs 20 min);
- strategic optimization weights;
- rendezvous score weights;
- maximum acceptable added hospital delay;
- number of Blood Response Units in demo;
- number of blood units carried per response unit;
- exact approved-rendezvous dataset;
- amount of expiration/rotation modeling in MVP;
- amount of shift/on-call modeling in MVP;
- final visual demo sequence;
- whether OpenAI explanation is included.

Do not hard-code these assumptions unnecessarily.

---

## 34. Guiding Product Principles

When Codex or the team must choose between implementations, prefer the option that follows these principles:

1. **Logistics, not clinical judgment.**
2. **Real-world compatible data structures.**
3. **Transparent deterministic optimization.**
4. **Simple enough to finish at HackGT.**
5. **Map-first, visually understandable demo.**
6. **No unnecessary paid dependencies.**
7. **Use real public data where practical and label synthetic data clearly.**
8. **A blood-capable resource means blood + vehicle + qualified clinician.**
9. **Patient transport should continue toward definitive care whenever feasible.**
10. **Rendezvous recommendations must use approved candidate points, not arbitrary road locations.**
11. **Availability and mobilization delays matter.**
12. **Every core recommendation should be explainable using the underlying calculations.**

---

## 35. One-Sentence Product Definition

> **BloodGrid is a rural EMS logistics and optimization platform that determines where scarce blood-capable response resources should be positioned and, once blood is requested, how an eligible resource can intercept a transporting ambulance so prehospital blood reaches the patient sooner without unnecessarily delaying definitive care.**

