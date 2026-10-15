"""Add searchable immutable references, including existing synthetic fixtures."""

import sqlalchemy as sa
from alembic import op

revision = "0003_external_reference"
down_revision = "0002_jobs_and_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("external_reference", sa.String(160)))
    # ALTER TABLE holds an exclusive lock through this migration transaction.
    # Enrich only the new fixture field; preserve state, version, timestamps and events.
    op.execute("ALTER TABLE jobs DISABLE TRIGGER guard_job_write")
    op.execute("""
        UPDATE jobs SET external_reference = 'SYN-' || lpad((seed - 9999)::text, 4, '0')
        WHERE specification->>'seed_dataset' = 'qtrace-demo-v1'
          AND seed BETWEEN 10000 AND 10199
    """)
    op.execute("ALTER TABLE jobs ENABLE TRIGGER guard_job_write")
    op.create_check_constraint("ck_jobs_external_reference", "jobs",
                               "external_reference IS NULL OR length(trim(external_reference)) > 0")
    op.create_index("ix_jobs_external_reference", "jobs", [sa.text("lower(external_reference)")])
    op.execute("""
        CREATE FUNCTION guard_job_reference() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.external_reference IS DISTINCT FROM OLD.external_reference THEN
            RAISE EXCEPTION 'External references are immutable' USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END $$;
        CREATE TRIGGER guard_job_reference BEFORE UPDATE OF external_reference ON jobs
          FOR EACH ROW EXECUTE FUNCTION guard_job_reference();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER guard_job_reference ON jobs")
    op.execute("DROP FUNCTION guard_job_reference()")
    op.drop_index("ix_jobs_external_reference", table_name="jobs")
    op.drop_constraint("ck_jobs_external_reference", "jobs", type_="check")
    op.drop_column("jobs", "external_reference")
