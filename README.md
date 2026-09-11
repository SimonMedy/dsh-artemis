# dsh-artemis

Native ARTEMIS integration for DeepSeek Harness.

The project keeps ARTEMIS MCP as the agent-facing automation interface and adds a native Harness UI for humans: device status, Android preview/live screen, manual controls, task status and traces.

## Status

Early investigation / bootstrap. APIs are pinned and verified before implementation because DeepSeek Harness is in developer preview.

## Architecture

- `src/host/`: machine-side adapter for ARTEMIS / Android.
- `src/client/`: Harness client UI and right-sidebar integration.
- `src/shared/`: JSON-safe RPC contracts and shared types.
- `docs/`: architecture, investigation notes, upstream pins, testing strategy and roadmap.

See [`docs/README.md`](docs/README.md) for the project documentation index.

## Development principle

Do not invent Harness or ARTEMIS interfaces. Inspect the pinned upstream revision first, isolate unstable APIs behind adapters, and keep MCP independent from the graphical plugin.
