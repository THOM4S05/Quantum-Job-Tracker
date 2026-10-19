export type WorkloadMetadata = {
  program_name: string | null; program_revision: string | null;
  source_language: string | null; compiler_name: string | null; compiler_version: string | null;
  optimisation_settings: Record<string, unknown> | null; requested_shots: number | null;
  estimated_logical_qubits: number | null; estimated_circuit_depth: number | null; estimated_gate_count: number | null;
  compilation_started_at: string | null; compilation_finished_at: string | null;
  queue_entered_at: string | null; queue_left_at: string | null;
  execution_started_at: string | null; execution_finished_at: string | null;
};
export type JobDurations = { compilation_seconds: number | null; queue_seconds: number | null; execution_seconds: number | null };

export const emptyMetadata = (): WorkloadMetadata => ({
  program_name: null, program_revision: null, source_language: null, compiler_name: null, compiler_version: null,
  optimisation_settings: null, requested_shots: null, estimated_logical_qubits: null,
  estimated_circuit_depth: null, estimated_gate_count: null, compilation_started_at: null,
  compilation_finished_at: null, queue_entered_at: null, queue_left_at: null,
  execution_started_at: null, execution_finished_at: null,
});

export function deriveDurations(metadata: WorkloadMetadata): JobDurations {
  const seconds = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const micros = (value: string) => {
      const millis = Date.parse(value);
      if (!Number.isFinite(millis) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
      const fraction = value.match(/\.(\d+)/)?.[1] ?? '';
      return BigInt(millis) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3, 6));
    };
    const first = micros(start), last = micros(end);
    if (first === null || last === null || last < first) return null;
    return Number(last - first) / 1_000_000;
  };
  return { compilation_seconds: seconds(metadata.compilation_started_at, metadata.compilation_finished_at),
    queue_seconds: seconds(metadata.queue_entered_at, metadata.queue_left_at),
    execution_seconds: seconds(metadata.execution_started_at, metadata.execution_finished_at) };
}

// Fictional fixture metadata only. These are not observations of quantum hardware.
export function syntheticMetadata(index: number, name: string, scenario: string, created: string): WorkloadMetadata {
  const at = (seconds: number) => new Date(Date.parse(created) + seconds * 1000).toISOString();
  const compiling = !['queued', 'cancelled'].includes(scenario);
  const queueing = compiling && scenario !== 'compilation_failure';
  const executing = queueing && scenario !== 'queueing_failure';
  return {
    program_name: name, program_revision: `synthetic-r${index % 5 + 1}`, source_language: 'Synthetic QASM-like',
    compiler_name: ['Synthetic Aurora Compiler', 'Synthetic Nebula Compiler', 'Synthetic Quasar Compiler'][index % 3],
    compiler_version: index % 17 === 0 ? null : 'synthetic-1.0.0',
    optimisation_settings: { level: index % 3, routing: 'synthetic-greedy' }, requested_shots: 1024,
    estimated_logical_qubits: index % 13 === 0 ? null : 8 + index % 4 * 8,
    estimated_circuit_depth: index % 13 === 0 ? null : 120 + index % 40,
    estimated_gate_count: index % 13 === 0 ? null : 600 + index % 100,
    compilation_started_at: compiling ? at(1) : null, compilation_finished_at: compiling ? at(2) : null,
    queue_entered_at: queueing ? at(2) : null, queue_left_at: queueing ? at(3) : null,
    execution_started_at: executing ? at(3) : null,
    execution_finished_at: ['success', 'execution_failure'].includes(scenario) ? at(scenario === 'success' ? 5 : 4) : null,
  };
}
