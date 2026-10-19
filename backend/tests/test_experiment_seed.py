"""Real PostgreSQL checks for the paired synthetic experiment and scoped reset."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, insert, select, text
from sqlalchemy.exc import IntegrityError

from app.config import Settings
from app.experiment_seed import (
    DATASET, EXPERIMENT_ID, comparison_report, experiment_plans, seed_experiment,
)
from app.main import create_app
from app.models import job_events, jobs
from app.seed import seed_jobs
from app.transitions import create_job
from app.workload_metadata import WorkloadMetadata

pytestmark = pytest.mark.postgres


def snapshot(db):
    return (list(db.execute(select(jobs).order_by(jobs.c.id))),
            list(db.execute(select(job_events).order_by(job_events.c.job_id, job_events.c.sequence))))


def assert_guards_enabled(db):
    assert db.execute(text("SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid IN "
                           "('jobs'::regclass, 'job_events'::regclass) AND NOT tgisinternal "
                           "ORDER BY tgname")).all() == [
        ("guard_event_write", "O"), ("guard_job_reference", "O"), ("guard_job_write", "O")]


def test_expected_comparison_outcomes_and_controlled_inputs(db):
    assert seed_experiment(db)["inserted"] == 56
    report = comparison_report(db)
    assert report["jobs"] == 56 and report["events"] == 315
    groups = {(item["workload"], item["arm"]): item for item in report["groups"]}
    for (workload, arm), item in groups.items():
        failed = workload == "compile-regression" and arm == "candidate"
        assert item["runs"] == 7
        assert item["failed"] == (7 if failed else 0)
        assert item["succeeded"] == (0 if failed else 7)
        assert item["median_compilation_seconds"] == 4
        assert item["median_queue_seconds"] == (None if failed else 2)
        assert item["median_execution_seconds"] == (None if failed else 18 if workload == "execution-slowdown" and arm == "candidate" else 10)
        assert item["execution_samples"] == (0 if failed else 7)
    baseline, candidate = groups["resource-gain", "baseline"], groups["resource-gain", "candidate"]
    for key, expected in (("logical_qubits", (32, 24)), ("circuit_depth", (240, 168)), ("gate_count", (1600, 1120))):
        assert (baseline[f"median_estimated_{key}"], candidate[f"median_estimated_{key}"]) == expected
    for key in ("logical_qubits", "circuit_depth", "gate_count"):
        assert groups["compile-regression", "candidate"][f"median_estimated_{key}"] is None
    rows = db.execute(select(jobs)).mappings().all()
    for row in rows:
        spec = row["specification"]
        assert spec["synthetic"] is True and spec["experiment"]["id"] == EXPERIMENT_ID
        paired = next(other for other in rows if other["specification"]["run"]["paired_run_key"] == spec["run"]["paired_run_key"] and other["id"] != row["id"])
        assert spec["workload"] == paired["specification"]["workload"]
        assert spec["comparison"]["changed_configuration_fields"] == ["metadata.compiler_version"]
        assert spec["comparison"]["intended_difference"]
        assert (row["provider"], row["target"], spec["shots"]) == (paired["provider"], paired["target"], paired["specification"]["shots"])
        for key in ("program_name", "program_revision", "source_language", "compiler_name", "optimisation_settings", "requested_shots"):
            assert row["metadata"][key] == paired["metadata"][key]
        assert row["metadata"]["compiler_version"] != paired["metadata"]["compiler_version"]
        if spec["workload"]["key"] == "unchanged":
            assert WorkloadMetadata.model_validate(row["metadata"]).durations() == WorkloadMetadata.model_validate(paired["metadata"]).durations()


def test_repeat_and_reset_reproduce_all_rows_and_preserve_existing_demo(db):
    seed_jobs(db)
    historical = snapshot(db)
    seed_experiment(db)
    before = snapshot(db)
    report = comparison_report(db)
    assert seed_experiment(db) == {"dataset": DATASET, "synthetic": True, "seed": 20261017,
                                   "inserted": 0, "skipped": 56, "removed": 0}
    assert snapshot(db) == before
    summary = seed_experiment(db, reset=True)
    assert summary["removed"] == summary["inserted"] == 56
    assert snapshot(db) == before
    assert comparison_report(db) == report
    assert all(row in before[0] for row in historical[0])
    assert all(row in before[1] for row in historical[1])
    assert db.scalar(select(func.count()).select_from(jobs)) == 256
    assert_guards_enabled(db)
    with pytest.raises(IntegrityError), db.begin_nested():
        db.execute(delete(jobs).where(jobs.c.id == experiment_plans()[0]["id"]))
    with pytest.raises(IntegrityError), db.begin_nested():
        db.execute(delete(job_events).where(job_events.c.job_id == experiment_plans()[0]["id"]))


def test_histories_metadata_and_api_agree(postgres_engine):
    with postgres_engine.begin() as db:
        seed_experiment(db)
    with patch("app.main.make_engine", return_value=postgres_engine):
        with TestClient(create_app(Settings(_env_file=None, postgres_db="test", postgres_user="test", postgres_password="test"))) as client:
            for plan in experiment_plans():
                response = client.get(f"/jobs/{plan['id']}")
                assert response.status_code == 200
                body = response.json()
                job, events = body["job"], body["events"]
                assert body["history_complete"] is True
                assert job["specification"] == plan["specification"]
                metadata = WorkloadMetadata.model_validate(job["metadata"])
                assert job["durations"] == metadata.durations().model_dump()
                assert job["started_at"] == events[1]["occurred_at"]
                assert job["finished_at"] == job["updated_at"] == events[-1]["occurred_at"]
                assert events[-1]["occurred_at"] == metadata.model_dump(mode="json")[
                    "compilation_finished_at" if job["status"] == "failed" else "execution_finished_at"]
                assert len({event["correlation_id"] for event in events}) == 1
                assert events[-1]["details"]["experiment_id"] == EXPERIMENT_ID
                if job["status"] == "failed":
                    assert job["error_stage"] == "compilation"
                    assert job["error_code"] == "SYNTHETIC_CANDIDATE_COMPILE_FAILED"
                    assert job["result"] is None
                    assert job["durations"]["queue_seconds"] is job["durations"]["execution_seconds"] is None
                    assert all(event["stage"] not in {"queueing", "execution"} for event in events)
                    assert metadata.estimated_logical_qubits is None
                else:
                    assert job["error_stage"] is None and job["result"]["synthetic"] is True
                    assert sum(job["result"]["counts"].values()) == metadata.requested_shots
                    assert any(event["stage"] == "queueing" and event["occurred_at"] == metadata.model_dump(mode="json")["queue_entered_at"] for event in events)
            listed = client.get("/jobs", params={"q": "EXP-2-CANDIDATE-1", "status": "failed"}).json()
            assert listed["total"] == 1


def test_reset_failure_rolls_back_evidence_and_trigger_changes(db):
    seed_experiment(db)
    before = snapshot(db)
    with patch("app.experiment_seed._insert_run", side_effect=RuntimeError("insertion failed")):
        with pytest.raises(RuntimeError, match="insertion failed"):
            seed_experiment(db, reset=True)
    assert snapshot(db) == before
    assert_guards_enabled(db)


def test_reset_refuses_unrelated_id_collision(db):
    plan = experiment_plans()[0]
    create_job(db, job_id=plan["id"], name="Unrelated", provider="Synthetic test", target="synthetic",
               requested_by="test", scenario="success", seed=1)
    before = snapshot(db)
    with pytest.raises(ValueError):
        seed_experiment(db)
    with pytest.raises(ValueError, match="collision"):
        seed_experiment(db, reset=True)
    assert snapshot(db) == before
    assert_guards_enabled(db)


def test_reset_refuses_external_retry_dependencies(db):
    seed_experiment(db)
    parent = experiment_plans()[0]["id"]
    # Exercise the modeled lineage without adding a retry API for this stage.
    row = dict(db.execute(select(jobs).where(jobs.c.id == parent)).mappings().one())
    from uuid import uuid4
    row.update(id=uuid4(), name="Unrelated retry", status="queued", version=1,
               started_at=None, finished_at=None, result=None,
               retry_of=parent, original_job_id=parent, specification={"synthetic": True})
    db.execute(insert(jobs).values(**row))
    before = snapshot(db)
    with pytest.raises(ValueError, match="reference"):
        seed_experiment(db, reset=True)
    assert snapshot(db) == before
    assert_guards_enabled(db)


def test_reset_restores_guards_when_delete_itself_fails(db):
    seed_experiment(db)
    before = snapshot(db)
    execute = db.execute

    def fail_delete(statement, *args, **kwargs):
        if getattr(statement, "is_delete", False):
            raise RuntimeError("delete failed with guards suspended")
        return execute(statement, *args, **kwargs)

    with patch.object(db, "execute", side_effect=fail_delete):
        with pytest.raises(RuntimeError, match="guards suspended"):
            seed_experiment(db, reset=True)
    assert snapshot(db) == before
    assert_guards_enabled(db)
