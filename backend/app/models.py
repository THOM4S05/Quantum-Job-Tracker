"""PostgreSQL tables shared by migrations, services, and future API/worker code."""

from sqlalchemy import (
    BigInteger, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer,
    String, Table, Text, UniqueConstraint, func, text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.database import metadata

STATUSES = ("queued", "running", "cancel_requested", "succeeded", "failed", "cancelled")
TERMINAL = frozenset({"succeeded", "failed", "cancelled"})
STAGES = ("submission", "compilation", "queueing", "execution", "cancellation")
TRANSITIONS = {
    "queued": frozenset({"running", "cancelled"}),
    "running": frozenset({"succeeded", "failed", "cancel_requested"}),
    "cancel_requested": frozenset({"cancelled"}),
    "succeeded": frozenset(),
    "failed": frozenset(),
    "cancelled": frozenset(),
}


jobs = Table(
    "jobs", metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("name", String(160), nullable=False),
    Column("provider", String(80), nullable=False),
    Column("target", String(120), nullable=False),
    Column("external_reference", String(160)),
    Column("status", String(24), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
    Column("started_at", DateTime(timezone=True)),
    Column("finished_at", DateTime(timezone=True)),
    Column("requested_by", String(120), nullable=False),
    Column("version", Integer, nullable=False),
    Column("specification", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column("scenario", String(80), nullable=False),
    Column("seed", BigInteger, nullable=False),
    Column("simulation_version", String(40), nullable=False),
    Column("result", JSONB(none_as_null=True)),
    Column("error_code", String(80)),
    Column("error_message", Text),
    Column("error_stage", String(24)),
    Column("retry_of", UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="RESTRICT")),
    Column("original_job_id", UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="RESTRICT")),
    CheckConstraint(f"status IN {STATUSES}", name="ck_jobs_status"),
    CheckConstraint("version >= 1", name="ck_jobs_version"),
    CheckConstraint("external_reference IS NULL OR length(trim(external_reference)) > 0",
                    name="ck_jobs_external_reference"),
    CheckConstraint("length(trim(name)) > 0 AND length(trim(provider)) > 0 AND "
                    "length(trim(target)) > 0 AND length(trim(requested_by)) > 0",
                    name="ck_jobs_labels"),
    CheckConstraint("(status IN ('succeeded', 'failed', 'cancelled')) = (finished_at IS NOT NULL)",
                    name="ck_jobs_finished"),
    CheckConstraint("status NOT IN ('running', 'cancel_requested', 'succeeded', 'failed') "
                    "OR started_at IS NOT NULL", name="ck_jobs_started"),
    CheckConstraint("status <> 'queued' OR started_at IS NULL", name="ck_jobs_queued"),
    CheckConstraint("updated_at >= created_at AND "
                    "(started_at IS NULL OR started_at BETWEEN created_at AND updated_at) AND "
                    "(finished_at IS NULL OR finished_at BETWEEN created_at AND updated_at) AND "
                    "(started_at IS NULL OR finished_at IS NULL OR finished_at >= started_at)",
                    name="ck_jobs_times"),
    CheckConstraint("(status = 'failed' AND error_code IS NOT NULL AND error_message IS NOT NULL "
                    "AND error_stage IS NOT NULL AND error_stage IN ('compilation', 'queueing', 'execution')) OR "
                    "(status <> 'failed' AND error_code IS NULL AND error_message IS NULL "
                    "AND error_stage IS NULL)", name="ck_jobs_error"),
    CheckConstraint("(status = 'succeeded') = (result IS NOT NULL)", name="ck_jobs_result"),
    CheckConstraint("(retry_of IS NULL) = (original_job_id IS NULL) AND "
                    "retry_of IS DISTINCT FROM id AND original_job_id IS DISTINCT FROM id",
                    name="ck_jobs_lineage"),
)

job_events = Table(
    "job_events", metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("job_id", UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="RESTRICT"), nullable=False),
    Column("sequence", Integer, nullable=False),
    Column("occurred_at", DateTime(timezone=True), nullable=False),
    Column("stage", String(24), nullable=False),
    Column("from_status", String(24)),
    Column("to_status", String(24), nullable=False),
    Column("message", Text, nullable=False),
    Column("details", JSONB, nullable=False, server_default=text("'{}'::jsonb")),
    Column("correlation_id", UUID(as_uuid=True), nullable=False),
    Column("actor", String(120), nullable=False),
    UniqueConstraint("job_id", "sequence", name="uq_job_events_sequence"),
    CheckConstraint("sequence >= 1", name="ck_job_events_sequence"),
    CheckConstraint(f"stage IN {STAGES}", name="ck_job_events_stage"),
    CheckConstraint(f"to_status IN {STATUSES}", name="ck_job_events_to_status"),
    CheckConstraint(f"from_status IS NULL OR from_status IN {STATUSES}",
                    name="ck_job_events_from_status"),
    CheckConstraint("length(trim(message)) > 0 AND length(trim(actor)) > 0",
                    name="ck_job_events_labels"),
    CheckConstraint("jsonb_typeof(details) = 'object'", name="ck_job_events_details"),
)

Index("ix_jobs_created", jobs.c.created_at.desc(), jobs.c.id.desc())
Index("ix_jobs_status_created", jobs.c.status, jobs.c.created_at.desc(), jobs.c.id.desc())
Index("ix_jobs_provider_created", jobs.c.provider, jobs.c.created_at.desc(), jobs.c.id.desc())
Index("ix_jobs_retry_of", jobs.c.retry_of)
Index("ix_jobs_original", jobs.c.original_job_id)
Index("ix_jobs_external_reference", func.lower(jobs.c.external_reference))
Index("ix_job_events_correlation", job_events.c.correlation_id)
