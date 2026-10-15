from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Event
from uuid import uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import func, insert, inspect, select, update
from sqlalchemy.exc import IntegrityError

from app.database import metadata
from app.models import job_events, jobs
from app.seed import DATASET, PROVIDERS, seed_jobs
from app.transitions import (
    InvalidTransition, VersionConflict, create_job, record_progress, transition_job,
)

pytestmark = pytest.mark.postgres
AT = datetime(2026, 10, 1, tzinfo=timezone.utc)


def new_job(db, **kwargs):
    return create_job(db, name="Test synthetic job", provider="Synthetic Aurora Labs",
                      target="simulator-8q", requested_by="test.operator", scenario="success",
                      seed=42, at=AT, **kwargs)


def move(db, job, target, **kwargs):
    options = dict(stage="compilation" if target == "running" else "execution",
                   message="Synthetic test transition", actor="test.operator",
                   correlation_id=uuid4(), at=AT + timedelta(seconds=job["version"]))
    if target == "failed":
        options.update(error_code="SYNTHETIC_FAILURE", error_message="Synthetic failure")
    elif target == "succeeded":
        options["result"] = {"synthetic": True}
    elif target in {"cancel_requested", "cancelled"}:
        options["stage"] = "cancellation"
    options.update(kwargs)
    return transition_job(db, job["id"], target, **options)


def reach(db, status):
    job = new_job(db)
    if status != "queued":
        if status == "cancelled":
            return move(db, job, status)
        job = move(db, job, "running")
        if status != "running":
            job = move(db, job, status)
    return job


# Independent expectations from the documented lifecycle, not the service map.
STATES = ("queued", "running", "cancel_requested", "succeeded", "failed", "cancelled")
ALLOWED_PAIRS = {
    ("queued", "running"), ("queued", "cancelled"),
    ("running", "succeeded"), ("running", "failed"), ("running", "cancel_requested"),
    ("cancel_requested", "cancelled"),
}
PAIRS = [(source, target) for source in STATES for target in STATES]


@pytest.mark.parametrize("source,target", PAIRS)
def test_transition_matrix(db, source, target):
    job = reach(db, source)
    before = list(db.execute(select(job_events).where(job_events.c.job_id == job["id"])))
    if (source, target) in ALLOWED_PAIRS:
        changed = move(db, job, target)
        assert changed["status"] == target
        assert changed["version"] == job["version"] + 1
        events = db.execute(select(job_events).where(job_events.c.job_id == job["id"])
                            .order_by(job_events.c.sequence)).mappings().all()
        assert len(events) == len(before) + 1
        assert events[-1]["from_status"] == source
        assert events[-1]["to_status"] == target
        assert events[-1]["sequence"] == changed["version"]
        assert events[-1]["occurred_at"] == changed["updated_at"]
    else:
        with pytest.raises(InvalidTransition):
            move(db, job, target)
        assert db.execute(select(jobs).where(jobs.c.id == job["id"])).mappings().one() == job
        assert list(db.execute(select(job_events).where(job_events.c.job_id == job["id"]))) == before


@pytest.mark.parametrize("status", ["succeeded", "failed", "cancelled"])
def test_database_rejects_direct_terminal_reactivation(db, status):
    job = reach(db, status)
    with pytest.raises(IntegrityError, match="Terminal jobs are immutable"):
        with db.begin_nested():
            db.execute(update(jobs).where(jobs.c.id == job["id"]).values(
                status="running", version=job["version"] + 1, finished_at=None))
    assert db.scalar(select(jobs.c.status).where(jobs.c.id == job["id"])) == status


def test_database_rejects_direct_invalid_transition(db):
    job = new_job(db)
    with pytest.raises(IntegrityError, match="Invalid job transition"):
        with db.begin_nested():
            db.execute(update(jobs).where(jobs.c.id == job["id"]).values(
                status="cancel_requested", version=2, started_at=AT))


def test_event_insert_failure_rolls_back_update_even_if_caught(db):
    job = new_job(db)
    # Whitespace-only messages violate a real database CHECK after the UPDATE.
    with pytest.raises(IntegrityError):
        move(db, job, "running", message=" ")
    assert db.execute(select(jobs).where(jobs.c.id == job["id"])).mappings().one() == job
    assert db.scalar(select(func.count()).select_from(job_events)) == 1
    assert move(db, job, "running")["version"] == 2


def test_outer_transaction_rollback_removes_job_and_events(postgres_engine):
    with pytest.raises(RuntimeError):
        with postgres_engine.begin() as connection:
            job = new_job(connection)
            move(connection, job, "running")
            raise RuntimeError("Simulated enclosing request failure")
    with postgres_engine.connect() as connection:
        assert connection.scalar(select(func.count()).select_from(jobs)) == 0
        assert connection.scalar(select(func.count()).select_from(job_events)) == 0


def test_unique_sequence_and_append_only_history(db):
    job = new_job(db)
    event = dict(db.execute(select(job_events)).mappings().one())
    event["id"] = uuid4()
    with pytest.raises(IntegrityError, match="uq_job_events_sequence"):
        with db.begin_nested():
            db.execute(insert(job_events).values(**event))
    with pytest.raises(IntegrityError, match="append-only"):
        with db.begin_nested():
            db.execute(update(job_events).values(message="Rewritten"))
    assert db.scalar(select(jobs.c.version).where(jobs.c.id == job["id"])) == 1


def test_stale_version_and_submission_immutability(db):
    job = new_job(db)
    running = move(db, job, "running")
    with pytest.raises(VersionConflict):
        move(db, running, "failed", expected_version=1)
    with pytest.raises(IntegrityError, match="Submission and lineage are immutable"):
        with db.begin_nested():
            db.execute(update(jobs).where(jobs.c.id == job["id"]).values(provider="Changed", version=3))


def test_progress_is_ordered_and_rejected_after_cancellation(db):
    job = reach(db, "running")
    updated = record_progress(db, job["id"], stage="queueing", message="Provider queue checkpoint",
                              actor="test.worker", correlation_id=uuid4(), at=AT + timedelta(seconds=2))
    assert updated["status"] == "running"
    assert updated["version"] == 3
    move(db, updated, "cancel_requested")
    with pytest.raises(InvalidTransition):
        record_progress(db, job["id"], stage="execution", message="Too late",
                        actor="test.worker", correlation_id=uuid4())


def snapshot(db):
    return (db.execute(select(jobs).order_by(jobs.c.id)).mappings().all(),
            db.execute(select(job_events).order_by(job_events.c.job_id, job_events.c.sequence)).mappings().all())


def test_seed_is_repeatable_and_histories_agree(db):
    unrelated = new_job(db)
    assert seed_jobs(db) == {"inserted": 200, "skipped": 0}
    first = snapshot(db)
    assert seed_jobs(db) == {"inserted": 0, "skipped": 200}
    assert snapshot(db) == first
    seeded = [j for j in first[0] if j["id"] != unrelated["id"]]
    assert len(seeded) == 200
    assert {j["provider"] for j in seeded} == set(PROVIDERS)
    assert {j["error_stage"] for j in seeded if j["status"] == "failed"} == {"compilation", "queueing", "execution"}
    assert sum(j["status"] == "succeeded" for j in seeded) == 80
    for job in seeded:
        events = [e for e in first[1] if e["job_id"] == job["id"]]
        assert job["specification"]["seed_dataset"] == DATASET
        assert [e["sequence"] for e in events] == list(range(1, len(events) + 1))
        assert events[0]["from_status"] is None
        assert events[0]["to_status"] == "queued"
        assert events[-1]["to_status"] == job["status"]
        assert events[-1]["sequence"] == job["version"]
        assert events[-1]["occurred_at"] == job["updated_at"]
        assert [e["occurred_at"] for e in events] == sorted(e["occurred_at"] for e in events)
        for previous, current in zip(events, events[1:]):
            assert current["from_status"] == previous["to_status"]
            assert current["from_status"] == current["to_status"] == "running" or (current["from_status"], current["to_status"]) in ALLOWED_PAIRS
        if job["status"] == "failed":
            assert events[-1]["stage"] == job["error_stage"]


def test_seed_determinism_on_fresh_runs(db):
    # Roll back only the fixture insertion, then compare a genuinely fresh run.
    with db.begin_nested() as savepoint:
        seed_jobs(db)
        first = snapshot(db)
        savepoint.rollback()
    seed_jobs(db)
    assert snapshot(db) == first


def test_migration_matches_models(db):
    context = MigrationContext.configure(db, opts={"compare_type": True})
    assert compare_metadata(context, metadata) == []


def test_migration_downgrade_and_upgrade(postgres_engine):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    with postgres_engine.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "0001_foundation")
        assert "jobs" not in inspect(connection).get_table_names()
        assert "job_events" not in inspect(connection).get_table_names()
        command.upgrade(config, "head")
        assert compare_metadata(MigrationContext.configure(connection), metadata) == []


def test_retry_reference_foreign_key(db):
    job = new_job(db)
    row = dict(job, id=uuid4(), retry_of=uuid4(), original_job_id=uuid4())
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.execute(insert(jobs).values(**row))


def test_reference_migration_preserves_seed_histories(postgres_engine):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    with postgres_engine.begin() as connection:
        seed_jobs(connection)
        before = snapshot(connection)
        config.attributes["connection"] = connection
        command.downgrade(config, "0002_jobs_and_events")
        command.upgrade(config, "head")
        assert snapshot(connection) == before
        assert connection.scalar(select(func.count()).select_from(jobs).where(jobs.c.external_reference.is_not(None))) == 200
        job = connection.execute(select(jobs).where(jobs.c.status == "running").limit(1)).mappings().one()
        with pytest.raises(IntegrityError, match="External references are immutable"):
            with connection.begin_nested():
                connection.execute(update(jobs).where(jobs.c.id == job["id"]).values(external_reference="Changed", version=job["version"] + 1))


@pytest.mark.parametrize("first_target", ["succeeded", "cancel_requested"])
def test_concurrent_completion_and_cancel_serialize(postgres_engine, first_target):
    # Commit a fresh job so independent connections can actually contend on it.
    with postgres_engine.begin() as connection:
        job = reach(connection, "running")
    locked = Event()
    attempted = Event()

    def complete():
        with postgres_engine.begin() as connection:
            changed = move(connection, job, first_target)
            locked.set()
            assert attempted.wait(timeout=5)
        return changed

    def cancel():
        assert locked.wait(timeout=5)
        with postgres_engine.begin() as connection:
            attempted.set()
            with pytest.raises(InvalidTransition):
                move(connection, job, "cancel_requested" if first_target == "succeeded" else "succeeded")

    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(complete)
        second = executor.submit(cancel)
        assert first.result(timeout=10)["status"] == first_target
        second.result(timeout=10)
    with postgres_engine.connect() as connection:
        assert connection.scalar(select(jobs.c.status).where(jobs.c.id == job["id"])) == first_target
        assert connection.scalar(select(func.count()).select_from(job_events).where(job_events.c.job_id == job["id"])) == 3
