# BloodGrid Handoff

**Last updated:** 2026-09-26

**Current phase:** In-app scenario selection and public-geography hybrid scenario complete; demo polish remains. A working crew-facing Ambulance UI has been added (see **Ambulance UI** below).

**Audience:** Alex, project teammates, and coding agents joining the work.

## Start Here

Read these files in order:

1. `AGENTS.md` for repository-wide engineering rules.
2. `docs/PROJECT_CONTEXT.md` for the HackGT scope and working principles.
3. `docs/PRODUCT_SPEC.md` for the full product contract.
4. `docs/SAFETY_AND_ASSUMPTIONS.md` for non-negotiable boundaries.
5. `docs/ARCHITECTURE.md` and `docs/IMPLEMENTATION_PLAN.md` for the system boundaries and approved next phase.
6. `frontend/AGENTS.md` before changing the dashboard.
7. This file for the current implementation state and next actions.

## What BloodGrid Is

BloodGrid is a rural EMS logistics prototype. It helps operations teams answer two questions:

1. Where should scarce, eligible Blood Response Units stage to improve modeled access to prehospital blood?
2. After blood has already been requested, which eligible unit should respond and at which meeting spot on the way can it meet the transporting ambulance with minimal delay to definitive care?

The project is map-first and intended for a clear HackGT demo. It is not a clinical decision-maker.

## Non-Negotiable Rules

- Do not decide whether a patient needs blood, which product to use, dosage, diagnosis, treatment, or hospital destination.
- Treat a resource as eligible only when it has usable blood, an eligible vehicle, a qualified clinician, and valid operational/storage status.
- Include `ON_CALL` mobilization delay in travel calculations.
- Meeting spots come from mapped public places (OpenStreetMap parking lots, gas stations, and similar), the scenario's known sites, or a roadside point on the route; never an unexplained midpoint. (2026-09-27 team decision; the old approved-points-only rule is retired.) Present spots as suggestions; the crew decides.
- Always compare an intercept against direct transport to the supplied hospital. Direct transport may win.
- Keep core recommendations deterministic and explainable from the calculated data. Do not use an LLM for optimization or clinical logic.
- Clearly label operational demo data as synthetic. Never imply it is live EMS or patient data.
- Avoid paid services and extra architecture unless the team explicitly approves them.

## Current State

The GitHub remote is connected on the `main` branch. The foundation and initial scenario commits are published. The repository now contains a runnable FastAPI data service and Next.js map dashboard backed by the versioned scenario data.

Completed foundation work:

- Full product specification copied into `docs/PRODUCT_SPEC.md`.
- Project, architecture, safety, data-provenance, implementation, and demo documentation created.
- `.env.example` and `.gitignore` created.
- Folder homes created for frontend, backend, data, scripts, and tests.
- Local Python and Node installations verified.
- Versioned CSV schema contract created under `data/schemas/v1/`.
- Complete synthetic scenario `rural_ga_initial_v1` created under `data/scenarios/`.
- Scenario metadata, provenance, a live incident, and configuration selection guidance added.
- Read-only FastAPI endpoints added for the scenario and every map layer.
- Next.js operations dashboard added with a real Mapbox basemap, scenario markers, layer controls, unit status, and marker details.
- Local browser-map token wiring added through the root `.env` file; no token is stored in Git.
- Provider-neutral Mapbox Matrix routing adapter added under `backend/app/routing/`.
- Deterministic baseline coverage service added under `backend/app/coverage/`. It requires valid onboard blood, an available vehicle, a qualified clinician, and either `AVAILABLE` or `ON_CALL` crew status. It adds an on-call unit's configured mobilization delay.
- `GET /coverage/baseline` added. It uses the scenario target by default, returns a result for every synthetic demand point, and keeps Mapbox-specific code outside coverage logic.
- Dashboard coverage panel, covered/uncovered demand markers, and point-level response-time details added.
- Backend tests, frontend type check, production frontend build, and a live Mapbox routing request passed.
- OR-Tools CP-SAT strategic deployment service added under `backend/app/deployment/`.
- `GET /deployment/strategic` assigns each eligible unit to one active station without exceeding station capacity, then maximizes synthetic target-time coverage using the existing routing and eligibility interfaces.
- Dashboard strategic deployment panel added with a current/recommended view toggle, before/after coverage counts, and unit-to-station assignments.
- Deployment tests cover maximum coverage, station capacity, exclusion of an ineligible unit, and the effect of on-call mobilization delay.
- Deterministic live incident evaluator added under `backend/app/rendezvous/` with `GET /live-incidents/{incident_id}/rendezvous`.
- Live evaluation validates the supplied active destination without selecting or changing it; it compares direct transport with nearby meeting spots and returns the soonest-blood spot that keeps heading toward the hospital, or direct transport (see **Meeting Spots**).
- Dashboard live incident panel added with direct transport, supplied hospital context, every candidate's status, and a map marker for the recommended meeting spot.
- Rendezvous tests cover each meeting-rule branch, on-call mobilization, ineligible resources, the roadside fallback, and catalog loading. The Mapbox adapter now also handles a single origin/destination comparison internally.
- Versioned synthetic availability profiles added in `data/scenarios/rural_ga_initial_v1/availability_profiles.json`.
- `backend/app/availability/service.py` applies a selected profile to an in-memory scenario copy, preserving the source scenario and resettable `baseline` state.
- Dashboard Synthetic operating state selector added. It refreshes baseline coverage, strategic deployment, live rendezvous, map markers, and resource eligibility together.
- Availability tests cover immutable baseline data, unknown-profile rejection, and consistent exclusion of an unavailable unit from coverage, deployment, and rendezvous results.
- Four synthetic open blood-request cases now live in `data/scenarios/rural_ga_initial_v1/live_incidents.csv`. Each records its own supplied active hospital; they are controlled demo cases, not patient or CAD records.
- Dashboard Live incident selector added to `frontend/src/components/IncidentPanel.tsx`. Selecting its demo case or clicking a live-incident map marker refreshes that request's live rendezvous result and map highlight without recalculating regional coverage or strategic staging.
- Rendezvous tests now confirm that evaluating different incident IDs preserves each incident's own supplied hospital rather than reusing or selecting a destination.
- Added `echols_valdosta_public_geography_v1`, a separate runnable hybrid scenario. It retains the original synthetic scenario unchanged and defaults remain unchanged.
- The hybrid scenario uses a saved Census TIGERweb Echols County boundary, public CMS facility directory rows for SGMC HEALTH and SGMC HEALTH LANIER, and saved Census Geocoder responses for their address coordinates.
- All operational inputs in the hybrid scenario remain synthetic: staging sites, resource and blood status, demand proxies, live incidents, patient-unit labels, availability profiles, and rendezvous points. No actual EMS agency, staffing position, CAD record, patient record, blood inventory, or approved rendezvous site is asserted.
- Added `data/schemas/v1/SOURCE_MANIFEST_CONTRACT.md`, a scenario-level `sources.json`, and processed public facility reference rows. Source hashes, direct URLs, transformations, and limitations are all retained with the scenario.
- Added loader coverage for the hybrid scenario. The backend test suite now has 21 passing tests.
- Added `GET /scenarios` plus optional `scenario_id` support to scenario-aware
  API endpoints. The configured `BLOODGRID_SCENARIO` remains the startup default.
- Added the dashboard header's **Demo data set** selector. It lists the
  versioned data worlds, displays the selected classification, resets the
  scenario-specific availability profile to baseline, and reloads map and
  calculation state together. The header no longer incorrectly calls the
  hybrid data set wholly synthetic.
- Replaced the hybrid scenario's hand-drawn diagonal demand grid with 30
  `SYNTHETIC_ROAD_ALIGNED_DEMAND_PROXY` records: 18 deterministic samples from
  public Census primary-road centerlines and 12 from secondary-road centerlines,
  each offset 12-54 meters to resemble ordinary map geocoding. The generated
  reference table records the source road for every proxy.
- Added the repeatable generator `scripts/build_echols_valdosta_demand_proxies.mjs`
  plus raw road snapshots, source hashes, and loader checks for road-class
  balance and source-road variety. This is public road geometry only, not crash,
  traffic, CAD, or patient data.
- Crew-facing **Ambulance UI** added at `/ambulance`, with an **Ambulance view** / **System view** button at the top of each UI. See the **Ambulance UI** section below and `docs/AMBULANCE_UI_SPEC.md` section 14.
- A blank `BLOODGRID_COVERAGE_TARGET_MINUTES=` line (as in `.env.example`) now means "use the scenario default" instead of crashing coverage; covered by `backend/tests/test_config.py`.
- Replaced the duplicate **Map layers** control and **Scenario markers** legend with `MapSymbols.tsx`: one panel where every symbol category is its own show/hide control. It identifies green squares as recommended staging sites; response units name their Available, On call, and Unavailable states; demand proxies name their Covered and Outside target states.
- The System UI marker grammar is static and distinct: red station squares, teal/amber/slate response-unit circles, dark-red hospital diamonds, blue/orange demand hexagons, filled violet rendezvous triangles, and magenta blood-request octagons. This is presentation only; operational data and calculations are unchanged.
- When the Strategic deployment control is set to **Recommended**, the Map symbols key adds a green-square **Recommended staging** entry beneath Stations. It identifies existing stations selected as staging locations for response units; it does not represent a new station or a station relocation.
- In the System UI, **Current** keeps response units at their scenario locations and, after selecting a blood request, shows only the direct ambulance-to-supplied-hospital route and travel time. **Recommended** moves assigned eligible unit markers to their optimized staging stations and evaluates the selected request as a clearly labeled staging simulation. It never changes source scenario data or asserts that a real unit has moved.
- A selected Recommended-view request enlarges and halos its recommended meeting spot. The map key gives estimated road time for the blue ambulance leg to that spot and the purple ambulance leg from the spot to the supplied hospital; the teal Blood Response Unit path remains visible without a time label. Direct-transport results show only the blue hospital route.
- When multiple System UI marker types share an exact coordinate, `OperationsMap.tsx` applies a small fixed Mapbox marker offset to separate them. Keep this in the Mapbox `Marker` options, not CSS transforms, so the icons remain stable while panning and zooming.
- Ordinary rendezvous symbols are intentionally very small violet triangles. The recommended point stays only slightly larger with a restrained halo, so it can be located without visually overpowering the live incident or response routes.
- Selecting a simulated blood-request marker or incident selector now displays road geometry from the existing provider-neutral `/route` endpoint. In Recommended view, the ambulance is blue from the incident to the recommended meeting spot and purple from that spot to the incident's supplied hospital; the selected eligible Blood Response Unit is teal to the meeting spot. Current view and Recommended direct-transport results show only the blue ambulance route to the supplied hospital. This is a visual explanation of the existing deterministic result, not a new recommendation or destination decision.

The scenario uses synthetic modeled rural-Georgia geography and operational data. It must not be presented as live or facility-accurate information.

## Repository Map

| Location | Purpose now | What will go there next |
| --- | --- | --- |
| `frontend/` | Runnable Next.js dashboard with baseline, strategic, multi-incident live-rendezvous, and availability views | Data-story and demo polish |
| `backend/` | FastAPI scenario API, routing adapter, availability overlays, coverage, deployment, and per-incident rendezvous evaluation | Data refinement and demo support |
| `data/raw/` | Saved Census TIGERweb, CMS directory, and Census Geocoder source responses | Additional untouched public source snapshots |
| `data/processed/` | Echols-Valdosta public geography summary and facility reference rows | Cleaned geographic and demand-proxy data |
| `data/synthetic/` | Empty | Demo inventory, staffing, availability, and simulated incidents |
| `data/schemas/v1/` | CSV data contract | Future schema versions when needed |
| `data/scenarios/rural_ga_initial_v1/` | Complete initial demo world | Subsequent data scenarios |
| `data/scenarios/echols_valdosta_public_geography_v1/` | Public-geography / synthetic-operations demo world with source manifest | Dashboard validation and presentation polish |
| `scripts/` | Empty | Repeatable data-preparation and scenario-generation utilities |
| `tests/` | Empty | Deterministic tests for core calculations and API behavior |

## Agreed Technical Direction

- **Frontend:** Next.js, initially one operations dashboard.
- **Backend:** Python and FastAPI.
- **Routing:** Mapbox Matrix API for MVP road travel, hidden behind a provider-neutral routing interface. The provider batches the current three units and 30 demand points into two requests because Mapbox permits 25 coordinates per matrix request.
- **Baseline coverage:** Fastest eligible unit by estimated `mapbox/driving` duration plus configured on-call mobilization. The initial scenario has a 20-minute target. Local `BLOODGRID_COVERAGE_TARGET_MINUTES` may override that target for demonstration only.
- **Strategic optimizer:** Google OR-Tools CP-SAT in `backend/app/deployment/`. It assigns every eligible unit to one active station, respects station capacity, and maximizes the number of demand points covered within the target. Routing and eligibility remain outside the optimizer.
- **Live rendezvous:** deterministic candidate evaluation in `backend/app/rendezvous/`, not OR-Tools. It requires an existing authorized request, chooses the soonest-blood meeting spot among those that keep heading toward the hospital, includes direct transport as the feasibility reference, and preserves the supplied destination hospital. See **Meeting spots** below.
- **Live-incident selection:** the scenario contains four synthetic open requests. The selected ID is browser state; `GET /live-incidents/{incident_id}/rendezvous` evaluates only that request. Selection updates the meeting-spot review and highlighted map marker, while coverage and strategic deployment remain scenario-wide views.
- **Meeting-rule assumptions:** the `BLOODGRID_MEETING_*` settings are in `config.py` -> `meeting_rule_settings()` (see **Meeting Spots**). They are local configuration values and must not be hard-coded elsewhere.
- **Availability profiles:** `availability_profiles.json` provides named, synthetic demo overlays. `baseline` is required. The overlay service is the sole owner of profile application; it returns a copied scenario, and no source CSV/JSON data are changed during a demo.
- **Persistence:** CSV and JSON for the MVP; no database required.
- **Optional AI:** only a later explanation layer, never core decision logic.

## Current Baseline Result

With the initial synthetic scenario and its 20-minute target, the live Mapbox verification produced:

- 3 eligible Blood Response Units.
- 11 of 30 synthetic demand points covered.
- 19 of 30 synthetic demand points outside the target.

These values are reproducible from the current scenario and routing provider but should still be described as synthetic prototype output, not an operational coverage claim. `mapbox/driving` supplies estimated road travel time without live-traffic, emergency-driving, weather, closure, dispatch-workload, or handoff-time modeling.

## Current Strategic Result

With the same initial synthetic scenario and 20-minute target, the live strategic deployment verification produced an `OPTIMAL` plan:

- Current arrangement: 11 of 30 synthetic demand points covered.
- Recommended arrangement: 18 of 30 synthetic demand points covered.
- `BR-01` -> Riverbend EMS (`S-04`).
- `BR-02` -> Pine Valley EMS (`S-03`).
- `BR-03` -> Highland EMS (`S-07`), retaining its 8-minute on-call mobilization delay.

This is a strategic planning comparison, not a real deployment command. It uses one narrow, explicit objective: maximize target-time coverage while respecting the synthetic station capacities.

## Current Live Incident Result

The dashboard defaults to `LIVE-001` and can select `LIVE-002`, `LIVE-003`, or `LIVE-004`. Each case has a supplied active destination and receives an independent meeting-spot review. The results below come from the retired approved-points evaluator; see **Meeting Spots** for current results. Prior live Mapbox verification for `LIVE-001` produced:

- Supplied destination: North Valley Trauma Center (`H-01`, recorded `LEVEL_II`). BloodGrid validated that it is an active record but did not choose it.
- Direct transport estimate: 28.7 minutes.
- Recommendation: `RV-03`, Route 17 Safe Staging Area, with `BR-02`.
- Estimated time-to-blood: 19.5 minutes; the patient ambulance waits 6.5 minutes and the resource waits 0 minutes.
- Modeled hospital arrival after rendezvous: 34.9 minutes, or 6.2 minutes of added delay compared with direct transport.
- Other points were rejected transparently as too late or as exceeding the configured 10-minute added-delay limit.

This is synthetic logistics output, not a clinical transfusion, transport, or destination recommendation.

Browser verification on 2026-09-26 also selected `LIVE-003`: the dashboard switched to `MEDIC-34`, preserved its supplied `H-03` East Ridge Community Hospital context, recalculated every approved-point result, and highlighted only that request on the map. Under the retired evaluator its result was direct transport; the meeting-spot rule now recommends BR-02 at a parking lot.

## Current Dynamic Availability Result

The dashboard now offers five synthetic operating states: Baseline, BR-02 unavailable, BR-03 staffed now, BR-01 blood unavailable, and BR-03 unqualified.

For the verified `BR-02 unavailable` state:

- BR-02 is marked `OUT_OF_SERVICE` and excluded by the shared eligibility rule.
- Eligible resources drop from 3 to 2.
- Current synthetic coverage drops from 11 of 30 to 5 of 30 demand points; optimized coverage drops from 18 of 30 to 14 of 30.
- Strategic staging assigns only BR-01 and BR-03.
- The live `LIVE-001` comparison changes from a rendezvous recommendation to direct transport.

The selector is a synthetic demonstration control, not a live unit-status command.

## Working Across Agents

This section is the practical integration contract for Alex, Claude, Codex, and any future coding agent. The goal is for one agent's work to fit the repository cleanly rather than creating a parallel implementation.

### Before Starting a Change

1. Start from the latest `main` branch and inspect `git status`. Preserve any work already present; do not reset, overwrite, or reformat unrelated files.
2. Read the files in **Start Here**, then identify the current milestone in `docs/IMPLEMENTATION_PLAN.md`. Do not begin a later feature while the current milestone is unfinished.
3. State the intended behavior, the likely files to touch, and which existing interface will be extended before editing.
4. Work in one focused branch or commit-sized slice. Avoid unrelated cleanup, framework swaps, package changes, or broad stylistic rewrites.

### Existing Interfaces to Preserve

| Responsibility | Existing home | Integration rule |
| --- | --- | --- |
| Scenario loading and validation | `backend/app/scenario_loader.py` | Read versioned CSV/JSON scenario data here. Do not duplicate scenario data in the frontend. |
| Configuration and private environment values | `backend/app/config.py` and root `.env` | Add configurable values centrally. Never commit `.env` or paste token values into source, docs, logs, or chat. |
| Road routing | `backend/app/routing/provider.py` | New coverage, deployment, or rendezvous code must use `RoutingProvider`; only `backend/app/routing/mapbox_provider.py` may contain Mapbox request details. |
| Eligibility and baseline coverage | `backend/app/coverage/service.py` | Reuse or extend the explicit eligibility rule. Do not create a second, slightly different eligibility check elsewhere. |
| Availability profiles | `backend/app/availability/service.py` | Apply named profile overlays only here. Never mutate source scenario data or duplicate its override behavior in frontend code. |
| Live rendezvous evaluation | `backend/app/rendezvous/service.py` | Use the existing routing and eligibility interfaces. Candidate spots come from `app/meeting_spots.py`; preserve the incident's supplied destination. |
| HTTP API | `backend/app/main.py` | Keep endpoint functions thin: receive a request, call a service, return typed data. Put business logic in focused modules. |
| Dashboard API client and types | `frontend/src/lib/api.ts` and `frontend/src/lib/types.ts` | Add backend response shapes here before displaying them. Do not calculate coverage or optimization results in the browser. |
| Map rendering | `frontend/src/components/OperationsMap.tsx` and `frontend/src/components/MapSymbols.tsx` | Use them to visualize API results. Keep marker semantics, colors, shapes, and show/hide entries synchronized. Never add a `transform` or transform transition to `.map-marker`. |
| Scenario data contract | `data/schemas/v1/` and `data/scenarios/` | Create a new scenario or schema version when data meaning changes; retain synthetic labels and provenance. |

### Current Technical Facts

- The dashboard calls the FastAPI backend at `http://localhost:8000` by default.
- The root `.env` contains local configuration. `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is used by the browser map. `MAPBOX_ACCESS_TOKEN` is preferred for backend routing; the local backend can temporarily fall back to the browser token.
- `GET /coverage/baseline` returns typed results for all 30 synthetic demand points. It uses the scenario's `target_coverage_minutes` unless `BLOODGRID_COVERAGE_TARGET_MINUTES` is set locally.
- `GET /deployment/strategic` returns the OR-Tools result for the same scenario. Its core code is `backend/app/deployment/service.py`; tests must use a fake `RoutingProvider`, not live Mapbox requests.
- `GET /live-incidents/{incident_id}/rendezvous` returns the deterministic live comparison. Its core code is `backend/app/rendezvous/service.py`; tests must use a fake `RoutingProvider`, not live Mapbox requests. Its optional `recommended_staging=true` query flag first calculates the strategic plan, copies the scenario with assigned units at those staging stations, then evaluates the same request. The response reports `resource_positioning` as `CURRENT` or `RECOMMENDED_STAGING`.
- The selected live-incident ID is maintained in `frontend/src/app/page.tsx`. `IncidentPanel.tsx` is the selector UI; it passes that ID to the existing rendezvous API client. Do not rerun coverage or strategic deployment on incident change.
- The System UI requests a rendezvous result only in Recommended view, with `recommended_staging=true`. Current view deliberately gets only the direct route geometry in the browser, avoiding an implication that it is recommending a live rendezvous from current positions.
- `MapSymbols.tsx` is the sole System UI map legend and visibility control. It owns only browser visibility state through `LayerVisibility`; it must not calculate logistics or alter scenario data.
- The default scenario remains `rural_ga_initial_v1`. Use the dashboard header's **Demo data set** selector to evaluate the hybrid scenario without restarting. `BLOODGRID_SCENARIO` changes only the scenario selected when the backend starts.
- Public facility records are static source snapshots. `active=true` in the hybrid scenario only enables a known record for the demo; it does not represent real-time hospital availability, trauma verification, or destination selection.
- Hybrid source provenance is metadata only. Do not make routing, eligibility, deployment, or rendezvous logic depend on a particular public source or Mapbox feature.
- `GET /scenario?availability_profile=<profile_id>` returns the selected copied scenario. The same optional query parameter is accepted by `/coverage/baseline`, `/deployment/strategic`, and `/live-incidents/{incident_id}/rendezvous`; `/availability-profiles` lists all profile definitions.
- The current routing profile is `mapbox/driving`, and `MapboxMatrixProvider` batches the initial three eligible units and 30 demand points into two Matrix API requests.
- The coverage result is a logistics estimate only. It does not provide a dispatch order, clinical recommendation, hospital selection, or real-world response guarantee.
- The next approved work is data improvement and demo polish. Preserve the current synthetic labels and repeatable profiles while improving only data sources, visual clarity, and presentation quality that can be explained confidently.

### Required Handoff From an Agent

Before an agent asks Alex or another agent to integrate its work, it should provide all of the following in its final note or commit message:

1. The user-facing behavior that changed.
2. The files added or materially changed, grouped by backend, frontend, data, and docs.
3. Any new environment variable, scenario field, API endpoint, or dependency.
4. The deterministic tests and local checks run, including their result.
5. Any limitation, assumption, or follow-up that remains.
6. An update to this document when the current state, architecture, setup, or recommended next work changes.

### Minimum Verification Before Integration

Run the relevant checks from the repository root after merging or applying another agent's patch:

```bash
cd backend
./.venv/bin/python -m unittest discover -s tests

cd ../frontend
npm run lint
npm run build
```

For dashboard changes, also start the backend and frontend locally and inspect `http://localhost:3000`. Confirm that the synthetic-data label remains visible, Map symbols still toggle, and the changed result is understandable from the displayed facts.

## Next Recommended Work

Validate and polish the data-improvement demo:

1. Review map framing and marker density for both scenarios at laptop and projector sizes, especially the road-aligned Echols-Valdosta demand distribution.
2. Improve the dashboard's demo flow so a presenter can move from baseline coverage to strategic staging, then choose a live incident and availability case without explaining implementation details.
3. Keep the three selectors conceptually separate: the data-set selector changes the complete demo world; availability profiles vary one world's operational resource state; the live-incident selector varies the response situation. Do not mutate source scenario files when any is selected.
4. Keep all synthetic operational values visibly labeled and do not add clinical destination or treatment recommendations.
5. Update the demo script, provenance notes, and screenshots only after the tested MVP behavior remains intact.

## Meeting Spots (2026-09-27, branch `feature/meeting-spots`)

The approved-rendezvous-points rule is retired by team decision. It often left no usable point, or picked a far unit when a closer one could meet the ambulance at an ordinary parking lot. The evaluator in `backend/app/rendezvous/service.py` was rewritten, replacing the previous evaluator and its hospital-delay weighting.

**Where spots come from.**
- The shared catalog is `data/meeting_spots/<region>.csv`, built by `node scripts/build_meeting_spots.mjs` from an OpenStreetMap Overpass download. Raw snapshots are in `data/raw/openstreetmap_meeting_spots_2026-09-27/`, and provenance is in `data/meeting_spots/sources.json`.
  - Categories: parking lots, gas stations, fire stations, places of worship, and schools. Private, underground, and tiny places are dropped.
  - Size: 6,827 spots around `rural_ga_initial_v1` and 1,633 around the Echols-Valdosta scenario.
  - Contract: `data/schemas/v1/MEETING_SPOT_CATALOG_CONTRACT.md`. The data is ODbL, and the UI credits "OpenStreetMap contributors".
- The scenario's active `rendezvous_points.csv` rows become known sites. The `approved` flag is no longer read, and scenario files are unchanged.
- Where mapped places are scarce, labeled roadside points on the ambulance's route or a unit's route are added.
- `backend/app/meeting_spots.py` loads all three.

**The rule.**
1. **Shortlist:** keep spots within `BLOODGRID_MEETING_CORRIDOR_METERS` (1200) of the ambulance-to-hospital route or of a unit's route toward the ambulance. Rank them with a crude straight-line estimate and keep the top `MAX_CANDIDATES` (40), plus the best 8 per unit.
2. **Time it:** a few chunked Matrix calls give real road times (about 1 s per incident).
3. **Choose:** for every (spot, eligible unit) pair, blood arrives at `max(ambulance drive, unit mobilization + drive)`. A pair is rejected when:
   - **Wrong direction:** the spot is more than `DIRECTION_TOLERANCE_MINUTES` (3) farther from the hospital than the ambulance's start.
   - **Too late:** blood arrives less than `MIN_BLOOD_GAIN_MINUTES` (3) sooner than direct hospital arrival.
   - **Too much delay:** added hospital delay exceeds `max(MIN_DELAY_CAP_MINUTES 5, MAX_DELAY_FRACTION 0.25 x direct)`.
4. **Recommend:** the soonest blood wins. Ties are broken by added delay, then category (known site first), then size, then ID. If nothing passes, the result is direct transport.

All settings are in `config.py` -> `meeting_rule_settings()`. The old `BLOODGRID_RENDEZVOUS_*` settings are removed. The supplied hospital is never changed, and spots are suggestions: the crew decides where to stop.

**Results (live Mapbox, baseline profile).**

| Incident | Result |
| --- | --- |
| LIVE-001 | BR-02 at Apple Valley Baptist Church, blood 13.4 min, +5.4 min |
| LIVE-002 | BR-01 at Chevron, blood 18.5 min, +1.7 min (was BR-02 at Route 17, blood 32.9, +9.9) |
| LIVE-003 | BR-02 at a parking lot, blood 17.4 min, +4.7 min |
| LIVE-004 | Direct transport |
| EV-001 | BR-EV-01 at JP Food, blood 14.9 min, +0 |
| EV-002 | Gas station, blood 26.1 min, +0 |
| EV-003 | Gas station, blood 71.9 min, +9.6 min |
| EV-004 | JP Food, blood 16.4 min, +0 |

Before this change, every Echols-Valdosta incident was direct transport.

**Merge with the map-symbol work (2026-09-27).**
- The System UI route overlay (`OperationsMap.tsx`) now draws to the recommended option's own coordinates, since a meeting spot is usually not in `rendezvous_points.csv`.
- Route drawing waits until the rebuilt map's own style has loaded. This fixes a "Style is not done loading" crash when the incident changed.
- The map-symbol key and route key use the dark brand theme.

**UI.**
- The System UI panel shows "Meet on the way" or "Continue direct", the options reviewed, what was ruled out, and the OSM credit. The recommended spot gets its own map marker.
- The Ambulance UI labels generic spots by road, e.g. "Parking lot on GA 211".

**Limits.**
- A mapped place is not verified as open, safe, or large enough.
- OSM coverage is uneven in rural areas.
- EV-003's gain versus delay is borderline; tune it with the settings if needed.
- The catalog is a dated snapshot. To refresh it, run `node scripts/build_meeting_spots.mjs --refresh`.

**Tests.** `backend/tests/test_rendezvous_service.py` covers each rule branch, the swing toward a unit, on-call mobilization, ineligible units, the known-site tie-break, the roadside fallback, and catalog loading.

## Ambulance UI (working model, 2026-09-26)

Open `http://localhost:3000` and press **Ambulance view**, or go straight to `http://localhost:3000/ambulance?unit=MEDIC-12`.

**The crew flow:**

1. A live map shows the ambulance and pulsing blips for eligible Blood Response Units.
2. The crew presses **MAKE REQUEST** and chooses a blood product and a destination hospital. Hospitals are listed by drive time only and never labelled "recommended".
3. The crew presses **GO**. The request is evaluated by the **unchanged** `calculate_live_rendezvous`.
4. A route overview shows the whole plan: the ambulance's route, the blood unit's route, the rendezvous point, and the hospital. Nothing moves until the crew presses **Start navigation**.
5. Heading-up, turn-by-turn navigation leads to the meeting spot. **Watch BR-02** frames both vehicles live so the blood unit can be seen moving. A compact bar shows the ETA to the blood point and the ETA to the hospital, both taken from the evaluator's numbers. The crew taps **Blood received**.
6. Navigation continues to the hospital, where the request closes as ARRIVED. At any point while driving, **Reroute** opens a dropdown of up to three distinct roads to the same point or hospital, with their times, using `GET /route/options`.
7. When the evaluator returns direct transport, the overview says so and navigation goes straight to the hospital.

The System UI's **Ambulance requests** panel lists every request and lets operations cancel one.

**Where it lives:**

- Backend: `backend/app/blood_requests/` and `backend/app/routing/coordinate_keyed.py`, plus `get_route()` on `RoutingProvider` (Mapbox Directions, in `mapbox_provider.py` only).
- New endpoints are at the end of `main.py`.
- Frontend: `frontend/src/app/ambulance/page.tsx`, `frontend/src/components/ambulance/`, `frontend/src/lib/ambulanceApi.ts`, `frontend/src/lib/navigation.ts`, and `frontend/src/components/AmbulanceRequestsPanel.tsx`.
- Tests: `backend/tests/test_blood_requests.py`.

**Works with both demo data sets (2026-09-27).**
- The System UI's **Ambulance view** button passes the selected **Demo data set** as `?scenario=<scenario_id>`.
- Every Ambulance endpoint (`/ambulances`, `/hospital-options`, `/blood-products`, `/resource-options`, `POST /requests`) accepts the same optional `scenario_id` as the other endpoints.
- Each crew request records its `scenario_id`, and the System UI's Ambulance requests panel shows only requests for the selected data set.
- Verified with `rural_ga_initial_v1` and `echols_valdosta_public_geography_v1`, including the real SGMC hospital references in the second.

**Limits:**

- Requests are held **in memory** and are lost when the backend restarts.
- Location is **simulated by default**. The ambulance drives the route at 5x real time by default (`BLOODGRID_AMBULANCE_SIM_SPEED_MULTIPLIER`); the **Demo** menu in the top bar switches between x1, x2, x5, and x10 during a demo. Use `?sim=0` for browser GPS, which only works on HTTPS or localhost.
- The ambulances are the `patient_unit_id` values in `live_incidents.csv`.
- The blood product is recorded but does not filter units (only `O_NEG` exists).
- The System UI shows requests in a panel only, not yet as map markers.

## Known Issues Found 2026-09-26

These are in code outside the Ambulance UI and were left for their owner to confirm.

1. **Fixed 2026-09-27 (meeting spots): Rendezvous results depended on evaluation order.** The rewritten evaluator keys the hospital by `hospital_id` and routes through `CoordinateKeyedProvider`.
   - **Cause:** `backend/app/rendezvous/service.py` gives every supplied hospital the location ID `"destination"`. `MapboxMatrixProvider` caches by location ID, so after one incident is evaluated, a later incident going to a *different* hospital reuses the first hospital's point-to-hospital times.
   - **Reproduced:** evaluated alone, `LIVE-003` gives `DIRECT_TRANSPORT`. Evaluated after `LIVE-001`, which the dashboard loads first, it gives `RENDEZVOUS` at `RV-03`. This explains why this handoff's `LIVE-003` result was not reproducible.
   - **Suggested fix:** use `hospital.hospital_id` as the location ID in `_hospital_location()`, and replace the hard-coded `"destination"` key in `_evaluate_candidate()` with that ID.
   - Crew requests already avoid this through `CoordinateKeyedProvider`.
2. **Fixed 2026-09-27 (meeting spots): Blank rendezvous settings crashed the calculation.** Those settings are removed, and the new `BLOODGRID_MEETING_*` settings treat blank as the default. Blank `BLOODGRID_RENDEZVOUS_MAX_ADDED_HOSPITAL_DELAY_MINUTES=` and `BLOODGRID_RENDEZVOUS_HOSPITAL_DELAY_WEIGHT=` lines, as in `.env.example`, raise "could not convert string to float" in `_nonnegative_float()`, so anyone who copies the template gets a failing live-incident panel. Treating blank as the default (as `coverage_target_minutes()` now does) would fix it.
3. **The System UI map can open off-center.** The map area stretches to the full height of the right-hand panel column, so its center can fall below the visible area and the map opens looking north of the demo region.

**Fixed 2026-09-27: System UI markers drifting while panning.** `.map-marker` had `transition: transform 140ms`. Mapbox positions markers by rewriting their inline `transform` on every frame, so each marker eased toward its position and trailed the map by about 35 px during a drag. The transition is removed, and the hover effect now uses an outline. Measured lag while dragging went from 34 px to 0–1 px.

Marker identity must use static CSS such as color, `clip-path`, borders, and text symbols. Do not add `transform` or a transform transition to any Mapbox marker element.

## Important Decisions Still Open

- Whether the Echols-Valdosta corridor should become the final live-demo scenario after a dashboard walkthrough.
- Coverage target, currently 20 minutes in `rural_ga_initial_v1`; whether it should differ for the final demo.
- Whether the default 10-minute maximum hospital delay and 0.5 hospital-delay weight should change for the final demo.
- Whether to add a scenario selector in the dashboard or keep scenario switching as a presenter-only local configuration step.
- Whether the final demo includes optional OpenAI-generated wording.
- Whether the Ambulance UI is recorded as part of milestone 8 or as a new milestone 9 (`AMBULANCE_UI_SPEC.md` decision D6).

These values should be centralized as configuration rather than hard-coded.

## Before You Make Changes

1. Check `git status` to see any teammate work that is not yet committed.
2. Read the documents listed in **Start Here**.
3. Keep changes focused on the current phase in `docs/IMPLEMENTATION_PLAN.md`.
4. Do not overwrite or remove other contributors' changes.

## Update This Document

Update this handoff at the end of every meaningful work session or whenever any of these change:

- current phase or completed features;
- file structure or architecture;
- datasets, source provenance, or synthetic/real status;
- configuration decisions or required environment variables;
- endpoints, user-facing workflows, or how to run the project;
- known limitations, blockers, or next recommended work.

Keep the opening status current, list what changed, and leave the next person with one clear recommended starting point. Prefer short, concrete language over a detailed activity log.
