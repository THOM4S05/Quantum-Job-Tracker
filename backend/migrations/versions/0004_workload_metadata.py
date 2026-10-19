"""Nullable compiler/resource snapshots; enrich only known synthetic fixtures."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0004_workload_metadata"
down_revision = "0003_external_reference"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("metadata", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.create_check_constraint("ck_jobs_metadata", "jobs", "jsonb_typeof(metadata) = 'object'")
    # The migration holds the table lock. Enrich only this new field, never states/events.
    op.execute("ALTER TABLE jobs DISABLE TRIGGER guard_job_write")
    op.execute("""
      UPDATE jobs j SET metadata = jsonb_build_object(
        'program_name', j.name,
        'program_revision', 'synthetic-r' || ((j.seed - 10000) % 5 + 1)::text,
        'source_language', 'Synthetic QASM-like',
        'compiler_name', (ARRAY['Synthetic Aurora Compiler','Synthetic Nebula Compiler','Synthetic Quasar Compiler'])[(((j.seed - 10000) % 3) + 1)::integer],
        'compiler_version', CASE WHEN (j.seed - 10000) % 17 = 0 THEN NULL ELSE 'synthetic-1.0.0' END,
        'optimisation_settings', jsonb_build_object('level', (j.seed - 10000) % 3, 'routing', 'synthetic-greedy'),
        'requested_shots', 1024,
        'estimated_logical_qubits', CASE WHEN (j.seed - 10000) % 13 <> 0 THEN 8 + (j.seed - 10000) % 4 * 8 END,
        'estimated_circuit_depth', CASE WHEN (j.seed - 10000) % 13 <> 0 THEN 120 + (j.seed - 10000) % 40 END,
        'estimated_gate_count', CASE WHEN (j.seed - 10000) % 13 <> 0 THEN 600 + (j.seed - 10000) % 100 END,
        'compilation_started_at', CASE WHEN j.scenario NOT IN ('queued','cancelled') THEN to_char(j.created_at AT TIME ZONE 'UTC' + interval '1 second', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END,
        'compilation_finished_at', CASE WHEN j.scenario NOT IN ('queued','cancelled') THEN to_char(j.created_at AT TIME ZONE 'UTC' + interval '2 seconds', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END,
        'queue_entered_at', CASE WHEN j.scenario NOT IN ('queued','cancelled','compilation_failure') THEN to_char(j.created_at AT TIME ZONE 'UTC' + interval '2 seconds', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END,
        'queue_left_at', CASE WHEN j.scenario NOT IN ('queued','cancelled','compilation_failure') THEN to_char(j.created_at AT TIME ZONE 'UTC' + interval '3 seconds', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END,
        'execution_started_at', CASE WHEN j.scenario IN ('success','execution_failure','running') THEN to_char(j.created_at AT TIME ZONE 'UTC' + interval '3 seconds', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END,
        'execution_finished_at', CASE WHEN j.scenario IN ('success','execution_failure') THEN to_char(j.finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END
      )
      WHERE j.specification->>'seed_dataset' = 'qtrace-demo-v1'
        AND j.seed BETWEEN 10000 AND 10199
        AND j.scenario IN ('success','compilation_failure','queueing_failure','execution_failure','queued','running','cancelled')
    """)
    op.execute("ALTER TABLE jobs ENABLE TRIGGER guard_job_write")


def downgrade() -> None:
    op.drop_constraint("ck_jobs_metadata", "jobs", type_="check")
    op.drop_column("jobs", "metadata")
