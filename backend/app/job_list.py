"""Read-only job search; no job specifications or event payloads are returned."""

from datetime import date, datetime, time, timedelta, timezone
import re
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError

from app.models import jobs

Status = Literal["queued", "running", "cancel_requested", "succeeded", "failed", "cancelled"]


class JobFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Status | None = None
    provider: str | None = Field(default=None, min_length=1, max_length=80)
    submitted_from: date | None = None
    submitted_to: date | None = None
    q: str | None = Field(default=None, min_length=1, max_length=160)
    page: int = Field(default=1, ge=1, le=1_000_000)
    page_size: int = Field(default=25, ge=1, le=100)

    @field_validator("provider", "q", mode="before")
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("submitted_from", "submitted_to", mode="before")
    @classmethod
    def iso_date(cls, value):
        if isinstance(value, str) and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("Use a date in YYYY-MM-DD format")
        return value

    @model_validator(mode="after")
    def date_order(self):
        if self.submitted_from and self.submitted_to and self.submitted_from > self.submitted_to:
            raise ValueError("Submission start date must be on or before the end date")
        # Keep the exclusive next-day bound representable.
        if self.submitted_to == date.max:
            raise ValueError("Submission end date must be before 9999-12-31")
        return self


class JobSummary(BaseModel):
    id: UUID
    name: str
    provider: str
    target: str
    external_reference: str | None
    status: Status
    created_at: datetime
    requested_by: str
    retry_of: UUID | None


class JobPage(BaseModel):
    items: list[JobSummary]
    total: int
    page: int
    page_size: int
    total_pages: int
    providers: list[str]


router = APIRouter()


@router.get("/jobs", response_model=JobPage)
def list_jobs(request: Request, filters: Annotated[JobFilters, Query()]) -> dict:
    conditions = []
    if filters.status:
        conditions.append(jobs.c.status == filters.status)
    if filters.provider:
        conditions.append(jobs.c.provider == filters.provider)
    if filters.submitted_from:
        conditions.append(jobs.c.created_at >= datetime.combine(filters.submitted_from, time.min, timezone.utc))
    # Stop at the next midnight to include the whole end date in UTC
    if filters.submitted_to:
        conditions.append(jobs.c.created_at < datetime.combine(filters.submitted_to + timedelta(days=1), time.min, timezone.utc))
    if filters.q:
        # Ignore letter case for references and check job IDs when the format fits
        matches = [func.lower(jobs.c.external_reference) == filters.q.lower()]
        try:
            matches.append(jobs.c.id == UUID(filters.q))
        except ValueError:
            pass
        conditions.append(or_(*matches))
    try:
        # Count, rows and provider options share a consistent read snapshot.
        with request.app.state.engine.connect().execution_options(isolation_level="REPEATABLE READ") as connection:
            with connection.begin():
                total = connection.scalar(select(func.count()).select_from(jobs).where(*conditions))
                # Use the ID to sort jobs with the same time so their order stays the same
                items = connection.execute(select(
                    jobs.c.id, jobs.c.name, jobs.c.provider, jobs.c.target,
                    jobs.c.external_reference, jobs.c.status, jobs.c.created_at,
                    jobs.c.requested_by, jobs.c.retry_of,
                ).where(*conditions).order_by(jobs.c.created_at.desc(), jobs.c.id.desc())
                    .offset((filters.page - 1) * filters.page_size).limit(filters.page_size)).mappings().all()
                providers = list(connection.scalars(select(jobs.c.provider).distinct().order_by(jobs.c.provider)))
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Jobs are temporarily unavailable. Please try again.") from None
    return {"items": items, "total": total, "page": filters.page,
            "page_size": filters.page_size,
            "total_pages": (total + filters.page_size - 1) // filters.page_size,
            "providers": providers}
