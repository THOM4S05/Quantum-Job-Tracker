# Quantum Job Tracker requirements

## Purpose and scope

Quantum Job Tracker is an application for investigating and managing synthetic quantum jobs. Its MVP provides job search, details and history, deterministic simulation, safe cancellation and retry, viewer/operator permissions, and basic operational health.

Every provider and quantum job is synthetic. The UI, seed data, and README must clearly label this; they must not imply access to Horizon Quantum systems. No real quantum SDKs, credentials, devices, or provider integrations are required.

### Roles

| Capability | Viewer | Operator |
| --- | --- | --- |
| Search jobs, read details/events, view health | Yes | Yes |
| Submit a synthetic job | No | Yes |
| Retry or cancel a job | No | Yes |

All jobs belong to one shared demonstration workspace. Tenant isolation, role administration, production identity management, and real provider access are outside MVP scope. The API enforces roles; hiding UI controls alone is insufficient.

## User stories and acceptance criteria

### R1 — Search jobs

As a viewer or operator, I can find jobs to investigate.

- The paginated list shows ID, name, synthetic provider, status, creation time, and original-job link where relevant.
- Search matches an exact job ID or a case-insensitive exact external reference. Status, exact provider, and inclusive UTC submission-date filters combine with search using AND. Job-name search is outside this stage.
- Results use creation time descending and ID as a stable tie breaker. Page size is bounded by the API.
- Loading, empty, invalid-filter, and request-error states are visible. Polling refreshes current results without resetting filters.
- The URL preserves search, filters, and page selection so a view can be reopened.

### R2 — Investigate details and events

As a viewer or operator, I can understand what happened to a job.

- Details show the immutable submission specification, scenario, seed, simulation version, status, timestamps, result or failure reason, and retry lineage.
- Events appear in ascending per-job sequence order. Equal timestamps cannot make the order ambiguous.
- Creation and every status transition have a durable event with timestamp, actor, and reason. Worker events identify the worker; operator actions identify the operator.
- Polling cannot duplicate events in the rendered timeline. Missing jobs return a useful not-found state.
- A terminal job's timeline and result remain available after a retry is created.

### R3 — Run deterministic synthetic jobs

As an operator, I can submit reproducible demonstration workloads.

- An operator can choose a name, a synthetic provider from a fixed catalog, a supported scenario, and an integer seed through a small submission form.
- The initial scenario catalog contains success, simulated provider unavailability at execution start, and simulated execution failure at a defined later step.
- The API validates submissions. Providers are metadata, not external services.
- The same scenario, seed, specification, and simulation version produce the same logical execution steps, failure point, and result. Wall-clock timestamps, queue delay, and IDs may differ.
- A separate worker claims queued jobs and persists execution progress. Restarting it resumes committed progress without duplicating steps or events.
- An operator's cancellation can interrupt execution; cancelled runs do not promise the same final outcome as uninterrupted runs.

### R4 — Cancel safely

As an operator, I can stop work without corrupting its history.

- Cancelling a queued job atomically changes it to `cancelled`; it can never be claimed afterward.
- Cancelling a running job changes it to `cancel_requested`. The worker acknowledges at the next bounded checkpoint and changes it to `cancelled`.
- Once `cancel_requested` is committed, a result or failure cannot replace it. Cancellation acknowledgement is the only next state.
- If success or failure commits before the cancellation request, cancellation returns a conflict and the terminal result remains intact.
- Repeated cancellation of `cancel_requested` or `cancelled` is a successful no-op with no duplicate transition event.
- UI feedback distinguishes a cancellation request from confirmed cancellation. If the worker is unavailable, the request remains pending and health reflects the outage; no false completion is shown.

### R5 — Retry safely

As an operator, I can rerun a finished job while retaining the original evidence.

- Only `succeeded`, `failed`, or `cancelled` jobs can be retried. Active jobs return a conflict.
- Retry creates a new `queued` job with a new ID and copies the immutable submission specification, seed, scenario, and simulation version.
- The new job records both its immediate `retry_of` and its root `original_job_id`. The initial job has neither; retrying a retry keeps the same root.
- The source job's state, result, and existing events are unchanged. Details expose navigable lineage.
- A retry uses a required idempotency key. Repeating the same request with that key returns the same new job; reusing it for another target or payload returns a conflict. A fresh key permits a deliberate additional retry.
- The API persists idempotency records transactionally with job creation and keeps them for the lifetime of the demo data. Initial submission uses the same protection against duplicate creation.
- Retry reproduces the original scenario; a deterministic failure may fail again. A different scenario or seed requires a fresh submission.

### R6 — Enforce permissions

As a viewer, I can investigate safely; as an operator, I can manage jobs.

- Every API request resolves a server-validated identity and role. Unauthenticated requests receive 401; disallowed actions receive 403.
- Viewer mutation attempts fail even when sent directly to the API. Controls are hidden or disabled with appropriate explanation in the UI.
- Local development uses seeded viewer and operator accounts and an explicitly documented demo login. The API issues signed, expiring bearer tokens; it does not trust a client-supplied role header.
- A configured signing secret is required. Tokens and passwords never appear in job events or application logs.
- Production SSO, public deployment security, and account recovery are deferred; demo login must be identified as local demonstration access.

### R7 — View basic health

As a viewer or operator, I can distinguish an idle system from a stalled one.

- The dashboard shows API/database availability, worker last heartbeat and freshness, and counts for every lifecycle state.
- An API liveness endpoint is independent of PostgreSQL; readiness returns 503 when a bounded database probe fails.
- Authenticated operational health reports a stale worker as degraded rather than healthy, including when no heartbeat has ever arrived.
- Poll failures appear as unavailable or stale data with the last successful refresh time, never as zero jobs or a healthy worker.
- No health indicator claims real quantum-provider connectivity.

## Cross-cutting acceptance criteria

- React with TypeScript, FastAPI, PostgreSQL, and one separately started Python worker form the entire runtime architecture.
- Polling is used initially; no WebSockets, Redis, Kubernetes, microservices, or real quantum SDKs.
- Valid transitions and ordered events commit together. All competing worker/operator updates are checked against current database state.
- Terminal jobs never become active again, including after retries, worker restarts, duplicate requests, or concurrent cancellation and completion.
- Controls have labels and keyboard access. Status is conveyed in text as well as color; timestamps specify a timezone.
- README documents verified local startup, configuration, seed/reset instructions, and checks as they become available.
- MVP checks cover lifecycle transitions, terminal immutability, deterministic outcomes, worker recovery, cancel races, retry idempotency/lineage, permissions, search, timeline ordering, and health degradation.

## Later stages and exclusions

GitHub issue linking follows the MVP and requires a separate integration design. Delivery polish follows that: usability, accessibility, error presentation, deployment documentation, and documented example workflows. Neither stage authorizes real quantum integration. Advanced scheduling, provider billing, multi-tenancy, live hardware, production SSO, and distributed worker fleets are outside the current scope.
