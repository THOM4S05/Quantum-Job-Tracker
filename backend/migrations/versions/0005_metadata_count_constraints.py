"""Enforce nullable resource-count bounds even for direct database writes."""

from alembic import op

revision = "0005_metadata_counts"
down_revision = "0004_workload_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for field, minimum in (("requested_shots", 1), ("estimated_logical_qubits", 0),
                           ("estimated_circuit_depth", 0), ("estimated_gate_count", 0)):
        op.create_check_constraint(f"ck_jobs_metadata_{field}", "jobs",
            f"CASE jsonb_typeof(metadata->'{field}') WHEN 'null' THEN true "
            f"WHEN 'number' THEN ((metadata->>'{field}')::numeric BETWEEN {minimum} AND 9007199254740991 "
            f"AND trunc((metadata->>'{field}')::numeric) = (metadata->>'{field}')::numeric) "
            f"ELSE metadata->'{field}' IS NULL END")


def downgrade() -> None:
    for field in ("requested_shots", "estimated_logical_qubits", "estimated_circuit_depth", "estimated_gate_count"):
        op.drop_constraint(f"ck_jobs_metadata_{field}", "jobs", type_="check")
