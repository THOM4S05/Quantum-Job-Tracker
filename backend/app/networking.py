"""Typed evidence and replay rules for the historical two-machine milestone."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import insert, select, update

from app.models import execution_parts, quantum_links, networked_runs, job_events

METHOD = 'entanglement_network'
OPERATION = 'remote-cz-1'


class NetworkEvent(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: Literal['execution_started', 'part_started', 'local_prepared', 'part_completed', 'part_aborted',
                  'entanglement_requested', 'attempt_completed', 'entanglement_timeout',
                  'remote_started', 'remote_completed', 'final_output']
    part_id: UUID | None = None
    link_id: UUID | None = None
    operation_id: Literal['remote-cz-1'] | None = None
    attempt_id: str | None = Field(default=None, min_length=1)
    resource_id: str | None = Field(default=None, min_length=1)
    outcome: Literal['failed', 'succeeded'] | None = None
    deadline: AwareDatetime | None = None
    output: dict | None = None

    @model_validator(mode='after')
    def shape(self):
        required = {'kind'}
        if self.kind.startswith('part_') or self.kind == 'local_prepared':
            required |= {'part_id'}
        if self.kind in {'entanglement_requested', 'attempt_completed', 'entanglement_timeout', 'remote_started', 'remote_completed'}:
            required |= {'link_id', 'operation_id'}
        if self.kind == 'entanglement_requested':
            required |= {'deadline'}
        if self.kind == 'attempt_completed':
            required |= {'attempt_id', 'outcome'}
            if self.outcome == 'succeeded':
                required |= {'resource_id'}
        if self.kind in {'remote_started', 'remote_completed'}:
            required |= {'resource_id'}
        if self.kind == 'final_output':
            required |= {'output'}
        present = {key for key, value in self.model_dump().items() if value is not None}
        if present != required:
            raise ValueError(f'{self.kind} requires exactly {sorted(required)}')
        return self


class ExecutionPart(BaseModel):
    id: UUID
    job_id: UUID
    label: str
    provider: str
    target: str
    role: str
    qubit_ids: list[str]
    status: Literal['pending', 'preparing', 'blocked', 'completed', 'aborted']
    started_at: datetime | None
    prepared_at: datetime | None
    finished_at: datetime | None
    failure_code: str | None
    failure_message: str | None


class QuantumLink(BaseModel):
    id: UUID
    job_id: UUID
    part_a_id: UUID
    part_b_id: UUID
    channel_type: Literal['synthetic_entanglement']


class NetworkMetrics(BaseModel):
    execution_seconds: float | None = None
    waiting_seconds: float | None = None
    wait_outcome: Literal['ready', 'timeout', 'unavailable'] = 'unavailable'
    attempts: int = 0
    successes: int = 0
    remote_seconds: float | None = None


class NetworkingEvidence(BaseModel):
    execution_method: Literal['entanglement_network'] = METHOD
    schema_version: Literal['1'] = '1'
    plan_version: Literal['two-machine-v1'] = 'two-machine-v1'
    synthetic: Literal[True] = True
    parts: list[ExecutionPart]
    links: list[QuantumLink]
    link_state: Literal['waiting', 'ready', 'consumed', 'timeout', 'unavailable']
    metrics: NetworkMetrics
    issues: list[str]


def point(value):
    return value if isinstance(value, datetime) else datetime.fromisoformat(value.replace('Z', '+00:00'))


def replay(parts, links, events):
    """Reject contradictory evidence; missing observations stay unavailable."""
    state = {str(p['id']): 'pending' for p in parts}
    if len(state) != 2 or len(links) != 1:
        raise ValueError('This plan requires two parts and one link')
    link = links[0]
    if str(link['part_a_id']) == str(link['part_b_id']) or {str(link['part_a_id']), str(link['part_b_id'])} != set(state):
        raise ValueError('Link endpoints must be distinct parts of this job')
    metrics = NetworkMetrics()
    requested = ready = remote_start = remote_end = execution_start = execution_end = None
    deadline = None
    attempts, resources, consumed = set(), set(), set()
    link_state = 'unavailable'
    output = None
    expected_parts = {key: {'status': 'pending', 'started_at': None, 'prepared_at': None, 'finished_at': None,
                            'failure_code': None, 'failure_message': None} for key in state}
    for event in events:
        if event['to_status'] in {'succeeded', 'failed', 'cancelled'}:
            execution_end = point(event['occurred_at'])
        payload = (event.get('details') or {}).get('network')
        if payload is None:
            continue
        if event['stage'] != 'execution':
            raise ValueError('Networking events belong to execution')
        item = NetworkEvent.model_validate(payload)
        at = point(event['occurred_at'])
        kind, part = item.kind, str(item.part_id) if item.part_id else None
        if item.link_id and str(item.link_id) != str(link['id']):
            raise ValueError('Event link does not belong to parent')
        if part and part not in state:
            raise ValueError('Event part does not belong to parent')
        if kind == 'execution_started':
            if execution_start is not None:
                raise ValueError('Execution already started')
            execution_start = at
        elif execution_start is None:
            raise ValueError('Execution start is missing')
        elif kind in {'part_started', 'local_prepared', 'part_completed', 'part_aborted'}:
            expected = {'part_started': 'pending', 'local_prepared': 'preparing', 'part_completed': 'blocked'}
            if kind == 'part_aborted':
                if link_state != 'timeout' or state[part] not in {'preparing', 'blocked'}:
                    raise ValueError('Abort requires a recorded coordination timeout')
            elif state[part] != expected[kind]:
                raise ValueError('Invalid part transition')
            if kind == 'part_completed' and remote_end is None:
                raise ValueError('Remote operation must finish before the required parts')
            state[part] = {'part_started': 'preparing', 'local_prepared': 'blocked',
                           'part_completed': 'completed', 'part_aborted': 'aborted'}[kind]
            expected_parts[part]['status'] = state[part]
            expected_parts[part][{'part_started': 'started_at', 'local_prepared': 'prepared_at',
                                  'part_completed': 'finished_at', 'part_aborted': 'finished_at'}[kind]] = at
            if kind == 'part_aborted':
                expected_parts[part].update(failure_code='COORDINATION_STOPPED', failure_message='Stopped after entanglement deadline; no device fault recorded')
        elif kind == 'entanglement_requested':
            if requested is not None or any(value != 'blocked' for value in state.values()) or item.deadline <= at:
                raise ValueError('Request requires prepared parts and a future deadline')
            requested, deadline, link_state = at, item.deadline, 'waiting'
        elif kind == 'attempt_completed':
            if link_state != 'waiting' or at >= deadline or item.attempt_id in attempts:
                raise ValueError('Attempt requires an active request and a unique attempt ID')
            attempts.add(item.attempt_id)
            metrics.attempts += 1
            if item.outcome == 'succeeded':
                if item.resource_id in resources:
                    raise ValueError('Resource already generated')
                resources.add(item.resource_id)
                metrics.successes += 1
                ready, link_state = at, 'ready'
        elif kind == 'entanglement_timeout':
            if link_state != 'waiting' or at < deadline:
                raise ValueError('Timeout requires an expired pending request')
            link_state = 'timeout'
            metrics.waiting_seconds = (at - requested).total_seconds()
            metrics.wait_outcome = 'timeout'
        elif kind == 'remote_started':
            if link_state != 'ready' or item.resource_id not in resources or item.resource_id in consumed or remote_start:
                raise ValueError('Remote operation requires one generated, unconsumed pair')
            consumed.add(item.resource_id)
            remote_start, link_state = at, 'consumed'
        elif kind == 'remote_completed':
            if remote_start is None or remote_end is not None or item.resource_id not in consumed:
                raise ValueError('Remote completion requires its recorded start and resource')
            remote_end = at
        elif kind == 'final_output':
            if output is not None or remote_end is None or any(value != 'completed' for value in state.values()):
                raise ValueError('Output requires all parts and remote operation complete')
            output = item.output
    if ready is not None:
        metrics.waiting_seconds = (ready - requested).total_seconds()
        metrics.wait_outcome = 'ready'
    if remote_start is not None and remote_end is not None:
        metrics.remote_seconds = (remote_end - remote_start).total_seconds()
    if execution_start is not None and execution_end is not None:
        metrics.execution_seconds = (execution_end - execution_start).total_seconds()
    return expected_parts, link_state, metrics, output


def load_network(connection, job, events):
    extension = connection.execute(select(networked_runs).where(networked_runs.c.job_id == job['id'])).mappings().one_or_none()
    if extension is None:
        return None
    parts = connection.execute(select(execution_parts).where(execution_parts.c.job_id == job['id']).order_by(execution_parts.c.label)).mappings().all()
    links = connection.execute(select(quantum_links).where(quantum_links.c.job_id == job['id'])).mappings().all()
    issues = []
    if job['specification'].get('execution_method') != METHOD:
        issues.append('Networking extension does not agree with the shared source specification.')
    try:
        expected, state, metrics, output = replay(parts, links, events)
        if any(any(p[key] != value for key, value in expected[str(p['id'])].items()) for p in parts):
            issues.append('Part records do not agree with recorded events.')
        if job['status'] == 'succeeded' and (output is None or output != job['result']):
            issues.append('Successful final output is missing or inconsistent.')
        if job['error_code'] == 'ENTANGLEMENT_TIMEOUT' and (state != 'timeout' or any(p['status'] != 'aborted' for p in parts)):
            issues.append('Timeout evidence is incomplete.')
        if job['error_code'] == 'ENTANGLEMENT_TIMEOUT':
            failure = next((event for event in reversed(events) if event['to_status'] == 'failed'), None)
            details = failure['details'] if failure else {}
            if details.get('link_id') != str(links[0]['id']) or details.get('operation_id') != OPERATION or details.get('cause') != 'coordination_failure':
                issues.append('Timeout failure identifiers or coordination cause are missing.')
    except ValueError as error:
        state, metrics = 'unavailable', NetworkMetrics()
        issues.append(str(error))
    return NetworkingEvidence(**extension, parts=parts, links=links, link_state=state, metrics=metrics, issues=issues)


def record_network_event(connection, job_id, payload, *, at, correlation_id, actor='network-fixture'):
    """Part update + parent version + event share a savepoint and parent lock."""
    from app.transitions import _locked_job, _require_transaction, record_progress
    _require_transaction(connection)
    item = NetworkEvent.model_validate(payload)
    with connection.begin_nested():
        job = _locked_job(connection, job_id, None)
        if job['status'] != 'running':
            raise ValueError('Networking progress requires a running parent')
        parts = connection.execute(select(execution_parts).where(execution_parts.c.job_id == job_id)).mappings().all()
        links = connection.execute(select(quantum_links).where(quantum_links.c.job_id == job_id)).mappings().all()
        events = list(connection.execute(select(job_events).where(job_events.c.job_id == job_id).order_by(job_events.c.sequence)).mappings())
        details = {'network': item.model_dump(mode='json', exclude_none=True)}
        candidate = dict(stage='execution', to_status='running', occurred_at=at, details=details)
        expected, _, _, _ = replay(parts, links, [*events, candidate])
        if item.part_id:
            connection.execute(update(execution_parts).where(execution_parts.c.id == item.part_id,
                execution_parts.c.job_id == job_id).values(**expected[str(item.part_id)]))
        return record_progress(connection, job_id, stage='execution', message=item.kind.replace('_', ' ').capitalize(),
                               actor=actor, correlation_id=correlation_id, details=details, at=at)
