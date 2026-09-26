# Data Schema v1

This folder defines the first CSV contract for runnable BloodGrid scenarios. Read `DATA_CONTRACT.md` before editing a scenario or adding data-loading code.

The contract is intentionally small enough for the HackGT MVP. Backend Pydantic models should enforce these same rules when the API is introduced. Create a new schema folder only when a change cannot remain backward-compatible with existing scenario files.
