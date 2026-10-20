# Synthetic compiler comparison dataset

This is a fixed historical experiment for investigating comparisons, not a compiler benchmark or hardware measurement. All programs, compiler versions, providers, outputs, resource estimates, timings and failures are **synthetic**. It does not connect to Horizon Quantum or any real quantum system.

## Model and persistence

The dataset reuses `jobs`, `job_events`, the validated compiler/resource metadata, and the existing atomic creation/transition/progress functions. No migration, worker, experiment API, comparison UI, or additional service is needed for these fixtures.

- An **experiment** is a named group of related runs: `Synthetic compiler comparison v1`. Its stable UUID and fixed seed `20261017` are stored in `specification.experiment`.
- A **workload** is a program revision and exact input configuration. `specification.workload` records its stable UUID, key, name, `program_revision`, and `inputs`. The UUID is derived from canonical JSON containing the revision and inputs. The revision is a SHA-256 fingerprint of a fictional program recipe identifier, not a claim that actual source code was compiled.
- A **job** is one workload run under its recorded compiler, provider, target, shots and optimisation settings. `specification.run` records `arm` (`baseline` or `candidate`), one-based `repetition`, and `paired_run_key`. Pair keys identify corresponding repetitions across arms; repetitions are independent fixtures, not retries. Retry lineage remains null.
- `specification.comparison` explicitly records the changed configuration field and intended synthetic difference. `seed_dataset = compiler-comparison-v1` identifies dataset ownership. The existing details API exposes this specification unchanged.

Provider and target use the canonical job columns. Program/compiler/configuration, nullable estimates, and phase boundaries use the existing metadata model described in [metadata.md](metadata.md). Results remain separate from estimates. All fixture IDs, event IDs, correlation IDs, submission/phase timestamps, outcomes and outputs are deterministic. Change the dataset version before changing its recipe.

## Controlled comparisons

There are **56 jobs**: four workloads × two compiler versions × seven repetitions. All use **Synthetic Comparison Compiler**, with baseline `synthetic-1.0.0` and candidate `synthetic-1.1.0`, **Synthetic Aurora Labs**, target `synthetic-comparison-simulator`, 1,024 shots, Synthetic QASM-like language, optimisation level 2, and routing `synthetic-fixed`.

Within a workload, program identity, inputs, provider, target, source language, compiler name, shots and optimisation settings are identical across both arms and all repetitions. Only compiler version is an intended configuration difference. Job/reference/correlation IDs, arm/repetition labels and submission times differ for run identity and scheduling. Estimated resources and recorded durations are outcomes, not configuration changes. Workloads intentionally have different widths/layers and program identities; comparisons must group by workload, not pool unrelated programs.

| Workload key | Inputs (width / layers) | Baseline → candidate estimates (logical qubits / depth / gates) | Baseline → candidate median execution | Intended evidence |
| --- | --- | --- | --- | --- |
| `resource-gain` | 32 / 12 | 32 / 240 / 1600 → 24 / 168 / 1120 | 10 s → 10 s | Fewer estimated resources; all 14 succeed |
| `compile-regression` | 16 / 8 | 16 / 180 / 900 → Not available | 10 s → Not available | Baseline 7 succeed; candidate 7 fail compilation |
| `execution-slowdown` | 24 / 10 | 24 / 210 / 1200 → unchanged | 10 s → 18 s | Candidate is 8 s slower in every pair; all 14 succeed |
| `unchanged` | 8 / 6 | 8 / 120 / 600 → unchanged | 10 s → 10 s | Identical paired estimates and durations; all 14 succeed |

Seven paired timing variations are a seeded permutation of −1.5, −1, −0.5, 0, 0.5, 1, 1.5 seconds. Successful execution takes 10 s plus that variation; slowdown candidates add another 8 s. Compilation takes 4 s plus half that variation, including recorded failed compilation attempts. Successful queue duration is always 2 s. Thus compilation medians are 4 s, queue medians are 2 s, and execution medians are as above. Each successful group has seven execution samples. The failed candidate group has zero execution samples, not seven zero-second executions. These constructed variations support median demonstrations; they are not independent measurements or statistical evidence about real compilers.

Durations in seconds are derived only from recorded timestamp pairs using the shared metadata model. Estimates are integral counts. Compilation failures end at the recorded compilation finish timestamp with stage `compilation`, code `SYNTHETIC_CANDIDATE_COMPILE_FAILED`, and an explicit synthetic explanation. Their queue/execution boundaries, resource estimates and result are null. They have no queueing/execution events. Successful phase boundaries agree with corresponding events, including a queue-entry checkpoint. Events at a shared timestamp are ordered by per-job sequence.

Total: **49 succeeded, 7 failed, 315 events**. Successful counts sum to the requested shots. Output counts are illustrative and do not imply correctness, fidelity or resource measurement.

## Seed, inspect and reset

From the project root, with Docker running:

```sh
test -f .env || cp .env.example .env
docker compose up --build -d
docker compose exec -T api python -m app.seed --dataset compiler-comparison-v1
```

The first invocation inserts 56 jobs. Subsequent invocations report `inserted: 0, skipped: 56`. The JSON command output includes stored per-workload/arm counts, available execution sample counts, median estimates/durations, and `comparison.snapshot_sha256`, a digest of **every job/event field**. A repeat or reset/reseed must retain the same digest and comparison groups.

To reset and immediately recreate **only these 56 experiment fixtures**:

```sh
docker compose exec -T api python -m app.seed --dataset compiler-comparison-v1 --reset
```

The command reports `removed: 56, inserted: 56`. It preserves the original 200-job demo and unrelated jobs. Reset is an administrative fixture operation requiring table-owner privileges: an exclusive table lock temporarily blocks reads/writes while the job/event delete guards are suspended and the owned fixture IDs are removed. Guards are re-enabled before insertion; foreign keys and constraints stay enabled. An enclosing savepoint and transaction roll back deletion, insertion, and trigger changes together if anything fails. All seed commands share an advisory lock. Unrelated ID collisions, unexpected dataset-owned IDs, or outside retry/root references cause reset to refuse without committing changes. Ordinary API/domain writes still cannot delete history or reactivate terminal jobs. Reset replaces historical fixtures; it is not a job lifecycle transition or an operator action.

The default `python -m app.seed` continues to seed the original 200 jobs. `--reset` is rejected for that dataset. Both profiles can coexist (256 total jobs). For local Python development, use the same arguments with `(cd backend && .venv/bin/python -m app.seed --dataset compiler-comparison-v1)` after migrations.

Open the [local jobs list on the experiment date](http://localhost:5173/?submitted_from=2026-10-12&submitted_to=2026-10-12). References follow `EXP-{workload number}-{BASELINE|CANDIDATE}-{repetition}`, with workload numbers matching table order above. Search exact references such as:

- `EXP-1-BASELINE-1` and `EXP-1-CANDIDATE-1` for resource improvement.
- `EXP-2-CANDIDATE-1` for compilation failure with no execution evidence.
- `EXP-3-BASELINE-1` and `EXP-3-CANDIDATE-1` for slower execution.
- `EXP-4-BASELINE-1` and `EXP-4-CANDIDATE-1` for the unchanged control.

Open a job and inspect the existing five metadata/evidence groups. Expand **Submission specification** under Target and configuration to inspect experiment, workload, input, pair and intended-difference records. The API search is `GET /jobs?q=EXP-2-CANDIDATE-1`; follow the returned ID with `GET /jobs/{id}` for complete evidence. The experiment comparison and overview now expose these records in the frontend. The static browser build includes a read-only export of this seed and its timelines; it never seeds a database or runs the CLI.

## Verification

The PostgreSQL suite in `backend/tests/test_experiment_seed.py` checks intended comparison medians/sample counts, controlled settings/identities, API history and timestamp agreement, unavailable execution evidence for failed compilation, exact repeat/reset snapshots, preservation of the original demo, active delete guards, collision/dependency refusal, and reset rollback. Tests use migrated disposable PostgreSQL schemas. See [progress.md](progress.md) for checks actually run.
