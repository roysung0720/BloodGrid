# Ambulance UI Specification

**Status:** Working model built (2026-09-26). See **section 14, "As built"**, for where the implementation differs from the original proposal below. Open decision D6 still needs team sign-off.
**Last updated:** 2026-09-26
**Related:** `PRODUCT_SPEC.md` (Mode B), `SAFETY_AND_ASSUMPTIONS.md` (live rendezvous and dynamic availability assumptions), `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md` milestone 8.

## 1. Summary

BloodGrid will have two user interfaces:

| UI | Who uses it | Purpose | Route |
| --- | --- | --- | --- |
| **System UI** | EMS operations, dispatch, planners | The current dashboard, unchanged: regional map, baseline coverage, strategic deployment, synthetic operating state, live-incident selector, and live rendezvous evaluation. It also lists requests sent from ambulances. | `/` |
| **Ambulance UI** | The crew of a transporting ambulance | A simple, glanceable screen: see where you are and nearby blood resources, send a blood request, then follow navigation to the meeting spot and on to the hospital. | `/ambulance?unit=<ambulance id>` |

Each UI has a button at the top of the page that switches to the other: **Ambulance view** in the System UI's top bar and **System view** in the Ambulance UI's top bar. `/ambulance` without a unit shows an ambulance chooser.

The Ambulance UI is a **new front end for logic that already exists**. The decision itself is made by the existing deterministic evaluator, `calculate_live_rendezvous` in `backend/app/rendezvous/service.py`, which already:

- compares direct transport with nearby meeting spots (see section 14, revision 7);
- applies the shared eligibility rule and on-call mobilization;
- rejects points that are too late or exceed the added-delay limit;
- scores the rest.

This UI must not duplicate, fork, or change that logic. It supplies a request and displays the result.

## 2. Safety Boundaries for This UI

The project rules in `AGENTS.md` and `SAFETY_AND_ASSUMPTIONS.md` apply in full. For this UI they mean:

| Crew action | What BloodGrid does | What BloodGrid must not do |
| --- | --- | --- |
| Presses **Make Request** | Records that the crew, under its own protocol, has requested blood. This is the "authorized blood request" the evaluator requires (`blood_requested = true`). | Suggest, prompt, or decide whether the patient needs blood. |
| Picks a **blood product** | Records the crew's choice with the request. | Recommend or default to a product. It never shows a "suggested" product. |
| Picks a **destination hospital** | Lists active hospitals with road drive time, sorted by drive time only. The crew's choice becomes the supplied `destination_hospital_id`, which the evaluator validates but never changes. | Label any hospital as "recommended", "best", or "closest", or rank by anything other than plain drive time. |
| Presses **Go** | Runs the existing evaluator and shows its result, whether that is a rendezvous or direct transport. | Hide the direct-transport comparison. When the evaluator returns `DIRECT_TRANSPORT`, the UI says so plainly and navigates to the hospital. |

Other rules:

- All operational data remains **synthetic**, and the Ambulance UI shows a permanent "Synthetic demo" badge.
- The word "Recommended" may be used for the evaluator's **rendezvous point**, which is a logistics output, as the System UI's `RendezvousPanel` already does. It is never used for a hospital or a blood product.
- The screen is designed for the **attending crew member or partner, not the driver while moving**. It uses large touch targets and minimal typing, and should not need interaction while the vehicle is moving.
- Navigation guidance is an aid. Road rules, emergency-driving policy, and crew judgment always take precedence.

## 3. User Flow

```text
 [S1 Live map] --Make Request--> [S2 Request sheet] --Go--> [S3 Calculating]
      ^                               |                         |
      |                             Cancel                      v
      |                               |          evaluator recommendation?
      |                               |           RENDEZVOUS  |  DIRECT_TRANSPORT
      |                               |               v       |        v
      |                      [S4a Navigate: to rendezvous]    |  [S4b Navigate: to hospital]
      |                                         |  Blood received        ^
      |                                         +------------------------+
      |                                                                  |
      +--------------------------- Arrived / End ------------------------+
```

## 4. Screens

### S1: Live map (idle)

```text
+--------------------------------------+
| MEDIC-12            [Synthetic demo] |
|                                      |
|        .  (o)                        |
|             blip BR-02 (7 min)       |
|                                      |
|              [^]  <- you             |
|                                      |
|   (o) blip BR-01          [H]        |
|                                      |
| +----------------------------------+ |
| |          MAKE REQUEST            | |  <- full-width red button
| +----------------------------------+ |
+--------------------------------------+
```

- **Full-screen map** centered on the ambulance and following it. The ambulance is shown as a heading arrow, and a "recenter" button appears if the user pans away.
- **Blips:** Blood Response Units are shown as dots.
  - Eligible units, as reported by `GET /coverage/baseline` in `resource_eligibility`, pulse.
  - Ineligible units use the existing `unit-unavailable` style, so markers mean the same thing as in the System UI.
  - Tapping a blip shows the unit ID and, for eligible units, its road time to the ambulance including on-call mobilization.
- Hospitals are shown as small, neutral markers with no ranking.
- **Make Request:** a full-width red button pinned to the bottom, at least 64 px tall.
- **Location status chip:** "GPS", "Simulated location", or "Location unavailable".

### S2: Request sheet

A bottom sheet slides up over the map, which stays visible above it.

```text
+--------------------------------------+
|  Blood request                   [X] |
|                                      |
|  Blood product                       |
|  [ Select product              v ]   |
|                                      |
|  Destination hospital                |
|  [ Select hospital             v ]   |
|     North Valley Trauma Ctr   11 min |
|     Pine County Trauma Ctr    18 min |
|     East Ridge Community      24 min |
|                                      |
| +----------------------------------+ |
| |              GO                  | |  <- disabled until both chosen
| +----------------------------------+ |
+--------------------------------------+
```

**Blood product dropdown**

- The options are the distinct `product_type` values of blood units that are ONBOARD and VALID on currently eligible units, under the active availability profile. The demo scenario only has `O_NEG`, shown as "O negative".
- There is no preselected value; the crew must choose.
- The product is **recorded with the request and shown back to the crew**. The existing evaluator does not match products, and with a single product type in the data it does not need to. Matching by product would mean extending the shared eligibility rule, which needs team approval (open decision D1).

**Destination hospital dropdown**

- The list includes every active hospital, sorted by **road drive time from the ambulance's current location**, shortest first. Drive time is shown on the right, e.g. `11 min`.
- Ties are broken alphabetically by name, so the order is deterministic.
- Hospitals with no road route go at the bottom, marked "No route" and disabled.
- The row may show the recorded trauma level as plain text, as the System UI's `RendezvousPanel` already shows for the supplied destination (open decision D3). It never shows words like "recommended", "best", or "closest".
- Drive times are calculated when the sheet opens, and refreshed if it stays open longer than `BLOODGRID_AMBULANCE_ETA_REFRESH_SECONDS`.

**Go button**

- A large red button, disabled until both dropdowns have a value.
- It sends the request (section 7.2) and moves to S3.
- The **[X]** button closes the sheet without sending anything.

### S3: Calculating

- A full-width status message reads "Finding blood resource..." with a spinner. It normally lasts under 2 seconds.
- On failure, the backend's `detail` message is shown with a **Retry** button, and the crew's selections are kept.

### S4a: Navigate to rendezvous (`recommendation = RENDEZVOUS`)

```text
+--------------------------------------+
| [->] In 0.4 mi turn right onto SR 17 |  <- next maneuver banner
+--------------------------------------+
|        route line ======             |
|              [^]           (o) BR-02 |
|                        [P] RV-03     |
+--------------------------------------+
| Meet BR-02 at Route 17 Safe Staging  |
| You 13.0 min | BR-02 19.5 min        |
| You wait 6.5 min | +6.2 min vs direct|
| [ Blood received ]   [ End request ] |
+--------------------------------------+
```

- **Leg 1:** from the ambulance's location to the evaluator's `recommended_rendezvous_id`.
- A **maneuver banner** shows the next instruction and the distance to it, using the step list from `GET /route` (section 7.3).
- A **route line** shows the whole route. The rest of the route to the hospital is shown faded.
- The **resource blip** (`resource_id`) is shown moving toward the point. In the demo its position is simulated along its route.
- **Plan facts** come straight from the recommended candidate in `LiveRendezvousResult`:
  - `patient_to_rendezvous_minutes` ("You");
  - `resource_arrival_minutes` ("BR-02", including mobilization);
  - `patient_wait_minutes` or `resource_wait_minutes`;
  - `time_to_blood_minutes`;
  - `added_hospital_delay_minutes`, compared against `direct_transport_minutes`.
- **Blood received:** a large button the crew taps after the handoff. It switches the screen to leg 2 (S4b). The leg is never advanced automatically by distance, because the handoff is a human event.
- **End request:** cancels the request after a confirmation prompt and returns to S1.

Example, using `LIVE-001` / `MEDIC-12` with baseline availability, as currently returned by the evaluator:

- `RV-03` with `BR-02`: time to blood 19.5 min, patient waits 6.5 min, +6.2 min versus 28.7 min direct.

### S4b: Navigate to hospital

- Same layout as S4a, with the supplied destination hospital as the target.
- When the evaluator returned `DIRECT_TRANSPORT`, a banner shows its `recommendation_reason`, e.g. "Continue to the supplied destination: no meeting spot gets blood at least 3 min sooner..." It also shows `direct_transport_minutes`.
  - Example: `LIVE-004` / `MEDIC-08`, where direct transport is 13.9 min and every point is too late.
- When the ambulance comes within `BLOODGRID_AMBULANCE_ARRIVAL_RADIUS_METERS` of the hospital, the screen shows an **Arrived** state with an **End request** button. This screen is informational only.

### Shared states

| State | Behavior |
| --- | --- |
| Backend unreachable | A banner reads "Not connected to BloodGrid". The map keeps working, and Make Request is disabled. |
| Location unavailable | A banner explains why. Make Request is disabled until a location exists, either real or simulated. |
| Route not found | Show "No road route" for that target, and do not draw a line. |
| Evaluator error (HTTP 422/503) | Show the backend `detail` message and a Retry button. |
| Request cancelled from System UI | The screen returns to S1 with the message "Request cancelled by operations". |

## 5. Ambulances and Location

**Which ambulances exist**

- For the MVP, the transporting ambulances are the distinct `patient_unit_id` values in `live_incidents.csv`: `MEDIC-12`, `MEDIC-21`, `MEDIC-34`, and `MEDIC-08`.
- Each ambulance's starting position is its incident's location, because the crew is on scene.
- No new data file is required. A dedicated `transport_units.csv` is deferred (open decision D8).

**Location**

- **Real GPS:** the browser Geolocation API (`watchPosition`) supplies position and heading.
- Browsers allow GPS only on secure pages. `http://localhost` counts as secure, but a phone opening `http://<laptop-ip>:3000` does not, so GPS will not work there without HTTPS. For a phone demo, use simulated mode or an HTTPS tunnel.
- **Simulated mode (default for the demo):** the ambulance starts at its incident location and moves along the active route at `BLOODGRID_AMBULANCE_SIM_SPEED_MULTIPLIER` times real time. It is turned on with `?sim=1`, and the location chip reads "Simulated location".
- The ambulance sends its position to the backend every `BLOODGRID_AMBULANCE_POSITION_REPORT_SECONDS`, so the System UI can show it.

**Availability profile**

- The Ambulance UI uses `baseline` unless `?availability_profile=<id>` is given.
- It passes the profile to every backend call, exactly as the System UI does. This keeps both UIs consistent: for example, under `br_02_out_of_service`, `LIVE-001` becomes direct transport in both.

## 6. Visual Design

- Mobile-first, designed for a phone or tablet in portrait. It also works in landscape and on desktop for the demo.
- Map styles use Mapbox's free `navigation-day` and `navigation-night` styles, switched automatically by the device's light or dark setting.
- Touch targets are at least 56 px, and primary buttons at least 64 px.
- Text in the maneuver banner is at least 20 px, and everything else at least 16 px.
- Red is reserved for the Make Request and Go buttons and for alerts. Markers reuse the existing color tokens in `globals.css` (`--unit-available`, `--unit-on-call`, `--hospital`, `--rendezvous`, `--live-incident`, and the `unit-unavailable` and `rendezvous-recommended` variants), so markers mean the same thing in both UIs.
- The synthetic-data badge is always visible.

## 7. Backend Changes

These changes are **additive**. The existing modules (`rendezvous/`, `availability/`, `coverage/`, `deployment/`, `scenario_loader.py`) and existing endpoints stay as they are. All routing goes through `RoutingProvider`, and only `mapbox_provider.py` may contain Mapbox request details.

### 7.1 New `backend/app/requests/` package

- `RequestStore` is an in-memory store with no database, following `AGENTS.md` rule 6. Requests are lost when the backend restarts, which must be documented. Each request is labelled `SIMULATED`.
- To evaluate a request, the package builds a `LiveIncident` from it:
  - `incident_id = REQ-<n>`;
  - the ambulance's position;
  - the crew's `destination_hospital_id`;
  - `blood_requested = true`;
  - `patient_unit_id` set to the ambulance;
  - `status = OPEN`.

  It then appends that incident to a **copy** of the active scenario with `model_copy`, the same pattern `apply_availability_profile` uses, and calls the existing `calculate_live_rendezvous` unchanged. Source data files are never modified.
- Re-evaluation happens only when the crew presses Go or Retry. The plan is not recalculated automatically while driving (see open decision D9).

### 7.2 New endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/ambulances` | Ambulance IDs and starting positions, derived from live incidents. |
| GET | `/hospital-options?lat=&lon=&availability_profile=` | Active hospitals with drive minutes from that point, sorted as described in S2. Uses `get_travel_matrix`. |
| GET | `/blood-products?availability_profile=` | Product types carried by currently eligible units. Uses `eligible_response_units`. |
| POST | `/requests` | Body: `unit_id`, `latitude`, `longitude`, `blood_product`, `destination_hospital_id`, `availability_profile`. Creates the request, evaluates it, and returns `{ request, rendezvous: LiveRendezvousResult }`. |
| GET | `/requests` | Active requests, for the System UI. |
| GET | `/requests/{id}` | Request status and the stored `LiveRendezvousResult`. Polled by the Ambulance UI. |
| POST | `/requests/{id}/position` | Latest ambulance position. |
| POST | `/requests/{id}/blood-received` | Marks leg 1 complete. |
| POST | `/requests/{id}/cancel` | Ends the request. |
| GET | `/route?from_lat=&from_lon=&to_lat=&to_lon=` | Route geometry and turn steps for drawing and navigation. |

The CORS settings must also allow `POST`, still only from the configured frontend origins. Request status values are `ACTIVE_RENDEZVOUS`, `ACTIVE_DIRECT`, `BLOOD_RECEIVED`, `ARRIVED`, and `CANCELLED`.

### 7.3 Routing interface extension

Add a route method to `RoutingProvider`, as `PRODUCT_SPEC.md` anticipates (`get_route`):

```python
def get_route(self, origin: RoutingLocation, destination: RoutingLocation) -> Route | None: ...
```

`Route` contains:

- `duration_seconds` and `distance_meters`;
- `geometry`: a list of `[longitude, latitude]` points;
- `steps`: a list of objects, each with an instruction, a maneuver type, a distance, and a location.

The Mapbox implementation uses the Directions API with `steps=true` and `geometries=geojson`, and is added as a **new method** beside the existing Matrix code. Results are cached by rounded coordinates. Fake providers in tests implement it too.

### 7.4 Configuration (centralized in `config.py`)

These values are reused as they are, with no change:

- `BLOODGRID_RENDEZVOUS_MAX_ADDED_HOSPITAL_DELAY_MINUTES` (default `10`);
- `BLOODGRID_RENDEZVOUS_HOSPITAL_DELAY_WEIGHT` (default `0.5`).

New settings:

| Setting | Proposed default |
| --- | --- |
| `BLOODGRID_AMBULANCE_ETA_REFRESH_SECONDS` | 60 |
| `BLOODGRID_AMBULANCE_POSITION_REPORT_SECONDS` | 5 |
| `BLOODGRID_AMBULANCE_ARRIVAL_RADIUS_METERS` | 150 |
| `BLOODGRID_AMBULANCE_SIM_SPEED_MULTIPLIER` | 5 (changeable live from the Demo menu) |
| `NEXT_PUBLIC_REQUEST_POLL_SECONDS` (frontend) | 3 |

New optional settings must treat a blank value in `.env` as "use the default", as `coverage_target_minutes()` does. That way copying `.env.example` never breaks the app.

## 8. Data Changes

None are required for the MVP. Ambulances come from `live_incidents.csv`, and requests live in memory. Any future persistent ambulance data, such as `transport_units.csv`, would follow `AGENTS.md` rule 7 and get a new schema and scenario version rather than editing v1 in place.

## 9. Frontend Changes

| Item | Change |
| --- | --- |
| `src/app/page.tsx` | Its current dashboard content moves to `src/app/system/page.tsx` with no behavior change. `page.tsx` becomes the landing page. |
| `src/app/system/page.tsx` | The existing System UI. It adds an "Ambulance requests" section alongside the existing live-incident selector. Selecting a runtime request shows its stored `LiveRendezvousResult` in the existing `RendezvousPanel`. |
| `src/app/ambulance/page.tsx` | New Ambulance UI entry. It reads `?unit=`, `?sim=`, and `?availability_profile=`. |
| `src/components/ambulance/` | New components: `AmbulanceMap`, `ResourceBlips`, `MakeRequestButton`, `RequestSheet`, `HospitalSelect`, `ProductSelect`, `NavigationView`, `ManeuverBanner`, `PlanFacts`, `LocationStatus`. |
| `src/lib/api.ts`, `src/lib/types.ts` | Add types and calls for every endpoint in 7.2. Reuse the existing `LiveRendezvousResult` and `RendezvousCandidate` types. |
| `src/lib/useLocation.ts` | Hook that returns the GPS or simulated position and heading. |

The frontend must not calculate hospital order, eligibility, or rendezvous choice. It only displays what the backend returns.

## 10. Tests

These are deterministic backend tests using a fake `RoutingProvider`, following `AGENTS.md` rule 9. The existing `test_rendezvous_service.py` and `test_availability_profiles.py` already cover the evaluator and profiles and are not changed.

- **Hospital options:** sorted by drive time, ties broken alphabetically, unroutable hospitals last, inactive hospitals excluded.
- **Blood products:** only products on eligible units are offered, and a profile that makes a unit ineligible removes its blood.
- **Request evaluation:**
  - a runtime request gives the same result as an equivalent CSV incident;
  - the crew's hospital is preserved;
  - the availability profile is applied;
  - source scenario data is unchanged afterwards.
- **Request lifecycle:** create, then blood received, then arrived; cancel works from any state; unknown IDs return 404.
- **`get_route`:** parses a Directions-style payload, and a no-route response returns `None`.
- **Config:** blank values for the new settings fall back to their defaults.

Frontend checks: `npm run lint` and `npm run build`, plus a manual checklist covering S1 to S4b in simulated mode, and the System UI showing the request.

## 11. Build Order

1. `get_route` in the routing interface and the Mapbox provider, plus `GET /route`.
2. `GET /ambulances`, `GET /hospital-options`, and `GET /blood-products`, with tests.
3. The `requests/` package and its endpoints, reusing `calculate_live_rendezvous`, with tests.
4. Route split: landing page, `/system` (a pure move), and an empty `/ambulance`.
5. Ambulance screens S1 and S2.
6. S3, S4a and S4b (navigation).
7. System UI: the "Ambulance requests" section.
8. Documentation: `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `HANDOFF.md`, `SAFETY_AND_ASSUMPTIONS.md`.

## 12. Out of Scope for This Version

- Voice guidance. The browser's built-in speech synthesis is a possible free follow-up.
- Offline maps.
- Live traffic.
- Automatic re-evaluation while driving.
- Login and authentication. The unit is chosen by URL for the demo.
- A separate UI for the Blood Response Unit crew.
- Several requests competing for the same unit.
- Integration with real CAD or GPS feeds.
- Matching requests by blood product (see D1).

## 13. Decisions

The working model uses the proposed defaults below. Only D6 still needs team sign-off; any of the others can be revisited.

| # | Question | As built |
| --- | --- | --- |
| D1 | Should the first dropdown be labelled "Blood type" (the patient's blood group) or "Blood product" (what the crew is asking to receive)? Should the product later filter which units are eligible? That would extend the shared eligibility rule. | "Blood product". Recorded only, with no filtering until the inventory has more than one type. |
| D2 | What should the blips include: only Blood Response Units, or also other ambulances? | Blood Response Units only. |
| D3 | Should hospital rows show trauma level beside the drive time? | Shown as plain text, e.g. "North Valley Trauma Center · 29 min · Level II". |
| D4 | Should the demo use real GPS or a simulated location? | Simulated by default; `?sim=0` uses GPS. |
| D5 | How do users move between the two UIs? | **Resolved (Alex's request):** a button at the top of each page. `/` stays the System UI; there is no landing page or `/system` route. |
| D6 | The Ambulance UI brings forward "configurable hospital destinations" and "dynamic ambulance animation", which `PRODUCT_SPEC.md` lists as stretch features. Should it count as part of milestone 8 or a new milestone 9? | **Open.** Proposed: record it as milestone 9. |
| D7 | Rendezvous weight and maximum added delay. | Reuses the existing 0.5 and 10 minutes. |
| D8 | Should ambulances get their own data file, or keep being derived from live incidents? | Derived from live incidents. |
| D9 | Should an active plan re-evaluate as the ambulance moves? | No. Only on Go. |

## 14. As Built (2026-09-26)

This section records where the working model differs from, or adds to, sections 1 to 12.

**Navigation between UIs.** `/` remains the System UI, with an **Ambulance view** button in its top bar. `/ambulance` shows an ambulance chooser; `/ambulance?unit=MEDIC-12` opens that crew's screen, which has a **System view** button. Optional parameters: `sim=0` for GPS, and `availability_profile=<id>`.

**Backend**

- The package is `backend/app/blood_requests/` rather than `requests/`, to avoid confusion with the popular `requests` Python library.
- Two endpoints were added beyond section 7.2:
  - `GET /resource-options?lat=&lon=&availability_profile=` returns every Blood Response Unit with its eligibility, reasons, and arrival time (driving plus mobilization). It supplies the blips.
  - `GET /ambulance/settings` serves the Ambulance UI timing settings from `config.py`, so they stay centralized. `NEXT_PUBLIC_REQUEST_POLL_SECONDS` therefore became the backend setting `BLOODGRID_REQUEST_POLL_SECONDS`.
- `POST /requests/{id}/position` also applies the arrival geofence and sets `ARRIVED` when the ambulance is within `BLOODGRID_AMBULANCE_ARRIVAL_RADIUS_METERS` of the hospital, on the hospital leg only.
- `POST /requests/{id}/cancel?by=operations|crew` records who ended the request, so the crew sees "Request cancelled by operations".
- A new request from an ambulance that already has an active request replaces it; the old one is ended with a reason.
- **Coordinate-keyed routing.** The existing rendezvous evaluator uses the label `"destination"` for whichever hospital is supplied. The Mapbox adapter caches travel times by label, so after one incident was evaluated, a later request to a *different* hospital could reuse the first hospital's times. Crew requests therefore call the unchanged evaluator through `routing/coordinate_keyed.py`, which keys every location by its coordinates. The same issue affects the System UI's live-incident panel. It is recorded in `HANDOFF.md` for the evaluator's owner, and was not changed here.
- `RoutingProvider` gained `get_route()`. The Mapbox Directions call lives only in `mapbox_provider.py`.

**Frontend**

- API calls are in `src/lib/ambulanceApi.ts`, and the new types are appended to `src/lib/types.ts`.
- Display-only route geometry (position along the route, next turn, distance formatting) is in `src/lib/navigation.ts`.
- Components are in `src/components/ambulance/`: `AmbulanceApp`, `AmbulanceMap`, `RequestSheet`, and `NavigationPanels`.
- The Ambulance map is created once and only moves markers and route lines, unlike the System UI map.
- **Route overview before driving (revision 2).** GO creates the request and shows a north-up overview of the whole plan:
  - the ambulance's route to the rendezvous point (blue);
  - the Blood Response Unit's route to the point (purple, dashed);
  - the point-to-hospital route (grey, dashed);
  - the rendezvous point, the assigned unit, and the destination hospital.

  Nothing moves until the crew presses **Start navigation**. That also starts the simulated clock for the Blood Response Unit, so both vehicles follow the evaluator's timeline from the same moment.
- **Heading-up navigation.** While driving, the camera rotates so that the direction of travel points up. It is tilted 45 degrees and places the vehicle low on the screen. The arrow faces a point 40 m ahead on the route, so it does not jitter at bends.
- **Compact panels that never cover the vehicle.** The turn banner is a single line. The bottom bar shows only two ETAs plus small **Blood received** and **End** buttons. The map measures the panels' height and pads the camera so the vehicle, route, and Mapbox attribution stay in the visible area.
- **ETAs come from the backend evaluator**, the same engine the System UI's Live incident evaluation uses. Mapbox Directions supplies only the drawn line and turn steps.
  - **Blood point** is the evaluator's `patient_to_rendezvous_minutes`, scaled by how much of the route is left. The note under it shows when the blood unit gets there, from `resource_arrival_minutes` minus elapsed time.
  - **Hospital** is `max(your arrival at the point, the unit's arrival) + rendezvous_to_hospital_minutes`. After blood is received, or for direct transport, it is the remaining share of `rendezvous_to_hospital_minutes` or `direct_transport_minutes`.
  - The simulated vehicle drives each leg in exactly that many modeled minutes, divided by the speed multiplier.
- **Reroute dropdown (revision 4).** The bottom bar's **Reroute** button opens a list of up to **three distinct roads** from the current position to the same target: the rendezvous point on the first leg, the hospital on the second. Every location stays the same.
  - Each row shows a letter, "via" a road only that option uses, its distance, and its time, marked **fastest** and/or **current**. Rows are sorted by time. The current road cannot be re-picked.
  - Picking a row switches the leg to that road immediately and closes the list.
  - `GET /route/options` (`route_options_between` in `blood_requests/service.py`) builds the list:
    1. It starts with Mapbox's recommended route and alternatives (`get_route_options()`).
    2. If fewer than three distinct roads remain, it requests routes through silent via points (`get_route_via()`, using the Directions `waypoints` parameter so there is no stop). The via points sit at 1/3, 1/2, and 2/3 of the recommended route, offset 15%, 25%, and 45% of the trip to each side. The requests run in parallel.
    3. It keeps the fastest acceptable ones. A route is rejected if it is more than 1.8x the recommended duration, needs a U-turn, or stays within 120 m of an already offered road at its 25%, 50%, and 75% points.
    4. These values live in `config.py` (`ROUTE_OPTION_*`), and the geometry is in `routing/geometry.py`.
  - In testing, four real demo trips each returned three roads in under one second.
  - Each option's time is the evaluator's remaining time for the leg, scaled by that road's duration relative to the recommended road from the same spot. This keeps ETAs calibrated to the evaluator.
  - The rendezvous plan itself is not re-evaluated (decision D9).
- **Watching the blood unit (revision 5).** While driving to the rendezvous, a **Watch BR-02** map button switches to a north-up camera that keeps the ambulance, the blood unit, and the meeting point in frame, re-fitting as both move. **Back to driving** returns to heading-up navigation.
  - The assigned unit's blip shows its live status: "ready" in the overview, then "mobilizing", its minutes to the point, "at point", and finally "handed off". All of it comes from the evaluator's `mobilization_minutes`, `resource_driving_minutes`, and `resource_arrival_minutes` on the shared simulation clock.
  - After **Blood received** the unit stays parked at the meeting point instead of jumping back to its station.
- **No confirmation pop-ups (revision 6).** Ending or cancelling a request takes two taps instead of a browser dialog. The first tap turns the button red ("Tap again to end" / "Tap again to cancel"), and it disarms after 3 seconds if the second tap does not come. This applies to **End** while driving, the **X** on the route overview, and **Cancel request** in the System UI's Ambulance requests panel.
- **Click-blocking fix (revision 6).** Map markers with a z-index (the ambulance arrow and the assigned blood unit) used to draw on top of the bottom panel. When one drove underneath, it silently swallowed clicks on the dropdowns and buttons. The map now has its own stacking context (`isolation: isolate`), and the overlays sit above it. A failed load of hospitals or blood products also shows a **Retry** button, rather than leaving a dropdown disabled.
- **Meeting spots (revision 7, 2026-09-27).** The rendezvous target can now be any suitable mapped public place (parking lot, gas station, fire station, church, or school lot), a scenario known site, or a roadside point.
  - The evaluator picks the soonest blood that keeps the ambulance heading toward the hospital; see **Meeting Spots** in `docs/HANDOFF.md`.
  - Generic spots are labeled by the road they sit on, e.g. "Parking lot on GA 211".
  - The Ambulance UI no longer loads the scenario's rendezvous-point list; it uses the candidate's own coordinates.
- **Driven road stays on the map (revision 8, 2026-09-27).** While driving, the route line behind the ambulance turns a dull red and only the road ahead stays bright red.
  - The driven part of the first leg is kept after **Blood received**, and the driven part of a road abandoned by **Reroute** is kept too, so the whole trip stays visible for the demo until the request ends.
  - The split comes from the leg's own route geometry (`splitRoute` in `src/lib/navigation.ts`). In simulation it is exact; with GPS it is the nearest point on the route.
- **Demo menu (revision 3).** A **Demo** button in the Ambulance UI top bar sets the simulation speed to x1, x2, x5, or x10. The default is `BLOODGRID_AMBULANCE_SIM_SPEED_MULTIPLIER`, now 5.
  - Movement runs on a single simulation clock shared by the ambulance and the blood unit. The clock re-anchors when the speed changes, so neither vehicle jumps.
  - ETAs remain in modeled road minutes.
  - In GPS mode the speed buttons are disabled.
- On the idle screen the camera frames the ambulance, the blips, and the hospitals. While navigating it follows the vehicle closely. Dragging the map pauses following, and a **Recenter** button restores it.
- In simulated mode the ambulance drives the returned route at `BLOODGRID_AMBULANCE_SIM_SPEED_MULTIPLIER` times real time. At the end of the hospital leg it pulls in to the hospital's coordinates, so the arrival geofence triggers.
- The assigned Blood Response Unit's blip waits out its mobilization time and then drives its own route to the rendezvous point.
- The System UI gained `src/components/AmbulanceRequestsPanel.tsx`. It polls `GET /requests`, shows each request's status and plan, and lets operations cancel a request. Map markers for requests in the System UI are a follow-up.

**Tests.** `backend/tests/test_blood_requests.py` covers:

- ambulance options, hospital ordering, blood products, and resource options;
- request/scenario equivalence, the preserved hospital, availability profiles, and unchanged source data;
- the rendezvous and direct lifecycles through ARRIVED;
- idempotent cancel, replacement of an active request, and invalid submissions;
- a regression test for coordinate-keyed routing;
- Directions parsing;
- blank-safe settings.

The full flow was also driven in Chrome: request, rendezvous navigation, blood received, hospital navigation, arrival, a direct-transport case, and cancellation by operations.
