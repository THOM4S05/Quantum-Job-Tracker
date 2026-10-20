from copy import deepcopy
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.comparisons import compare_jobs, delta
from app.config import Settings
from app.experiment_seed import EXPERIMENT_ID, experiment_plans, seed_experiment
from app.main import create_app

BASELINE, CANDIDATE = 'synthetic-1.0.0', 'synthetic-1.1.0'


def fixtures():
    return [{**plan, 'metadata': plan['metadata'].model_dump(mode='json'), 'target': 'synthetic-comparison-simulator',
             'provider': 'Synthetic Aurora Labs', 'simulation_version': 'compiler-comparison-v1',
             'status': 'failed' if plan['scenario'] == 'compilation_failure' else 'succeeded',
             'error_stage': 'compilation' if plan['scenario'] == 'compilation_failure' else None}
            for plan in experiment_plans()]


def pair():
    return [row for row in fixtures() if row['specification']['workload']['key'] == 'resource-gain'
            and row['specification']['run']['repetition'] == 1]


def metric(row, key):
    return next(item for item in row['metrics'] if item['key'] == key)


def test_seed_matching_outcomes_samples_and_independent_deltas():
    rows = fixtures()
    result = compare_jobs(rows, BASELINE, CANDIDATE)
    assert result['selected_jobs'] == 56 and result['matched_groups'] == 4
    assert sum(item['baseline']['runs'] + item['candidate']['runs'] for item in result['rows']) == 56
    by_workload = {row['workload']: row for row in result['rows']}
    gain = by_workload['resource-gain']
    assert metric(gain, 'estimated_logical_qubits')['absolute_change'] == -8
    assert metric(gain, 'estimated_logical_qubits')['percentage_change'] == -25
    assert metric(gain, 'estimated_circuit_depth')['percentage_change'] == -30
    failure = by_workload['compile-regression']
    assert failure['candidate']['runs'] == failure['candidate']['compilation']['failed'] == 7
    assert metric(failure, 'compilation_success')['absolute_change'] == -100
    assert metric(failure, 'compilation_success')['delta_unit'] == 'pp'
    assert metric(failure, 'compilation_success')['percentage_change'] is None
    assert metric(failure, 'compilation_duration')['candidate'] == {'value': 4, 'samples': 7}
    assert metric(failure, 'execution_duration')['candidate'] == {'value': None, 'samples': 0}
    assert metric(failure, 'execution_success')['absolute_change'] is None
    slowdown = by_workload['execution-slowdown']
    assert metric(slowdown, 'execution_duration')['absolute_change'] == 8
    assert metric(slowdown, 'execution_duration')['percentage_change'] == 80
    assert metric(by_workload['unchanged'], 'execution_duration')['percentage_change'] == 0


@pytest.mark.parametrize('field', ['target', 'provider', 'program_revision', 'inputs', 'requested_shots',
                                   'optimisation_settings', 'compiler_name', 'source_language', 'simulation_version',
                                   'additional_settings', 'additional_workload_settings'])
def test_other_configuration_changes_are_flagged_and_not_compared(field):
    rows = pair()
    candidate = rows[1]
    if field in ('target', 'provider', 'simulation_version'):
        candidate[field] = 'other synthetic configuration'
    elif field == 'inputs':
        candidate['specification']['workload']['inputs'] = {'width': 999}
    elif field == 'additional_settings':
        candidate['specification']['routing_budget'] = 17
    elif field == 'additional_workload_settings':
        candidate['specification']['workload']['precision'] = 'low'
    else:
        candidate['metadata'][field] = 2048 if field == 'requested_shots' else {'level': 3} if field == 'optimisation_settings' else 'changed'
        if field == 'requested_shots':
            candidate['specification']['shots'] = 2048
        if field == 'program_revision':
            candidate['specification']['workload']['program_revision'] = 'changed'
    result = compare_jobs(rows, BASELINE, CANDIDATE)
    assert result['matched_groups'] == 0 and len(result['rows']) == 2
    assert {row['status'] for row in result['rows']} == {'baseline_only', 'candidate_only'}
    assert all(field in row['differences'] for row in result['rows'])
    assert all(item['absolute_change'] is None for row in result['rows'] for item in row['metrics'])


def test_unmatched_workloads_missing_identity_and_contradictory_metadata():
    rows = pair()
    rows[1]['specification']['workload']['key'] = 'different-program'
    result = compare_jobs(rows, BASELINE, CANDIDATE)
    assert len(result['rows']) == 2 and result['matched_groups'] == 0
    rows = pair()
    for row in rows:
        row['specification']['workload'].pop('inputs')
    result = compare_jobs(rows, BASELINE, CANDIDATE)
    assert result['rows'][0]['status'] == 'unverifiable'
    assert 'inputs' in result['rows'][0]['missing_fields']
    rows = pair()
    rows[1]['specification']['shots'] = 99
    result = compare_jobs(rows, BASELINE, CANDIDATE)
    assert 'inconsistent_shots' in result['rows'][0]['missing_fields']
    assert result['matched_groups'] == 0


def test_canonical_object_order_and_partial_matching_do_not_lose_runs():
    rows = pair()
    rows[1]['specification']['workload']['inputs'] = dict(reversed(list(rows[1]['specification']['workload']['inputs'].items())))
    assert compare_jobs(rows, BASELINE, CANDIDATE)['matched_groups'] == 1
    extra = deepcopy(rows[1])
    extra['id'] = 'extra-job'
    extra['target'] = 'synthetic-other-target'
    result = compare_jobs([*rows, extra], BASELINE, CANDIDATE)
    assert result['matched_groups'] == 1 and len(result['rows']) == 2
    assert all('target' in row['differences'] for row in result['rows'])
    assert sum(len(row[side]['jobs']) for row in result['rows'] for side in ('baseline', 'candidate')) == 3


@pytest.mark.parametrize('baseline,candidate,rate,expected', [
    (0, 5, False, (5, None)), (0, 0, False, (0, None)), (None, 5, False, (None, None)),
    (5, None, False, (None, None)), (10, 18, False, (8, 80)), (80, 60, True, (-20, None)),
])
def test_delta_rules(baseline, candidate, rate, expected):
    assert delta(baseline, candidate, rate=rate) == dict(zip(('absolute_change', 'percentage_change'), expected))


def test_missing_and_zero_observations_and_failures_are_not_hidden():
    rows = pair()
    rows[0]['metadata']['estimated_gate_count'] = 0
    rows[0]['metadata']['execution_finished_at'] = None
    rows[1]['status'] = 'failed'
    rows[1]['error_stage'] = 'execution'
    result = compare_jobs(rows, BASELINE, CANDIDATE)['rows'][0]
    assert result['candidate']['execution']['failed'] == 1
    assert metric(result, 'execution_duration')['candidate']['samples'] == 1
    assert metric(result, 'execution_duration')['baseline']['value'] is None
    assert metric(result, 'estimated_gate_count')['absolute_change'] == 1120
    assert metric(result, 'estimated_gate_count')['percentage_change'] is None
    assert compare_jobs([], BASELINE, CANDIDATE)['rows'] == []
    rows[1]['metadata']['compiler_version'] = 'synthetic-other'
    assert compare_jobs(rows, BASELINE, CANDIDATE)['excluded_version_jobs'] == 1


@pytest.fixture
def client(postgres_engine):
    with postgres_engine.begin() as db:
        seed_experiment(db)
    with patch('app.main.make_engine', return_value=postgres_engine):
        with TestClient(create_app(Settings(_env_file=None, postgres_db='test', postgres_user='test', postgres_password='test'))) as client:
            yield client


@pytest.mark.postgres
def test_comparison_api_real_experiment_and_timeline_drilldowns(client):
    options = client.get('/comparisons').json()
    assert options['selection_required'] is True and len(options['experiments']) == 1
    params = {'experiment': EXPERIMENT_ID, 'baseline': BASELINE, 'candidate': CANDIDATE}
    response = client.get('/comparisons', params=params)
    assert response.status_code == 200
    body = response.json()
    assert body['compiler_versions'] == [BASELINE, CANDIDATE]
    assert body['experiment_jobs'] == body['selected_jobs'] == 56
    assert body['matched_groups'] == 4
    ids = set()
    for row in body['rows']:
        for side in ('baseline', 'candidate'):
            for job in row[side]['jobs']:
                ids.add(job['id'])
                evidence = client.get(f"/jobs/{job['id']}").json()
                assert evidence['history_complete'] is True
                assert evidence['job']['metadata']['compiler_version'] == params[side]
    assert len(ids) == 56
    assert client.get('/comparisons', params={**params, 'candidate': 'absent'}).json()['matched_groups'] == 0


@pytest.mark.parametrize('params', [
    {'experiment': 'invalid'}, {'baseline': ' '}, {'candidate': 'x' * 81},
    {'baseline': BASELINE, 'candidate': f' {BASELINE} '}, {'unexpected': 'value'},
])
def test_invalid_comparison_queries(params):
    with TestClient(create_app(Settings(_env_file=None, postgres_db='test', postgres_user='test', postgres_password='test'))) as client:
        assert client.get('/comparisons', params=params).status_code == 422


def test_outage_is_sanitized():
    with TestClient(create_app(Settings(_env_file=None, postgres_db='test', postgres_user='test', postgres_password='test'))) as client:
        with patch.object(client.app.state.engine, 'connect', side_effect=OperationalError('secret-host', {}, Exception('secret'))):
            response = client.get('/comparisons')
    assert response.status_code == 503 and 'secret' not in response.text
