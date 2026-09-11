# Roadmap

The product direction is described in [`product-vision.md`](product-vision.md). The guiding goal is a Harness-native Android computer-use surface: human supervision plus model-facing visual observation through ARTEMIS.

## Phase 0 — investigation and bootstrap

Status: substantially complete.

- verify Harness external plugin package/loading contract;
- verify right-sidebar registry/slot signatures;
- verify Host↔Client communication primitives;
- inventory ARTEMIS device/task/trace APIs and `artemis-client`;
- establish security/maintainability policies and compatibility pins;
- prove packaged installation/composition against pinned Harness;
- add ARTEMIS MCP config generator and native rules-skill adapter.

## Phase 1 — minimal native panel

Status: in progress; merge is gated on real Harness + Chromium E2E.

- native Android right-sidebar page/guide entry;
- ARTEMIS reachability/status;
- active device serial/model/state;
- Busy / Ready / Offline / No-device states;
- refresh and bounded polling;
- fake-ARTEMIS browser E2E on a real blank Harness Session;
- add verified Android metadata from readiness only where cost/refresh policy is appropriate.

## Phase 1.5 — explicit screenshot observation

This phase separates human preview from model vision so the contracts remain clear.

- expose a narrow Host operation that obtains **one** validated Android frame from the verified ARTEMIS stream mechanism;
- accept PNG/JPEG only, with strict content/size/time limits;
- add refreshable screenshot/preview to the human panel;
- verify Harness' programmatic native image-attachment/session-input seam;
- promote an explicit Android observation into a real model image input when the selected model supports vision;
- add deterministic tests proving the screenshot that the human sees is the observation admitted to the model path;
- do not persist observations automatically.

Validation target: DeepSeek V4.1 Flash today, capability-driven for future vision models.

## Phase 2 — live human screen

- proxy/consume the verified ARTEMIS multipart live stream through the cleanest supported Host path;
- preserve device aspect ratio and sidebar resize behavior;
- recover from dropped stream/restarts;
- keep continuous video human-facing; model observations remain discrete checkpoints.

## Phase 3 — bounded device controls

- Back, Home, Recents and Rotate;
- explicit busy/error feedback;
- narrow allow-listed Host/ARTEMIS actions only;
- no generic ADB/shell surface;
- no duplication of ARTEMIS agent automation semantics.

## Phase 4 — tasks, traces and visual QA loop

- current ARTEMIS task status;
- results/failure summary;
- trace/replay entry points using supported ARTEMIS APIs;
- visual-check workflow: action → screenshot observation → model evaluation → optional follow-up action;
- attach observation/checkpoint evidence to task/trace summaries without retaining uncontrolled video.

## Phase 5 — installation and agent experience

- orchestrate one explicit `artemisRoot` into the MCP row + optional rules-skill face;
- surface independent status for ARTEMIS daemon/UI and ARTEMIS MCP connection;
- integrate upstream `mcp_server/rules.md` through the native Harness skill face;
- capability-check model vision before exposing visual-agent actions;
- document one-command or native settings flow without scanning arbitrary filesystem paths.

## Phase 6 — autonomous mobile computer-use workflows

- "implement and visually verify" workflow for Android UI changes;
- reproducible bug-reproduction loop with screenshot + trace evidence;
- bounded regression journeys with explicit visual checkpoints;
- optional policy for visual acceptance criteria supplied by the user/repository;
- safe retry/stop budgets to avoid unbounded agent/device loops.

## Phase 7 — compatibility and polish

- light/dark theme and native Harness components/tokens;
- documented supported Harness/ARTEMIS/model revisions/capabilities;
- full integration smoke workflow with real ARTEMIS + Android emulator where CI infrastructure permits;
- performance, privacy and screenshot-retention review;
- release/versioning policy for a developer-preview upstream.
