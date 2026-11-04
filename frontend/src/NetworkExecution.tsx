import snapshot from './data/networkSnapshot.json';
import { jobHref } from './environment';
import type { JobEvidence, RecordedEvent } from './JobDetails';

export const networkExamples = snapshot.fixture_ids;
export type NetworkPart = {
  id: string; job_id: string; label: string; provider: string; target: string; role: string; qubit_ids: string[];
  status: 'pending' | 'preparing' | 'blocked' | 'completed' | 'aborted';
  started_at: string | null; prepared_at: string | null; finished_at: string | null;
  failure_code: string | null; failure_message: string | null;
};
export type NetworkingEvidence = {
  execution_method: 'entanglement_network'; schema_version: '1'; plan_version: 'two-machine-v1'; synthetic: true;
  parts: NetworkPart[];
  links: { id: string; job_id: string; part_a_id: string; part_b_id: string; channel_type: 'synthetic_entanglement' }[];
  link_state: 'waiting' | 'ready' | 'consumed' | 'timeout' | 'unavailable';
  metrics: { execution_seconds: number | null; waiting_seconds: number | null; wait_outcome: 'ready' | 'timeout' | 'unavailable'; attempts: number; successes: number; remote_seconds: number | null };
  issues: string[];
};
export function NetworkExampleLinks() {
  const params = new URLSearchParams(window.location.search);
  params.delete('job');
  if (params.get('view') !== 'comparison') params.delete('view');
  const query = params.toString();
  return <p className="network-examples"><a href={jobHref(networkExamples.success, query)}>Open network success example</a><span aria-hidden="true"> · </span><a href={jobHref(networkExamples.timeout, query)}>Open entanglement-timeout example</a></p>;
}
export function networkEventLabel(event: RecordedEvent, networking?: NetworkingEvidence | null) {
  const payload = event.details?.network as { kind?: string; part_id?: string; link_id?: string; operation_id?: string; attempt_id?: string; outcome?: string; resource_id?: string; deadline?: string } | undefined;
  if (!payload) return null;
  const part = networking?.parts.find((item) => item.id === payload.part_id);
  return [part?.label ?? (payload.part_id ? `Unidentified machine ${payload.part_id}` : null),
    payload.link_id ? `Link A–B · ${payload.link_id}` : null, payload.operation_id,
    payload.attempt_id ? `${payload.attempt_id}: ${payload.outcome}` : null,
    payload.resource_id ? `${payload.resource_id}${payload.kind === 'remote_started' ? ' consumed' : payload.kind === 'attempt_completed' ? ' generated' : ''}` : null,
    payload.deadline ? `Deadline ${payload.deadline}` : null].filter(Boolean).join(' · ') || 'Shared execution';
}
const time = (value: string | null) => value ? `${new Date(value).toISOString().replace('T', ' ').replace('.000Z', '')} UTC` : 'Not available';
const seconds = (value: number | null) => value === null ? 'Not available' : `${value.toLocaleString('en-GB', { maximumFractionDigits: 6 })} s`;
export function NetworkExecution({ evidence }: { evidence: JobEvidence }) {
  const network = evidence.networking;
  if (!network) return <section className="detail-panel" aria-labelledby="network-title"><h2 id="network-title">Network execution</h2><p className="evidence-warning">Networking evidence is unavailable. The recorded distributed specification has no networking records.</p><NetworkExampleLinks /></section>;
  const metrics = network.metrics;
  const trustworthy = network.issues.length === 0 && evidence.history_complete;
  const failure = evidence.events.find((event) => (event.details?.network as { kind?: string } | undefined)?.kind === 'entanglement_timeout');
  return <section className="detail-panel" aria-labelledby="network-title">
    <p className="eyebrow">SYNTHETIC DISTRIBUTED EXECUTION</p><h2 id="network-title">Network execution</h2>
    <p>One shared source job, two machine-specific execution parts and one entanglement link. Overall outcome: <strong>{evidence.job.status}</strong>.</p>
    <p className="evidence-note">Historical synthetic tracking. No hardware connection, physical network simulation, real entanglement generation or claim of quantum advantage.</p>
    {(!trustworthy) && <div className="evidence-warning" role="status"><p>Network evidence is incomplete or inconsistent. Metrics are unavailable; missing observations have not been reconstructed.</p>{network.issues.map((issue) => <p key={issue}>{issue}</p>)}</div>}
    <div className="network-diagram" role="group" aria-label="Two synthetic machines connected by link A–B; entangled pairs are generated resources consumed by the remote operation">
      {network.parts.map((part, index) => <div className="network-node" key={part.id}>
        {index === 1 && <p className="network-connector" aria-label={`Link A–B resource state: ${network.link_state}`}>↔ Link A–B · {network.link_state === 'consumed' ? 'Pair consumed' : network.link_state}</p>}
        <article className="network-machine"><h3>{part.label}</h3><p>{part.provider}<br />{part.target}</p><p><strong>{part.status}</strong> · {part.role} · {part.qubit_ids.join(', ')}</p>
          <dl><div><dt>Preparation started</dt><dd>{time(part.started_at)}</dd></div><div><dt>Local preparation completed</dt><dd>{time(part.prepared_at)}</dd></div><div><dt>Part stopped / finished</dt><dd>{time(part.finished_at)}</dd></div></dl>
          {part.failure_message && <p>{part.failure_message}</p>}
        </article>
      </div>)}
    </div>
    <p className="evidence-note">The link records connectivity. Its displayed resource state comes from recorded attempts; it is not a permanently entangled connection. A stopped part does not imply a machine fault.</p>
    <dl className="metadata-grid network-metrics">
      <div><dt>Elapsed execution time</dt><dd>{trustworthy ? seconds(metrics.execution_seconds) : 'Not available'}</dd></div>
      <div><dt>{metrics.wait_outcome === 'timeout' ? 'Elapsed entanglement wait (timeout)' : 'Entanglement waiting time'}</dt><dd>{trustworthy ? seconds(metrics.waiting_seconds) : 'Not available'}</dd></div>
      <div><dt>Successful entanglement attempts / completed attempts</dt><dd>{trustworthy ? `${metrics.successes} / ${metrics.attempts}` : 'Not available'}</dd></div>
      <div><dt>Remote-operation duration</dt><dd>{trustworthy ? seconds(metrics.remote_seconds) : 'Not available'}</dd></div>
    </dl>
    <p className="evidence-note">Elapsed time uses the parent execution endpoints, including overlapping parts. Attempt counts exclude missing or unfinished observations; they are separate from job success rates.</p>
    {evidence.job.error_code === 'ENTANGLEMENT_TIMEOUT' && <div className="network-failure"><h3>Coordination failure: entanglement timeout</h3><p>{evidence.job.error_message}</p><p>Affected link: {network.links[0]?.id ?? 'Not available'} · Operation: remote-cz-1</p>{failure ? <a href={`#event-${failure.sequence}`}>View recorded deadline event #{failure.sequence}</a> : <p>Supporting timeout event is unavailable.</p>}</div>}
    <NetworkExampleLinks />
  </section>;
}
