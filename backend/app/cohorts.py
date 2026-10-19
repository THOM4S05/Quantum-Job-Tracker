"""Shared submission cohort validation and SQL predicates for overview/drill-down."""

import re
from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select

from app.models import jobs


class CohortFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")
    submitted_from: date | None = None
    submitted_to: date | None = None
    target: str | None = Field(default=None, min_length=1, max_length=120)
    compiler_version: str | None = Field(default=None, min_length=1, max_length=80)
    experiment: UUID | None = None

    @field_validator("target", "compiler_version", mode="before")
    @classmethod
    def strip_label(cls, value):
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
        if self.submitted_to == date.max:
            raise ValueError("Submission end date must be before 9999-12-31")
        return self


def cohort_conditions(filters: CohortFilters):
    conditions = []
    if filters.submitted_from:
        conditions.append(jobs.c.created_at >= datetime.combine(filters.submitted_from, time.min, timezone.utc))
    if filters.submitted_to:
        conditions.append(jobs.c.created_at < datetime.combine(filters.submitted_to + timedelta(days=1), time.min, timezone.utc))
    if filters.target:
        conditions.append(jobs.c.target == filters.target)
    if filters.compiler_version:
        conditions.append(jobs.c.metadata["compiler_version"].astext == filters.compiler_version)
    if filters.experiment:
        conditions.append(jobs.c.specification["experiment"]["id"].astext == str(filters.experiment))
    return conditions


def cohort_options(connection):
    def values(expression):
        return list(connection.scalars(select(expression).where(expression.is_not(None)).distinct().order_by(expression)))
    experiment_id = jobs.c.specification["experiment"]["id"].astext
    experiment_name = jobs.c.specification["experiment"]["name"].astext
    # IDs are UUIDs in the experiment recipe. Ignore unmodeled legacy groups.
    experiments = {}
    for identity, name in connection.execute(select(experiment_id, experiment_name).where(experiment_id.is_not(None))
                                               .distinct().order_by(experiment_id, experiment_name)):
        try:
            identity = str(UUID(identity))
        except ValueError:
            continue
        experiments[identity] = name or identity
    return {"targets": values(jobs.c.target), "compiler_versions": values(jobs.c.metadata["compiler_version"].astext),
            "experiments": [{"id": identity, "name": name} for identity, name in experiments.items()]}
