"""Network replay, API parity and real PostgreSQL invariants."""
import copy
import json
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, insert, select, update
from sqlalchemy.exc import IntegrityError

from app.networking import NetworkEvent, replay, record_network_event, OPERATION
from app.network_seed import seed_networking, export_networking, IDS
from app.models import jobs, job_events, execution_parts, networked_runs, quantum_links
from app.transitions import record_progress, transition_job
from app.config import Settings
from app.main import create_app

SNAPSHOT = Path(__file__).resolve().parents[2] / 'frontend/src/data/networkSnapshot.json'


def evidence(scenario='success'):
    return next(item for item in json.loads(SNAPSHOT.read_text())['jobs'] if item['job']['scenario'] == f'network_{scenario}')


def test_recorded_success_timeout_and_missing_remote_end():
    success = evidence()
    _, state, metrics, output = replay(success['networking']['parts'], success['networking']['links'], success['events'])
    assert state == 'consumed' and metrics.execution_seconds == 11
    assert metrics.waiting_seconds == 4 and metrics.remote_seconds == 2
    assert (metrics.successes, metrics.attempts) == (1, 2) and output == success['job']['result']
    timeout = evidence('timeout')
    _, state, metrics, output = replay(timeout['networking']['parts'], timeout['networking']['links'], timeout['events'])
    assert state == 'timeout' and metrics.waiting_seconds == 12 and metrics.execution_seconds == 15
    assert metrics.remote_seconds is None and output is None and metrics.successes == 0 and metrics.attempts == 2
    prefix = success['events'][:next(i for i, e in enumerate(success['events']) if e['details'].get('network', {}).get('kind') == 'remote_completed')]
    _, _, metrics, output = replay(success['networking']['parts'], success['networking']['links'], prefix)
    assert metrics.remote_seconds is None and output is None and metrics.execution_seconds is None


@pytest.mark.parametrize('payload', [
    {'kind': 'attempt_completed', 'outcome': 'failed'},
    {'kind': 'remote_started', 'link_id': str(uuid4()), 'operation_id': OPERATION},
    {'kind': 'part_started', 'part_id': str(uuid4()), 'outcome': 'succeeded'},
    {'kind': 'execution_started', 'extra': True},
])
def test_payload_shapes_are_validated(payload):
    with pytest.raises(ValueError): NetworkEvent.model_validate(payload)


@pytest.mark.parametrize('mutation', ['ungenerated', 'double_consume', 'foreign_part', 'foreign_link', 'duplicate_attempt', 'early_timeout', 'early_output', 'timeout_remote'])
def test_replay_rejects_contradictions(mutation):
    item = evidence()
    events = copy.deepcopy(item['events'])
    network = lambda e: e['details'].get('network', {})
    get = lambda kind: next(e for e in events if network(e).get('kind') == kind)
    if mutation == 'ungenerated': network(get('remote_started'))['resource_id'] = 'unknown-pair'
    if mutation == 'double_consume':
        index = events.index(get('remote_started'))
        events.insert(index + 1, copy.deepcopy(events[index]))
    if mutation == 'foreign_part': network(get('part_started'))['part_id'] = str(uuid4())
    if mutation == 'foreign_link': network(get('entanglement_requested'))['link_id'] = str(uuid4())
    if mutation == 'duplicate_attempt':
        attempts = [e for e in events if network(e).get('kind') == 'attempt_completed']
        network(attempts[1])['attempt_id'] = network(attempts[0])['attempt_id']
    if mutation == 'early_timeout':
        target = get('remote_started'); network(target).update(kind='entanglement_timeout'); network(target).pop('resource_id')
    if mutation == 'early_output': events.remove(get('part_completed'))
    if mutation == 'timeout_remote':
        extra = copy.deepcopy(get('remote_started'))
        item = evidence('timeout'); events = copy.deepcopy(item['events'])
        extra['details']['network']['link_id'] = item['networking']['links'][0]['id']; events.append(extra)
    with pytest.raises(ValueError): replay(item['networking']['parts'], item['networking']['links'], events)


@pytest.mark.postgres
def test_seed_export_and_api_agree_with_bundled_snapshot(postgres_engine):
    with postgres_engine.begin() as connection:
        assert seed_networking(connection) == {'inserted': 2, 'skipped': 0}
        assert seed_networking(connection) == {'inserted': 0, 'skipped': 2}
        assert connection.scalar(select(func.count()).select_from(jobs)) == 2
        assert connection.scalar(select(func.count()).select_from(execution_parts)) == 4
        snapshot = export_networking(connection)
        assert snapshot == json.loads(SNAPSHOT.read_text())
    settings = Settings(_env_file=None, postgres_db='test', postgres_user='test', postgres_password='test')
    with patch('app.main.make_engine', return_value=postgres_engine), TestClient(create_app(settings)) as client:
        for item in snapshot['jobs']: assert client.get(f"/jobs/{item['job']['id']}").json() == item
        page = client.get('/jobs').json()
        assert page['total'] == 2 and all(j['execution_method'] == 'entanglement_network' for j in page['items'])
        overview = client.get('/overview').json()
        assert overview['total_jobs'] == 2 and overview['execution']['failed'] == 1
        assert overview['failures_by_stage'][2] == {'key': 'execution', 'count': 1}


class StopFixture(Exception): pass


def active_prefix(db, stop_kind='entanglement_requested'):
    original = record_network_event
    def emit(connection, job_id, payload, **kwargs):
        if payload['kind'] == stop_kind: raise StopFixture()
        return original(connection, job_id, payload, **kwargs)
    with patch('app.network_seed.record_network_event', side_effect=emit), pytest.raises(StopFixture): seed_networking(db)
    return db.execute(select(jobs).where(jobs.c.id == IDS['success'])).mappings().one()


@pytest.mark.postgres
def test_part_and_parent_event_roll_back_together(db):
    job = active_prefix(db, 'part_started')
    part = db.execute(select(execution_parts).where(execution_parts.c.job_id == job['id'])).mappings().first()
    with patch('app.transitions._event', side_effect=RuntimeError('event rejected')), pytest.raises(RuntimeError):
        record_network_event(db, job['id'], {'kind': 'part_started', 'part_id': str(part['id'])}, at=job['updated_at'], correlation_id=uuid4())
    assert db.scalar(select(jobs.c.version).where(jobs.c.id == job['id'])) == job['version']
    assert db.scalar(select(execution_parts.c.status).where(execution_parts.c.id == part['id'])) == 'pending'
    assert db.scalar(select(func.count()).select_from(job_events).where(job_events.c.job_id == job['id'])) == job['version']


@pytest.mark.postgres
def test_domain_rejects_cross_parent_events_and_ungenerated_pair(db):
    job = active_prefix(db)
    link = db.scalar(select(quantum_links.c.id).where(quantum_links.c.job_id == job['id']))
    for payload in ({'kind': 'remote_started', 'link_id': str(link), 'operation_id': OPERATION, 'resource_id': 'not-generated'}, {'kind': 'part_started', 'part_id': str(uuid4())}):
        with pytest.raises(ValueError): record_network_event(db, job['id'], payload, at=job['updated_at'], correlation_id=uuid4())
    assert db.scalar(select(jobs.c.version).where(jobs.c.id == job['id'])) == job['version']
    with pytest.raises((ValueError, IntegrityError)):
        record_progress(db, job['id'], stage='execution', message='Bypass', actor='test', correlation_id=uuid4(), at=job['updated_at'], details={'network': {'kind': 'remote_started', 'link_id': str(link), 'operation_id': OPERATION, 'resource_id': 'unknown'}})
    with pytest.raises(IntegrityError), db.begin_nested():
        transition_job(db, job['id'], 'succeeded', stage='execution', message='Premature success', actor='test', correlation_id=uuid4(), result={'fake': True}, at=job['updated_at'])


@pytest.mark.postgres
@pytest.mark.parametrize('table', [execution_parts, quantum_links, networked_runs])
def test_related_records_immutable_after_parent_terminal(db, table):
    seed_networking(db)
    values = {'status': 'blocked'} if table is execution_parts else {'channel_type': 'synthetic_entanglement'} if table is quantum_links else {'schema_version': '1'}
    with pytest.raises(IntegrityError), db.begin_nested(): db.execute(update(table).where(table.c.job_id == IDS['success']).values(**values))
    row = dict(db.execute(select(table).where(table.c.job_id == IDS['success'])).mappings().first())
    if 'id' in row: row['id'] = uuid4()
    with pytest.raises(IntegrityError), db.begin_nested(): db.execute(insert(table).values(**row))


@pytest.mark.postgres
def test_outer_rollback_removes_all_network_evidence(postgres_engine):
    with postgres_engine.connect() as connection:
        transaction = connection.begin(); seed_networking(connection); transaction.rollback()
        for table in (jobs, job_events, networked_runs, execution_parts, quantum_links): assert connection.scalar(select(func.count()).select_from(table)) == 0


@pytest.mark.postgres
def test_database_rejects_cross_parent_link_endpoints(db):
    from app.transitions import create_job
    first = active_prefix(db)
    other = create_job(db, name='Other distributed attempt', provider=first['provider'], target=first['target'],
                       requested_by='test', scenario='network_success', seed=4, specification=first['specification'], at=first['created_at'])
    db.execute(insert(networked_runs).values(job_id=other['id'], execution_method='entanglement_network', schema_version='1', plan_version='two-machine-v1', synthetic=True))
    original = dict(db.execute(select(execution_parts).where(execution_parts.c.job_id == first['id'])).mappings().first())
    own_part = {**original, 'id': uuid4(), 'job_id': other['id'], 'status': 'pending', 'started_at': None, 'prepared_at': None}
    db.execute(insert(execution_parts).values(**own_part))
    with pytest.raises(IntegrityError), db.begin_nested():
        db.execute(insert(quantum_links).values(id=uuid4(), job_id=other['id'], part_a_id=own_part['id'], part_b_id=original['id'], channel_type='synthetic_entanglement'))
    with pytest.raises(IntegrityError), db.begin_nested():
        db.execute(insert(quantum_links).values(id=uuid4(), job_id=other['id'], part_a_id=own_part['id'], part_b_id=own_part['id'], channel_type='synthetic_entanglement'))


@pytest.mark.postgres
@pytest.mark.parametrize('kind', ['foreign_part', 'foreign_link', 'ungenerated', 'double_consume', 'early_timeout', 'bad_payload'])
def test_database_validates_network_events_even_when_domain_is_bypassed(db, kind):
    job = active_prefix(db, 'remote_completed' if kind == 'double_consume' else 'entanglement_requested')
    link = db.scalar(select(quantum_links.c.id).where(quantum_links.c.job_id == job['id']))
    payloads = {
        'foreign_part': {'kind': 'part_started', 'part_id': str(uuid4())},
        'foreign_link': {'kind': 'entanglement_requested', 'link_id': str(uuid4()), 'operation_id': OPERATION, 'deadline': '2026-10-14T12:00:20Z'},
        'ungenerated': {'kind': 'remote_started', 'link_id': str(link), 'operation_id': OPERATION, 'resource_id': 'unknown'},
        'double_consume': {'kind': 'remote_started', 'link_id': str(link), 'operation_id': OPERATION, 'resource_id': 'pair-1'},
        'early_timeout': {'kind': 'entanglement_timeout', 'link_id': str(link), 'operation_id': OPERATION},
        'bad_payload': {'kind': 'attempt_completed', 'link_id': str(link)},
    }
    with pytest.raises(IntegrityError), db.begin_nested():
        db.execute(update(jobs).where(jobs.c.id == job['id']).values(version=job['version'] + 1))
        db.execute(insert(job_events).values(id=uuid4(), job_id=job['id'], sequence=job['version'] + 1,
            occurred_at=job['updated_at'], stage='execution', from_status='running', to_status='running',
            message='Direct write', details={'network': payloads[kind]}, correlation_id=uuid4(), actor='test'))
    assert db.scalar(select(jobs.c.version).where(jobs.c.id == job['id'])) == job['version']
