import json
from pathlib import Path

import pytest

from app.export_example import export_example
from app.experiment_seed import seed_experiment
from app.models import jobs
from sqlalchemy import func, select

pytestmark = pytest.mark.postgres


def test_browser_snapshot_reproduces_the_seed_and_existing_calculations(db):
    seed_experiment(db)
    before = db.scalar(select(func.count()).select_from(jobs))
    manifest, snapshot = export_example(db)
    assert export_example(db) == (manifest, snapshot)
    directory = Path(__file__).resolve().parents[2] / 'frontend/src/data'
    assert manifest == json.loads((directory / 'exampleManifest.json').read_text())
    assert snapshot == json.loads((directory / 'exampleSnapshot.json').read_text())
    assert before == db.scalar(select(func.count()).select_from(jobs)) == 56
    assert len(snapshot['jobs']) == 56
    assert all(item['history_complete'] for item in snapshot['jobs'])
    assert sum(len(item['events']) for item in snapshot['jobs']) == 315
    forward = snapshot['comparisons'][f"{manifest['baseline']}:{manifest['candidate']}"]
    assert forward['matched_groups'] == 4 and forward['selected_jobs'] == 56
    job_ids = {item['job']['id'] for item in snapshot['jobs']}
    for row in forward['rows']:
        for side in ('baseline', 'candidate'):
            assert {job['id'] for job in row[side]['jobs']} <= job_ids


def test_export_refuses_an_unseeded_database(db):
    with pytest.raises(ValueError, match='Seed compiler-comparison-v1'):
        export_example(db)
