# Hybrid Android testing strategy

`dsh-artemis` does not replace unit, integration, JUnit, Espresso or Compose UI tests. The default strategy is hybrid: use the cheapest, most deterministic test that can prove the required invariant, then use ARTEMIS for real-world, adaptive and visual verification.

## When to prefer deterministic tests

Use classic tests first when the check is exact, repeatable and cheap to express in code. Examples:

- pure business logic and state transitions;
- persisted database state;
- exact API status/payload contracts;
- one known Compose semantic node or control;
- short, deterministic navigation flows that already have a stable Espresso/Compose test.

These tests belong earlier in the feedback loop because they are faster, less flaky and easier to run at scale.

## When to use ARTEMIS + a vision-capable model

Use ARTEMIS when the check depends on the real device/emulator, an adaptive user journey, or human-like visual judgement. Examples:

- reproduce a bug described in natural language;
- explore an unknown or recently changed flow before writing a deterministic test;
- check for clipping, overlap, wrong assets, unexpected dialogs, stale loaders or other visual defects;
- validate a feature across different device sizes, orientations or OS states;
- correlate a user-visible failure with Android hierarchy, OCR, Logcat or ARTEMIS trace evidence;
- verify a newly implemented UI against the user's visual and behavioral criteria.

## Recommended agent loop

For significant Android changes, prefer this order:

1. run relevant fast deterministic tests;
2. build and install the app using the repository's normal tooling;
3. use ARTEMIS to reach the target state on the real emulator/device;
4. collect only the observations needed for verification (screenshot, hierarchy, trace or logs);
5. let a vision-capable model evaluate explicit visual criteria when needed;
6. if the check fails, correct the smallest plausible cause, then rebuild and rerun the affected part of the loop;
7. stop after a bounded number of retries and report remaining uncertainty/evidence.

## Evidence policy

ARTEMIS already produces useful episode evidence. `mobile_get_device_state("screenshot")` writes a local JPEG and `mobile_inspect_trace` can expose before/after/action-overlay screenshots. `dsh-artemis` should reference this existing evidence rather than introduce a second screenshot archive.

Model-facing images should be explicit checkpoints, bounded by the Harness attachment policy, and not persisted as an uncontrolled video feed. Never log image bytes or base64 content.

## Rule of economy

Do not use ARTEMIS to prove something a cheap local test can prove more reliably. Do not use a vision model when hierarchy/state data is sufficient. Do not capture every frame. Add real-world and visual verification only when it proves product behavior that deterministic tests do not efficiently cover.
