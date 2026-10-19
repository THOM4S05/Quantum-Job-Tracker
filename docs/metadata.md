# Compiler and resource metadata

All examples, providers, compilers, versions, workloads, estimates, and timings in the fixtures are synthetic. Nothing describes Horizon Quantum metadata or an actual quantum hardware execution.

## Storage and API contract

`jobs.metadata` is a JSONB snapshot validated by `WorkloadMetadata` in `backend/app/workload_metadata.py`. Existing canonical `jobs.provider` and `jobs.target` remain the sole provider/target fields; they are not duplicated inside the JSON. The job list and details APIs both return `job.metadata` (or `items[].metadata`) and `durations`. Durations are derived response fields and are never persisted as independent counters.

All metadata fields are nullable. Missing JSON keys and explicit null values mean unknown and are serialized as null by the API. The interface displays **Not available**, never a guessed zero. A recorded zero estimate or equal start/end timestamps is a known zero and remains visible as zero. An empty optimisation object `{}` is a recorded empty configuration; null is an unknown configuration.

| Field | Definition and unit |
| --- | --- |
| `program_name` | Workload/program name; distinct from the job display name even when a fixture uses the same text |
| `program_revision` | Opaque revision label or source/content hash; no particular hash algorithm is implied |
| `source_language` | Recorded source-language label; fixture value is `Synthetic QASM-like`, not a claim of SDK support |
| `compiler_name` | Recorded compiler identity; fixtures use `Synthetic Aurora Compiler`, `Synthetic Nebula Compiler`, or `Synthetic Quasar Compiler` |
| `compiler_version` | Recorded compiler version; example `synthetic-1.0.0` is fictional and distinct from the simulation-engine version |
| `optimisation_settings` | JSON object of compilation options; synthetic examples include `level` and `routing`, with no vendor semantics implied |
| `requested_shots` | Requested number of repetitions, integer count; separate from any shots/counts in the recorded result |
| `estimated_logical_qubits` | Estimated logical-qubit count; not physical qubits, device capacity, or an observed allocation |
| `estimated_circuit_depth` | Estimated sequential circuit layers; not elapsed time |
| `estimated_gate_count` | Estimated number of gates; not measured native/device instructions |
| `compilation_started_at` / `compilation_finished_at` | Start and stop of the compilation attempt, including an attempt that fails |
| `queue_entered_at` / `queue_left_at` | Entry to and exit from the fictional provider queue, including leaving due to failure; not the application's initial `queued` status interval |
| `execution_started_at` / `execution_finished_at` | Start and stop of the execution attempt, including failure; an active run may have only its start recorded |
| `job.provider` / `job.target` | Existing fictional provider and synthetic simulator target identifiers |

Phase timestamps are timezone-aware ISO 8601, normalized to UTC by the backend. Timestamp precision is up to microseconds. The details UI labels UTC explicitly. Existing submission/update/start/finish timestamps remain available and are not repurposed as phase timestamps.

## Duration rules

- `durations.compilation_seconds = compilation_finished_at - compilation_started_at`.
- `durations.queue_seconds = queue_left_at - queue_entered_at`.
- `durations.execution_seconds = execution_finished_at - execution_started_at`.

Durations are seconds, with up to six fractional digits. Both endpoints are required. A missing start, missing finish, or unstarted phase produces null / **Not available**. There is no live elapsed-time substitution and no duration inferred from job status, another phase, submission time, or the current clock. Equal timestamps produce zero seconds. Negative intervals and out-of-order known phase timestamps are rejected by backend validation.

Backend duration calculation and the static demo use the same definition, including timezone offsets and microsecond fractions. The normal API-backed UI displays the API's durations; it does not keep another timer.

## Estimates versus observations

Estimated resources live only under `metadata.estimated_*`. Observed outputs remain under the existing `job.result` and appear inside **Lifecycle and failure evidence** as **Recorded result (synthetic observed output)**. They are not copied into estimated resource fields. A result is still synthetic: the label “observed” means the recorded simulator output, not hardware measurement.

The failure panel still quotes the persisted error message and shows recorded event diagnostics and correlation IDs. Adding compiler metadata does not introduce inferred root causes or AI conclusions.

## Validation

The shared creation function validates metadata before inserting a job or its creation event. Unknown keys, blank supplied labels, naive timestamps, non-finite JSON options, invalid ordering, fractional/boolean/string counts, and negative counts are rejected. Requested shots must be at least 1; resource estimates may be 0. All counts are bounded to 9,007,199,254,740,991, the common exact-integer range of the backend/browser contract. Label lengths are bounded in the model.

PostgreSQL additionally enforces a JSON object and nullable integral resource-count bounds/types. Existing lifecycle, terminal-state, and append-only-event protections are unchanged. There is no new job mutation API in this stage. Arbitrary SQL is not a supported replacement for validated application writes.

## Fixtures and migration

Migration `0004_workload_metadata` adds the snapshot column and enriches only the identified `qtrace-demo-v1` fixture jobs with seeds 10000–10199. It does not fill unrelated legacy jobs. Migration `0005_metadata_counts` adds count constraints. The migration transaction holds the table lock and temporarily suspends the old row-write trigger only to populate the new fixture field, then restores it. IDs, statuses, versions, old timestamps, results, errors, and event histories are preserved.

The historical fixture contract defines compilation from submission +1 s to +2 s, provider queue from +2 s to +3 s, and execution from +3 s until the recorded execution failure (+4 s) or success (+5 s). The existing stage checkpoints mark these synthetic boundaries. Unreached phases have null endpoints; a running fixture has no execution finish. These are explicitly fictional fixture intervals, not measurements reconstructed from a real provider. Some fixtures intentionally lack compiler versions (index divisible by 17) and estimates (index divisible by 13), demonstrating **Not available**.

New seed runs use the same deterministic definitions as migration backfill. Repeated seed commands retain their non-destructive skip behavior. The static sample fixtures and newly created browser runs use the same field names, types, units, unknown rules, and interval definitions. Older browser-local runs keep their prior observations/history and receive null metadata rather than invented compiler information. No browser storage reset is required.

## Inspect and check

```sh
docker compose up --build -d
docker compose exec -T api python -m app.seed
```

Open the local jobs list, search for `SYN-0004`, and select its job name. Inspect **Program and compiler**, **Target and configuration**, **Estimated resources**, **Timings**, then **Lifecycle and failure evidence**. `SYN-0005` demonstrates a compilation failure with no queue/execution duration; `SYN-0001` demonstrates deliberately unavailable compiler/resource values.

The browser-only demo can be checked with `cd frontend && npm run dev:demo`; the source/build has been updated, but this stage does not publish it to GitHub Pages.

See [README](../README.md) for database test and browser-workflow commands, and [progress](progress.md) for actual results and remaining limitations.
