from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError

from app.config import Settings
from app.main import create_app
from app.models import job_events, jobs
from app.seed import seed_jobs
from app.transitions import create_job
from app.workload_metadata import WorkloadMetadata


@pytest.mark.parametrize("field,value", [
    ("requested_shots", 0), ("requested_shots", -1), ("requested_shots", True),
    ("estimated_logical_qubits", -1), ("estimated_circuit_depth", 1.5),
    ("estimated_gate_count", "50"), ("estimated_gate_count", 9007199254740992),
    ("compiler_version", " "), ("source_language", ""),
    ("optimisation_settings", {"bad": float('nan')}),
])
def test_invalid_metadata(field, value):
    with pytest.raises(ValidationError):
        WorkloadMetadata.model_validate({field: value})


def test_missing_values_and_real_zero_estimates():
    metadata = WorkloadMetadata()
    assert all(value is None for value in metadata.model_dump().values())
    assert all(value is None for value in metadata.durations().model_dump().values())
    assert WorkloadMetadata(estimated_gate_count=0).estimated_gate_count == 0


def test_durations_use_recorded_endpoints_and_timezone_offsets():
    metadata = WorkloadMetadata(
        compilation_started_at="2026-10-01T10:00:00.000100+01:00",
        compilation_finished_at="2026-10-01T09:00:01.250900Z",
        queue_entered_at="2026-10-01T09:00:01.250900Z",
        queue_left_at="2026-10-01T09:00:01.250900Z",
        execution_started_at="2026-10-01T09:00:02Z",
    )
    assert metadata.durations().model_dump() == {
        "compilation_seconds": 1.2508, "queue_seconds": 0.0, "execution_seconds": None,
    }
    assert metadata.model_dump(mode="json")["compilation_started_at"] == "2026-10-01T09:00:00.000100Z"
    # A known finish with an unknown start still cannot supply a duration.
    assert WorkloadMetadata(execution_finished_at="2026-10-01T09:00:02Z").durations().execution_seconds is None


@pytest.mark.parametrize("fields", [
    {"execution_started_at": "2026-10-01T09:00:00"},
    {"compilation_started_at": "2026-10-01T09:00:02Z", "compilation_finished_at": "2026-10-01T09:00:01Z"},
    {"compilation_finished_at": "2026-10-01T09:00:02Z", "queue_entered_at": "2026-10-01T09:00:01Z"},
])
def test_invalid_phase_timestamps(fields):
    with pytest.raises(ValidationError):
        WorkloadMetadata.model_validate(fields)


def create(connection, metadata=None):
    return create_job(connection, name="Metadata test", provider="Synthetic provider", target="synthetic-8q",
                      requested_by="demo", scenario="queued", seed=5, metadata=metadata,
                      at=datetime(2026, 10, 1, tzinfo=timezone.utc))


@pytest.mark.postgres
def test_metadata_round_trip_in_persistence_list_and_details(postgres_engine):
    metadata = WorkloadMetadata(program_name="Synthetic workload", program_revision="synthetic-r2",
        source_language="Synthetic QASM-like", compiler_name="Synthetic Test Compiler", compiler_version="synthetic-1.0.0",
        optimisation_settings={"level": 2, "passes": ["synthetic-routing"]}, requested_shots=1024,
        estimated_logical_qubits=8, estimated_circuit_depth=250, estimated_gate_count=0,
        compilation_started_at="2026-10-01T00:00:00Z", compilation_finished_at="2026-10-01T00:00:01.5Z")
    with postgres_engine.begin() as connection:
        job = create(connection, metadata)
        missing = create(connection)
        assert connection.scalar(select(jobs.c.metadata).where(jobs.c.id == job['id'])) == metadata.model_dump(mode="json")
    settings = Settings(_env_file=None, postgres_db="test", postgres_user="test", postgres_password="test")
    with patch("app.main.make_engine", return_value=postgres_engine), TestClient(create_app(settings)) as client:
        detail = client.get(f"/jobs/{job['id']}").json()["job"]
        summary = client.get('/jobs', params={"q": str(job['id'])}).json()['items'][0]
        for item in (detail, summary):
            assert item['metadata'] == metadata.model_dump(mode="json")
            assert item['durations'] == {"compilation_seconds": 1.5, "queue_seconds": None, "execution_seconds": None}
        unknown = client.get(f"/jobs/{missing['id']}").json()['job']
        assert all(value is None for value in unknown['metadata'].values())
        assert unknown['result'] is None


@pytest.mark.postgres
def test_metadata_migration_enriches_fixtures_without_changing_evidence(postgres_engine):
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    with postgres_engine.begin() as connection:
        seed_jobs(connection)
        legacy = create(connection)
        before = [dict(row) for row in connection.execute(select(jobs).order_by(jobs.c.id)).mappings()]
        events = connection.execute(select(job_events).order_by(job_events.c.id)).all()
        config.attributes['connection'] = connection
        command.downgrade(config, '0003_external_reference')
        command.upgrade(config, 'head')
        after = [dict(row) for row in connection.execute(select(jobs).order_by(jobs.c.id)).mappings()]
        for old, new in zip(before, after):
            assert WorkloadMetadata.model_validate(old.pop('metadata')) == WorkloadMetadata.model_validate(new.pop('metadata'))
            assert old == new
        assert connection.execute(select(job_events).order_by(job_events.c.id)).all() == events
        assert connection.scalar(select(jobs.c.metadata).where(jobs.c.id == legacy['id'])) == {}


@pytest.mark.postgres
@pytest.mark.parametrize("field,value", [("requested_shots", 0), ("estimated_gate_count", -1), ("estimated_logical_qubits", True)])
def test_database_rejects_invalid_counts_even_for_direct_writes(db, field, value):
    row = create(db)
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.execute(insert(jobs).values(**dict(row, id=uuid4(), metadata={field: value})))
