# Android live viewer

Phase 2 adds an explicit, human-facing live Android screen viewer. ARTEMIS remains the device-stream authority; `dsh-artemis` validates and re-emits the stream through the Harness trust boundary.

## Flow

```text
ARTEMIS /api/stream/device-live
        ↓
validated PNG frames
        ↓
Harness trust fence
        ↓
GET /dsh-artemis/v1/live
        ↓
normalized multipart/x-mixed-replace
        ↓
native Android panel <img>
```

The viewer is opt-in. Opening the Android panel does not start a live stream. **Start live** creates the browser listener; **Stop live** removes it.

## Host invariants

- ARTEMIS remains loopback-only by default.
- Browser input cannot select an upstream URL, path, serial or command.
- `connection.requestRejection()` runs before ARTEMIS access.
- `/dsh-artemis/v1/live` accepts `GET` only.
- Every upstream multipart frame is parsed and validated independently.
- Boundary and part-header sizes remain bounded.
- Fragmented upstream chunks accumulate in a bounded growable buffer with amortized capacity growth, so fragmentation cannot force a full-frame copy on every read.
- `Content-Type` must be `image/png` and `Content-Length` must be positive, safe and at most 8 MiB.
- Every frame must contain a PNG signature and its trailing multipart CRLF.
- The Host never forwards opaque upstream bytes; it emits a normalized project-owned multipart boundary.
- Node response backpressure is respected before another frame is written.
- Browser disconnect/Stop aborts the Host iterator, which cancels the ARTEMIS response.
- Errors before response headers are sanitized; errors after streaming begins terminate the response without reflecting upstream details.
- Responses are `no-store` + `nosniff`.

The one-frame snapshot endpoint consumes the first frame from this same validated streaming pipeline, so screenshot and live behavior cannot silently diverge.

## Browser invariants

- Live URL is same-origin Harness Web only.
- Live never starts automatically.
- Snapshot capture is disabled while live is active so the panel does not create two ARTEMIS listeners for one user action.
- Removing the live `<img>` stops the request and therefore the upstream listener.
- Device disappearance or stream disconnect stops live automatically.
- A failed image may reconnect at most four times, with delays capped at three seconds.
- Successful load resets the retry budget.
- Retry timers are cleared on Stop and unmount.
- The previously captured snapshot remains available after Stop.

## Privacy and model boundary

Live frames are transient human UI only. They are not:

- written to logs;
- converted to base64 for logging or model input;
- persisted through the Harness attachment store;
- added to Session history;
- sent to a model automatically.

Model-facing visual observations remain discrete, explicit checkpoints and require a supported public Session-owned image handoff before implementation.

## ARTEMIS lifecycle

At the pinned ARTEMIS revision, the device stream service shares one capture task between listeners and stops/cancels the capture loop when the last listener leaves. The service targets roughly one capture every 80 ms with a minimum delay between attempts. This makes browser Stop/disconnect a meaningful resource-release boundary rather than a cosmetic UI state.

## Validation

Phase 2 requires:

- multi-frame parser tests;
- malformed later-frame rejection after an earlier valid frame;
- trust/method/error-sanitization route tests;
- bounded retry unit tests;
- a fake ARTEMIS stream that stays open and emits multipart PNG frames repeatedly;
- real packaged Harness + Chromium E2E that starts live, observes a frame, stops live and verifies the prior manual snapshot is still available.
