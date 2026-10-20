# Quantum Job Tracker

**Inspect quantum-job compilation and execution, compare experiments, and investigate changes using the underlying job evidence.** Quantum Job Tracker helps developers and operators trace an observed difference back to recorded runs, timelines and failure diagnostics.

All jobs, providers, compiler metadata and results are **synthetic**. The featured example compares compiler versions; an experiment is a group of related runs and need not be a compiler-version comparison. No Horizon Quantum systems, real compiler service or quantum hardware is connected.

[Open the browser demo](https://thom4s05.github.io/Quantum-Job-Tracker/) · [Demo & Guide](https://thom4s05.github.io/Quantum-Job-Tracker/?view=guide) · [Local setup](#run-the-full-application-locally)

## Screenshots

Current browser-demo screenshots, captured on 20 October 2026. All jobs and outcomes shown are synthetic; this independent portfolio project does not execute on real quantum hardware. The browser demo uses bundled records, while the local FastAPI/PostgreSQL application reads database records.

### Browse and filter jobs

Search and filter 256 bundled sample jobs by status, provider, submission dates, target, compiler version or experiment, then open a recorded run.

![Current Jobs page with synthetic-data label, example links, search and cohort filters, and job results](docs/images/quantum-job-tracker-jobs-overview.png)

### Compare an experiment

The seeded resource-gain workload shows lower estimated circuit depth and gate count for the candidate version. Run counts and outcome denominators stay visible alongside the observations; these synthetic examples are not real compiler benchmarks.

![Resource-gain comparison showing lower estimated depth and gate count, baseline and candidate run counts, and comparison metrics](docs/images/quantum-job-tracker-experiment-comparison.png)

### Investigate a failure

Follow a supporting candidate run from compile-regression to its recorded compilation failure, correlation ID, ordered timeline and expanded diagnostics. No execution duration is fabricated for a run that never executed.

![Recorded compilation failure evidence and ordered three-event timeline with expanded structured diagnostics](docs/images/quantum-job-tracker-lifecycle-diagnostics.png)

<details>
<summary><strong>More views: metadata, operational overview, and Demo & Guide</strong></summary>

#### Job metadata

Inspect the program revision, synthetic compiler version, target settings and resource estimates before reading phase timings and failure evidence.

![Current supporting-job details showing program and compiler, target configuration, estimated resources and phase timings](docs/images/quantum-job-tracker-job-investigation.png)

#### Operational overview

Check success-rate denominators, timing sample counts, failures by stage and jobs by target for the selected submission cohort.

![Operational overview showing compilation and execution success rates, median queue and execution times, and breakdowns](docs/images/quantum-job-tracker-operational-overview.png)

#### Demo & Guide

Follow the bulleted example journey, with direct links to the comparison and a verified supporting job.

![Demo and Guide showing its bulleted example walkthrough and direct links to working features](docs/images/quantum-job-tracker-demo-guide.png)

</details>

## Demo & Guide

Select **Demo & Guide** in the sidebar, or the smaller link in the Jobs/Overview introduction. The page explains what each working section is for, its main controls, a bulleted example journey, a small glossary and how to interpret the results. It is written for first-time visitors, including readers without quantum-computing knowledge, and identifies the app as an independent portfolio project using synthetic data.

Listed explanations use visible bullet points. Longer groups sit side by side on wider screens and stack on narrow screens to keep them readable.

Direct location: `?view=guide` under the app’s base path. For example, [local browser demo guide](http://127.0.0.1:5174/?view=guide), [local API-backed guide](http://localhost:5173/?view=guide), or the [public guide](https://thom4s05.github.io/Quantum-Job-Tracker/?view=guide). Follow the existing startup instructions below for either mode.

The guide resolves its example and supporting compilation-failure job through the current data adapter, then verifies the recorded job’s experiment, compiler and failure stage. If the example or job is unavailable, it explains the situation and offers retry/general navigation instead of inventing links or results. Its **Explore example comparison** action preserves the featured selections; direct supporting-job links return to that same comparison.

The guide is included in the GitHub Pages browser build.

## Browser demo

[Open the browser demo](https://thom4s05.github.io/Quantum-Job-Tracker/)

The browser build runs without installation, sign-in or an API. GitHub Pages hosts the existing release; use the updated local browser build below to try this stage before a separately authorized publication.

- Browse 256 bundled sample jobs (200 historical fixtures plus the 56-run example experiment) and filter by status, provider, submission date, or exact ID/reference.
- Search for `syn-0005` and open the job to investigate a compilation failure and its lifecycle timeline.
- Follow **Explore example comparison** through a supporting job and its recorded timeline. The read-only comparison snapshot is generated from the existing PostgreSQL seed and calculations.
- Optionally expand **Browser-only playground**, enter a run name, choose an outcome, and select **Create simulated run**. This immediately generates personal browser data; it is not backend submission or real execution.
- Select **Reset demo** to remove your personal runs and return to the sample workspace.

Outcomes include success, compilation/queueing/execution failure, queued, running, and cancelled. Outcomes are generated immediately with fictional lifecycle timestamps; queued and running jobs remain in those states. No quantum hardware or background worker runs.

Personal runs are stored separately for each browser. Up to 100 personal runs are saved in that browser's local storage when available; clearing browser data removes them. Sample-job links can be shared, but personal runs are available only in the browser where they were created. The original 200 browser fixture IDs are separate from local database IDs. The 56-job example snapshot retains the seed IDs so every comparison reference resolves to its exported timeline. Reset removes personal runs and keeps all 256 bundled fixtures.

### Run the browser demo locally

```sh
cd frontend
npm ci
npm run dev:demo
```

Open [the local browser demo](http://127.0.0.1:5174). To produce the static site, run `npm run build:demo`; the output is `frontend/dist` when viewed from the repository root. Demo behavior is enabled by `VITE_DEMO_MODE=true`; the static deployment contains no database connection or credentials.

### GitHub Pages deployment

GitHub Pages is enabled for this repository. The [deployment workflow](.github/workflows/pages.yml) tests and builds the demo on pushes to `main`, then publishes it after both frontend and PostgreSQL-backed Python tests pass. Pull requests run tests and build without publishing. You can also run **Deploy interactive demo** from the [Actions tab](https://github.com/THOM4S05/Quantum-Job-Tracker/actions/workflows/pages.yml).

For a fork, select **GitHub Actions** under **Settings → Pages → Build and deployment** before running the workflow. Relative asset paths and query-based job links support repository subdirectories, direct links, reloads, and browser Back/Forward without server routing rules.

## Implementation

[How it works on the site](https://thom4s05.github.io/Quantum-Job-Tracker/?view=implementation) explains data sources and request handling. [Implementation notes](docs/implementation.md) map the code to Python, React/TypeScript, PostgreSQL/SQL, FastAPI/HTTP, async requests, message-broker design and Git/CI/CD, with SQL examples and discussion questions.

The local backend uses synchronous database calls. The frontend uses async requests; background worker execution and NATS/MQTT integration are not implemented. CI runs Python integration tests against PostgreSQL as well as frontend tests and the static build before deployment.

## Compiler and resource metadata

Job details now group information into **Program and compiler**, **Target and configuration**, **Estimated resources**, **Timings**, and **Lifecycle and failure evidence**. All compiler names/versions are clearly synthetic. Unknown metadata displays **Not available**; estimates remain separate from recorded simulator outputs, and phase durations are calculated from recorded timestamps only.

[Metadata definitions, units, validation, and migration behavior](docs/metadata.md)

To inspect locally, run `docker compose up --build -d` and open a job such as `SYN-0004` (success), `SYN-0005` (compilation failure), or `SYN-0001` (deliberately missing estimates/version). Existing fixtures are enriched by migration; the seed command remains safe to repeat. The static demo uses the same metadata shape, including older saved-run compatibility. The browser demo includes these metadata sections.

## Compare an experiment

Open [Compare](http://localhost:5173/?view=comparison) in the full local application. Choose an experiment, a baseline compiler version and a different candidate version. Choices persist in the URL, including through job/timeline drill-down and **Back to comparison**.

Each workload is split into exact configuration groups by program revision, inputs, target/provider, shots, compiler name and relevant settings. Changed settings, missing identity and unmatched groups are flagged; they are never silently treated as compiler-only changes. Tables show baseline, candidate, absolute change and meaningful relative change, with separate run/outcome counts and timing/resource sample counts. Rates use percentage points; zero baselines and missing observations have no relative percentage. Recorded failures remain visible.

```sh
docker compose up --build -d
docker compose exec -T api python -m app.seed --dataset compiler-comparison-v1
```

Choose **Synthetic compiler comparison v1**, baseline **synthetic-1.0.0**, candidate **synthetic-1.1.0**. The four matched workloads include estimated qubits 32 → 24 (−25%), compilation success 100% → 0% (−100 pp), execution duration 10 → 18 s (+80%), and an unchanged control. Expand either side's jobs to inspect recorded timelines. Queue time can reflect operational conditions; synthetic comparisons establish no real compiler performance claim.

**Changes to investigate** appears inside each compatible workload group. It shows newly observed compilation failures, lower execution success, higher timing/resource values, and decreases or other improvements alongside them. Counts, percentage-point changes and zero/missing-value explanations stay visible. Expand **Supporting jobs for …** to inspect the exact observations; **Runs contributing to timing medians** covers every timing metric. Compilation failures with no execution observations say **Insufficient data to compare**. These are descriptive synthetic differences, not confirmed regressions or causal conclusions.

[Matching, metric definitions, units, delta rules and API contract](docs/comparisons.md). The browser build includes a frozen, read-only export of the named seed, both comparison directions and all supporting timelines. It uses no live API. The local application reads the same experiment through PostgreSQL; no snapshot is substituted if local data is missing. The comparison page is also available in the [browser demo](https://thom4s05.github.io/Quantum-Job-Tracker/?view=comparison); the local browser build supports the same seeded example without PostgreSQL.

## Operational overview

Open the [browser overview](https://thom4s05.github.io/Quantum-Job-Tracker/?view=overview), or [local Overview](http://localhost:5173/?view=overview) after starting the full application below. Four cards show compilation success rate, execution success rate, median queue time and median execution duration from actual PostgreSQL job records. Each shows its denominator or eligible timing sample count; unavailable observations display **Not enough data**. Expand each rate's exclusions for pending, cancelled/cancelling, not-started and unknown counts.

Submission dates (inclusive UTC days), target, compiler version and experiment apply to every metric and chart. **Dates select jobs by submission time**, even when lifecycle activity occurs later. Select a failure-stage or target bar to inspect matching jobs; the cohort filters survive pagination, details and return navigation. All data is explicitly synthetic. The static browser demo uses its own recorded browser jobs with the same definitions and source labelling.

[Metric definitions, denominators, timing units and schema adaptations](docs/metrics.md) explain how explicit failure stages distinguish compilation failures from later failures. Rates exclude cancellations; timing samples require recorded endpoints and are never filled with zero. No worker or extra service is added.

To reproduce the compiler comparison cohort:

```sh
docker compose up --build -d
docker compose exec -T api python -m app.seed
docker compose exec -T api python -m app.seed --dataset compiler-comparison-v1
```

Select the experiment, target `synthetic-comparison-simulator`, candidate version `synthetic-1.1.0`, and submission date 12 October 2026: expect 28 jobs, compilation success 21/28 (75%), execution success 21/21 (100%), and 21 queue observations with median 2 s. Compilation failures have no execution samples.

The read-only `GET /overview` endpoint accepts `submitted_from`, `submitted_to`, `target`, `compiler_version` and `experiment` (experiment UUID). `GET /jobs` accepts the same cohort plus `failure_stage` (`compilation`, `queueing`, `execution`, `unknown`) for drill-downs. Responses include global filter options so a narrowed cohort retains available selections. Metrics aggregate the complete cohort rather than a paginated subset.

## Current status

The public GitHub Pages demo supports browsing, compiler/resource metadata inspection, an operational overview, and creating browser-local simulated runs. The full local application uses the same React/TypeScript interface to search and paginate PostgreSQL data through FastAPI. Filters persist in the URL, and the page polls every five seconds while visible. The database contains jobs, ordered events, lifecycle protection, immutable external references, and deterministic fixtures. Job details now show recorded failure evidence and the ordered event history. Backend worker execution, operator actions such as retry/cancel, and authentication remain future stages. Creating a simulated run in the public browser demo does not submit a job to the backend.

- [Requirements and acceptance criteria](docs/requirements.md)
- [Architecture and lifecycle](docs/architecture.md)
- [Progress, checks, and staged delivery plan](docs/progress.md)

## Run the full application locally

The following sections describe the FastAPI/PostgreSQL application. The public browser demo above works independently of this setup.

The app is named **Quantum Job Tracker**. Existing local database/user names, the Compose project name, and historical seed identifiers retain their original internal values to preserve stored jobs, volumes, and deterministic fixture IDs.

Prerequisite: Docker with Compose v2 and a running Docker engine. From this folder:

```sh
# Preserve an existing .env; create it only on first setup.
test -f .env || cp .env.example .env
docker compose up --build -d
```

To load the example experiment after startup, run with `docker compose exec -T api python -m app.seed --dataset compiler-comparison-v1`. This is repeatable and preserves existing jobs. The default 200-job profile remains optional.

Open [Quantum Job Tracker](http://localhost:5173) and [API documentation](http://localhost:8000/docs). Allow the initial image builds and health checks to finish; inspect status with `docker compose ps -a` and logs with `docker compose logs api migrate db frontend`.

Compose starts PostgreSQL, runs `alembic upgrade head` as a one-shot migration service, then starts the API and frontend. PostgreSQL data persists in a named volume. The frontend serves a compiled build through Nginx and proxies `/api/` to the API; the browser never receives database credentials. All published ports bind to the local machine only.

The `.env` file is ignored by Git. The example password is for local demonstration only. PostgreSQL initialization variables apply when the volume is first created; changing the password in `.env` does not update an existing database password.

Stop with `docker compose down` (keeps database data). Only for an intentional fresh local database, `docker compose down -v` deletes the local database volume. Migrations create `jobs` and `job_events` with indexes, constraints, immutable terminal jobs, and append-only event history. Seed data is opt-in; startup never seeds or resets jobs automatically.

## Synthetic compiler experiment

A separate opt-in fixture profile adds **56 synthetic runs**: four workloads, baseline/candidate compiler versions, and seven paired repetitions. It demonstrates improved resource estimates, a candidate compilation failure, slower execution, and an unchanged control. All comparisons keep workload/input, target, shots and optimisation settings fixed.

```sh
docker compose up --build -d
docker compose exec -T api python -m app.seed --dataset compiler-comparison-v1
# Repeat safely, or replace only this experiment and reproduce its exact evidence:
docker compose exec -T api python -m app.seed --dataset compiler-comparison-v1 --reset
```

The JSON output reports per-group medians/sample counts and a full job/event snapshot digest. Repeat/reset runs reproduce the same digest without duplicates. The original 200 fixtures and unrelated jobs are preserved. Open [the experiment date](http://localhost:5173/?submitted_from=2026-10-12&submitted_to=2026-10-12), or search `EXP-2-CANDIDATE-1` for the compile failure. Expand **Submission specification** in details to inspect experiment/workload/pair identity and intended differences. This dataset is available in the PostgreSQL application and as a read-only exported snapshot in the browser build.

See [experiment definitions, expected outcomes and reset behavior](docs/experiments.md). No worker or real compiler/hardware execution is involved.

## Seed synthetic histories

After startup, run this from the project root:

```sh
docker compose exec -T api python -m app.seed
```

The first run inserts exactly 200 jobs and 880 events across **Synthetic Aurora Labs**, **Synthetic Nebula Works**, and **Synthetic Quasar Forge**. Outcomes include 80 successes; 20 failures each in compilation, queueing, and execution; 20 queued jobs; 20 running jobs; and 20 cancelled jobs. Fixed UUIDs, seeds, UTC timestamps, correlation IDs, and results make fresh runs deterministic. These are historical demonstration fixtures, not a running simulator.

Rerunning reports `inserted: 0, skipped: 200` and preserves both existing fixtures and unrelated jobs. The entire seed operation is transactional and concurrent seed invocations are serialized. The original demo profile has no reset flag. A seed-ID collision with unrelated data fails rather than overwriting it.

For local Python development after applying migrations:

```sh
(cd backend && .venv/bin/python -m app.seed)
```

To inspect the stored status counts:

```sh
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT status, count(*) FROM jobs GROUP BY status ORDER BY status"'
```

The frontend now lists the seeded jobs. Existing demo fixtures receive references `SYN-0001` through `SYN-0200` in migration `0003_external_reference`; other existing jobs keep a null reference. The migration enriches only that new field and preserves job states, versions, timestamps, and event histories. New seed runs create the same references.

## Browse and search jobs

Open [Jobs](http://localhost:5173). Apply any combination of status, provider, UTC submission dates, and an exact ID/reference. Search for `syn-0005` to find a seeded compilation failure. Clear filters to return to the full list. Applying filters or a new page size starts at page 1; Previous/Next retain applied filters. Copy the URL to share or reopen the same view; browser Back/Forward restores the filters.

The page polls every five seconds after each response, pauses recurring requests in hidden tabs, cancels obsolete requests, and retains the last successful results with an explicit warning if refresh fails. Loading, empty, out-of-range page, validation error, and service error states are distinct. All submission times and date bounds use UTC. Select a job name to open its details; the details URL retains the applied list filters.

`GET /jobs` (browser proxy: `/api/jobs`) supports:

| Parameter | Meaning |
| --- | --- |
| `status` | One of `queued`, `running`, `cancel_requested`, `succeeded`, `failed`, `cancelled` |
| `provider` | Exact provider name; options come from PostgreSQL, independent of current filters |
| `submitted_from` | Inclusive UTC date, `YYYY-MM-DD` |
| `submitted_to` | Inclusive UTC date, `YYYY-MM-DD`; must be at least the start date and before `9999-12-31` |
| `q` | Exact job UUID OR case-insensitive exact external reference; surrounding spaces ignored; at most 160 characters |
| `page` | 1–1,000,000; default 1 |
| `page_size` | 1–100; default 25 |

Filters combine with AND. An unknown nonempty provider/reference returns no matches; invalid statuses, dates, bounds, blank supplied text, or unrecognized parameters return 422. References are nullable and need not be globally unique; all exact matches are returned. Search treats `%` and `_` literally and does not search job names.

The response contains `items`, `total`, `page`, `page_size`, `total_pages`, and the global `providers` list. Items include ID, name, provider, target, reference, status, submission time, requester, and retry source. Ordering is always `created_at DESC, id DESC`. Count and rows use one PostgreSQL repeatable-read snapshot. Pages beyond the result set return an empty `items` array with the correct total. Offset pagination is stable for a fixed dataset; new submissions between requests can shift page positions.

The endpoint is currently read-only local demo access; role enforcement will be added in its own stage.

## Investigate a job

Filter the [jobs list for failed jobs](http://localhost:5173/?status=failed), then select a job name. Search for `SYN-0005` for a seeded compilation failure. The details page shows current status, provider/target, UTC timestamps, recorded error stage/code/explanation, and an ordered lifecycle timeline. Expand an event's structured diagnostics to inspect the stored JSON. Correlation IDs are displayed per event; the failure panel uses the recorded failure event's ID rather than assuming one global job correlation ID.

The explanation is the stored error message, not an AI root-cause conclusion. Unknown metadata values are labeled **Not available**; empty diagnostics and absent events have explicit messages. An inconsistent or incomplete event history is flagged rather than reconstructed. Unknown jobs show a missing-job state; malformed IDs and service failures have distinct feedback. If refresh fails, previously loaded evidence is marked as stale.

**Back to filtered jobs** restores the list's exact applied query, including provider, dates, page, and page size. Reloading or sharing a details URL preserves that return context. Retry lineage references link to other recorded jobs when present; no retry or cancel action is implemented.

`GET /jobs/{UUID}` (frontend proxy: `/api/jobs/{UUID}`) returns:

- `job`: persisted submission, current state, timestamps, outcome, failure metadata, version, and lineage.
- `events`: all recorded events ordered by ascending per-job sequence, including timestamps, transitions, messages, actors, structured details, and correlation IDs.
- `history_complete`: whether sequences/transition continuity/latest state agree with the current job version and update timestamp. This is an audit-history check, not a claim that diagnostics explain a cause.

The job and events are read from one PostgreSQL repeatable-read snapshot. Missing IDs return 404, invalid UUIDs return 422, and database failures return a sanitized 503. The endpoint is read-only local demo access. It currently returns the full history in one response; event pagination is deferred for larger histories.

## Browser workflow tests

The Playwright test uses the running frontend, actual FastAPI API, and seeded PostgreSQL data. Start and seed the stack first, then:

```sh
docker compose up --build -d
docker compose exec -T api python -m app.seed
docker compose exec -T api python -m app.seed --dataset compiler-comparison-v1
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

If Google Chrome is already installed, use it without downloading another browser:

```sh
cd frontend
QUANTUM_JOB_TRACKER_E2E_CHANNEL=chrome npm run test:e2e
```

The default base URL is `http://127.0.0.1:5173`; override it with `QUANTUM_JOB_TRACKER_E2E_BASE_URL` if needed. The browser tests cover Demo & Guide and its verified example links, the complete first-visit walkthrough, experiment comparison and timeline return navigation, the original failure investigation, and the operational overview: cohort selection, rates/counts, both chart drill-downs, failure evidence, and filter-preserving return navigation. Seed both profiles as above. The tests do not mock network responses or modify jobs. Failure traces/screenshots are written to ignored `frontend/test-results/`.

On the implementation machine the packaged Chromium download ran out of disk space and was stopped. The test then **passed using installed Chrome** with the command above; no existing browser caches were removed.

### Static hosting base-path check

The separate browser tests check the complete example and Demo & Guide (including direct reload and supporting-job return) at the GitHub Pages repository path and assert that no API requests are made. From `frontend`, build and preview locally (no publishing):

```sh
VITE_DEMO_MODE=true npx vite build --base=./ --outDir node_modules/.qjt-journey-dist
npx vite preview --host 127.0.0.1 --port 5176 --strictPort --base=/Quantum-Job-Tracker/ --outDir node_modules/.qjt-journey-dist
```

In another terminal:

```sh
cd frontend
QUANTUM_JOB_TRACKER_E2E_CHANNEL=chrome npm run test:e2e:demo
```

Open [the local static demo](http://127.0.0.1:5176/Quantum-Job-Tracker/). The normal release build remains `npm run build:demo`, with relative assets and query-based navigation; the test serves those same relative assets under an explicit repository prefix. Static test artifacts are written to ignored `frontend/test-results-demo/`.

### Refresh the bundled example

The committed export is deterministic and generated using the existing backend comparison calculations and history-completeness check. After the local database is migrated and the experiment is seeded, regenerate it without writing to the database:

```sh
(cd backend && .venv/bin/python -m app.export_example)
```

This writes only `frontend/src/data/exampleManifest.json` and `exampleSnapshot.json`. The PostgreSQL export test checks that they match fresh seeded data and contain all 56 complete histories. No credentials, personal jobs or runtime environment values are exported.

## Check communication

Once the services have started, run (requires Python 3 on the host):

```sh
sh scripts/check-stack.sh
```

This verifies frontend HTML, direct and frontend-proxied API liveness, and direct and proxied readiness backed by a real PostgreSQL `SELECT 1`. It exits unsuccessfully if any service is unavailable; it does not substitute mock database responses.

| Endpoint | Healthy response | Failure behavior |
| --- | --- | --- |
| `GET /health/live` | 200, `{"status":"ok","service":"quantum-job-tracker-api"}` | Independent of database connectivity |
| `GET /health/ready` | 200, `{"status":"ready","database":"reachable"}` | 503, `{"status":"not_ready","database":"unavailable"}` |

Readiness uses a two-second connection timeout and two-second SQL statement timeout. It checks connectivity, not migration currency. The jobs page reads the actual database through `/jobs`; the later health dashboard will add separate operational status and worker health.

## Local development outside containers

Use Python 3.12 and Node.js 22+ with npm. Keep `.env` as above. Start PostgreSQL with `docker compose up -d db`, or supply an existing PostgreSQL instance through `DB_HOST`, `DB_PORT`, and the `POSTGRES_*` values in `.env`.

In one terminal:

```sh
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

The Vite development server proxies `/api/` to `127.0.0.1:8000`, keeping browser requests on the same origin. No browser environment variables or CORS configuration are needed at this stage. Backend settings read the root `.env`; exported environment variables override it. Do not place credentials in `VITE_*` variables or the frontend folder.

## Development checks

```sh
(cd backend && .venv/bin/python -m pytest -q)
(cd backend && .venv/bin/python -m pip check)
(cd backend && .venv/bin/alembic upgrade head --sql)
(cd frontend && npm run build)
(cd frontend && npm test)
```

The health tests mock database probes. PostgreSQL tests are separate and **skip** unless `QUANTUM_JOB_TRACKER_TEST_DATABASE_URL` is set; a passing health-only run is not database verification. With the default local demonstration credentials, run:

```sh
cd backend
QUANTUM_JOB_TRACKER_TEST_DATABASE_URL=postgresql+psycopg://qtrace:local-demo-only@127.0.0.1:5432/qtrace .venv/bin/python -m pytest -q
```

Use a PostgreSQL database account permitted to create/drop schemas. If credentials differ, supply a correctly URL-encoded `postgresql+psycopg://…` URL; do not commit it. Every PostgreSQL test migrates its own uniquely named disposable schema and drops that schema afterward. Tests never truncate application tables. Unreachable/misconfigured PostgreSQL causes a failure, not a skip, when the variable is provided.

Tests cover all 36 state pairs, database terminal protection, real transaction rollback, event insert failure, sequence uniqueness, immutable history, stale versions, retry foreign keys, migrations up/down and model agreement, seed determinism/idempotency, and both completion/cancellation commit orders. Offline migration SQL generation alone does not apply a migration to a database. Python dependency constraints and the npm lockfile record resolved versions; container base images are pinned to release lines rather than immutable digests.

The details stage passed 85 backend tests (including real PostgreSQL evidence/history checks), 19 React tests, and the Playwright failure-investigation workflow against the live stack. The API-backed React tests mock HTTP responses inside the test suite; the normal local application calls FastAPI/PostgreSQL. The public browser demo uses browser-generated data, covered by additional tests for filtering, pagination, histories, personal runs, and reset. The browser demo release passed all 24 frontend tests and both production builds, with browser checks for creating a run, inspecting its failure, resetting, and searching. Production build and dependency audit passed. Exact live-stack/browser check results and remaining limitations are recorded in [progress](docs/progress.md).

The initial application will use polling. Redis, Kubernetes, additional services, and real quantum SDKs are outside the plan.
