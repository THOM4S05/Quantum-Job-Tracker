"""Recorded job evidence only; no inferred failure explanations."""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.job_list import JobSummary, Status
from app.models import job_events, jobs


class JobRecord(JobSummary):
    updated_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    version: int
    specification: dict[str, Any]
    scenario: str
    seed: int
    simulation_version: str
    result: dict[str, Any] | None
    error_code: str | None
    error_message: str | None
    error_stage: str | None
    original_job_id: UUID | None


class RecordedEvent(BaseModel):
    id: UUID
    job_id: UUID
    sequence: int
    occurred_at: datetime
    stage: str
    from_status: Status | None
    to_status: Status
    message: str
    details: dict[str, Any]
    correlation_id: UUID
    actor: str


class JobEvidence(BaseModel):
    job: JobRecord
    events: list[RecordedEvent]
    history_complete: bool


router = APIRouter()


@router.get("/jobs/{job_id}", response_model=JobEvidence)
def get_job(job_id: UUID, request: Request) -> dict:
    try:
        with request.app.state.engine.connect().execution_options(isolation_level="REPEATABLE READ") as connection:
            with connection.begin():
                job = connection.execute(select(jobs).where(jobs.c.id == job_id)).mappings().one_or_none()
                if job is None:
                    raise HTTPException(status_code=404, detail="Job not found")
                events = connection.execute(select(job_events).where(job_events.c.job_id == job_id)
                                            .order_by(job_events.c.sequence.asc())).mappings().all()
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Job evidence is temporarily unavailable. Please try again.") from None
    # This checks the recorded history, not whether diagnostics explain a cause.
    complete = (
        len(events) == job["version"]
        and all(event["sequence"] == index for index, event in enumerate(events, start=1))
        and bool(events)
        and events[0]["from_status"] is None
        and events[0]["to_status"] == "queued"
        and all(current["from_status"] == previous["to_status"] for previous, current in zip(events, events[1:]))
        and events[-1]["to_status"] == job["status"]
        and events[-1]["occurred_at"] == job["updated_at"]
    )
    return {"job": job, "events": events, "history_complete": complete}
