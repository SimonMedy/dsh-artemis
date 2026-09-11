# Host adapter

Machine-side integration boundary for ARTEMIS, Android and verified Harness Host APIs.

## ARTEMIS HTTP client

`artemis-http.mjs` implements the framework-neutral ARTEMIS boundary using Node's built-in Fetch API. It deliberately:

- defaults to `http://127.0.0.1:8000`;
- accepts explicit loopback hosts only;
- follows the baseline endpoints documented by ARTEMIS' official `artemis-client` (`/api/status`, `/api/devices`);
- treats `/api/stream/device-state` as a separate UI capability whose stability is lower than the SDK baseline;
- enforces request timeouts, JSON content type and response-size limits;
- normalizes responses into small project-owned objects rather than forwarding raw upstream payloads.

## Harness Web route

`harness-routes.mjs` owns the Web-profile browser boundary. It uses the verified Harness `webServer.register(...)` seam and currently registers one exact read-only route:

```text
GET /dsh-artemis/v1/overview
```

Production registration requires both Harness `webServer` and `connection` services. Every request is first passed through `connection.requestRejection(...)`, matching Harness' own Host route pattern so Host/Origin and browser authentication checks run before method handling or ARTEMIS access.

The route exposes only normalized project data. It does not expose the ARTEMIS base URL or upstream live-stream URL, accepts only GET/HEAD, returns `no-store`, and maps failures to bounded error shapes. An unavailable ARTEMIS instance is represented as a normal `offline` overview so the UI can render that state without treating it as an exceptional browser failure.
