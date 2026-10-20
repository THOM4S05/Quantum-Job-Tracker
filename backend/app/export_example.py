"""Export the existing immutable seeded example for the offline browser demo.

Read-only; run after migrations and `python -m app.seed --dataset compiler-comparison-v1`.
No personal jobs, environment values or database credentials are exported.
"""
import argparse
import json
from pathlib import Path

from sqlalchemy import select

from app.comparisons import compare_jobs
from app.config import Settings
from app.database import make_engine
from app.experiment_seed import DATASET, EXPERIMENT_ID, VERSIONS, experiment_plans
from app.job_details import JobEvidence, history_complete
from app.models import jobs, job_events


def export_example(connection):
    rows = connection.execute(select(jobs).where(jobs.c.specification['experiment']['id'].astext == EXPERIMENT_ID)
                              .order_by(jobs.c.id)).mappings().all()
    if {row['id'] for row in rows} != {plan['id'] for plan in experiment_plans()}:
        raise ValueError('Seed compiler-comparison-v1 before exporting its exact 56 jobs')
    evidence = []
    for row in rows:
        if row['specification'].get('seed_dataset') != DATASET or row['specification'].get('synthetic') is not True:
            raise ValueError('Only identified synthetic fixtures may be exported')
        events = connection.execute(select(job_events).where(job_events.c.job_id == row['id'])
                                    .order_by(job_events.c.sequence)).mappings().all()
        if not history_complete(row, events):
            raise ValueError('Example history is incomplete; export refused')
        evidence.append(JobEvidence(job=row, events=events, history_complete=True).model_dump(mode='json'))
    manifest = {'id': EXPERIMENT_ID, 'name': 'Synthetic compiler comparison v1',
                'baseline': VERSIONS['baseline'], 'candidate': VERSIONS['candidate'], 'synthetic': True}
    comparisons = {}
    for baseline, candidate in ((VERSIONS['baseline'], VERSIONS['candidate']), (VERSIONS['candidate'], VERSIONS['baseline'])):
        comparisons[f'{baseline}:{candidate}'] = {'synthetic': True, 'selection_required': False,
            'experiment_jobs': len(rows), 'experiments': [{'id': EXPERIMENT_ID, 'name': manifest['name']}],
            'compiler_versions': sorted(VERSIONS.values()), **compare_jobs(rows, baseline, candidate)}
    return manifest, {'source': 'Read-only snapshot of the synthetic PostgreSQL seed; no live execution',
                      'dataset': DATASET, 'jobs': evidence, 'comparisons': comparisons}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=Path(__file__).resolve().parents[2] / 'frontend/src/data')
    args = parser.parse_args()
    engine = make_engine(Settings())
    try:
        with engine.connect().execution_options(isolation_level='REPEATABLE READ') as connection:
            with connection.begin():
                manifest, snapshot = export_example(connection)
        args.output_dir.mkdir(parents=True, exist_ok=True)
        for name, content in (('exampleManifest.json', manifest), ('exampleSnapshot.json', snapshot)):
            (args.output_dir / name).write_text(json.dumps(content, indent=2, sort_keys=True) + '\n')
        print('Exported 56 synthetic example jobs, timelines and both compiler comparison directions.')
    finally:
        engine.dispose()


if __name__ == '__main__':
    main()
