"""Submission-cohort metrics; definitions and conservative exclusions: docs/metrics.md."""

from collections import Counter
from datetime import datetime
from statistics import median
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.cohorts import CohortFilters, cohort_conditions, cohort_options
from app.job_list import ExperimentOption
from app.models import jobs


class AttemptMetric(BaseModel):
    succeeded: int
    failed: int
    completed: int
    pending: int
    cancelled: int
    not_started: int
    unknown: int
    rate_percent: float | None


class TimingMetric(BaseModel):
    median_seconds: float | None
    samples: int
    excluded: int


class Breakdown(BaseModel):
    key: str
    count: int


class Overview(BaseModel):
    synthetic: bool = True
    total_jobs: int
    cancelled_jobs: int
    cancelling_jobs: int
    compilation: AttemptMetric
    execution: AttemptMetric
    queue_time: TimingMetric
    execution_duration: TimingMetric
    failures_by_stage: list[Breakdown]
    jobs_by_target: list[Breakdown]
    targets: list[str]
    compiler_versions: list[str]
    experiments: list[ExperimentOption]


def timestamp(value):
    if not value:
        return None
    try:
        point = value if isinstance(value, datetime) else datetime.fromisoformat(value.replace("Z", "+00:00"))
        return point if point.utcoffset() is not None else None
    except (ValueError, TypeError, AttributeError):
        return None


def interval(metadata, start, end):
    first, last = timestamp(metadata.get(start)), timestamp(metadata.get(end))
    if first is None or last is None or last < first:
        return None
    return round((last - first).total_seconds(), 6)


def attempt(job, phase):
    status, stage, metadata = job["status"], job.get("error_stage"), job.get("metadata") or {}
    if status in {"cancelled", "cancel_requested"}:
        return "cancelled"
    if status == "failed" and stage == phase:
        return "failed"
    if phase == "execution":
        if status == "succeeded":
            return "succeeded"
        started = timestamp(metadata.get("execution_started_at")) is not None
        if started:
            return "pending" if status in {"queued", "running"} else "unknown"
        return "unknown" if status == "failed" and stage not in {"compilation", "queueing"} else "not_started"
    if timestamp(metadata.get("compilation_finished_at")) is not None:
        if status != "failed" or stage in {"queueing", "execution"}:
            return "succeeded"
    if status == "queued" and not metadata.get("compilation_started_at"):
        return "not_started"
    if status in {"queued", "running"} and timestamp(metadata.get("compilation_started_at")) is not None:
        return "pending"
    return "unknown"


def calculate_overview(rows):
    phases = {phase: Counter(attempt(row, phase) for row in rows) for phase in ("compilation", "execution")}

    def rate(counts):
        completed = counts["succeeded"] + counts["failed"]
        return {**{key: counts[key] for key in ("succeeded", "failed", "pending", "cancelled", "not_started", "unknown")},
                "completed": completed, "rate_percent": round(100 * counts["succeeded"] / completed, 6) if completed else None}

    def timing(values):
        observed = [value for value in values if value is not None]
        return {"median_seconds": median(observed) if observed else None,
                "samples": len(observed), "excluded": len(rows) - len(observed)}

    failures = Counter(row.get("error_stage") or "unknown" for row in rows if row["status"] == "failed")
    targets = Counter(row["target"] for row in rows)
    return {"total_jobs": len(rows), "cancelled_jobs": sum(row["status"] == "cancelled" for row in rows),
            "cancelling_jobs": sum(row["status"] == "cancel_requested" for row in rows),
            **{phase: rate(counts) for phase, counts in phases.items()},
            "queue_time": timing([interval(row.get("metadata") or {}, "queue_entered_at", "execution_started_at") for row in rows]),
            "execution_duration": timing([
                interval(row.get("metadata") or {}, "execution_started_at", "execution_finished_at")
                if attempt(row, "execution") in {"succeeded", "failed"} else None for row in rows]),
            "failures_by_stage": [{"key": key, "count": failures[key]} for key in ("compilation", "queueing", "execution", "unknown")],
            "jobs_by_target": [{"key": key, "count": count} for key, count in sorted(targets.items())]}


router = APIRouter()


@router.get("/overview", response_model=Overview)
def get_overview(request: Request, filters: Annotated[CohortFilters, Query()]):
    try:
        with request.app.state.engine.connect().execution_options(isolation_level="REPEATABLE READ") as connection:
            with connection.begin():
                rows = connection.execute(select(jobs.c.status, jobs.c.error_stage, jobs.c.target, jobs.c.metadata)
                                          .where(*cohort_conditions(filters))).mappings().all()
                return {**calculate_overview(rows), **cohort_options(connection)}
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Overview is temporarily unavailable. Please try again.") from None
