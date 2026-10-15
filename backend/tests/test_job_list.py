from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.main import create_app
from app.transitions import create_job, transition_job


def app_for_tests():
    return create_app(Settings(_env_file=None, postgres_db="test", postgres_user="test", postgres_password="test"))


@pytest.fixture
def client(postgres_engine):
    with postgres_engine.begin() as connection:
        for number, provider, status, when, reference in [
            (1, "Synthetic Aurora Labs", "failed", "2026-10-01T00:00:00+00:00", "AUR-001"),
            (2, "Synthetic Aurora Labs", "failed", "2026-10-02T23:59:59+00:00", "AUR-002"),
            (3, "Synthetic Nebula Works", "failed", "2026-10-02T12:00:00+00:00", "NEB-003"),
            (4, "Synthetic Aurora Labs", "succeeded", "2026-10-02T12:00:00+00:00", "AUR-004"),
            (5, "Synthetic Aurora Labs", "queued", "2026-10-03T00:00:00+00:00", None),
            (6, "Synthetic Aurora Labs", "queued", "2026-10-03T00:00:00+00:00", "LITERAL_%"),
        ]:
            at = datetime.fromisoformat(when)
            job = create_job(connection, job_id=UUID(int=number), name=f"Synthetic job {number}",
                             provider=provider, target="simulator-8q", requested_by="demo.operator",
                             scenario="test", seed=number, at=at, external_reference=reference)
            common = dict(actor="synthetic-test", correlation_id=uuid4(), stage="execution", message="Synthetic test")
            if status != "queued":
                transition_job(connection, job["id"], "running", at=at + timedelta(seconds=1), **common)
                transition_job(connection, job["id"], status, at=at + timedelta(seconds=2),
                               result={} if status == "succeeded" else None,
                               error_code="SYNTHETIC_FAILURE" if status == "failed" else None,
                               error_message="Synthetic failure" if status == "failed" else None, **common)
    with patch("app.main.make_engine", return_value=postgres_engine):
        with TestClient(app_for_tests()) as client:
            yield client


@pytest.mark.postgres
def test_combined_status_provider_and_inclusive_dates(client):
    result = client.get("/jobs", params={"status": "failed", "provider": "Synthetic Aurora Labs",
                        "submitted_from": "2026-10-02", "submitted_to": "2026-10-02"})
    assert result.status_code == 200
    body = result.json()
    assert [item["external_reference"] for item in body["items"]] == ["AUR-002"]
    assert body["total"] == 1
    assert body["providers"] == ["Synthetic Aurora Labs", "Synthetic Nebula Works"]
    assert "specification" not in body["items"][0]


@pytest.mark.postgres
def test_exact_id_or_case_insensitive_reference_search(client):
    for q in (str(UUID(int=2)), "aur-002", "  AUR-002  "):
        body = client.get("/jobs", params={"q": q}).json()
        assert body["total"] == 1
        assert body["items"][0]["id"] == str(UUID(int=2))
    assert client.get("/jobs", params={"q": "AUR-00"}).json()["total"] == 0
    assert client.get("/jobs", params={"q": "%"}).json()["total"] == 0
    assert client.get("/jobs", params={"q": "literal_%"}).json()["total"] == 1
    assert client.get("/jobs", params={"q": "aur-002", "status": "queued"}).json()["total"] == 0
    assert client.get("/jobs", params={"q": "' OR 1=1 --"}).json()["total"] == 0


@pytest.mark.postgres
def test_stable_order_pagination_and_boundaries(client):
    pages = [client.get("/jobs", params={"page_size": 2, "page": page}).json() for page in range(1, 5)]
    assert [item["id"] for page in pages for item in page["items"]] == [str(UUID(int=n)) for n in (6, 5, 2, 4, 3, 1)]
    assert pages[0]["total"] == 6
    assert pages[0]["total_pages"] == 3
    assert pages[2]["page"] == 3
    assert pages[3]["items"] == []
    assert client.get("/jobs", params={"page_size": 100}).json()["page_size"] == 100
    empty = client.get("/jobs", params={"provider": "Unknown fictional provider"}).json()
    assert empty["total"] == 0 and empty["total_pages"] == 0 and empty["items"] == []


@pytest.mark.postgres
def test_date_bounds_are_submission_dates_in_utc(client):
    assert client.get("/jobs", params={"submitted_to": "2026-10-01"}).json()["total"] == 1
    assert client.get("/jobs", params={"submitted_from": "2026-10-03"}).json()["total"] == 2


@pytest.mark.parametrize("params", [
    {"status": "finished"}, {"provider": " "}, {"provider": "x" * 81},
    {"q": " "}, {"q": "x" * 161}, {"page": 0}, {"page": -1}, {"page": "abc"},
    {"page": "1.5"}, {"page": 1000001}, {"page_size": 0}, {"page_size": 101},
    {"page_size": "abc"}, {"submitted_from": "2026-02-30"}, {"submitted_to": "yesterday"},
    {"submitted_from": "2026-10-03", "submitted_to": "2026-10-01"},
    {"submitted_to": "9999-12-31"}, {"unknown_filter": "x"},
    {"submitted_from": "2026-10-01T00:00:00Z"},
])
def test_invalid_queries_are_rejected_without_database_access(params):
    with TestClient(app_for_tests()) as client:
        response = client.get("/jobs", params=params)
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)


def test_database_outage_has_sanitized_error():
    with TestClient(app_for_tests()) as client:
        with patch.object(client.app.state.engine, "connect", side_effect=OperationalError("secret-host", {}, Exception("secret-password"))):
            response = client.get("/jobs")
    assert response.status_code == 503
    assert response.json() == {"detail": "Jobs are temporarily unavailable. Please try again."}
    assert "secret" not in response.text
