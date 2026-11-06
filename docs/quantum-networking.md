# Synthetic network tracking: implemented milestone

Implemented locally on 4 November 2026 for the browser demo and FastAPI/PostgreSQL application. This describes the implementation; [the original handoff](quantum-networking-plan.md) remains the proposed design record. No publication or deployment is included.

## Available behavior

Jobs now identifies a networked attempt as one parent job. Its shared immutable specification identifies the source program, revision, inputs and two-machine plan. The Network execution section shows two independently recorded parts, one link, timings, combined sequence-ordered events, recorded output on success, and coordination-failure evidence on timeout. Jobs and Demo & Guide link to both historical examples. Existing URL filters, return links, refresh/stale states and ordinary job details continue to work.

A link represents connectivity. A successful completed entanglement attempt creates a named pair; the remote operation consumes it exactly once. A failed attempt alone does not fail the parent. The timeout stops both parts after their local preparation; it does not record two hardware failures. Job sequence numbers give synthetic recorded order, including identical timestamps, without asserting global physical ordering.

Overview still counts parent jobs only. A small network-outcome breakdown separates success, entanglement timeout and other/pending outcomes. Entanglement-attempt rates remain on details. Compiler compatibility includes the entire execution method/plan/network configuration in submission settings; absent network plan fields make a comparison unverifiable, and local/networked configurations cannot silently match.

## Setup and reproducible export

Apply the additive migration, then select the optional profile (the existing default and comparison profiles are unchanged):

```sh
docker compose run --rm migrate
docker compose run --rm api python -m app.seed --dataset quantum-networking-v1
```

From a configured Python environment in `backend/`, seed and export validated database evidence:

```sh
python -m app.network_seed --export ../frontend/src/data/networkSnapshot.json
```

The exporter reads the committed records in a repeatable-read transaction and refuses missing or inconsistent history, outcomes or synthetic provenance. It does not invent a second browser timeline. Seed reruns report `inserted: 0, skipped: 2`, preserve unrelated data and never rewrite completed fixtures. Fixture creation uses the existing transition/progress functions before making the parent terminal. No worker or network submission endpoint is added.

Browser demo: **258 bundled parent jobs** = the unchanged original 200 fixtures + 56 compiler experiment fixtures + 2 networking fixtures. Personal browser storage and reset behavior are unchanged; reset preserves all 258 bundled jobs. Local totals depend on which optional profiles have been loaded. Existing README screenshots predate the two additional examples.

| Fixture | Parent job ID | Outcome | Execution elapsed | Entanglement wait | Successful / completed attempts | Remote operation |
| --- | --- | --- | --- | --- | --- | --- |
| Success | c5ed0733-fdae-5135-9d40-a4d1b3db000e | succeeded | 11 s | 4 s (ready) | 1 / 2 | 2 s |
| Timeout | 0e83a2a4-5f1f-5e21-8672-7e06b602dedd | failed at execution | 15 s | 12 s (timeout) | 0 / 2 | unavailable |

## Additive contract

`GET /jobs/{id}` adds nullable `networking`. Missing networking is valid for ordinary jobs. List/detail job summaries add `execution_method` (`single_machine` by default, or `entanglement_network`). The existing job status, version, retry lineage and result rules remain authoritative.

The extension contains `execution_method`, `schema_version`, `plan_version`, `synthetic`, `parts`, `links`, derived `link_state`, `metrics`, and `issues`. Each part has its parent ID, machine label/provider/target, role/qubit identifiers, status, start/preparation/finish timestamps, and optional recorded failure code/message. Part states are `pending`, `preparing`, `blocked`, `completed`, `aborted`. Blocked means local preparation completed while shared coordination is still required. Links require distinct endpoints from that same parent.

`job_events.details.network` uses a validated discriminated `kind` with only the relevant fields:

| Kind | Additional fields |
| --- | --- |
| execution_started | none |
| part_started, local_prepared, part_completed, part_aborted | part_id |
| entanglement_requested | link_id, operation_id, deadline |
| attempt_completed | link_id, operation_id, attempt_id, outcome; resource_id exactly on success |
| entanglement_timeout | link_id, operation_id |
| remote_started, remote_completed | link_id, operation_id, resource_id |
| final_output | output |

The milestone has one fixed operation, `remote-cz-1`. A terminal timeout event also records `link_id`, `operation_id` and `cause: coordination_failure` in its diagnostic details. Final output must agree with the successful parent result. The combined timeline includes all ordinary compilation/queueing/terminal events as well as networking progress.

Metrics use recorded endpoints: execution start to parent terminal execution event; request to readiness or timeout; remote start to completion. Part durations are not summed. Counts include only explicit completed attempt outcomes. Missing endpoints are null, never zero. Inconsistent replay adds visible issues, and the UI suppresses metrics when history is incomplete or inconsistent.

## Persistence and validation

Migration `0006_networking` adds `networked_runs` (parent ID primary/foreign key), `execution_parts` and `quantum_links`. Composite endpoint foreign keys reject cross-parent connectivity. Guards lock the parent, freeze plan records and reject changes to related records after completion. Networking event guards validate shape, references, sequence/version agreement, preparation/request/deadline order, unique attempts, generated-pair consumption and remote/output prerequisites. Parent terminal guards enforce required parts and output, and prevent a successful remote result on timeout.

`record_network_event` holds the parent lock and wraps part changes, parent version and event insertion in a savepoint. Replay validation also runs on ordinary transition/progress entry points when networking is involved, so callers cannot bypass domain checks by appending raw networking details. The caller owns the outer transaction. The details API loads the parent, events and extension in one repeatable-read snapshot.

Verification includes domain and real PostgreSQL tests for rollback, cross-parent records/events, invalid/repeated pair consumption, terminal protection, seed idempotence and byte-for-byte browser fixture agreement; React tests for both outcomes and absent/inconsistent evidence; and shared browser journeys for live API and offline demo, including reload, filter return, Back/Forward and mobile keyboard checks. Run the standard backend/frontend suites and both frontend builds as described in the README. PostgreSQL tests require `QUANTUM_JOB_TRACKER_TEST_DATABASE_URL`; they skip explicitly when it is absent.

Verified on 4 November 2026: 187 backend tests passed against PostgreSQL 17 with no database skips; 72 frontend tests passed; all 6 live-API and 6 browser-demo journeys passed in installed Chrome; both frontend builds passed. Browser journeys include the existing compiler comparison, failure investigation and Guide, as well as networking. A temporary isolated database was used, without modifying the application database or publishing the build.

## Deferred work

User-configurable network submissions, active workers, hardware connections, physical simulation, multiple simultaneous pairs, arbitrary topology, fidelity/distance metrics and QPU billing/usage accounting are not implemented. No claim of quantum advantage or connection to production systems is made.
