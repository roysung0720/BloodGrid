# Data Scenarios

Each folder here is a complete, versioned data bundle that BloodGrid can load. It includes all runtime CSV files, `scenario.json`, and a README with provenance and limitations.

Use lowercase, underscore-separated scenario IDs ending in a version, such as `rural_ga_initial_v1`. Select the active bundle through `BLOODGRID_SCENARIO`.

After a scenario is used for a stable demo, preserve it as a reproducible snapshot. Create a new versioned folder for changed geography, demand data, assumptions, or operational conditions instead of overwriting the earlier bundle.
