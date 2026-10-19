"""Repeatable historical fixtures; this is not a quantum execution worker."""

import argparse
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid5

from sqlalchemy import Connection, func, select, text

from app.config import Settings
from app.database import make_engine
from app.models import jobs
from app.transitions import create_job, record_progress, transition_job
from app.workload_metadata import synthetic_metadata

DATASET = "qtrace-demo-v1"
NAMESPACE = UUID("7bc311ed-855e-4a70-8f14-080e07f0bbd0")
PROVIDERS = ("Synthetic Aurora Labs", "Synthetic Nebula Works", "Synthetic Quasar Forge")
BASE_TIME = datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc)


def seed_jobs(connection: Connection) -> dict[str, int]:
    """Insert missing fixtures in one caller transaction; never reset other jobs.

    Fixed UUIDs, timestamps and formula-derived outcomes make reruns identical.
    A transaction-scoped advisory lock serializes concurrent seed invocations.
    """
    if not connection.in_transaction():
        raise RuntimeError("Seed within engine.begin()")
    connection.execute(text("SELECT pg_advisory_xact_lock(735120026)"))
    inserted = skipped = 0
    for index in range(200):
        job_id = uuid5(NAMESPACE, f"{DATASET}:{index}")
        existing = connection.execute(select(jobs).where(jobs.c.id == job_id)).mappings().one_or_none()
        if existing is not None:
            if existing["specification"].get("seed_dataset") != DATASET:
                raise ValueError("Seed ID collides with unrelated data; no changes committed")
            skipped += 1
            continue
        created = BASE_TIME + timedelta(minutes=index * 7)
        # Every ten jobs have four successes and one of each other outcome
        bucket = index % 10
        scenario = (
            "success" if bucket < 4 else
            "compilation_failure" if bucket == 4 else
            "queueing_failure" if bucket == 5 else
            "execution_failure" if bucket == 6 else
            "queued" if bucket == 7 else
            "running" if bucket == 8 else "cancelled"
        )
        correlation = uuid5(job_id, "seed-correlation")
        create_job(connection, job_id=job_id, name=f"Synthetic experiment {index + 1:03d}",
                   provider=PROVIDERS[index % 3], target=f"simulator-{8 + (index % 4) * 8}q",
                   requested_by=("demo.operator.alex", "demo.operator.sam")[index % 2],
                   scenario=scenario, seed=10000 + index, simulation_version="v1",
                   external_reference=f"SYN-{index + 1:04d}",
                   metadata=synthetic_metadata(index, f"Synthetic experiment {index + 1:03d}", scenario, created),
                   specification={"seed_dataset": DATASET, "qubits": 8 + (index % 4) * 8,
                                  "shots": 1024, "synthetic": True},
                   correlation_id=correlation, at=created)
        common = {"actor": "synthetic-seeder", "correlation_id": correlation}
        if scenario == "queued":
            inserted += 1
            continue
        if scenario == "cancelled":
            transition_job(connection, job_id, "cancelled", stage="cancellation",
                           message="Synthetic job cancelled before compilation",
                           at=created + timedelta(seconds=1), **common)
            inserted += 1
            continue
        transition_job(connection, job_id, "running", stage="compilation",
                       message="Synthetic compilation started", at=created + timedelta(seconds=1), **common)
        for step, stage in enumerate(("compilation", "queueing", "execution"), start=2):
            at = created + timedelta(seconds=step)
            if scenario == f"{stage}_failure":
                transition_job(connection, job_id, "failed", stage=stage,
                               message=f"Simulated {stage} failure", error_code=f"SYNTHETIC_{stage.upper()}_FAILED",
                               error_message=f"Fictional provider reported a synthetic {stage} failure",
                               details={"synthetic": True, "retryable": True}, at=at, **common)
                break
            record_progress(connection, job_id, stage=stage,
                            message=f"Synthetic {stage} checkpoint", details={"step": step, "synthetic": True},
                            at=at, **common)
        else:
            # Only run this if no stage failed and stopped the loop
            if scenario == "success":
                transition_job(connection, job_id, "succeeded", stage="execution",
                               message="Synthetic execution completed",
                               result={"synthetic": True, "shots": 1024,
                                       "counts": {"00": 500 + index % 25, "11": 524 - index % 25}},
                               at=created + timedelta(seconds=5), **common)
        inserted += 1
    return {"inserted": inserted, "skipped": skipped}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", choices=(DATASET, "compiler-comparison-v1"), default=DATASET)
    parser.add_argument("--reset", action="store_true", help="Replace only the compiler comparison fixtures")
    args = parser.parse_args()
    if args.reset and args.dataset != "compiler-comparison-v1":
        parser.error("--reset requires --dataset compiler-comparison-v1; historical demo jobs are preserved")
    engine = make_engine(Settings())
    try:
        with engine.begin() as connection:
            if args.dataset == "compiler-comparison-v1":
                from app.experiment_seed import comparison_report, seed_experiment
                summary = seed_experiment(connection, reset=args.reset)
                summary["comparison"] = comparison_report(connection)
            else:
                summary = seed_jobs(connection)
            summary["total_jobs"] = connection.scalar(select(func.count()).select_from(jobs))
        print(json.dumps(summary, sort_keys=True))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
