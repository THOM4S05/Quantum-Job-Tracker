"""Fixed historical compiler experiment, using the existing atomic job writes.

This module does not execute programs or contact compilers/providers. Changing the
scenario recipe requires a new dataset version, rather than rewriting evidence.
"""

import hashlib
import json
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import median
from uuid import UUID, uuid5

from sqlalchemy import Connection, delete, or_, select, text

from app.models import job_events, jobs
from app.transitions import create_job, record_progress, transition_job
from app.workload_metadata import WorkloadMetadata

DATASET = "compiler-comparison-v1"
SEED = 20261017
REPEATS = 7
NAMESPACE = UUID("681366db-bfe6-4f17-8267-524c8966dc75")
EXPERIMENT_ID = str(uuid5(NAMESPACE, DATASET))
BASE_TIME = datetime(2026, 10, 12, 9, tzinfo=timezone.utc)
VERSIONS = {"baseline": "synthetic-1.0.0", "candidate": "synthetic-1.1.0"}


@dataclass(frozen=True)
class Workload:
    key: str
    name: str
    inputs: dict
    estimates: tuple[int, int, int]
    difference: str


WORKLOADS = (
    Workload("resource-gain", "Synthetic resource reduction", {"width": 32, "layers": 12},
             (32, 240, 1600), "Candidate estimates: 24 logical qubits, depth 168, 1120 gates; timings unchanged."),
    Workload("compile-regression", "Synthetic compilation regression", {"width": 16, "layers": 8},
             (16, 180, 900), "Candidate fails compilation; estimates, queue and execution evidence unavailable."),
    Workload("execution-slowdown", "Synthetic execution slowdown", {"width": 24, "layers": 10},
             (24, 210, 1200), "Candidate execution duration increases by 8 seconds in each paired repetition."),
    Workload("unchanged", "Synthetic unchanged control", {"width": 8, "layers": 6},
             (8, 120, 600), "No resource or duration change in paired repetitions."),
)


def _digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def experiment_plans() -> list[dict]:
    """Pair identical inputs/settings and deterministic timing variation by repeat."""
    plans = []
    for workload_index, workload in enumerate(WORKLOADS):
        jitter = [-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5]
        random.Random(f"{SEED}:{workload.key}").shuffle(jitter)
        program_revision = "sha256:" + _digest({"program": workload.key, "revision": "synthetic-r1"})
        workload_identity = {"program_revision": program_revision, "inputs": workload.inputs}
        workload_id = str(uuid5(NAMESPACE, _digest(workload_identity)))
        for repeat, variation in enumerate(jitter, start=1):
            for arm_index, (arm, compiler_version) in enumerate(VERSIONS.items()):
                run_key = f"{DATASET}:{SEED}:{workload.key}:{arm}:{repeat}"
                job_id = uuid5(NAMESPACE, run_key)
                created = BASE_TIME + timedelta(minutes=workload_index * 60 + repeat * 2 + arm_index)
                failed = workload.key == "compile-regression" and arm == "candidate"
                estimates = (None, None, None) if failed else (
                    (24, 168, 1120) if workload.key == "resource-gain" and arm == "candidate" else workload.estimates)
                compile_start = created + timedelta(seconds=1)
                compile_end = compile_start + timedelta(seconds=4 + variation / 2)
                queue_end = None if failed else compile_end + timedelta(seconds=2)
                execution_end = None if failed else queue_end + timedelta(
                    seconds=10 + variation + (8 if workload.key == "execution-slowdown" and arm == "candidate" else 0))
                metadata = WorkloadMetadata(
                    program_name=workload.name, program_revision=program_revision,
                    source_language="Synthetic QASM-like", compiler_name="Synthetic Comparison Compiler",
                    compiler_version=compiler_version,
                    optimisation_settings={"level": 2, "routing": "synthetic-fixed"}, requested_shots=1024,
                    estimated_logical_qubits=estimates[0], estimated_circuit_depth=estimates[1],
                    estimated_gate_count=estimates[2], compilation_started_at=compile_start,
                    compilation_finished_at=compile_end, queue_entered_at=None if failed else compile_end,
                    queue_left_at=queue_end, execution_started_at=queue_end, execution_finished_at=execution_end,
                )
                specification = {
                    "synthetic": True, "seed_dataset": DATASET,
                    "experiment": {"id": EXPERIMENT_ID, "name": "Synthetic compiler comparison v1", "seed": SEED},
                    "workload": {"id": workload_id, "key": workload.key, "name": workload.name, **workload_identity},
                    "run": {"arm": arm, "repetition": repeat, "paired_run_key": f"{workload_id}:{repeat}"},
                    "comparison": {"changed_configuration_fields": ["metadata.compiler_version"],
                                   "intended_difference": workload.difference},
                    "shots": 1024,
                }
                plans.append(dict(id=job_id, name=f"{workload.name} / {arm} / {repeat}",
                                  external_reference=f"EXP-{workload_index + 1}-{arm.upper()}-{repeat}",
                                  created_at=created, metadata=metadata, specification=specification,
                                  scenario="compilation_failure" if failed else "success"))
    return plans


def _reset(connection: Connection, plans: list[dict]) -> int:
    """Administrative, scoped fixture replacement; caller savepoint makes DDL atomic.

    Exclusive table locks prevent concurrent writes while the two delete guards
    are suspended. Foreign keys/constraints remain enabled. No cascade is used.
    """
    connection.execute(text("LOCK TABLE jobs, job_events IN ACCESS EXCLUSIVE MODE"))
    ids = [plan["id"] for plan in plans]
    owned = connection.execute(select(jobs).where(or_(
        jobs.c.id.in_(ids), jobs.c.specification["seed_dataset"].astext == DATASET))).mappings().all()
    if any(row["id"] not in ids or row["specification"].get("seed_dataset") != DATASET for row in owned):
        raise ValueError("Dataset identity collision; reset refused")
    dependent = connection.scalar(select(jobs.c.id).where(
        ~jobs.c.id.in_(ids), or_(jobs.c.retry_of.in_(ids), jobs.c.original_job_id.in_(ids))).limit(1))
    if dependent is not None:
        raise ValueError("Unrelated jobs reference this experiment; reset refused")
    connection.execute(text("ALTER TABLE job_events DISABLE TRIGGER guard_event_write"))
    connection.execute(text("ALTER TABLE jobs DISABLE TRIGGER guard_job_write"))
    connection.execute(delete(job_events).where(job_events.c.job_id.in_(ids)))
    connection.execute(delete(jobs).where(jobs.c.id.in_(ids)))
    connection.execute(text("ALTER TABLE jobs ENABLE TRIGGER guard_job_write"))
    connection.execute(text("ALTER TABLE job_events ENABLE TRIGGER guard_event_write"))
    return len(owned)


def seed_experiment(connection: Connection, *, reset: bool = False) -> dict:
    if not connection.in_transaction():
        raise RuntimeError("Seed within engine.begin()")
    # Share the historical seed lock, including reset/reseed operations.
    connection.execute(text("SELECT pg_advisory_xact_lock(735120026)"))
    plans = experiment_plans()
    inserted = skipped = 0
    with connection.begin_nested():
        removed = _reset(connection, plans) if reset else 0
        for plan in plans:
            existing = connection.execute(select(jobs).where(jobs.c.id == plan["id"])).mappings().one_or_none()
            if existing is not None:
                if (existing["specification"] != plan["specification"]
                        or existing["metadata"] != plan["metadata"].model_dump(mode="json")
                        or existing["status"] != ("failed" if plan["scenario"] == "compilation_failure" else "succeeded")):
                    raise ValueError("Experiment fixture differs from recipe; use the scoped --reset command")
                skipped += 1
                continue
            _insert_run(connection, plan)
            inserted += 1
    return {"dataset": DATASET, "synthetic": True, "seed": SEED,
            "inserted": inserted, "skipped": skipped, "removed": removed}


def _insert_run(connection: Connection, plan: dict) -> None:
    metadata = plan["metadata"]
    correlation = uuid5(plan["id"], "correlation")
    create_job(connection, job_id=plan["id"], name=plan["name"], provider="Synthetic Aurora Labs",
               target="synthetic-comparison-simulator", requested_by="synthetic.experiment.operator",
               scenario=plan["scenario"], seed=SEED, simulation_version=DATASET,
               external_reference=plan["external_reference"], metadata=metadata,
               specification=plan["specification"], correlation_id=correlation, at=plan["created_at"])
    common = {"actor": "synthetic-experiment-seeder", "correlation_id": correlation,
              "details": {"synthetic": True, "experiment_id": EXPERIMENT_ID,
                          "workload_id": plan["specification"]["workload"]["id"],
                          **plan["specification"]["run"]}}
    transition_job(connection, plan["id"], "running", stage="compilation",
                   message="Synthetic compilation started", at=metadata.compilation_started_at, **common)
    if plan["scenario"] == "compilation_failure":
        transition_job(connection, plan["id"], "failed", stage="compilation",
                       message="Synthetic candidate compilation failed; execution was not attempted",
                       error_code="SYNTHETIC_CANDIDATE_COMPILE_FAILED",
                       error_message="The synthetic candidate fixture rejects this workload during compilation.",
                       at=metadata.compilation_finished_at, **common)
        return
    record_progress(connection, plan["id"], stage="compilation", message="Synthetic compilation completed",
                    at=metadata.compilation_finished_at, **common)
    record_progress(connection, plan["id"], stage="queueing", message="Synthetic provider queue entered",
                    at=metadata.queue_entered_at, **common)
    record_progress(connection, plan["id"], stage="execution", message="Synthetic queue left; execution started",
                    at=metadata.execution_started_at, **common)
    transition_job(connection, plan["id"], "succeeded", stage="execution",
                   message="Synthetic execution completed",
                   result={"synthetic": True, "shots": 1024, "counts": {"00": 512, "11": 512}},
                   at=metadata.execution_finished_at, **common)


def comparison_report(connection: Connection) -> dict:
    """Summarize stored observations, excluding unavailable values from medians."""
    rows = connection.execute(select(jobs).where(jobs.c.specification["seed_dataset"].astext == DATASET)
                              .order_by(jobs.c.id)).mappings().all()
    ids = [row["id"] for row in rows]
    events = connection.execute(select(job_events).where(job_events.c.job_id.in_(ids))
                                .order_by(job_events.c.job_id, job_events.c.sequence)).mappings().all()
    groups = []
    for workload in WORKLOADS:
        for arm in VERSIONS:
            group = [row for row in rows if row["specification"]["workload"]["key"] == workload.key
                     and row["specification"]["run"]["arm"] == arm]
            snapshots = [WorkloadMetadata.model_validate(row["metadata"]) for row in group]
            def middle(values):
                known = [value for value in values if value is not None]
                return median(known) if known else None
            groups.append({"workload": workload.key, "arm": arm, "runs": len(group),
                           "succeeded": sum(row["status"] == "succeeded" for row in group),
                           "failed": sum(row["status"] == "failed" for row in group),
                           "execution_samples": sum(item.execution_finished_at is not None for item in snapshots),
                           "median_estimated_logical_qubits": middle([item.estimated_logical_qubits for item in snapshots]),
                           "median_estimated_circuit_depth": middle([item.estimated_circuit_depth for item in snapshots]),
                           "median_estimated_gate_count": middle([item.estimated_gate_count for item in snapshots]),
                           **{f"median_{key}": middle([item.durations().model_dump()[key] for item in snapshots])
                              for key in ("compilation_seconds", "queue_seconds", "execution_seconds")}})
    # Include every persisted field/event, not just aggregate outcomes, in the digest.
    snapshot = json.loads(json.dumps({"jobs": [dict(row) for row in rows],
                                     "events": [dict(event) for event in events]}, default=str))
    return {"synthetic": True, "jobs": len(rows), "events": len(events),
            "snapshot_sha256": _digest(snapshot), "groups": groups}
