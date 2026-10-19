# Operational overview metric definitions

All observations are synthetic job records. These metrics describe the selected submission cohort, not real hardware, compiler quality or service-level guarantees. Definitions were established before implementing the overview.

## Cohort and filters

`GET /overview` and the jobs list share exact target, compiler-version and experiment-ID filters plus inclusive UTC submission dates (`submitted_from`, `submitted_to`). The range selects jobs by `jobs.created_at`, from UTC midnight through the exclusive midnight after the end date. Phase events may occur outside that range and still contribute. Each retry is a distinct run. Missing compiler/experiment values do not match a selected value; no experiment means all jobs, including ungrouped jobs. Option lists come from all stored jobs so selections do not disappear as the cohort narrows.

## Attempts and schema adaptation

The schema has one status per job; `running` covers compilation, provider queueing and execution. There is no separate compilation outcome column. We use the nullable phase timestamps in `jobs.metadata` and the explicit terminal `jobs.error_stage`, without assuming that a final `failed` job failed compilation. No timestamp is reconstructed from submission, job finish, or generic event messages.

For success-rate metrics, jobs in `cancelled` or `cancel_requested` are excluded and counted as **cancelled or cancelling**. This conservative job-level exclusion also applies if a previous phase finished before cancellation. It keeps cancellation outside both denominators and is explicit rather than treating it as failure. Other jobs are classified per phase as follows:

| Phase | Successful attempt | Failed attempt | Pending | Not started / unknown |
| --- | --- | --- | --- | --- |
| Compilation | Recorded compilation finish timestamp, without explicit compilation failure; for terminal failed jobs, a known later failure stage (`queueing` or `execution`) is also required | Terminal `failed` with explicit `error_stage=compilation`, even if timestamps are missing | Nonterminal job with a compilation start but no finish | Queued with no start: not started. Other insufficient evidence: unknown |
| Execution | Terminal `succeeded` | Terminal `failed` with explicit `error_stage=execution` | Nonterminal job with execution start | No execution start: not started, unless terminal succeeded/failed execution supplies an outcome. Conflicting/insufficient terminal evidence: unknown |

Compilation success rate = successful compilations / (successful + failed compilation attempts). Execution success rate = successful executions / (successful + failed execution attempts). Only those completed attempts enter denominators. Pending, cancelled/cancelling, not-started and unknown counts are reported separately for each phase. A queueing failure with recorded compilation completion contributes a successful compilation and no execution attempt. Missing timing endpoints do not erase an explicitly recorded terminal execution outcome or compilation failure, but do exclude its duration sample. A terminal failed job with no failure stage cannot establish compilation success or failure from status alone.

## Timing samples

- **Median queue time**, seconds: `metadata.execution_started_at - metadata.queue_entered_at` for any job with both endpoints, including running or subsequently cancelled jobs that started execution. This deliberately uses execution start, not `queue_left_at`. Missing endpoints or negative intervals are excluded. The sample count and excluded-cohort count are returned.
- **Median execution duration**, seconds: `metadata.execution_finished_at - metadata.execution_started_at` for completed execution attempts (the successful/failed outcomes above), with both endpoints and a nonnegative interval. Execution failures are included; pending and cancelled attempts are excluded. Missing endpoints are excluded rather than replaced by `finished_at`. The sample count and excluded-cohort count are returned.
- Medians use the middle sorted value, or the mean of the two middle values for even samples. Real zero-second intervals are valid. With zero eligible observations, return null and display **Not enough data**; likewise for a rate with zero completed attempts. A single recorded observation is eligible and labelled `n=1`.

## Breakdowns and drill-down

**Failures by stage** counts terminal failed jobs by explicit `error_stage` (`compilation`, `queueing`, `execution`, or `unknown`). It counts jobs, not repeated error events. **Jobs by target** counts all jobs in the selected cohort by canonical `jobs.target`, irrespective of status. Both charts show counts and link to the jobs list preserving the cohort. Failure links add `status=failed` and `failure_stage`; target links set `target`. List/details navigation preserves these filters. Counts of zero are valid breakdown counts; an empty cohort has an explicit empty message.

The API calculates the whole cohort in one PostgreSQL repeatable-read snapshot, never just a list page. This initial portfolio-scale implementation reads the selected job snapshots into the API process; SQL/precomputed aggregation should replace this before large production datasets. There is no new worker or metrics service. The independent browser demo computes the same definitions from its own recorded browser data and labels that source clearly; it never implies access to PostgreSQL.
