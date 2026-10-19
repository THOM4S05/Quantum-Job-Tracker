from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.experiment_seed import EXPERIMENT_ID, seed_experiment
from app.main import create_app
from app.overview import calculate_overview
from app.seed import seed_jobs


def point(seconds):
    return f"2026-10-01T00:00:{seconds:02d}+00:00"


def row(status="succeeded", stage=None, **metadata):
    return {"status": status, "error_stage": stage, "target": "synthetic-target", "metadata": metadata}


def test_known_attempts_denominators_and_timing_samples():
    rows = [
        row(compilation_started_at=point(0), compilation_finished_at=point(2), queue_entered_at=point(2),
            queue_left_at=point(3), execution_started_at=point(6), execution_finished_at=point(16)),
        row("failed", "compilation", compilation_started_at=point(0), compilation_finished_at=point(3)),
        row("failed", "queueing", compilation_finished_at=point(3), queue_entered_at=point(3)),
        row("failed", "execution", compilation_finished_at=point(3), queue_entered_at=point(3),
            execution_started_at=point(5), execution_finished_at=point(9)),
        row("running", compilation_started_at=point(0)),
        row("running", compilation_finished_at=point(2), queue_entered_at=point(2), execution_started_at=point(10)),
        row("queued"),
        row("cancelled", compilation_finished_at=point(2), queue_entered_at=point(2),
            execution_started_at=point(8), execution_finished_at=point(20)),
        row("cancel_requested", compilation_started_at=point(0)),
    ]
    result = calculate_overview(rows)
    assert result["compilation"] == {"succeeded": 4, "failed": 1, "completed": 5, "pending": 1,
        "cancelled": 2, "not_started": 1, "unknown": 0, "rate_percent": 80}
    assert result["execution"] == {"succeeded": 1, "failed": 1, "completed": 2, "pending": 1,
        "cancelled": 2, "not_started": 4, "unknown": 0, "rate_percent": 50}
    assert result["queue_time"] == {"median_seconds": 5, "samples": 4, "excluded": 5}
    assert result["execution_duration"] == {"median_seconds": 7, "samples": 2, "excluded": 7}
    assert result["cancelled_jobs"] == result["cancelling_jobs"] == 1
    assert [item["count"] for item in result["failures_by_stage"]] == [1, 1, 1, 0]
    assert result["jobs_by_target"] == [{"key": "synthetic-target", "count": 9}]


def test_empty_pending_and_cancelled_have_null_metrics_not_zero():
    for rows in ([], [row("queued"), row("running", compilation_started_at=point(1)), row("cancelled")]):
        result = calculate_overview(rows)
        assert result["compilation"]["rate_percent"] is None
        assert result["execution"]["rate_percent"] is None
        assert result["queue_time"]["median_seconds"] is None
        assert result["execution_duration"]["median_seconds"] is None


def test_missing_timestamps_preserve_explicit_outcomes_without_inventing_durations():
    result = calculate_overview([row(), row("failed", "execution"), row("failed", "compilation"),
                                 row("failed", None, compilation_finished_at=point(2))])
    assert result["compilation"]["failed"] == 1
    assert result["compilation"]["unknown"] == 3
    assert result["compilation"]["succeeded"] == 0
    assert result["execution"]["completed"] == 2
    assert result["execution"]["rate_percent"] == 50
    assert result["execution_duration"]["samples"] == result["queue_time"]["samples"] == 0
    assert result["failures_by_stage"][-1] == {"key": "unknown", "count": 1}


def test_zero_durations_are_valid_but_missing_negative_naive_and_invalid_are_excluded():
    result = calculate_overview([
        row(queue_entered_at=point(5), execution_started_at=point(5), execution_finished_at=point(5)),
        row(queue_entered_at=point(8), execution_started_at=point(5), execution_finished_at=point(4)),
        row(queue_entered_at="invalid", execution_started_at=point(5)),
        row(execution_started_at="2026-10-01T00:00:00", execution_finished_at=point(2)),
    ])
    assert result["queue_time"] == result["execution_duration"] == {"median_seconds": 0, "samples": 1, "excluded": 3}


def test_known_later_failure_never_becomes_compilation_failure():
    result = calculate_overview([row("failed", "execution", compilation_finished_at=point(2)),
                                 row("failed", "queueing", compilation_finished_at=point(2))])
    assert result["compilation"]["rate_percent"] == 100
    assert result["compilation"]["failed"] == 0
    assert result["execution"]["rate_percent"] == 0


@pytest.fixture
def overview_client(postgres_engine):
    with patch("app.main.make_engine", return_value=postgres_engine):
        with TestClient(create_app(Settings(_env_file=None, postgres_db="test", postgres_user="test", postgres_password="test"))) as client:
            yield client


@pytest.mark.postgres
def test_real_seed_cohort_filters_and_breakdown_drilldowns(postgres_engine, overview_client):
    with postgres_engine.begin() as connection:
        seed_jobs(connection)
        seed_experiment(connection)
    result = overview_client.get("/overview").json()
    assert result["synthetic"] is True and result["total_jobs"] == 256
    assert result["compilation"]["succeeded"] == 189 and result["compilation"]["failed"] == 27
    assert result["execution"]["completed"] == 149
    assert result["execution"]["succeeded"] == 129
    assert len(result["targets"]) == 5
    filters = {"submitted_from": "2026-10-12", "submitted_to": "2026-10-12", "experiment": EXPERIMENT_ID,
               "target": "synthetic-comparison-simulator", "compiler_version": "synthetic-1.1.0"}
    selected = overview_client.get("/overview", params=filters).json()
    assert selected["total_jobs"] == 28
    assert selected["compilation"]["rate_percent"] == 75
    assert selected["execution"]["rate_percent"] == 100
    assert selected["queue_time"] == {"median_seconds": 2, "samples": 21, "excluded": 7}
    assert selected["experiments"] == [{"id": EXPERIMENT_ID, "name": "Synthetic compiler comparison v1"}]
    for stage in selected["failures_by_stage"]:
        listed = overview_client.get("/jobs", params={**filters, "failure_stage": stage["key"], "status": "failed"}).json()
        assert listed["total"] == stage["count"]
    for target in selected["jobs_by_target"]:
        assert overview_client.get("/jobs", params={**filters, "target": target["key"]}).json()["total"] == target["count"]
    # Range selects submission date, not phase endpoints (all phase activity is later).
    old = overview_client.get("/overview", params={"submitted_from": "2026-10-01", "submitted_to": "2026-10-02"}).json()
    assert old["total_jobs"] == 200 and old["queue_time"]["median_seconds"] == 1
    assert old["compilation"]["rate_percent"] == 87.5 and old["execution"]["rate_percent"] == 80
    empty = overview_client.get("/overview", params={**filters, "target": "absent"}).json()
    assert empty["total_jobs"] == 0 and empty["compilation"]["rate_percent"] is None
    # Global options survive narrowing to an empty cohort.
    assert empty["targets"] == result["targets"]


@pytest.mark.parametrize("params", [
    {"submitted_from": "2026-02-30"}, {"submitted_from": "2026-10-02", "submitted_to": "2026-10-01"},
    {"submitted_to": "9999-12-31"}, {"target": " "}, {"compiler_version": "x" * 81},
    {"experiment": "not-a-uuid"}, {"unexpected": "value"},
])
def test_invalid_cohort_values_are_rejected_for_both_endpoints(params):
    with TestClient(create_app(Settings(_env_file=None, postgres_db="test", postgres_user="test", postgres_password="test"))) as client:
        for endpoint in ("/jobs", "/overview"):
            assert client.get(endpoint, params=params).status_code == 422


def test_overview_database_outage_is_sanitized():
    with TestClient(create_app(Settings(_env_file=None, postgres_db="test", postgres_user="test", postgres_password="test"))) as client:
        with patch.object(client.app.state.engine, "connect", side_effect=OperationalError("secret-host", {}, Exception("secret"))):
            response = client.get("/overview")
    assert response.status_code == 503 and "secret" not in response.text


@pytest.mark.postgres
def test_submission_day_includes_later_execution_and_excludes_next_days_submissions(postgres_engine, overview_client):
    from datetime import timedelta
    from uuid import uuid4
    from app.transitions import create_job, transition_job

    submitted = datetime(2026, 10, 1, 23, 59, 59, tzinfo=timezone.utc)
    with postgres_engine.begin() as connection:
        first = create_job(connection, name="Cross-midnight synthetic run", provider="Synthetic test", target="synthetic",
                           requested_by="test", scenario="success", seed=1, at=submitted,
                           metadata={"compilation_started_at": submitted.isoformat(),
                                     "compilation_finished_at": (submitted + timedelta(seconds=2)).isoformat(),
                                     "queue_entered_at": (submitted + timedelta(seconds=2)).isoformat(),
                                     "execution_started_at": (submitted + timedelta(seconds=5)).isoformat(),
                                     "execution_finished_at": (submitted + timedelta(seconds=15)).isoformat()})
        common = dict(stage="execution", message="Synthetic boundary test", actor="test", correlation_id=uuid4())
        transition_job(connection, first["id"], "running", at=submitted, **common)
        transition_job(connection, first["id"], "succeeded", result={"synthetic": True},
                       at=submitted + timedelta(seconds=15), **common)
        create_job(connection, name="Next-day synthetic run", provider="Synthetic test", target="synthetic",
                   requested_by="test", scenario="queued", seed=2, at=submitted + timedelta(seconds=1))
    params = {"submitted_from": "2026-10-01", "submitted_to": "2026-10-01"}
    overview = overview_client.get("/overview", params=params).json()
    assert overview["total_jobs"] == 1
    assert overview["queue_time"]["median_seconds"] == 3
    assert overview["execution_duration"]["median_seconds"] == 10
    assert overview_client.get("/jobs", params=params).json()["items"][0]["id"] == str(first["id"])
