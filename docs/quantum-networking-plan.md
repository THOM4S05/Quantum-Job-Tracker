# Quantum networking tracking: implementation handoff

Prepared 4 November 2026. This is a proposed implementation plan, not an implemented feature or a description of Horizon Quantum's internal systems.

## Purpose and user story

Extend Quantum Job Tracker so a user can inspect one synthetic calculation executed across two quantum computers connected by an entanglement link. The user should be able to answer: did this run fail on a machine, while establishing entanglement, or during the remote operation?

Anish encouraged adding quantum networking to the mock tracker. He did not specify its design and explicitly could not discuss HQ's internal networking. His earlier priorities were experiment comparison and operational monitoring. General design advice from him can refine this plan; implementation need not depend on access to internal information.

## Confirmed scope decisions

- The user confirmed delivery in both the public browser demo and the local FastAPI/PostgreSQL application, using the same data contract and deterministic fixtures.
- The user confirmed two synthetic machines, one link, and success/entanglement-timeout scenarios. Model one remote entangling operation for this first example.
- These choices are settled; do not ask the user to confirm them again.

## Model: one source job, machine-specific execution parts

Preserve the existing top-level job as one submitted execution attempt. Its immutable specification holds the shared source program identity/revision and inputs. For a networked job, add a one-to-one networking extension and machine-specific execution parts. Do not select unrelated jobs and group them after execution.

```text
Existing job: shared source specification + overall execution attempt
└── Networking extension (same job ID)
    ├── Execution part A → synthetic QPU A
    ├── Execution part B → synthetic QPU B
    ├── Link A–B
    └── Entanglement and remote-operation events
```

An execution part is not another top-level job. This avoids double-counting and keeps the existing job list and outcome denominators meaningful. A run is the execution attempt represented by the existing job row; do not create a redundant independent run lifecycle. If the same source is executed again, it gets a new job/attempt with matching source identity. Do not reuse `retry_of` or `original_job_id` for part membership; those fields already mean retry lineage.

Proposed additive records (final names may follow repository conventions):

- `networked_runs`: job ID as primary/foreign key; execution method `entanglement_network`; schema/plan version and synthetic provenance. Overall status remains on `jobs`.
- `execution_parts`: ID, parent job ID, part label, provider, target, assigned role/qubit identifiers, status and recorded timestamps; optional explicit failure code/message. Give pending/blocked parts appropriate states rather than forcing the top-level job state machine onto them.
- `quantum_links`: ID, parent job ID, endpoint part IDs and channel type. Endpoints must be distinct parts belonging to that same parent.
- Reuse append-only `job_events` for the combined timeline. Define validated networking payloads inside `details`, including event kind, part/link ID, operation ID and entanglement attempt/resource ID where applicable.

Treat the link as connectivity, and entangled pairs as generated resources that operations consume. A permanently "entangled" link is misleading. Derive display states such as waiting/ready/consumed/timeout from the relevant attempt's events. The first version needs no inventory of many simultaneous pairs.

## Event and failure semantics

Keep the current parent lifecycle and major stages: submission, compilation, queueing, execution and cancellation. Networking activity in these fixtures occurs within execution; `waiting for entanglement` is an execution substate, not a new parent status. Future compilation/mapping or reservation failures can remain in their actual stages.

Success fixture:

1. Submit the source job; compile a recorded two-part execution plan.
2. Enter/leave the execution queue; both parts start local preparation.
3. Request shared entanglement for a named remote operation.
4. Record an unsuccessful attempt, then a successful attempt producing a pair.
5. Start and complete the remote operation using that pair.
6. Finish local work, record final output, and complete the parent job.

Timeout fixture:

1. Reach the same entanglement request after local preparation.
2. Record failed attempts, followed by the recorded deadline expiring.
3. Fail the parent at stage `execution`, with `ENTANGLEMENT_TIMEOUT` and affected link/operation identifiers.
4. Record the parts' stopped/aborted outcomes explicitly. Neither computer needs to have a hardware fault; label the cause as coordination failure rather than inventing two device failures.

An unsuccessful entanglement attempt is not automatically a failed job. Success requires required parts and the remote operation to complete, consumed entanglement to have been generated, and a recorded final output. A timeout cannot have a completed remote operation or final successful result.

Use job sequence numbers as the authoritative timeline order, including events with identical timestamps. Label this as synthetic recorded order, not a claim about global physical event ordering. Missing or inconsistent evidence should be visible; never infer root causes from absent events.

## First user interface

Integrate into Jobs and Job details before adding a new main navigation section.

- Mark networked jobs clearly in the list; optionally add an execution-method filter.
- Keep one shared Program and compiler section. Show a synthetic distributed target at parent level and actual per-part provider/target labels below; do not imply the parent has only one physical QPU.
- Add a Network execution section to details: two machine cards, one connecting link, overall outcome and accessible text describing the diagram.
- Show each part's recorded status/timings and a combined timeline with machine/link labels. Selecting a machine or link may filter/highlight its events; always allow return to the full timeline.
- Show an explicit failure panel with the recorded cause, affected link and supporting event. Provide links to the success and timeout fixtures.
- Preserve existing deep links, query filters, browser Back/Forward, polling, stale/error states and mobile layout. Ordinary job details remain supported without networking records.
- Explain the example and its limits in Demo & Guide: historical synthetic tracking, no hardware connection, physical network simulation, real entanglement generation or claim of quantum advantage.

## Metrics and comparisons

Initially show metrics on the networked job's details; extend Overview after those semantics work.

- Elapsed execution time: recorded parent execution end minus start; do not sum overlapping parts.
- Entanglement waiting time: recorded readiness minus request on success. For timeout, show elapsed wait with a timeout label, not a successful generation latency.
- Attempts and successes: derive from explicit completed attempt outcomes, excluding missing/in-progress observations from the success denominator. Show numerator/denominator.
- Remote-operation duration: end minus start only when both endpoints exist. Unknown is unavailable, not zero.
- Defer fidelity, distance, qubit counts and QPU usage summaries unless the fixture has explicit definitions and evidence. Do not sum logical qubits as a claim of equivalent computing capability or call wall-clock part duration billable QPU time.

Overview continues counting parent jobs only. A network failure contributes one execution failure; detailed cause can be a breakdown. Keep any entanglement-attempt rate separate from job success rate. Compiler comparisons must include execution method, plan/topology and relevant network configuration in compatibility identity, or explicitly exclude networked jobs with an explanation until supported. Do not compare local and networked runs silently as a compiler-only change.

## Implementation sequence

1. Re-read repository instructions and current code; confirm scope choices. Define typed DTOs, event payloads, sample timelines, invariants and UI labels before building screens.
2. Add an additive Alembic migration and relational constraints, preserving existing data and guards. Implement atomic writes that update part state and append parent events in the same transaction under the parent lock. Extend terminal protection to related records; creating fixtures must populate the extension before making the parent terminal.
3. Add a deterministic, idempotent optional seed profile for the two examples. Use the existing transition/progress functions and preserve job version/history agreement. No live worker or submission endpoint is required for this historical tracking milestone.
4. Extend the read-only details API with nullable networking evidence, loaded in the same consistent database snapshot as the job/history. Use the same contract in the browser adapter. Export validated backend fixtures to a bundled networking snapshot rather than independently inventing browser outcomes. Old saved personal jobs remain valid.
5. Build the details section, list discovery and guide journey. Keep generation of user-configurable network runs for a later milestone.
6. Add carefully scoped Overview breakdowns and comparison compatibility handling. Verify all existing single-machine behavior.

Relevant existing code: `backend/app/models.py`, `transitions.py`, `job_details.py`, `job_list.py`, `overview.py`, `comparisons.py`, `cohorts.py`, seed/export modules, `backend/migrations/versions/`; `frontend/src/App.tsx`, `JobDetails.tsx`, `demo.ts`, `Overview.tsx`, comparison modules, `Guide.tsx`, and snapshot data. `frontend/src/api.ts` already selects the live API or browser adapter. Inspect current implementations rather than treating planned worker features in architecture documentation as shipped code.

## Acceptance and verification

- One source job appears once in Jobs/Overview; two parts share its specification and have independent recorded evidence.
- Success visibly requires entanglement before the remote operation; a pair is consumed once.
- Timeout identifies the link, preserves completed local activity and has no fabricated final result or runtime endpoints.
- Parent and related writes roll back together; cross-parent endpoints/events, invalid resource consumption and mutations after parent completion are rejected.
- Existing 256 bundled records, personal browser storage, retry lineage, compiler comparison journey and job history validation remain compatible. New fixture counts are documented explicitly.
- Backend and browser examples agree on IDs, event order, outcomes, durations and missing-data behavior.
- Add meaningful domain/API/PostgreSQL tests for the above; React tests for the two scenarios, absent/incomplete evidence and ordinary jobs; a browser journey through both examples, direct reload and return navigation. Check responsive and accessible presentation.
- Run the existing frontend tests and both builds; run backend tests with real PostgreSQL when available and report skipped database coverage honestly. Extend existing journey checks where needed. Do not publish or deploy as part of this implementation unless separately authorized.

## Optional questions for Anish

Ask one short question first:

> I'm planning one source job split across two quantum computers, with a timeline showing entanglement attempts and a remote operation. Would a success vs entanglement-timeout example be a useful first version?

If he wants to advise further:

> For monitoring or comparing these runs, which matters most: entanglement waiting time, link failures, or time spent on each machine?

These ask about the mock project's usefulness and do not request HQ architecture, confidential metrics or implementation details.

## Prompt for a new chat

Read `docs/quantum-networking-plan.md` and applicable repository instructions. Implement the agreed first milestone of synthetic quantum-network tracking in the existing Quantum Job Tracker. Preserve one existing top-level source job/execution attempt; add machine-specific execution parts and link/entanglement evidence, not unrelated child top-level jobs. Follow the documented contract, deterministic fixtures, lifecycle invariants and verification requirements. Confirm any unanswered scope choices from this plan, then work through the implementation and validation. Do not deploy. Clearly distinguish shipped behavior from later milestones.
