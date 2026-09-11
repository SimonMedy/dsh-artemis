# Host adapter

Machine-side integration boundary for ARTEMIS, Android and verified Harness Host APIs.

## Current implementation

`artemis-http.mjs` implements the first framework-neutral ARTEMIS boundary using Node's built-in Fetch API. It deliberately:

- defaults to `http://127.0.0.1:8000`;
- accepts explicit loopback hosts only;
- follows the baseline endpoints documented by ARTEMIS' official `artemis-client` (`/api/status`, `/api/devices`);
- treats `/api/stream/device-state` as a separate UI capability whose stability is lower than the SDK baseline;
- enforces request timeouts, JSON content type and response-size limits;
- normalizes responses into small project-owned objects rather than forwarding raw upstream payloads.

Harness-specific route registration is intentionally a separate module to keep ARTEMIS transport testable without Harness.
