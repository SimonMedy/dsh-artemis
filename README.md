# dsh-artemis

Native ARTEMIS integration for DeepSeek Harness — aiming to make Android a first-class observe/act/verify surface for coding agents and humans.

The project keeps ARTEMIS MCP as the agent-facing automation interface and adds native Harness integration around it:

- Android device/status and screen UI for human supervision;
- official ARTEMIS MCP tools for model actions;
- ARTEMIS behavioral rules as an optional native Harness skill;
- a planned visual-observation path that turns explicit Android screenshots into native Harness image inputs for vision-capable models;
- task/trace evidence for debugging and QA workflows.

The long-term product goal is the mobile counterpart of an integrated browser/computer-use tool: implement or fix code, drive the real Android app, inspect the resulting screen, visually verify it with a multimodal model, and repeat when necessary.

See [`docs/product-vision.md`](docs/product-vision.md) and [`docs/roadmap.md`](docs/roadmap.md).

## Architecture

- `src/host/`: machine-side adapter for ARTEMIS / Android.
- `src/client/`: Harness client UI and right-sidebar integration.
- `src/integration/`: MCP/rules-skill integration helpers and plugin faces.
- `src/shared/`: project-owned protocol constants/types.
- `docs/`: architecture, product vision, upstream pins, testing strategy and roadmap.

## Development principle

Do not invent Harness or ARTEMIS interfaces. Inspect the pinned upstream revision first, isolate unstable APIs behind adapters, keep MCP independent from the graphical plugin, and require reproducible compatibility/E2E evidence for user-visible behavior.
