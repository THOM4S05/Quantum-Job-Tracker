# Quantum Job Tracker progress

## README simplification — 20 October 2026

- Removed the timed “Three-minute walkthrough” section at the user’s request. Kept screenshots, feature descriptions, guide links and setup instructions; reworded remaining setup references to the example experiment. Application pages are unchanged.
- Checks actually run: verified README local links, balanced code fences, removal of the timed section, and `git diff --check`. No application tests rerun for this documentation-only change. No blockers or deployment.

## README screenshot refresh — 20 October 2026

- Moved the screenshot section immediately below the short purpose/synthetic-data introduction and demo links. Kept existing startup instructions and detailed documentation.
- Replaced the three historical screenshots with current local browser-demo captures. Added experiment comparison, operational overview and Demo & Guide images. Captions identify the bundled synthetic source, the resource improvement and recorded candidate compilation failure; additional views are expandable.
- Checks actually run: opened the working local browser build under `/Quantum-Job-Tracker/` in Chrome, followed the guide’s example/supporting-job links, captured six screenshots and visually inspected each. Checked README image/local-file links, PNG headers/dimensions and balanced code fences; `git diff --check` passed. No application code changed, so unit/backend suites were not rerun for this documentation-only update.
- No blocker found. No publication or deployment. The next implementation stage remains separately scoped.

## Guide and layout publication — 20 October 2026

Prepared Demo & Guide, its verified example links, and the bulleted responsive layouts for publication. The README now links to the public guide. Validation passed: **66 frontend tests**, the browser-demo production build, **5 API-backed Chrome workflows**, and **4 static-hosting Chrome workflows**, including mobile layout and keyboard navigation. Documentation file links and whitespace checks passed. Backend source is unchanged; PostgreSQL tests remain required by the deployment workflow. Earlier stage notes below describe the state before this publication.

## Bulleted lists and compact layouts — 20 October 2026

- Continued the existing list-formatting work without replacing the guide or other features. Guide walkthrough, page explanations, glossary, interpretation notes, implementation components, overview breakdowns and comparison explanations use visible bullets.
- Longer explanatory lists and change cards use responsive columns; supporting-job lists also flow into columns when space permits. Narrow screens retain a single readable column. The chronological event timeline retains its existing event markers and sequence.
- Checks actually run: **66 frontend tests passed**, TypeScript check passed, static-demo production build passed, and **4 Chrome browser tests passed** under `/Quantum-Job-Tracker/`. The added browser check verified bullet styles, desktop columns, mobile stacking and no horizontal page overflow; existing example links, return navigation and keyboard checks also passed. `git diff --check` passed.
- No backend changes or backend tests were needed for this presentation update. Nothing published or deployed. No remaining blocker found; the next implementation stage remains separately scoped.

## Demo & Guide page — 20 October 2026

- [x] Read project instructions, README and current frontend/data/navigation code, then inspected the actual Jobs, Overview, comparison, job details/timeline and How it works pages before writing copy. No `AGENTS.md` is present in the workspace or inspected parent folders. Preserved existing work and design.
- [x] Added a directly loadable `?view=guide` page with a plain-language purpose, the concrete compiler-version example, explicit synthetic/independent-portfolio labels, five numbered steps, readable section cards, glossary and interpretation guidance. Main explanations remain visible without expanding sections.
- [x] Covered actual controls and navigation labels for Overview, Jobs, Job details, Experiment comparison, Changes to investigate, the browser-only playground and How it works. Explained submission-cohort filters, exact reference search, baseline/candidate choices, counts/units, configuration matching and return navigation without describing planned services as available.
- [x] Reused the existing example identifier and comparison query. Resolved a supporting candidate job from the current comparison data and verified its recorded compilation failure, experiment and compiler version before exposing the direct link. Missing data, failed checks and unavailable/wrong-stage jobs produce honest messages and retry/general navigation; no records or conclusions are invented.
- [x] Added **Demo & Guide** to main-page sidebars and a small entry in the Jobs/Overview introduction. Links use the existing base-path-aware helpers and retain the comparison return query for direct job/timeline links.
- [x] Used semantic headings, a guide contents navigation, numbered steps, definition lists and descriptive links. Added responsive cards and wrapped mobile navigation to accommodate the extra item; existing keyboard focus styling remains visible.
- [x] Updated README with the guide location and usage. No backend service, data-model/calculation change, dashboard, onboarding overlay, dependency, publication or deployment was added.

Checks actually run for this stage:

- Frontend regression suite: **66 passed**. Seven added checks cover direct guide rendering and visible content, verified example/supporting-job links, preserved selections, loading, missing experiment, retry after failed checks, and refusal to link to missing or wrongly staged supporting records. Existing features remain passing.
- TypeScript checking passed, including guide code and both browser-test configurations. Normal API-mode and static-demo Vite production builds passed. The static build used release-style relative assets and was served locally under `/Quantum-Job-Tracker/`.
- API-backed Playwright/Chrome suite against the existing separate local frontend/API preview and actual PostgreSQL: **5 passed**. The new guide workflow opens navigation, reloads the guide directly, follows the main example link and verified supporting record, inspects the three-event failure timeline, and returns to the same comparison selections. The existing four workflows passed too.
- Static-hosting Playwright/Chrome suite: **3 passed**. Includes the guide and example journey under `/Quantum-Job-Tracker/`, direct reload, deep supporting links and comparison return, with **zero API requests**. A narrow-screen check at 390×844 verified no horizontal page overflow, tab navigation to the main example action, visible focus outline and Enter activation without losing the base path.
- Inspected `/tmp/quantum-demo-guide.png`, `/tmp/quantum-guide-cards.png` and `/tmp/quantum-guide-mobile.png` for desktop/mobile layout. Confirmed the guide has no collapsed explanatory sections. This is not a full screen-reader or accessibility certification.
- `git diff --check` and documentation local-link/fence checks passed. Backend code/data were unchanged, so the Python suite was not rerun for this explanatory frontend stage; the guide’s API interactions were exercised in the browser checks above.

What works: first-time visitors can learn the app’s purpose without quantum terminology knowledge, follow a concrete example, open verified job evidence and retain comparison choices. All general explanations/navigation remain usable when example records cannot be checked. The browser-only personal-run playground is clearly distinguished from the API-backed application and from real execution.

How to open: choose **Demo & Guide** in the sidebar or the introduction, use `?view=guide`, or open the local static preview at `http://127.0.0.1:5176/Quantum-Job-Tracker/?view=guide`. The API-backed development preview is `http://127.0.0.1:5175/?view=guide`; standard README setup remains unchanged.

Remaining limitations: no local guide/demo blocker was found. Missing/unseeded local example data needs the documented seed/setup; the guide offers a readable fallback rather than substituting snapshot results in API mode. The hosted release remains unchanged because publishing/deploying was out of scope. No new backend work is required for this page; the next planned implementation remains the separately scoped permission foundation.


## Complete browser example publication — 20 October 2026

Prepared the first-visit instructions and complete exported experiment for publication. The browser release now includes the 56-run synthetic compiler example, full histories and precomputed comparisons alongside the original 200 samples. The public example can be followed without a backend; the local application continues to read PostgreSQL.

Pre-push verification passed: **159 Python tests** against disposable PostgreSQL schemas, **59 frontend tests**, the browser-demo production build, **4 API-backed Chrome workflows**, and **1 static-hosting Chrome workflow** under `/Quantum-Job-Tracker/` with zero API requests. Documentation file links and whitespace checks passed. The existing Starlette/AnyIO deprecation warning remains. Earlier source-stage notes below describe their state before this publication.

## First-visit story and complete example — 20 October 2026

- [x] Read README, project instructions and existing UI/data/navigation/test code before changing the design. No `AGENTS.md` is present. Preserved the jobs list, overview, matching/calculations, comparison highlights and recorded failure-investigation workflow.
- [x] Added an audience/purpose introduction on Jobs and Overview, a visible synthetic-jobs/results label, data-source explanation, **Start with Overview**, and **Explore example comparison** with the existing seed's selections prefilled. Explained that compiler-version comparison is the featured example, not the definition of every experiment.
- [x] Added **What to notice** for the improvement and candidate compilation failures, brief success-rate/resource explanations, consistent **Experiment comparison** navigation, and a jump to timeline/failure evidence. Existing **Back to comparison** retains experiment and compiler selections.
- [x] Closed the main browser-demo gap: included a read-only, deterministic export of the existing 56-job experiment, its complete timelines, and both comparison directions. `app/export_example.py` reads only the named synthetic seed and uses existing comparison calculations plus the shared history-completeness check. A PostgreSQL test checks the committed snapshot against a fresh seed and verifies that export changes no job records. No browser matching algorithm or alternate simulator was added.
- [x] Browser data now includes 256 bundled samples (the original 200 plus the 56-run example); reset preserves all samples. Personal-run creation remains an explicitly labelled, collapsed browser-only playground, with no backend submission or experiment-creation claim. API mode still reads PostgreSQL and never substitutes a snapshot for empty/missing local data.
- [x] Added a shared complete-journey browser check, an API-backed test, and a static-hosting test under `/Quantum-Job-Tracker/`. Retained query-based links and the hosting base path through entry, job reload, and exact comparison return navigation.
- [x] Updated README purpose, three-minute walkthrough, startup/seed instructions, export regeneration and static-hosting checks, plus architecture/comparison/implementation notes. No publication, deployment, push, auth, GitHub integration, worker or monitoring system was added.

Checks actually run:

- Full backend suite against actual PostgreSQL: **159 passed**, including fresh-schema export reproducibility, exact checked-in snapshot equality, all 56 complete histories/315 events, matching contributor references, read-only row-count preservation and refusal to export an unseeded database. The existing Starlette/AnyIO deprecation warning remains.
- Full frontend suite: **59 passed**. New checks verify the example entry point, all 56 supporting job histories, reverse direction, validation/empty/missing-data behavior, purpose/source/synthetic labels while loading or on error, retry, empty overview values, absence of substituted example results in unseeded API mode, and withholding featured-direction guide notes when selections are reversed. Existing list/detail/comparison/highlight checks remain passing. Sample-count expectations were updated from 200 to 256; one accidentally changed HTTP-status expectation was corrected back to 200.
- TypeScript checking passed, including both browser configurations and the journey helper. An initial test-only unsupported RTL `exact` option was removed. Normal API-mode and static-demo production builds passed. The static release-style relative-assets build was also served locally under `/Quantum-Job-Tracker/`.
- API-backed Playwright/Chrome suite against the separate local Vite/FastAPI preview and actual PostgreSQL: **4 passed**. The new full journey covers initial purpose → Overview → preselected comparison → visible resource improvement and missing execution samples → supporting candidate job → timeline/failure evidence/correlation → exact return choices and reload. Existing three workflows passed too.
- Static-hosting Playwright/Chrome suite: **1 passed** with the same complete journey at `/Quantum-Job-Tracker/`, using release-style `./` assets and asserting **zero API requests**. Direct job reload and comparison return preserve the repository prefix and full selection query. The initial journey assertion expected capitalized `Correlation ID` instead of the existing `Failure correlation ID`; it was corrected. Parallel runners initially collided in nested artifact directories; static artifacts now have a separate ignored output directory and the static test passed on rerun.
- Read-only export command against the existing seeded database produced the committed snapshot. No application data was reset or reseeded for the demo. Snapshot contains only synthetic job models, evidence and derived comparisons, not credentials or environment configuration.
- Inspected `/tmp/quantum-first-visit.png`, `/tmp/quantum-overview-intro.png` and `/tmp/quantum-example-hosting.png`: purpose, source labels, primary example action and guided explanation remain readable within the existing desktop design. No mobile-device/screen-reader audit is claimed.
- Python compilation, `git diff --check` and documentation local-link/fence checks passed.

What works: a first-time visitor can complete the same example using the updated static browser build alone or the seeded local application. The guide distinguishes lower estimates from measured performance, shows a change worth investigating without causal claims, and leads directly to recorded evidence. Loading/error/empty/missing states remain honest and preserve navigation.

How to try now: open `http://127.0.0.1:5176/Quantum-Job-Tracker/`, choose **Start with Overview**, then **Explore example comparison**. The separate API-backed development preview remains at `http://127.0.0.1:5175/`. Standard README commands reproduce either mode without publishing.

Remaining issues: no blocker prevents completing the updated local static or seeded API demo. The hosted release is unchanged because publication/deployment was explicitly out of scope. An unseeded local API database needs the documented seed command; it intentionally does not fall back to browser data. Static comparison snapshots support the featured pair in either direction, not arbitrary compiler experiments; no real compiler/hardware performance claim is made. The next planned implementation remains the separately scoped permission foundation.

## Comparison highlights publication — 20 October 2026

Prepared the comparison highlights and supporting-observation links for publication. Pre-push validation passed: **157 backend tests** against disposable PostgreSQL schemas, **52 frontend tests**, the browser-demo production build, and **3 Chrome browser workflows** against the prepared local preview and real PostgreSQL data. Documentation file links and whitespace checks passed. The existing Starlette/AnyIO deprecation warning remains. The public comparison data source still has no named experiments; the local seeded application supplies the comparison evidence.

## Changes to investigate — 20 October 2026

- [x] Read project instructions, README, matching/metric definitions, comparison API/page, existing tests and navigation before editing. No `AGENTS.md` is present in the project or inspected parent folders. Preserved existing work and the matching/delta definitions.
- [x] Added lightweight **Changes to investigate** inside compatible comparison groups, using the existing calculated metrics and outcome counts. No dashboard, alerting service, rules configuration, migration, worker or persisted state was added.
- [x] Highlighted newly observed compilation failures only when the baseline has successful compilations and no recorded compilation failures; lower execution success; higher observed compilation/runtime medians; and higher estimated depth/gate counts. Showed higher success rates and lower timing/resource observations alongside increases.
- [x] Kept neutral synthetic language and the explicit absence of regression/causal proof. Included workload/target, baseline/candidate values, run/sample counts, absolute changes, percentage points for rates, and explicit zero-baseline/insufficient-data explanations. Incompatible/unverifiable groups receive no highlights.
- [x] Added eligible observation `job_ids` to existing timing, rate and resource observations without changing their values or sample rules. Supporting-job links preserve comparison choices. **Runs contributing to timing medians** identifies the observations for compilation, queue and execution, including unchanged timings and eligible failures.
- [x] Used the existing seeded experiment unchanged to demonstrate candidate compilation failures, increased runtime, lower resource estimates and the unchanged control. Compilation failures have no fabricated execution samples.
- [x] Updated README and comparison definitions. Did not publish, push, deploy, rebuild/restart the existing Compose application, or reseed its data. Used separate local development servers for browser validation.

Checks actually run for this stage:

- Full backend regression suite with actual PostgreSQL: **157 passed**. Tests use disposable migrated schemas. Added checks that contributor ID sets exactly match eligibility (including cancelled-after-start queue observations, missing execution endpoints, completed failures and empty execution samples), sample counts and side-specific jobs. API checks follow compilation-failure contributor IDs to real complete timelines. Existing matching and delta tests remain passing. The pre-existing Starlette/AnyIO deprecation warning remains.
- Frontend regression suite: **52 passed**. The 13 added focused checks cover new-failure conditions, lower/higher execution success, increased compilation/runtime/resource metrics, decreases shown alongside increases, sample/run counts, zero-baseline handling, missing timing observations, exact supporting links, timing provenance including queue samples, unchanged observations and all incompatible match statuses.
- TypeScript checking passed, including browser-test sources. Both normal and static browser-demo Vite production builds passed. These are local build artifacts only; nothing was published or deployed.
- Playwright with installed Chrome against the separate local Vite/FastAPI preview and actual seeded PostgreSQL data: **3 passed**. The extended comparison workflow verifies both concerns and resource decreases, missing execution observations, and that supporting runtime links exactly equal the API's contributor IDs; it opens a supporting timeline and returns to the unchanged comparison URL. Existing failure-investigation and overview workflows also passed.
- Inspected `/tmp/quantum-runtime-change.png` and `/tmp/quantum-resource-changes.png`: neutral, readable inline highlights with workload/target, baseline/candidate samples, deltas and supporting-job controls. No mobile/screen-reader audit is claimed.
- Python compilation, source whitespace checks, and documentation local-link/fence checks passed.

What works: in the seeded comparison, compilation-regression shows baseline 0/7 versus candidate 7/7 failed compilations and −100 pp compilation success, with insufficient candidate execution timing. Execution-slowdown shows 10 → 18 s (+8 s, +80%; n=7 each). Resource-gain shows depth 240 → 168 and gates 1600 → 1120 (both −30%; n=7 each), and the unchanged control has no highlighted differences. Every timing contributor can be inspected without including ineligible runs in its median.

How to inspect this work now: the local development preview is `http://127.0.0.1:5175/?view=comparison`, using a separate API at port 8001 and the existing database. Choose **Synthetic compiler comparison v1**, baseline **synthetic-1.0.0**, candidate **synthetic-1.1.0**. The existing Compose app and hosted site were left unchanged. Standard startup/build instructions in README remain valid for a future local run of the updated source.

Limitations: descriptive highlighting has no statistical confidence or causal interpretation and cannot establish real compiler performance. Strict matching and existing observation eligibility still apply. The static browser samples have no named experiments; this feature is demonstrated in the local seeded PostgreSQL application. Full observation/job lists remain appropriate for the small fixture dataset. No implementation blocker remains.

This stage is complete. The next planned implementation remains the separately scoped permission foundation; worker execution, actions and external integrations remain deferred.

## Comparison publication — 20 October 2026

Prepared the comparison workflow for GitHub Pages publication. The public page includes navigation and an explicit empty state because browser fixtures have no named experiments; seeded compiler comparisons continue to use the local PostgreSQL application. Updated the README with the public comparison URL.

Pre-publication checks: **155 Python tests passed** against disposable PostgreSQL schemas, **39 frontend tests passed**, the browser-demo production build passed, and **3 Playwright workflows passed** using Chrome against the local API/database stack. Documentation file links and whitespace checks passed. The existing Starlette/AnyIO deprecation warning remains.

## Publication and implementation notes — 19 October 2026

The release includes the compiler/resource metadata, experiment fixtures, operational overview, and an optional **How it works** page linked from jobs, details and overview. The implementation guide maps Python, React, PostgreSQL/SQL, FastAPI/HTTP, async behaviour, message brokers and Git/CI/CD to code references and discussion questions. NATS/MQTT and a job worker remain unimplemented; the public site uses browser data, while the local API uses synchronous PostgreSQL access. The 56-job compiler comparison dataset remains a local backend seed profile, not a browser fixture.

CI now runs the full Python suite against a temporary PostgreSQL 17 service, alongside frontend tests and the static build. Deployment requires both jobs to pass. It publishes only the static site; backend deployment and production database migrations are outside this workflow.

Pre-push verification: **127 backend tests passed** against disposable PostgreSQL schemas, **34 frontend tests passed**, both normal and browser-demo production builds passed, and **2 Playwright workflows passed** using Chrome against the running local API/database stack. The existing Starlette/AnyIO deprecation warning remains. No new worker, broker, login or operator action is claimed.

## Current status

The Demo & Guide page is complete and linked from main navigation and the introduction. It describes existing pages and terms, resolves available seeded evidence, and supports direct hosting-base-path links and comparison return context. This stage passed 66 frontend tests, five API-backed browser checks and three static-hosting/mobile/keyboard checks, plus TypeScript and both frontend builds. Backend functionality was unchanged. No publication or deployment was performed.

The project is named Quantum Job Tracker. All seeded and future quantum jobs and providers are synthetic; nothing connects to Horizon Quantum systems.

## Experiment comparison — 20 October 2026

- [x] Reinspected project instructions, README, metadata/experiment seeds, shared metrics, list/detail navigation, static demo and tests. No `AGENTS.md` is present. Preserved existing project work and the implementation-notes page.
- [x] Defined conservative workload/configuration matching, unverifiable identity, changed settings, sample/denominator rules and null/zero/rate delta behavior in `docs/comparisons.md`.
- [x] Added read-only `/comparisons` with experiment-scoped version options and one consistent PostgreSQL snapshot. No default compiler pair is invented.
- [x] Partitioned runs by revision, canonical input/settings JSON, target/provider, shots, compiler identity, language, simulation version and extra recorded settings. Flagged other differences, unmatched workloads and contradictory/missing identity. Every selected run remains in one inspectable group.
- [x] Reused outcome definitions and added completed compilation-duration and estimated-resource medians. Kept run counts, completed attempts, exclusions and observation samples separate. Included recorded failed attempts with timing endpoints; no fabricated execution duration for compilation failures.
- [x] Added URL-persisted React comparison choices, baseline/candidate/value/delta/sample tables, failure visibility, bounded visible-tab polling, loading/error/retry/stale/empty states, and links to every side's job/timeline with exact return context.
- [x] Documented queue-time confounding and synthetic limitations. The independent browser samples have no named experiments and show an honest empty comparison selection rather than invented backend evidence.

Checks actually run:

- Full backend suite with actual PostgreSQL: **155 passed**, with the existing Starlette/AnyIO deprecation warning. Includes matching every seeded workload, all selected jobs appearing once, changed revision/inputs/target/provider/shots/compiler/language/optimisation/simulation/extra settings, canonical key ordering, partially matched groups, unmatched workload names, missing inputs, contradictory shots, unavailable/zero baselines, rate percentage points, execution failures, API options/selections, invalid/same-version queries, sanitized outages, and all 56 drill-down histories.
- Initial focused calculation run without a database URL: **27 passed, 1 PostgreSQL test skipped**; the subsequent full PostgreSQL run above executed that integration test.
- Frontend suite: **39 passed**, including comparison values/units/samples, unavailable percentages, configuration/unmatched warnings, selection application and history restoration, loading/error/retry/empty states, exact comparison return routing and browser-demo empty contract.
- `docker compose up --build -d`: passed, including the TypeScript/Vite production build. The static browser-demo production build with `VITE_DEMO_MODE=true` and relative base path also passed. Local TypeScript checking included browser-test sources.
- Playwright with installed Chrome against the actual frontend/API/PostgreSQL stack: **3 passed**. New workflow selects the seeded pair, verifies −25% estimated qubits, −100 pp compilation success, +8 s / +80% execution duration, opens a failed candidate's three-event timeline, returns to the identical URL and reloads its choices. Existing failure-investigation and overview drill-down workflows also passed.
- Final comparison/details wording follow-up: **14 focused frontend tests passed** and local TypeScript checking passed. Stack communication, Python compilation, `git diff --check`, and documentation fences/local links passed.
- Inspected `/tmp/quantum-comparison.png`: four readable workload/configuration panels, explicit candidate compilation failures and missing execution samples, separate outcome summaries and metric tables, with no clipped content in the tested desktop layout. No mobile-device/screen-reader audit is claimed.

What works: the running local application compares all four seeded workloads using actual database evidence and exposes every selected underlying run. The compilation-regression candidate shows seven failed completed compilations, a 4 s compilation median (n=7), and no execution duration (n=0). The slowdown remains 10 → 18 s, and estimated-qubit improvement remains 32 → 24. Original list, overview and investigation features remain working.

Limitations: comparisons are descriptive synthetic observations, not causal or statistically significant estimates of real compiler performance. Queue times can depend on operational conditions. Strict matching can leave incomplete/legacy configurations unverifiable. The API currently groups a whole small experiment in memory and returns full job references; larger experiments need bounded group/job pagination. The static browser samples lack named experiment membership and require the local seeded PostgreSQL app for this workflow. No hosted deployment was performed. No implementation blocker remains.

This stage is complete. The next planned implementation remains the separately scoped permission foundation; worker execution, operator actions and external integrations remain deferred.

## Overview readability follow-up — 19 October 2026

Changed **Metric definitions and exclusions** into six spaced bullet points, retaining the same definitions. The focused overview suite passed **6 tests**. No known limitation or blocker was introduced; the next planned stage remains permission foundation.

## Operational overview — 19 October 2026

- [x] Reinspected project instructions, README, architecture, job list/details, metadata, seeds/experiment profile, static demo and tests. No `AGENTS.md` is present. Preserved existing uncommitted work from the earlier stages.
- [x] Defined success denominators, schema adaptation, cancellation/pending/unknown exclusions, timing samples, units and submission-cohort semantics before implementing calculations in `docs/metrics.md`.
- [x] Added read-only `GET /overview` using actual job data in one repeatable-read PostgreSQL snapshot. Calculations cover the complete cohort, not a page. Explicit failure stage distinguishes compilation failures from later failures.
- [x] Shared submission-time/date, target, compiler-version and experiment validation/predicates/options between overview and jobs endpoints. Added explicit failure-stage job filtering for drill-downs.
- [x] Added URL-persisted React overview with four cards, denominator/sample counts, exclusion details, null-state messages, shared filters, five-second visible-tab polling, loading/error/retry/stale behavior, and two simple linked bar charts.
- [x] Preserved the job list and failure-investigation workflow, including cohort filters through list pagination, details and return navigation. Added matching browser-demo calculations using its own recorded jobs with explicit browser source labelling.
- [x] Updated README startup/browser-check instructions, architecture, metric definitions, limitations and next stage. No hosted deployment was performed.

Checks actually run for this stage:

- Initial database checks failed to connect because Docker Desktop was stopped (**53 passed, 73 setup errors**); this was an environment failure. Started Docker Desktop and rebuilt/started the existing Compose stack, then reran the full backend suite against PostgreSQL: **126 passed**. Subsequently added a midnight submission-cohort boundary test and ran the full overview test file: **15 passed**. The pre-existing Starlette/AnyIO deprecation warning remains.
- Backend checks cover independently known success/failure denominators, pending/cancelled/cancelling/unknown/not-started exclusions, compilation/queue/execution failures, missing or invalid timestamps, valid zero intervals, negative intervals, even medians, empty data, whole-cohort aggregation, combined exact filters, invalid query values, matching drill-down counts, global options, sanitized outages, and inclusion of execution after the selected submission day.
- Frontend regression suite: **34 passed**, including overview cards/counts/definitions, loading/empty/error/retry states, cohort filter application and URL restoration, preserved breakdown queries, browser-adapter calculations, missing evidence, cancellations and matching demo drill-down counts.
- `docker compose up --build -d`: passed, including TypeScript/Vite production frontend build and migration/startup ordering. No database migration was needed. The static demo production build also passed with `VITE_DEMO_MODE=true` and relative base path.
- Playwright using installed Chrome and the real Nginx/FastAPI/PostgreSQL stack: **2 passed**. The original failure investigation still works; the new workflow selects every cohort filter, verifies 75% compilation success (21/28), drills into target and failure-stage jobs, opens recorded failure evidence, and restores the filtered list. The first overview attempt exposed a selector accessible-name mismatch; explicit accessible names were added to the shared selectors and both workflows then passed.
- Final stack communication check, local TypeScript checking (including browser tests), Python compilation, source whitespace checks, and documentation local links/fences passed.
- Inspected `/tmp/quantum-overview.png`: the selected synthetic experiment cohort rendered readable cards, sample counts, shared filters and linked bar charts with no clipped content at the tested desktop size. No mobile-device or screen-reader audit is claimed.

What works: the running local overview uses actual PostgreSQL data and the existing investigation routes. Compilation failures are counted only from their explicit stage; unavailable execution observations stay null. Candidate experiment cohort: 28 jobs, compilation 21/28 (75%), execution 21/21 (100%), median queue 2 s (n=21), median execution 11 s (n=21), seven compilation failures. Global filter options remain selectable for empty cohorts.

Limitations: metrics are synthetic fixture observations, not actual compiler/hardware measurements or operational guarantees. Both success-rate denominators conservatively exclude all cancelled/cancelling jobs, even if an earlier phase completed; this adaptation is documented. Missing evidence is counted separately rather than reconstructed from generic events. The API currently aggregates selected job snapshots in memory, suitable for this small synthetic dataset; large-scale SQL/precomputed aggregation remains future work. This is a read-only operational overview, not authenticated infrastructure/worker monitoring. At completion of this stage, the hosted demo had not yet been republished; see the publication entry above. No blocker remains for this stage.

The stage is complete. The next planned implementation remains the separately scoped permission foundation; worker execution, actions, and external integrations remain deferred.

## Synthetic experiment dataset — 17 October 2026

- [x] Reinspected workspace instructions, README, architecture, existing seed/model/metadata/transition/API code, demo mode and tests. No `AGENTS.md` is present. Preserved the existing uncommitted metadata-stage work.
- [x] Reused the existing seed entry point, immutable job specification, validated metadata, and atomic job/event writes; no service, schema migration or worker added.
- [x] Modeled a named experiment, program/input workload identity, compiler arm, repetition and pair identity. Recorded intended configuration/outcome differences explicitly.
- [x] Added 56 synthetic runs: resource improvement, candidate compilation regression, execution slowdown and unchanged control, with seven repetitions per arm and fixed seed `20261017`.
- [x] Kept comparison inputs/settings fixed; generated consistent histories, timestamps, failure stages and metadata from one recipe. Failed compilation has no resource estimates, queue/execution boundaries, execution duration or result.
- [x] Added nonduplicating seed, scoped transactional reset/reseed, and stored-data reports with medians, sample counts and a full job/event snapshot digest.
- [x] Documented definitions/units, scenarios, controls, CLI usage, reset locking/privileges, UI/API inspection, and the unchanged independent static demo.

Checks actually run for this stage:

- Full backend regression suite against PostgreSQL: **111 passed**, including the first six experiment tests. After adding the additional suspended-trigger rollback test, reran the complete experiment file: **7 passed**. The pre-existing Starlette/AnyIO deprecation warning remains. Tests use migrated disposable PostgreSQL schemas and cover expected medians/counts, controlled identities/settings, all 56 API histories, missing execution evidence, exact repeated/reset job/event snapshots, preservation of the original demo, active guards, collision/dependency refusal, and rollback during deletion and reinsertion.
- Frontend regression suite: **28 passed**. No frontend source changes were needed for this stage.
- `docker compose up --build -d`: passed; the API contains the new seed profile and the frontend build remains unchanged/cached.
- Live initial seed: **56 inserted**, **49 succeeded**, **7 compilation failures**, **315 events**, **256 total jobs**. Live repeat/reset/repeat reported 0/56 skipped, 56 removed/inserted, then 0/56 skipped; total stayed 256. All comparison groups and full persisted snapshots matched, digest `dc86d7aff5e8870b9e784fd1db33c05d7cdad819858254271cd049946c840169`.
- Live median outcomes matched the recipe: resource estimates 32/240/1600 → 24/168/1120; compilation regression candidate had zero execution samples and null execution median; slowdown execution 10 s → 18 s; unchanged control 10 s → 10 s. Compilation medians were 4 s and successful queue medians 2 s.
- `QUANTUM_JOB_TRACKER_E2E_CHANNEL=chrome npm run test:e2e`: **1 passed** against the real stack after adding the experiment. The existing failure investigation now opens a new candidate compilation failure and checks its metadata, evidence, diagnostics, timeline and return filters.
- `sh scripts/check-stack.sh`: passed frontend/direct/proxied API liveness and PostgreSQL readiness. Python compilation, seed CLI help and `git diff --check` passed.

What works: the requested experiment is seeded in the running local PostgreSQL application, visible in the existing job list/detail workflow, and repeatable through the documented CLI. Original demo jobs remain intact. Full evidence reset is scoped to this fixture profile and refuses outside retry/root dependants; ordinary writes retain terminal/history guards.

Limitations: these are constructed historical fixtures, not an executing simulator, actual compiler measurements or statistical evidence about real compilers. Experiment/workload membership is stored in the immutable specification and inspected through existing details, not separate CRUD tables or a comparison UI. The static browser demo does not include this optional PostgreSQL profile. Reset briefly takes exclusive table locks and requires the table owner. No blocker remains for this stage.

The stage is complete. The next planned implementation remains the separately scoped permission foundation; worker execution, operator actions and external integrations remain deferred.

## Compiler/resource stage — 17 October 2026

- [x] Inspected existing instructions, README, model/API/seed code, details/list UI, static demo/storage, and prior tests. No `AGENTS.md` is present. Existing project identity, internal fixture IDs, frontend shell, routes, and deployment workflow are preserved.
- [x] Added a typed nullable compiler/resource JSONB snapshot with additive migrations; canonical provider/target fields and result/event data remain separate.
- [x] Added strict count/JSON/label/timestamp validation and derived compilation/queue/execution durations. Unknown endpoints stay null; no live elapsed-time or zero substitution.
- [x] Enriched identified synthetic fixtures and updated new seed generation, preserving status/version/old timestamps/events and repeatable seed behavior.
- [x] Updated list/detail API responses and static demo metadata/duration shapes. Older personal browser runs retain unknown metadata and prior results/history.
- [x] Grouped job details into Program and compiler; Target and configuration; Estimated resources; Timings; Lifecycle and failure evidence.
- [x] Documented definitions, units, synthetic provenance, validation, migration behavior, and inspection examples in `docs/metadata.md` and README.

Checks actually run for this stage:

- PostgreSQL-backed full suite: **105 passed**, with the pre-existing Starlette/AnyIO deprecation warning. Includes metadata round-tripping through storage/list/details, missing values, valid zero estimates, invalid counts/labels/options, timezone-aware chronological timestamps, microsecond duration arithmetic, direct database count validation, and migration preservation of existing job/event evidence.
- Frontend suite: **28 passed**. Covers the existing list/investigation/demo behavior plus metadata section rendering, unknown versus zero, shared duration cases, all synthetic scenarios, backend-compatible demo fields, and loading older saved runs without fabricated values.
- `npm run build`, `npm run build:demo`, and the Docker frontend build passed. No hosted demo deployment was performed.
- `docker compose up --build -d`: passed with migrations through `0005_metadata_counts (head)` on the existing PostgreSQL database.
- Repeated `docker compose exec -T api python -m app.seed`: `inserted=0, skipped=200, total_jobs=200`.
- `sh scripts/check-stack.sh`: passed against the live frontend/API/PostgreSQL stack.
- `QUANTUM_JOB_TRACKER_E2E_CHANNEL=chrome npm run test:e2e`: **1 passed**. The original filtering/failure/timeline/return workflow now also checks the compiler, estimated-resource, and timings sections using real API/PostgreSQL data.
- In-app browser inspection confirmed the five groups on a successful fixture, clearly labelled synthetic compiler data, separate estimates/recorded outputs, and 1 s / 1 s / 2 s compile/queue/execution durations. Saved a preview to `/tmp/quantum-job-metadata.jpg`.
- Live HTTP checks confirmed matching list/detail metadata, expected success/failure phase durations, intentionally unavailable values, and complete unchanged event histories.
- Final Python compilation, dependency consistency, offline migration SQL generation, source whitespace, Markdown links/fences, and `git diff --check` passed.

What works: compiler metadata is persisted and visible in the local application; static demo samples/new runs carry the same fields, while legacy personal runs display unavailable metadata. Existing investigation evidence and job-list behavior remain working.

Limitations: metadata and timings are fictional fixture snapshots, not results from an actual compiler or hardware. Unrelated legacy jobs remain unknown. Timestamp/label/options validation is enforced by the shared application model; PostgreSQL additionally enforces JSON-object/count constraints. At completion of this stage, the GitHub Pages build had not yet been republished; see the publication entry above. Screenshots in README predate this extension. No implementation blocker remains for this stage.

This stage is complete. The next planned implementation remains the separately scoped permission foundation; no worker, operator action, authentication, or external integration was added.

## Staged checklist

- [x] **Demo & Guide** — visible usage explanations, verified example records, glossary and interpretation, responsive/keyboard navigation and base-path browser coverage.

- [x] **First-visit refinement** — concise purpose/source labels, seeded example entry, guided evidence journey and relative-base static hosting checks.

- [x] **Changes to investigate extension** — inline descriptive highlights, balanced observations, exact timing contributor links and focused missing/zero/incompatible tests.

- [x] **Experiment comparison extension** — exact configuration matching, explicit mismatches/unmatched groups, outcome/sample-aware deltas, URL choices and recorded timeline drill-downs.

- [x] **Operational overview extension** — documented metrics, submission-cohort filters, counts/exclusions/units, linked breakdowns and API/React/PostgreSQL/browser checks.

- [x] **Synthetic experiment dataset extension** — fixed-seed paired compiler comparisons, seven repetitions per arm, scoped reset/reseed, documented outcomes and PostgreSQL/API verification.

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
  - Operational job metrics and linked breakdowns are implemented by the overview extension. Authenticated infrastructure health, worker freshness, degraded states and full MVP verification remain deferred.
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
- The jobs list and details are read-only local demo access. Separate paginated events APIs, worker execution, accounts, role enforcement, retry/cancel endpoints, and authenticated infrastructure/worker monitoring remain unimplemented. Full-history detail responses are intended for the current small fixture histories. Public health endpoints expose only minimal infrastructure status.
- Offset pagination is deterministic for an unchanged dataset; new jobs between page requests may shift page positions. Exact external-reference search is case-insensitive, not substring or job-name search.
- `requested_by` and event actors are demonstration identifiers until accounts are implemented. Retry/root references are modeled; retry behavior/idempotency remains a later stage.
- Shared writes maintain job/event consistency. Arbitrary direct SQL can bypass the service-level event pairing; triggers still enforce legal job states, terminal immutability, and append-only history.
- A successful readiness response checks database connectivity, not schema version. Migration success is separately enforced at Compose startup.
- This is a local development foundation; public deployment and production identity management are out of scope.
- Python constraints and npm lockfile record package resolution. Container image release tags can change; immutable image digests are deferred to delivery work.

## Next stage

Next implementation stage: permission foundation (Stage 1C), when requested. Worker execution and operator actions remain deferred until their respective stages. Add bounded event pagination before supporting substantially longer histories.
