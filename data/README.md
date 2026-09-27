# Data

This folder holds reproducible BloodGrid data and runnable demo worlds.

- `raw/`: downloaded, untouched public source files.
- `processed/`: derived geographic or demand-proxy data used by the application.
- `synthetic/`: deliberately fabricated operational demo data, such as inventory and unit status.
- `schemas/`: CSV field descriptions and validation notes.
- `scenarios/`: complete, versioned data bundles the application can load.

Every dataset must identify whether it is REAL, REAL PROXY, SYNTHETIC, or a
clearly described hybrid of those categories, and document its provenance and
limitations. A hybrid scenario must keep a `sources.json` manifest beside its
runtime files; see `schemas/v1/SOURCE_MANIFEST_CONTRACT.md`.

The application will select a scenario by `BLOODGRID_SCENARIO`. A scenario includes every CSV required for a runnable map and simulation, plus its own metadata and provenance. Preserve a scenario once it supports a demo; create a new versioned folder rather than quietly changing past inputs.
