# Roadmap

## Phase 0 — investigation and bootstrap

- verify Harness external plugin package/loading contract;
- verify right-sidebar registry/slot signatures;
- verify Host↔Client communication primitives;
- inventory ARTEMIS device/task/trace APIs and `artemis-client`;
- test networking/CSP assumptions for `localhost:8000`;
- establish CI and compatibility pins.

## Phase 1 — minimal native panel

- native Android right-sidebar tab;
- ARTEMIS reachability/status;
- active device serial / AVD / Android metadata when available;
- single screenshot or refreshable preview;
- refresh/reconnect behavior;
- browser E2E using fake ARTEMIS.

## Phase 2 — live screen

- consume the verified ARTEMIS live mechanism through the cleanest supported path;
- preserve device aspect ratio and sidebar resize behavior;
- recover from dropped stream/restarts.

## Phase 3 — manual controls

- Back, Home, Recents and Rotate;
- explicit busy/error feedback;
- no duplication of ARTEMIS agent automation semantics.

## Phase 4 — tasks and traces

- current ARTEMIS task status;
- results/failure summary;
- trace/replay entry points using supported ARTEMIS APIs.

## Phase 5 — compatibility/polish

- light/dark theme and native Harness tokens/components;
- documented supported Harness/ARTEMIS revisions;
- full integration smoke workflow.
