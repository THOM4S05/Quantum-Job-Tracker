"""Jobs, ordered events, and database lifecycle protection."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision = "0002_jobs_and_events"
down_revision = "0001_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("provider", sa.String(80), nullable=False),
        sa.Column("target", sa.String(120), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("requested_by", sa.String(120), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("specification", pg.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("scenario", sa.String(80), nullable=False),
        sa.Column("seed", sa.BigInteger, nullable=False),
        sa.Column("simulation_version", sa.String(40), nullable=False),
        sa.Column("result", pg.JSONB(none_as_null=True)),
        sa.Column("error_code", sa.String(80)),
        sa.Column("error_message", sa.Text),
        sa.Column("error_stage", sa.String(24)),
        sa.Column("retry_of", pg.UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="RESTRICT")),
        sa.Column("original_job_id", pg.UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="RESTRICT")),
        sa.CheckConstraint("status IN ('queued','running','cancel_requested','succeeded','failed','cancelled')", name="ck_jobs_status"),
        sa.CheckConstraint("version >= 1", name="ck_jobs_version"),
        sa.CheckConstraint("length(trim(name)) > 0 AND length(trim(provider)) > 0 AND length(trim(target)) > 0 AND length(trim(requested_by)) > 0", name="ck_jobs_labels"),
        sa.CheckConstraint("(status IN ('succeeded','failed','cancelled')) = (finished_at IS NOT NULL)", name="ck_jobs_finished"),
        sa.CheckConstraint("status NOT IN ('running','cancel_requested','succeeded','failed') OR started_at IS NOT NULL", name="ck_jobs_started"),
        sa.CheckConstraint("status <> 'queued' OR started_at IS NULL", name="ck_jobs_queued"),
        sa.CheckConstraint("updated_at >= created_at AND (started_at IS NULL OR started_at BETWEEN created_at AND updated_at) AND (finished_at IS NULL OR finished_at BETWEEN created_at AND updated_at) AND (started_at IS NULL OR finished_at IS NULL OR finished_at >= started_at)", name="ck_jobs_times"),
        sa.CheckConstraint("(status = 'failed' AND error_code IS NOT NULL AND error_message IS NOT NULL AND error_stage IS NOT NULL AND error_stage IN ('compilation','queueing','execution')) OR (status <> 'failed' AND error_code IS NULL AND error_message IS NULL AND error_stage IS NULL)", name="ck_jobs_error"),
        sa.CheckConstraint("(status = 'succeeded') = (result IS NOT NULL)", name="ck_jobs_result"),
        sa.CheckConstraint("(retry_of IS NULL) = (original_job_id IS NULL) AND retry_of IS DISTINCT FROM id AND original_job_id IS DISTINCT FROM id", name="ck_jobs_lineage"),
    )
    op.create_table(
        "job_events",
        sa.Column("id", pg.UUID(as_uuid=True), primary_key=True),
        sa.Column("job_id", pg.UUID(as_uuid=True), sa.ForeignKey("jobs.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("sequence", sa.Integer, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("stage", sa.String(24), nullable=False),
        sa.Column("from_status", sa.String(24)),
        sa.Column("to_status", sa.String(24), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("details", pg.JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("correlation_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column("actor", sa.String(120), nullable=False),
        sa.UniqueConstraint("job_id", "sequence", name="uq_job_events_sequence"),
        sa.CheckConstraint("sequence >= 1", name="ck_job_events_sequence"),
        sa.CheckConstraint("stage IN ('submission','compilation','queueing','execution','cancellation')", name="ck_job_events_stage"),
        sa.CheckConstraint("to_status IN ('queued','running','cancel_requested','succeeded','failed','cancelled')", name="ck_job_events_to_status"),
        sa.CheckConstraint("from_status IS NULL OR from_status IN ('queued','running','cancel_requested','succeeded','failed','cancelled')", name="ck_job_events_from_status"),
        sa.CheckConstraint("length(trim(message)) > 0 AND length(trim(actor)) > 0", name="ck_job_events_labels"),
        sa.CheckConstraint("jsonb_typeof(details) = 'object'", name="ck_job_events_details"),
    )
    op.create_index("ix_jobs_created", "jobs", [sa.text("created_at DESC"), sa.text("id DESC")])
    op.create_index("ix_jobs_status_created", "jobs", ["status", sa.text("created_at DESC"), sa.text("id DESC")])
    op.create_index("ix_jobs_provider_created", "jobs", ["provider", sa.text("created_at DESC"), sa.text("id DESC")])
    op.create_index("ix_jobs_retry_of", "jobs", ["retry_of"])
    op.create_index("ix_jobs_original", "jobs", ["original_job_id"])
    op.create_index("ix_job_events_correlation", "job_events", ["correlation_id"])
    op.execute("""
    CREATE FUNCTION guard_job_write() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Job history cannot be deleted' USING ERRCODE = '23514';
      END IF;
      IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'queued' OR NEW.version <> 1 THEN
          RAISE EXCEPTION 'Jobs must start queued at version 1' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END IF;
      IF OLD.status IN ('succeeded','failed','cancelled') THEN
        RAISE EXCEPTION 'Terminal jobs are immutable' USING ERRCODE = '23514';
      END IF;
      IF ROW(NEW.id, NEW.name, NEW.provider, NEW.target, NEW.requested_by,
             NEW.created_at, NEW.specification, NEW.scenario, NEW.seed,
             NEW.simulation_version, NEW.retry_of, NEW.original_job_id)
         IS DISTINCT FROM
         ROW(OLD.id, OLD.name, OLD.provider, OLD.target, OLD.requested_by,
             OLD.created_at, OLD.specification, OLD.scenario, OLD.seed,
             OLD.simulation_version, OLD.retry_of, OLD.original_job_id) THEN
        RAISE EXCEPTION 'Submission and lineage are immutable' USING ERRCODE = '23514';
      END IF;
      IF NEW.version <> OLD.version + 1 OR NEW.updated_at < OLD.updated_at
         OR (OLD.started_at IS NOT NULL AND NEW.started_at IS DISTINCT FROM OLD.started_at) THEN
        RAISE EXCEPTION 'Invalid job version or timestamp' USING ERRCODE = '23514';
      END IF;
      IF NEW.status = OLD.status THEN
        IF OLD.status <> 'running' THEN
          RAISE EXCEPTION 'Only running jobs accept progress' USING ERRCODE = '23514';
        END IF;
      ELSIF NOT (
        (OLD.status = 'queued' AND NEW.status IN ('running','cancelled')) OR
        (OLD.status = 'running' AND NEW.status IN ('succeeded','failed','cancel_requested')) OR
        (OLD.status = 'cancel_requested' AND NEW.status = 'cancelled')
      ) THEN
        RAISE EXCEPTION 'Invalid job transition' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER guard_job_write BEFORE INSERT OR UPDATE OR DELETE ON jobs
      FOR EACH ROW EXECUTE FUNCTION guard_job_write();
    """)
    op.execute("""
    CREATE FUNCTION guard_event_write() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'Job events are append-only' USING ERRCODE = '23514';
    END $$;
    CREATE TRIGGER guard_event_write BEFORE UPDATE OR DELETE ON job_events
      FOR EACH ROW EXECUTE FUNCTION guard_event_write();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER guard_event_write ON job_events")
    op.execute("DROP FUNCTION guard_event_write()")
    op.execute("DROP TRIGGER guard_job_write ON jobs")
    op.execute("DROP FUNCTION guard_job_write()")
    op.drop_table("job_events")
    op.drop_table("jobs")
