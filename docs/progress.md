# Quantum Job Tracker progress

## Current status

Job details and the failure-investigation workflow are complete on top of the searchable jobs list. The details stage passed 85 backend tests, 19 frontend tests, production/container builds, and a Playwright workflow against the live PostgreSQL stack using installed Chrome. Worker execution, authentication, and operator actions remain deferred.

The project is named Quantum Job Tracker. All seeded and future quantum jobs and providers are synthetic; nothing connects to Horizon Quantum systems.

## Staged checklist

- [x] **Stage 0 — Inspect and plan**
  - Requirements, acceptance criteria, component diagram, lifecycle, cancellation races, retry lineage, and staged delivery plan.
- [x] **Stage 1A — Project foundation**
  - React/TypeScript page displaying API reachability with polling and request timeouts.
  - FastAPI liveness and bounded PostgreSQL readiness probes.
  - PostgreSQL service, persistent volume, full-stack Docker Compose, and backend/frontend Dockerfiles.
  - Alembic configuration and baseline migration (application tables added in Stage 1B).
  - Backend-only environment configuration, example environment, ignore files, dependency pins/constraints and npm lockfile.
  - Reproducible startup instructions, API checks, frontend build, and stack-check script.
- [ ] **Stage 1A verification follow-up — Docker/PostgreSQL**
  - [x] Run documented Compose startup and inspect all service states (completed during database stage).
  - [x] Verify live migrations and run `sh scripts/check-stack.sh` against PostgreSQL.
  - [ ] Verify database persistence after restart and readiness failure/recovery with PostgreSQL stopped/restarted.
  - [ ] Inspect the rendered page in a browser, including API outage/recovery presentation.
- [x] **Stage 1B — Database model and deterministic fixtures**
  - Jobs/events schema, migrations, lifecycle and outcome constraints, immutable submissions/terminal jobs, append-only events, and indexes.
  - Shared atomic creation/transition/progress helpers with row locking, version checks, and rollback protection.
  - Idempotent seed command producing 200 jobs/880 consistent events across three fictional providers.
  - PostgreSQL integration tests for all state pairs, database constraints, rollback, migrations, seed consistency, and competing actions.
- [ ] **Stage 1C — Permission foundation (deferred)**
  - Seeded viewer/operator demo accounts, login, and API role enforcement.
  - Check permission handling against real PostgreSQL. Authentication was not part of the database-model request.
- [x] **Stage 2A — Searchable jobs list (R1)**
  - Paginated `GET /jobs` with combined status, provider, inclusive UTC submission dates, and exact ID/reference search.
  - Stable timestamp/UUID ordering, bounded query values, summary responses, and real provider options.
  - React filters, URL persistence/history, badges, pagination, polling, loading, empty, invalid-query, error/retry, and stale-data states.
  - Nullable immutable external references, indexed lookup, and safe migration enrichment of existing seed fixtures.
  - PostgreSQL API integration tests, frontend state/interaction tests, live proxy checks, and browser verification.
- [x] **Stage 2B — Job details and failure investigation (current stage, R2)**
  - Read-only `GET /jobs/{UUID}` returning the job and sequence-ordered events from one consistent database snapshot.
  - Job metadata/timestamps, recorded failure stage/code/explanation, event correlation IDs, and expandable structured diagnostics.
  - Explicit missing-job, missing/incomplete diagnostics, history inconsistency, loading/error/retry, and stale-evidence feedback.
  - List/detail/lineage links preserve the applied list query; browser reload and filtered-list return work.
  - PostgreSQL and React checks plus a saved and executed browser failure-investigation test.
  - Separate event pagination and permission checks remain deferred to their applicable stages.
- [ ] **Stage 3 — Deterministic execution (R3)**
  - Operator submission API/form with idempotency and validation.
  - Separate Python worker, versioned success/failure simulation, claims, leases, persistent progress, restart recovery, and heartbeat.
  - Exit: end-to-end execution, reproducibility, duplicate submission, lease fencing, and recovery are checked against PostgreSQL.
- [ ] **Stage 4 — Safe operator actions (R4, R5, R6)**
  - Cancel/retry APIs and UI with authoritative state feedback.
  - Check transitions, both race orders, duplicate requests, retry lineage, terminal immutability, and viewer rejection of every mutation.
- [ ] **Stage 5 — Health and MVP verification (R7)**
  - Authenticated health dashboard, aggregate counts, worker freshness, degraded and stale states.
  - Check outages/recovery, browser journeys, accessibility, and all MVP criteria.
  - Verify README startup from a clean local setup.
- [ ] **Stage 6 — GitHub issue linking (later)**
  - Separately scope issue associations, credentials, permissions, failure behavior, and integration checks.
- [ ] **Stage 7 — Delivery polish (later)**
  - Responsive presentation, accessibility, error messages, example workflows, and verified delivery documentation.

## What works now

- The frontend jobs page requests same-origin `/api/jobs` and displays real PostgreSQL jobs with filters, status badges, pagination, UTC times, and requester/reference fields. Job names now open details while retaining the list query.
- `/api/jobs/{UUID}` displays persisted job metadata and an ordered event timeline, with failure metadata, per-event correlation IDs, and expandable raw JSON. Missing/inconsistent records are labeled without invented root-cause conclusions.
- Applied filters and page size persist in the URL and survive history navigation. Applying new filters resets pagination.
- Polling pauses in hidden tabs, obsolete requests cannot overwrite newer results, and failed refreshes label retained results as stale.
- Both the local Vite proxy (foundation checks) and the container Nginx proxy (database-stage checks) reach FastAPI.
- Liveness returns 200 independently of PostgreSQL; readiness returns a sanitized 503 when PostgreSQL is absent.
- Alembic migrates to `0003_external_reference`; PostgreSQL stores jobs/events with indexes, consistency constraints, terminal protection, append-only history, and immutable searchable references.
- Settings load the root `.env`, safely construct a database URL, and keep credentials out of frontend configuration.
- Compose orders database health, migration completion, and API startup; the stack-check script now passes against the real Docker/PostgreSQL stack.
- The seed command populated 200 jobs/880 events and left them unchanged on rerun. Successful and failed histories agree with job status, row version, timestamps, and failure stage.
- The shared transition helper saves job changes and events atomically under a row lock, rejects invalid transitions/stale versions, and rolls back its changes if event insertion fails.

## Checks actually run

### Foundation checks (earlier on 15 October 2026)

- Reinspected README, architecture, requirements, progress, and the workspace. No `AGENTS.md` or application code existed before this stage; existing planning files were preserved and updated.
- Installed frontend dependencies and backend development dependencies. Initial sandbox network requests failed; downloads succeeded with approved network access.
- `cd frontend && npm run build`: passed TypeScript checking and Vite production build.
- `cd backend && .venv/bin/python -m pytest -q`: **3 passed**. Covers liveness without a database probe, successful readiness using a mocked probe, and sanitized failure/recovery. One dependency deprecation warning was reported by Starlette's TestClient about AnyIO's BlockingPortal alias.
- `cd backend && .venv/bin/python -m pip check`: passed; no broken requirements.
- `cd backend && .venv/bin/python -m compileall -q app migrations`: passed.
- `cd backend && .venv/bin/alembic upgrade head --sql`: passed after fixing a path-with-spaces import issue discovered during the first attempt. Generated SQL for `alembic_version` and revision `0001_foundation`; no live migration was applied.
- `cd backend && .venv/bin/alembic heads`: reported `0001_foundation (head)`.
- Started Uvicorn on local port 8000 and Vite on local port 5173 with approved local network access. HTTP assertions passed for frontend HTML and both direct/proxied liveness (200) and readiness (503 with PostgreSQL absent).
- `sh -n scripts/check-stack.sh`: passed shell syntax validation.
- Parsed `compose.yaml` with Ruby's YAML parser, including shared backend configuration anchors, and checked the four expected services and migration/database dependency. Passed syntax/structure checks; this is not Docker Compose schema validation.
- Direct file checks passed for whitespace/newlines across 33 project files, local Markdown links, and absence of the example database password from compiled frontend assets. `git check-ignore` confirmed `.env`, the Python virtual environment, `node_modules`, and frontend build output are ignored.
- `command -v docker` and `command -v psql`/`postgres`: no executables found. Docker image builds, Compose startup, database-backed readiness success, live migrations, and the full stack-check script could not be verified.
- Browser preview attempts failed: the in-app browser did not attach and Chrome was unavailable. No rendered UI or browser automation checks are claimed.

### Database-stage checks (15 October 2026)

- Re-read existing code and documentation; no `AGENTS.md` exists in this workspace. Preserved the existing frontend/API foundation.
- Docker Engine and Compose are now accessible. The previously missing Docker/PostgreSQL verification path was available for this stage.
- `QUANTUM_JOB_TRACKER_TEST_DATABASE_URL=… .venv/bin/python -m pytest -q`: **55 passed** against PostgreSQL 17 (52 PostgreSQL tests plus 3 health tests), with the same single dependency deprecation warning. PostgreSQL tests applied migrations in disposable schemas; no SQLite substitute or database mocks were used for domain checks.
- PostgreSQL checks cover all 36 state pairs, direct terminal reactivation/illegal SQL transitions, failed event insertion rollback, actual enclosing transaction rollback, sequence uniqueness, immutable events/submissions, stale row versions, retry foreign keys, progress rejection after cancellation, both cancellation/completion commit orders, repeatable seed histories, model/migration agreement, and migration downgrade/upgrade.
- `docker compose up --build -d`: passed. API/migration/frontend images built, the migration container exited 0, and API/database/frontend reported healthy.
- `docker compose exec -T api alembic current`: `0002_jobs_and_events (head)`.
- `docker compose exec -T api python -m app.seed`, first run: `inserted=200, skipped=0, total_jobs=200`; second run: `inserted=0, skipped=200, total_jobs=200`.
- Direct PostgreSQL inspection: 80 succeeded, 60 failed, 20 queued, 20 running, 20 cancelled; 20 failures per compilation/queueing/execution stage; 880 events; zero jobs whose latest event differs from current status/version/update timestamp.
- `sh scripts/check-stack.sh`: passed frontend HTML, direct/proxied API liveness, and direct/proxied database readiness against PostgreSQL.
- Python compilation, offline migration SQL generation, and `alembic heads` passed during this stage. No frontend source changes were needed.
- Final direct checks passed for whitespace/newlines across 18 source/documentation files and for Markdown fenced blocks/local links. `pip check` reported no broken requirements.

### Job-list checks (15 October 2026)

- Re-read existing API/model/migration/seed/frontend code and project documents. No `AGENTS.md` was present. Preserved the workspace shell and purple styling already in the frontend.
- `QUANTUM_JOB_TRACKER_TEST_DATABASE_URL=… .venv/bin/python -m pytest -q`: **80 passed**, with one pre-existing Starlette/AnyIO deprecation warning. Includes actual PostgreSQL API filtering, timestamp ties, pagination boundaries, invalid queries, literal reference search, and a migration backfill/history-preservation test. Invalid-query and outage-response tests do not require PostgreSQL; database-backed tests still skip unless the explicit test URL is set.
- `cd frontend && npm test`: **11 passed** with Vitest/React Testing Library. Covers loading, result fields/statuses, empty results, retry after network failure, 422 feedback, combined filters, page reset/bounds, URL history, stale polling/recovery, hidden-tab polling, and obsolete responses. Mock HTTP data is confined to tests.
- `cd frontend && npm run build`: passed TypeScript checking and Vite production build.
- The first container build reported development-tool advisories. Updated Vite to 6.4.4 and Vitest to 4.1.11; `npm audit --json` subsequently reported **zero vulnerabilities**, and build/tests passed with those versions.
- `docker compose up --build -d`: final container build/startup passed; migration 0003 applied to the existing seeded database. `docker compose exec -T api alembic current` reported `0003_external_reference (head)`.
- Live HTTP assertions through the frontend proxy traversed all 8 default pages: 200 distinct jobs in stable order, one combined status/provider/date/reference match, direct UUID search, no matches, beyond-last page, and invalid parameter rejection. Passed.
- `sh scripts/check-stack.sh`: passed against the final Docker stack and actual PostgreSQL.
- Desktop browser verification showed the 200-job list, a case-insensitive reference match, combined status/provider filters, restoration of a URL containing UTC date bounds, the live empty-results state, and browser Back restoration. Date bounds were restored from the URL; browser automation could not reliably enter native date controls. Form date changes are covered by the React tests and real API date-boundary tests.
- Saved a temporary preview of the verified jobs view. No dedicated mobile-device or screen-reader audit was performed.
- Final Python compilation, offline migration SQL generation, dependency consistency, direct source/document whitespace checks, and Markdown link/fence checks passed.

### Job-details checks (15 October 2026)

- Re-read existing code and project documents before changing files. No `AGENTS.md` exists in this workspace. Preserved the existing jobs list, schema, seed data, and workspace styling.
- `QUANTUM_JOB_TRACKER_TEST_DATABASE_URL=… .venv/bin/python -m pytest -q`: **85 passed**, with the pre-existing Starlette/AnyIO deprecation warning. New PostgreSQL tests verify exact stored evidence, per-job event isolation, ascending sequences despite tied timestamps, incomplete history without fabricated events, null outcomes, and unknown IDs. Additional checks cover malformed UUIDs and sanitized database outages.
- `cd frontend && npm test`: **19 passed**. New component checks cover metadata/failure/timeline rendering, expandable diagnostics, absent fields/events, 404/422 states, retry, stale refresh/recovery without event duplication, and non-failed jobs.
- `cd frontend && npm run build`: passed TypeScript and Vite production build, including browser-test source/configuration type checking.
- Added Playwright 1.64.1 and `npm run test:e2e`. The first attempt to download its bundled Chromium failed with ENOSPC and was stopped. Existing browser caches were left intact.
- `QUANTUM_JOB_TRACKER_E2E_CHANNEL=chrome npm run test:e2e`: **1 browser test passed** using installed Google Chrome and the real Nginx/FastAPI/PostgreSQL stack. An initial run timed out on an overly strict filter label selector; the selector was corrected and the test rerun successfully. The passing run filtered failures, opened one, checked recorded error metadata/correlation/diagnostics and event order, reloaded details, and returned to the exact filtered list URL.
- `docker compose up --build -d`: passed with the new API and frontend; no schema migration or data rewrite was needed.
- `sh scripts/check-stack.sh`: passed against the deployed stack.
- `npm audit --json`: zero reported vulnerabilities after adding the browser-test dependency.
- In-app browser inspection verified a seeded compilation failure with all applied list filters preserved in its URL and expanded the recorded JSON diagnostics. No dedicated mobile/screen-reader audit was performed.
- Saved a temporary preview of the complete verified investigation view.
- Final `tsc --noEmit`, Python compilation, dependency consistency, source/document whitespace, and Markdown link/fence checks passed. Browser-test result output is ignored by Git.

Earlier planning checks verified Markdown links, fenced blocks, requirement/state coverage, whitespace, and the Quantum Job Tracker rename. No authentication or worker tests exist yet.

## Known limitations and blockers

- No implementation blocker remains for the details stage. The packaged Chromium download could not complete due to low disk space; the required browser test passed with installed Chrome instead. Dedicated mobile/screen-reader testing, database stop/restart recovery, and persistence across restarts have not been checked in this stage.
- The jobs list and details are read-only local demo access. Separate paginated events APIs, worker execution, accounts, role enforcement, retry/cancel endpoints, and operational dashboard remain unimplemented. Full-history detail responses are intended for the current small fixture histories. Public health endpoints expose only minimal infrastructure status.
- Offset pagination is deterministic for an unchanged dataset; new jobs between page requests may shift page positions. Exact external-reference search is case-insensitive, not substring or job-name search.
- `requested_by` and event actors are demonstration identifiers until accounts are implemented. Retry/root references are modeled; retry behavior/idempotency remains a later stage.
- Shared writes maintain job/event consistency. Arbitrary direct SQL can bypass the service-level event pairing; triggers still enforce legal job states, terminal immutability, and append-only history.
- A successful readiness response checks database connectivity, not schema version. Migration success is separately enforced at Compose startup.
- This is a local development foundation; public deployment and production identity management are out of scope.
- Python constraints and npm lockfile record package resolution. Container image release tags can change; immutable image digests are deferred to delivery work.

## Next stage

Next implementation stage: permission foundation (Stage 1C), when requested. Worker execution and operator actions remain deferred until their respective stages. Add bounded event pagination before supporting substantially longer histories.
