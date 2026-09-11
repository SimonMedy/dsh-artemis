# Architecture

## Boundary

`dsh-artemis` is a UI integration, not a replacement for ARTEMIS MCP.

```text
DeepSeek agent ── MCP ──> ARTEMIS ──> Android device

Harness client UI
      │
      └─ dsh-artemis client
              │ verified Harness Host/Client primitive
              ▼
         dsh-artemis host ──> ARTEMIS / Android
```

## Modules

### `src/shared`

Owns JSON-safe DTOs and protocol names. It must not import browser-only, Node-only, Harness-internal or ARTEMIS-internal implementation objects.

### `src/host`

Owns local connectivity, ARTEMIS discovery/status, device metadata and user-initiated device controls. It is the compatibility boundary for ARTEMIS and host-side Harness APIs.

### `src/client`

Owns the native Harness UI surface, right-sidebar registration, rendering, reconnect/refresh UX and screen viewer. It is the compatibility boundary for Harness client APIs.

## Screen transport

ARTEMIS currently exposes a multipart MJPEG live-device endpoint backed by ADB screenshots. The final client transport is intentionally undecided until Harness browser/CSP/network constraints are tested. JSON RPC must not be used to shuttle continuous image frames by default.

## Stability policy

All developer-preview Harness integration points are treated as unstable. A small adapter layer should contain registry/slot/Host API dependencies so upstream breakage does not leak into feature components.
