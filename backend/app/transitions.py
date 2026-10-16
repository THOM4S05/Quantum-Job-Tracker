"""Atomic domain writes. Call within ``with engine.begin() as connection``.

The caller owns the outer commit. Each operation also uses a savepoint so an
event insertion error cannot leave a changed job if caught by that caller.
"""

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4, uuid5

from sqlalchemy import Connection, func, insert, select, update

from app.models import STAGES, TERMINAL, TRANSITIONS, job_events, jobs


class InvalidTransition(ValueError):
    pass


class VersionConflict(InvalidTransition):
    pass


def _require_transaction(connection: Connection) -> None:
    if not connection.in_transaction():
        raise RuntimeError("Use an explicit caller-owned transaction (engine.begin()).")


def _timestamp(connection: Connection, at: datetime | None) -> datetime:
    at = at if at is not None else connection.scalar(select(func.clock_timestamp()))
    if at.tzinfo is None or at.utcoffset() is None:
        raise ValueError("Timestamps must include a timezone")
    return at


def _event(connection: Connection, job: dict, *, previous: str | None,
           stage: str, message: str, details: dict[str, Any],
           correlation_id: UUID, actor: str) -> None:
    if stage not in STAGES:
        raise ValueError("Unknown event stage")
    if not isinstance(details, dict):
        raise ValueError("Event details must be an object")
    # Use the job version to set the event ID and its place in the history
    connection.execute(insert(job_events).values(
        id=uuid5(job["id"], f"event:{job['version']}"), job_id=job["id"],
        sequence=job["version"], occurred_at=job["updated_at"], stage=stage,
        from_status=previous, to_status=job["status"], message=message,
        details=details, correlation_id=correlation_id, actor=actor,
    ))


def create_job(connection: Connection, *, name: str, provider: str, target: str,
               requested_by: str, scenario: str, seed: int,
               simulation_version: str = "v1", specification: dict | None = None,
               external_reference: str | None = None,
               job_id: UUID | None = None, correlation_id: UUID | None = None,
               at: datetime | None = None) -> dict:
    """Create an initial queued job and its first event, without committing."""
    _require_transaction(connection)
    with connection.begin_nested():
        now = _timestamp(connection, at)
        job = dict(connection.execute(insert(jobs).values(
            id=job_id or uuid4(), name=name, provider=provider, target=target,
            external_reference=external_reference,
            status="queued", requested_by=requested_by, version=1,
            created_at=now, updated_at=now, scenario=scenario, seed=seed,
            simulation_version=simulation_version, specification=specification or {},
        ).returning(jobs)).mappings().one())
        _event(connection, job, previous=None, stage="submission",
               message="Synthetic job submitted", details={"synthetic": True},
               correlation_id=correlation_id or uuid4(), actor=requested_by)
        return job


def _locked_job(connection: Connection, job_id: UUID, expected_version: int | None) -> dict:
    # Lock the row so two writes cannot change the job at once
    row = connection.execute(select(jobs).where(jobs.c.id == job_id).with_for_update()).mappings().one_or_none()
    if row is None:
        raise LookupError(f"Unknown job {job_id}")
    # Block changes if the job has changed since it was last read
    if expected_version is not None and row["version"] != expected_version:
        raise VersionConflict("Job version changed")
    return dict(row)


def _change(connection: Connection, job_id: UUID, *, to_status: str | None,
            stage: str, message: str, actor: str, correlation_id: UUID,
            details: dict | None, expected_version: int | None,
            error_code: str | None, error_message: str | None,
            result: dict | None, at: datetime | None) -> dict:
    _require_transaction(connection)
    with connection.begin_nested():
        old = _locked_job(connection, job_id, expected_version)
        # Add a progress event without changing the job status
        progress = to_status is None
        target = old["status"] if progress else to_status
        if progress:
            if old["status"] != "running" or stage not in {"compilation", "queueing", "execution"}:
                raise InvalidTransition("Only running jobs accept execution progress")
        elif target not in TRANSITIONS[old["status"]]:
            raise InvalidTransition(f"Cannot transition {old['status']} to {target}")
        if target in {"cancel_requested", "cancelled"} and stage != "cancellation":
            raise InvalidTransition("Cancellation requires the cancellation stage")
        if target == "succeeded" and stage != "execution":
            raise InvalidTransition("Success requires the execution stage")
        if target == "failed":
            if stage not in {"compilation", "queueing", "execution"} or not error_code or not error_message:
                raise InvalidTransition("Failure requires an execution stage, code, and message")
        elif error_code is not None or error_message is not None:
            raise InvalidTransition("Only failed jobs may have error information")
        # Only successful jobs should have a result
        if (target == "succeeded") != (result is not None):
            raise InvalidTransition("A result is required exactly when succeeding")
        now = _timestamp(connection, at)
        if now < old["updated_at"]:
            raise InvalidTransition("Event timestamps cannot move backwards")
        values = dict(
            status=target, updated_at=now, version=old["version"] + 1,
            started_at=now if old["status"] == "queued" and target == "running" else old["started_at"],
            finished_at=now if target in TERMINAL else None,
            error_code=error_code, error_message=error_message,
            error_stage=stage if target == "failed" else None, result=result,
        )
        job = dict(connection.execute(update(jobs).where(jobs.c.id == job_id)
                   .values(**values).returning(jobs)).mappings().one())
        _event(connection, job, previous=old["status"], stage=stage,
               message=message, details={} if details is None else details,
               correlation_id=correlation_id, actor=actor)
        return job


def transition_job(connection: Connection, job_id: UUID, to_status: str, *,
                   stage: str, message: str, actor: str, correlation_id: UUID,
                   details: dict | None = None, expected_version: int | None = None,
                   error_code: str | None = None, error_message: str | None = None,
                   result: dict | None = None, at: datetime | None = None) -> dict:
    """Lock current state, validate, update job/version and append event atomically.

    Self-transitions and all transitions out of terminal states are rejected.
    The caller must let its outer transaction commit before reporting success.
    """
    return _change(connection, job_id, to_status=to_status, stage=stage,
                   message=message, actor=actor, correlation_id=correlation_id,
                   details=details, expected_version=expected_version,
                   error_code=error_code, error_message=error_message, result=result, at=at)


def record_progress(connection: Connection, job_id: UUID, *, stage: str, message: str,
                    actor: str, correlation_id: UUID, details: dict | None = None,
                    at: datetime | None = None) -> dict:
    """Append a running-stage event (from_status == to_status), never reactivate."""
    return _change(connection, job_id, to_status=None, stage=stage, message=message,
                   actor=actor, correlation_id=correlation_id, details=details,
                   expected_version=None, error_code=None, error_message=None, result=None, at=at)
