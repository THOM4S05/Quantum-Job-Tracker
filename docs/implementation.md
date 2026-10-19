# Implementation notes

This document maps Python, React, PostgreSQL/SQL, FastAPI/HTTP, async behaviour, message brokers and Git/CI/CD to the current implementation. It separates working code from design questions. All workload data is synthetic.

## Data paths

The GitHub Pages demo runs React and a JavaScript data adapter in the browser. It has 200 sample jobs, browser-local personal runs, metadata and an overview. The PostgreSQL compiler-comparison dataset is available through the local backend seed command; it is not included in the browser fixtures.

The local application uses React → HTTP/JSON → FastAPI → SQLAlchemy/psycopg → PostgreSQL. Docker Compose runs migrations before starting the API. See [the README](../README.md) for startup and seed commands.

## Python and FastAPI

- [main.py](../backend/app/main.py) registers routers, health endpoints and application lifespan cleanup.
- [workload_metadata.py](../backend/app/workload_metadata.py) uses Pydantic to validate metadata and derive durations from recorded timestamp pairs.
- [transitions.py](../backend/app/transitions.py) requires a transaction and pairs state changes with ordered events; savepoints protect partial writes.
- [overview.py](../backend/app/overview.py) calculates rates, exclusions and medians over selected job snapshots in Python. It currently loads the selected cohort into memory; SQL aggregation or precomputed metrics would be needed for larger datasets.

Discussion: where should validation happen, what belongs in the API versus domain functions, and how does a failed event insert roll back a state update? Read the transaction tests in [test_jobs_postgres.py](../backend/tests/test_jobs_postgres.py).

## React and async requests

[App.tsx](../frontend/src/App.tsx), [JobDetails.tsx](../frontend/src/JobDetails.tsx) and [Overview.tsx](../frontend/src/Overview.tsx) use state and effects to load data. Form drafts become URL filters on submission. URL history restores filters. Requests use async/await and AbortController; cleanup prevents old responses from replacing newer views. Polling waits five seconds after completion and pauses while hidden. A failed refresh retains the last successful snapshot with an error message.

The backend uses synchronous route functions and synchronous SQLAlchemy/psycopg database calls. Its application lifespan is async; that does not make database I/O asynchronous. No worker executes queued jobs. Browser simulation returns a generated history immediately.

Discussion: why is effect cleanup necessary, what happens if requests finish out of order, and why would wrapping blocking database calls in `async def` alone fail to provide nonblocking I/O?

## PostgreSQL and SQL

[models.py](../backend/app/models.py) defines typed columns, JSONB, indexes, foreign keys and constraints. [Migrations](../backend/migrations/versions) add metadata and enforce immutable terminal jobs and append-only events. [job_list.py](../backend/app/job_list.py) builds parameterised queries; count, rows and options use one repeatable-read snapshot. Ordering by creation time and ID resolves timestamp ties. Pagination uses OFFSET/LIMIT.

Examples to run against the local database:

```sql
-- Count jobs in each state.
SELECT status, count(*) AS jobs
FROM jobs
GROUP BY status
ORDER BY status;

-- Inspect failed jobs and their recorded compiler version.
SELECT id, external_reference, error_stage,
       metadata->>'compiler_version' AS compiler_version
FROM jobs
WHERE status = 'failed'
ORDER BY created_at DESC, id DESC
LIMIT 25;

-- Read one job's events in sequence order. Bind the job_id parameter.
SELECT sequence, from_status, to_status, stage, occurred_at
FROM job_events
WHERE job_id = :job_id
ORDER BY sequence;
```

Discussion: why must count and rows share a snapshot, when does OFFSET become expensive, what index helps exact case-insensitive reference matching, and which invariants belong in database constraints as well as application validation? The `:job_id` placeholder is for a bound SQLAlchemy parameter, not literal psql input.

## HTTP and REST API

The current endpoints are read-only: `GET /jobs`, `GET /jobs/{id}`, `GET /overview`, `GET /health/live` and `GET /health/ready`. Query parameters filter collections. FastAPI validates filters and serialises JSON response models. Missing jobs return 404; invalid inputs return 422; database failures return a sanitised 503. The frontend's same-origin `/api` proxy removes that prefix before forwarding to FastAPI. Open `http://localhost:8000/docs` for the local OpenAPI interface.

Discussion: what distinguishes path parameters from query parameters, why does liveness remain available during a database outage, and how would submission/retry endpoints handle duplicate client requests? POST/PUT/PATCH/DELETE job operations are not implemented.

## Message brokers: design only

Neither NATS nor MQTT is implemented. No broker container, publisher, consumer or acknowledgement path exists. The current job/event database model can support a later worker design, but fixtures do not demonstrate message delivery.

Before adding a broker, define:

- What message contains the persisted job ID and schema version.
- How the database commit and publication stay consistent, for example with a transactional outbox.
- Which broker mode, persistence and acknowledgement settings meet the workload's delivery requirements. NATS Core and JetStream must not be treated as identical delivery systems; MQTT QoS is not a guarantee of exactly-once database effects.
- How workers claim jobs, make duplicate delivery harmless, retry with limits, recover after crashes and handle out-of-order events.
- How to test the failure after a database commit but before acknowledgement, and how to observe queue backlog and processing failures.

For delivery semantics, see [NATS JetStream documentation](https://docs.nats.io/concepts/jetstream) and [HiveMQ MQTT QoS documentation](https://docs.hivemq.com/hivemq-platform/connect/publish-subscribe-architecture.html). The need for idempotent database writes follows from treating message receipt and the database transaction as separate operations.

These are questions for a future implementation, not claims about current capabilities. A broker is not needed for the current read-only API and static demo.

## Git and CI/CD

[pages.yml](../.github/workflows/pages.yml) runs on main pushes, pull requests and manual dispatch. One job installs frontend dependencies from the lockfile, runs component tests and builds the browser demo. A separate Python job starts PostgreSQL 17, installs constrained dependencies and runs the full backend test suite against disposable migrated schemas. The deploy job requires both jobs to pass and publishes only non-PR builds to GitHub Pages.

The workflow deploys static assets only. It does not deploy FastAPI, apply migrations to a shared database, or provision a broker. CI database credentials apply only to its temporary PostgreSQL service. Browser tests against the full local stack are run separately as described in the README.

Discussion: how do commits, pull requests and branch protection relate; why must backend failures block a site deployment; and how would a backend deployment sequence migrations, health checks and rollback? The workflow runs PR checks, but required branch protection rules must be configured separately in GitHub.
