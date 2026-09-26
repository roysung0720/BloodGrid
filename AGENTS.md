# BloodGrid Agent Instructions

1. Read `docs/PROJECT_CONTEXT.md` and `docs/PRODUCT_SPEC.md` before making architectural changes.
2. BloodGrid is logistics decision support. It must never make clinical treatment, diagnosis, transfusion, or destination decisions.
3. Build the MVP in the order listed in `docs/IMPLEMENTATION_PLAN.md`. Preserve working behavior before adding stretch features.
4. A response resource is eligible only when usable blood, an eligible vehicle, a qualified clinician, and valid operational status are all present.
5. Keep routing-provider code behind the backend routing interface. Do not place Mapbox-specific logic in optimization modules.
6. Prefer free, local, and understandable tools. Do not add paid services, databases, or new framework layers without explicit approval.
7. Clearly label real and synthetic data, retain source provenance, and never present synthetic operational data as real.
8. Keep configuration values centralized. Do not hard-code optimization thresholds or scoring weights throughout the application.
9. Add deterministic tests for changes to eligibility, coverage, deployment, or rendezvous logic.
10. Update the relevant documentation when the architecture, data model, or safety assumptions change.
11. Update `docs/HANDOFF.md` at the end of each meaningful work session so teammates and their agents can understand the current state, decisions, limitations, and next recommended work.
