# Product vision

`dsh-artemis` should make Android feel like a first-class execution and observation surface inside DeepSeek Harness — the mobile counterpart of an integrated browser/computer-use tool.

The product is not just an ARTEMIS dashboard. Its value comes from combining four capabilities in one Harness-native workflow:

1. **Observe** the real Android device/emulator state and screen.
2. **Act** through the official ARTEMIS MCP automation surface.
3. **Understand** screenshots with a vision-capable Harness model.
4. **Verify** the post-action UI/state and continue until the requested outcome is satisfied.

## Why users install it

### Android developers

- inspect the current emulator/device without leaving Harness;
- ask the coding agent to implement a feature, launch the app, navigate to it and verify the rendered result;
- reproduce a mobile bug while keeping source changes, device state and traces in one agent session;
- validate navigation, loading, empty, error and success states against the actual app rather than inferred code behavior.

### Full-stack developers

- validate an end-to-end flow that crosses backend/web work and a mobile client;
- have one Harness session modify APIs and immediately verify the Android consumer;
- catch contract regressions that compile successfully but render or behave incorrectly on-device.

### QA / test engineers

- run natural-language Android regression checks through ARTEMIS;
- inspect live state and traces when a task fails;
- use visual verification for issues that hierarchy/XML checks alone miss: clipping, overlap, wrong assets, unreadable contrast, stale loading indicators or unexpected dialogs;
- preserve deterministic traces/replays for diagnosis while keeping screenshots ephemeral by default.

### Autonomous coding-agent workflows

The highest-value target is a closed loop:

```text
inspect code
    ↓
implement/fix
    ↓
build/install app
    ↓
ARTEMIS action
    ↓
capture Android observation
    ↓
vision model evaluates actual UI
    ↓
pass ──────────────► report evidence
fail ─► inspect/fix ─► repeat
```

This is the mobile equivalent of an agent using an integrated browser to implement and visually verify a web feature.

## Two visual surfaces

The human viewer and the model observation path are related but are not the same API.

### Human-facing screen

A continuous or refreshable Android surface inside the Harness right sidebar. Goals:

- low-latency human supervision;
- manual controls;
- device/task status around the screen;
- native Harness layout and theme behavior.

The live viewer may consume a proxied multipart stream and does not automatically become model context.

### Model-facing visual observation

A discrete screenshot/frame promoted to a real Harness image input when the active model supports vision. Goals:

- explicit, bounded observations rather than streaming video into model context;
- predictable token/cost usage;
- evidence tied to the action/check that requested it;
- no persistence of every frame by default.

The target loop is:

```text
ARTEMIS/device frame
      ↓
dsh-artemis Host validates one PNG/JPEG observation
      ↓
Harness native image-attachment/session input seam
      ↓
vision-capable model
      ↓
reasoning + ARTEMIS MCP action
```

Do not implement this by embedding base64 screenshots into arbitrary text or by bypassing Harness' native image intake. Harness already has durable image-attachment/session semantics; `dsh-artemis` should integrate with that supported seam after its exact programmatic contract is verified.

## Vision-model policy

The architecture is capability-driven, not hardcoded to one model id.

As of September 2026, DeepSeek V4.1 Flash (`deepseek-flash`) is the primary validation target because it provides native multimodal visual understanding and agent/tool capabilities. Future models should work when Harness reports equivalent image-input capability.

The plugin should therefore distinguish:

- `vision available`: allow model observation/check workflows;
- `vision unavailable`: keep ARTEMIS MCP + human viewer working and fall back to hierarchy/trace inspection.

No feature should assume that every configured Harness model accepts images.

## Core workflows

### Implement and visually verify

User intent: "Implement this mobile screen and make sure it looks correct."

1. Agent edits source.
2. Project build/install flow runs through the repository's normal tooling.
3. ARTEMIS reaches the target screen.
4. `dsh-artemis` supplies an explicit screenshot observation to the model.
5. Model checks requested visual/behavioral criteria.
6. Agent fixes and repeats if necessary.

### Reproduce and diagnose

User intent: "This button sometimes leaves a blank screen. Find and fix it."

1. ARTEMIS reproduces the flow.
2. Agent inspects screenshots + device state + trace.
3. Agent correlates failure with source/log evidence.
4. Fix is implemented.
5. Same flow is rerun and visually verified.

### Regression verification

User intent: "Check login, onboarding and settings after this refactor."

1. Run bounded ARTEMIS tasks for each journey.
2. Capture explicit checkpoints rather than all frames.
3. Model evaluates state/visual expectations.
4. Trace/checkpoint evidence summarizes failures.

## Product constraints

- ARTEMIS MCP remains the agent-facing action authority.
- The sidebar does not become a second automation engine.
- Model visual observations are explicit snapshots, not an uncontrolled video feed.
- Screenshots/traces may contain sensitive data: avoid persistence by default and never log image bytes/base64.
- Manual controls and model tools use narrow allow-listed operations; no generic browser-to-ADB shell.
- UI remains native Harness: official slots, primitives and `--dsw-*` tokens.
- Missing vision support must degrade gracefully rather than disabling the whole plugin.
