from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.main import create_app
from app.models import jobs
from app.transitions import create_job, transition_job


def make_test_app():
    return create_app(Settings(_env_file=None, postgres_db="test", postgres_user="test", postgres_password="test"))


@pytest.fixture
def detail_client(postgres_engine):
    with patch("app.main.make_engine", return_value=postgres_engine):
        with TestClient(make_test_app()) as client:
            yield client


def create(connection):
    return create_job(connection, name="Recorded failure test", provider="Synthetic Aurora Labs",
                      target="simulator-8q", requested_by="test.operator", scenario="execution_failure",
                      seed=12, at=datetime(2026, 10, 1, tzinfo=timezone.utc))


@pytest.mark.postgres
def test_details_return_exact_recorded_evidence_in_sequence_order(postgres_engine, detail_client):
    correlation = uuid4()
    with postgres_engine.begin() as connection:
        job = create(connection)
        other = create(connection)
        options = dict(stage="execution", actor="synthetic-test", correlation_id=correlation, at=job["created_at"])
        transition_job(connection, job["id"], "running", message="Execution started", **options)
        transition_job(connection, job["id"], "failed", message="Recorded device timeout",
                       error_code="SYNTHETIC_TIMEOUT", error_message="The fictional device exceeded its execution window.",
                       details={"timeout_seconds": 30, "synthetic": True, "nested": {"attempt": 1}}, **options)
    response = detail_client.get(f"/jobs/{job['id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["job"]["status"] == "failed"
    assert body["job"]["provider"] == job["provider"]
    assert body["job"]["target"] == job["target"]
    assert body["job"]["error_message"] == "The fictional device exceeded its execution window."
    assert [event["sequence"] for event in body["events"]] == [1, 2, 3]
    assert len({event["occurred_at"] for event in body["events"]}) == 1
    assert all(event["job_id"] == str(job["id"]) and event["job_id"] != str(other["id"]) for event in body["events"])
    assert body["events"][-1]["correlation_id"] == str(correlation)
    assert body["events"][-1]["details"] == {"timeout_seconds": 30, "synthetic": True, "nested": {"attempt": 1}}
    assert body["history_complete"] is True


@pytest.mark.postgres
def test_incomplete_history_is_reported_without_synthetic_events(postgres_engine, detail_client):
    with postgres_engine.begin() as connection:
        job = create(connection)
        # Reproduce missing audit events from a direct SQL writer without fabricating history.
        connection.execute(update(jobs).where(jobs.c.id == job["id"]).values(
            status="running", version=2, started_at=job["created_at"]))
        connection.execute(update(jobs).where(jobs.c.id == job["id"]).values(
            status="failed", version=3, finished_at=job["created_at"],
            error_stage="execution", error_code="RECORDED_FAILURE", error_message="Recorded failure only"))
    body = detail_client.get(f"/jobs/{job['id']}").json()
    assert body["history_complete"] is False
    assert len(body["events"]) == 1
    assert body["job"]["error_message"] == "Recorded failure only"
    assert not any(event["to_status"] == "failed" for event in body["events"])


@pytest.mark.postgres
def test_queued_job_has_null_outcome_and_unknown_id_is_404(postgres_engine, detail_client):
    with postgres_engine.begin() as connection:
        job = create(connection)
    body = detail_client.get(f"/jobs/{job['id']}").json()
    assert body["job"]["error_message"] is None
    assert body["job"]["started_at"] is None and body["job"]["finished_at"] is None
    assert body["history_complete"] is True
    assert detail_client.get(f"/jobs/{uuid4()}").status_code == 404


def test_invalid_job_id_is_422():
    with TestClient(make_test_app()) as client:
        assert client.get("/jobs/not-a-uuid").status_code == 422


def test_details_outage_is_sanitized():
    with TestClient(make_test_app()) as client:
        with patch.object(client.app.state.engine, "connect", side_effect=OperationalError("secret-host", {}, Exception("secret-password"))):
            response = client.get(f"/jobs/{uuid4()}")
    assert response.status_code == 503
    assert response.json() == {"detail": "Job evidence is temporarily unavailable. Please try again."}
    assert "secret" not in response.text
