# Android snapshot observation

Phase 1.5 introduces a deliberately narrow, ephemeral Android screenshot path. ARTEMIS remains the automation authority; the snapshot is a human-facing observation surface, not a second automation engine.

## Current flow

```text
ARTEMIS /api/stream/device-live
        ↓
Host extracts one PNG frame
        ↓
Harness trust fence
        ↓
GET /dsh-artemis/v1/snapshot
        ↓
Browser validates and displays one temporary frame
```

## Verified ARTEMIS contract

At the pinned ARTEMIS revision, `/api/stream/device-live` is `multipart/x-mixed-replace` with boundary `frame`. Every frame declares `Content-Type: image/png` and `Content-Length`, followed by PNG bytes and CRLF. The Host consumes only the first complete frame and cancels the stream afterwards.

## Security invariants

Host:
- ARTEMIS remains loopback-only by default;
- no browser-supplied upstream URL/path/serial is accepted;
- Harness `connection.requestRejection()` runs before ARTEMIS access;
- only `GET /dsh-artemis/v1/snapshot` is exposed;
- multipart boundary/headers are bounded and validated;
- frame `Content-Length` is mandatory, positive and capped;
- media type and PNG signature are checked;
- default frame budget is 8 MiB and snapshot timeout is 4 seconds;
- upstream stream is cancelled after the first accepted frame;
- browser response is `no-store` + `nosniff` and protocol details are sanitized.

Browser:
- only the same-origin snapshot endpoint is resolved;
- credentials remain same-origin, redirects are rejected and cache is disabled;
- an independent 8 MiB limit, timeout, content type and PNG signature check are applied;
- image bytes are exposed through an ephemeral Blob/Object URL that must be revoked when replaced or unmounted;
- image bytes/base64 are never written to logs.

## Persistence and model handoff

Snapshots are **not** persisted through `ctx.attachments.saveImages()` in this phase. The pinned attachment backend stores immutable content-addressed objects, while the public Session prompt contract does not accept an existing attachment reference as image input. Creating durable images merely for preview would therefore risk orphan state without a proven Session lifecycle.

Until Harness exposes a supported Session-owned handoff, `dsh-artemis` must not fabricate Session events, touch private Session stores, or re-read/re-base64 a stored image just to force it through `session.prompt()`.

When a public handoff exists, vision must be model-name agnostic and gated by `LlmModelInfo.inputModalities`: explicit `image` support enables vision; an explicit list without `image` disables it; missing metadata remains unknown.
