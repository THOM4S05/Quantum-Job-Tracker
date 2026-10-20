# Experiment comparisons

Question: what changed for a workload under the candidate compiler version compared with the baseline? All evidence is synthetic. Comparisons are descriptive, not claims about real compiler performance. Queue time can change with operational conditions, scheduling and provider load, independently of compiler changes.

## Matching policy

Choose one experiment UUID and two distinct compiler-version strings. Only that experiment's runs for those versions are selected; other/missing compiler versions are reported separately. Version options are scoped to the experiment. Repeated jobs are observations, not assumed pairwise statistical measurements.

A logical workload uses its recorded `specification.workload.key`, falling back to program name. Within it, an exact comparison group requires equality of program name/revision, input JSON, source language, provider, target, requested shots, compiler name, optimisation settings, simulation version and additional submission settings. Canonical JSON compares object key order independently; array order, value types and values matter. Compiler version is excluded from this identity as the intended variable. Outcome status, estimates, timings, IDs, repetition/arm labels, actors, submission timestamps, and simulation seed are not compilation settings and do not enter the key.

Inputs must be explicitly recorded in `specification.workload.inputs` (including an explicitly empty object); missing inputs are not treated as empty. All identity fields must be known. Recorded workload revision/shots that contradict metadata are flagged as inconsistent. Extra specification fields outside `synthetic`, `seed_dataset`, `experiment`, `workload`, `run`, `comparison`, and `shots` are compared conservatively as additional settings. Extra workload fields beyond `id`, `key`, `name`, `program_revision`, and `inputs` are also settings. Workload IDs/names are labels, not proof of matching inputs.

Different configurations within a logical workload produce separate rows with the differing field names shown. An exact subgroup present in both arms can be compared even when other subgroups differ; this is explicitly flagged. A subgroup in only one arm is unmatched and receives no deltas. Unknown or contradictory matching fields produce an **unverifiable** row with no deltas, even when both arms contain the same null fields. Missing workload identity is isolated per job rather than pooled. A different logical workload is shown as unmatched, never silently aligned by position. All selected jobs appear in exactly one row and remain inspectable.

## Outcomes, samples and changes

Use the existing [overview definitions](metrics.md) for completed compilation/execution attempts, rates, and excluded pending/cancelled/not-started/unknown jobs. Show all run counts and both completed-attempt counts. Timings and estimates have their own observation counts; they are separate from outcome denominators.

- Compilation duration: median recorded compilation-start to compilation-finish for completed compilation outcomes, including explicit compilation failures. Missing endpoints and cancelled/pending attempts are excluded.
- Queue time: median queue-entry to execution-start, including any job that started execution and has both timestamps.
- Execution duration: median start to finish for completed successful or failed executions, with both endpoints. Failures are not silently dropped.
- Resource values: medians of available estimated logical qubits, circuit depth and gate-count snapshots across all runs in the subgroup, regardless of final outcome. These are estimates, not observed execution results. Unknown values are excluded and sample counts are shown.
- Absolute change = candidate − baseline. Rates use **percentage points (pp)**; duration changes use seconds (s); other changes use the metric's count unit.
- Relative percentage change = 100 × (candidate − baseline) / baseline for non-rate metrics with a nonzero baseline. Zero baselines and missing values have no percentage change. Rates show percentage-point differences only. Unmatched/unverifiable rows have no deltas.
- No eligible observations displays **Not enough data**. A real zero is preserved. Single observations are allowed and labelled. Medians are descriptive: no statistical significance, causality or automatic performance verdict is claimed.

## API, navigation and limits

`GET /comparisons?experiment={uuid}&baseline={version}&candidate={version}` returns options, selection state, excluded-version counts, configuration groups, side-specific run/outcome counts, metrics with samples/deltas, and job references. Omitting a selection returns options without inventing a default comparison. Same-version comparisons and invalid/unknown query shapes return 422. Data/options share one repeatable-read PostgreSQL snapshot; the initial implementation groups the whole selected experiment in memory for this small portfolio dataset.

React uses `?view=comparison&experiment=…&baseline=…&candidate=…`. Expand a group's baseline/candidate jobs to open a recorded timeline; **Back to comparison** restores the exact choices. Reload and browser Back/Forward preserve choices. Static browser sample jobs currently have no named experiment membership, so that source shows an honest empty selection state rather than backend comparison data. Use the local PostgreSQL application and optional experiment seed to try the workflow. No schema change, worker, mutation, real compiler or hardware SDK is added.
