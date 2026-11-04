"""Optional deterministic network fixtures, built through the domain write path."""
import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID, uuid5

from sqlalchemy import insert, select, text
from app.models import jobs, job_events, networked_runs, execution_parts, quantum_links
from app.networking import METHOD, OPERATION, load_network, record_network_event
from app.transitions import create_job, record_progress, transition_job
from app.job_details import JobEvidence, history_complete
from app.workload_metadata import WorkloadMetadata

DATASET = 'quantum-networking-v1'
NAMESPACE = UUID('e220615b-c182-42b2-a0e6-2403071b0ce6')
IDS = {scenario: uuid5(NAMESPACE, scenario) for scenario in ('success', 'timeout')}


def seed_networking(connection):
    connection.execute(text('SELECT pg_advisory_xact_lock(735120028)'))
    inserted = skipped = 0
    for index, (scenario, job_id) in enumerate(IDS.items()):
        existing = connection.execute(select(jobs).where(jobs.c.id == job_id)).mappings().one_or_none()
        if existing is not None:
            if existing['specification'].get('seed_dataset') != DATASET:
                raise ValueError('Network seed ID collision')
            events = connection.execute(select(job_events).where(job_events.c.job_id == job_id).order_by(job_events.c.sequence)).mappings().all()
            evidence = load_network(connection, existing, events)
            if evidence is None or evidence.issues or not history_complete(existing, events):
                raise ValueError('Existing network fixture is incomplete; refusing to overwrite')
            skipped += 1
            continue
        base = datetime(2026, 10, 14, 12, index, tzinfo=timezone.utc)
        at = lambda seconds: base + timedelta(seconds=seconds)
        end = 16 if scenario == 'success' else 20
        correlation = uuid5(job_id, 'correlation')
        common = dict(actor='network-fixture', correlation_id=correlation)
        create_job(connection, job_id=job_id, name=f'Synthetic network {scenario}',
            provider='Synthetic distributed system', target='Synthetic QPU A ↔ QPU B',
            external_reference=f'NET-{scenario.upper()}', requested_by='demo.network.operator',
            scenario=f'network_{scenario}', seed=20261104, simulation_version='network-v1',
            specification={'synthetic': True, 'seed_dataset': DATASET, 'execution_method': METHOD,
                'program': {'id': 'distributed-bell-example', 'revision': 'synthetic-r1', 'inputs': {'initial_state': '00'}},
                'network_plan': {'version': 'two-machine-v1', 'topology': 'A-B', 'operation': OPERATION,
                                 'channel': 'synthetic_entanglement', 'deadline_seconds': 12}},
            metadata=WorkloadMetadata(program_name='Synthetic distributed Bell example', program_revision='synthetic-r1',
                source_language='Synthetic QASM-like', compiler_name='Synthetic network compiler', compiler_version='synthetic-network-1.0',
                optimisation_settings={'mapping': 'fixed-A-B'}, requested_shots=1024,
                compilation_started_at=at(1), compilation_finished_at=at(3), queue_entered_at=at(3), queue_left_at=at(5),
                execution_started_at=at(5), execution_finished_at=at(end)), at=base, correlation_id=correlation)
        connection.execute(insert(networked_runs).values(job_id=job_id, execution_method=METHOD, schema_version='1', plan_version='two-machine-v1', synthetic=True))
        part_ids = [uuid5(job_id, f'part-{label}') for label in ('A', 'B')]
        for label, part_id in zip(('A', 'B'), part_ids):
            connection.execute(insert(execution_parts).values(id=part_id, job_id=job_id, label=f'Machine {label}',
                provider=f'Synthetic provider {label}', target=f'Synthetic QPU {label}', role='control' if label == 'A' else 'target',
                qubit_ids=[f'{label}:q0'], status='pending'))
        link_id = uuid5(job_id, 'link-A-B')
        connection.execute(insert(quantum_links).values(id=link_id, job_id=job_id, part_a_id=part_ids[0], part_b_id=part_ids[1], channel_type='synthetic_entanglement'))
        transition_job(connection, job_id, 'running', stage='compilation', message='Shared source compilation started', at=at(1), **common)
        record_progress(connection, job_id, stage='compilation', message='Two-part execution plan compiled', details={'plan_version': 'two-machine-v1'}, at=at(3), **common)
        record_progress(connection, job_id, stage='queueing', message='Execution queue entered', at=at(3), **common)
        record_progress(connection, job_id, stage='queueing', message='Execution queue left', at=at(5), **common)
        def emit(seconds, kind, **fields):
            record_network_event(connection, job_id, {'kind': kind, **fields}, at=at(seconds), **common)
        def linked(seconds, kind, **fields):
            emit(seconds, kind, link_id=str(link_id), operation_id=OPERATION, **fields)
        emit(5, 'execution_started')
        for part_id in part_ids:
            emit(5, 'part_started', part_id=str(part_id))
        for part_id in part_ids:
            emit(7, 'local_prepared', part_id=str(part_id))
        linked(8, 'entanglement_requested', deadline=at(20).isoformat())
        linked(10, 'attempt_completed', attempt_id='attempt-1', outcome='failed')
        if scenario == 'success':
            linked(12, 'attempt_completed', attempt_id='attempt-2', outcome='succeeded', resource_id='pair-1')
            linked(12, 'remote_started', resource_id='pair-1')
            linked(14, 'remote_completed', resource_id='pair-1')
            for part_id in part_ids:
                emit(15, 'part_completed', part_id=str(part_id))
            output = {'synthetic': True, 'counts': {'00': 512, '11': 512}, 'shots': 1024}
            emit(16, 'final_output', output=output)
            transition_job(connection, job_id, 'succeeded', stage='execution', message='Network execution completed', result=output, at=at(16), **common)
        else:
            linked(16, 'attempt_completed', attempt_id='attempt-2', outcome='failed')
            linked(20, 'entanglement_timeout')
            for part_id in part_ids:
                emit(20, 'part_aborted', part_id=str(part_id))
            transition_job(connection, job_id, 'failed', stage='execution', message='Entanglement deadline expired',
                error_code='ENTANGLEMENT_TIMEOUT', error_message='Coordination failure: entanglement deadline expired; no device fault recorded',
                details={'link_id': str(link_id), 'operation_id': OPERATION, 'cause': 'coordination_failure'}, at=at(20), **common)
        inserted += 1
    return {'inserted': inserted, 'skipped': skipped}


def export_networking(connection):
    evidence = []
    for scenario, job_id in IDS.items():
        job = connection.execute(select(jobs).where(jobs.c.id == job_id)).mappings().one()
        events = connection.execute(select(job_events).where(job_events.c.job_id == job_id).order_by(job_events.c.sequence)).mappings().all()
        network = load_network(connection, job, events)
        if job['specification'].get('seed_dataset') != DATASET or job['specification'].get('synthetic') is not True or network is None or network.issues or not history_complete(job, events):
            raise ValueError('Export requires complete validated synthetic database fixtures')
        evidence.append(JobEvidence(job={**job, 'execution_method': METHOD}, events=events, history_complete=True, networking=network).model_dump(mode='json'))
    return {'dataset': DATASET, 'source': 'Validated PostgreSQL historical synthetic fixtures; no live execution',
            'fixture_ids': {key: str(value) for key, value in IDS.items()}, 'jobs': evidence}


def main():
    from app.config import Settings
    from app.database import make_engine
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--export', type=Path, help='Export validated fixtures after seeding')
    args = parser.parse_args()
    engine = make_engine(Settings())
    try:
        with engine.begin() as connection:
            summary = seed_networking(connection)
        if args.export:
            with engine.connect().execution_options(isolation_level='REPEATABLE READ') as connection:
                with connection.begin():
                    snapshot = export_networking(connection)
            args.export.write_text(json.dumps(snapshot, indent=2, sort_keys=True) + '\n')
        print(json.dumps(summary))
    finally:
        engine.dispose()


if __name__ == '__main__':
    main()
