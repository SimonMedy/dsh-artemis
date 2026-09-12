# Bounded latest-trace evidence

This Phase 4 lot adds an explicit, read-only drill-down for the latest ARTEMIS step. It is intentionally structure-only.

## Browser contract

`GET /dsh-artemis/v1/evidence/latest-traces`:
- crosses the Harness connection trust fence before ARTEMIS access;
- accepts no query parameters or browser-provided identifiers;
- derives the current session from ARTEMIS `/api/status`;
- selects the latest recorded step server-side;
- validates the server-derived `step_id` before using it upstream;
- fetches the ARTEMIS trace tree only after the user explicitly chooses **Inspect traces**;
- returns only bounded `name`, `type`, `status` and `children` metadata.

The response never includes ARTEMIS session, step or trace identifiers, payloads, raw/native thinking, screenshots, filesystem paths, LLM call bodies or arbitrary upstream JSON. The server caps tree depth, children and total nodes; the browser independently validates the same shape.

## Why replay is not part of this route

Pinned ARTEMIS replay GET endpoints call `_ensure_session_chunked(...)`. That operation can materialize replay chunks/files, so those endpoints are not treated as side-effect-free reads even though their HTTP method is GET. Their responses also contain values such as `file://` screenshot paths, raw thinking, action parameters and replay/LLM details.

For that reason this plugin does not call replay endpoints from the read-only evidence route. Replay inspection/execution needs a separate policy decision, explicit user action, bounded server-derived identifiers and lifecycle/retention rules before it is exposed.

## Bounds

- maximum trace tree nodes: 64
- maximum trace tree depth: 6
- maximum children retained per node: 16
- upstream JSON uses the existing ARTEMIS client byte/time limits
- client fetch is same-origin, `no-store`, redirect-denying and time-bounded

Deterministic unit and real Harness/Chromium E2E fixtures deliberately include secret trace ids, payloads, raw thinking, file paths and LLM output to prove those fields do not cross the sanitized route or reach rendered UI.
