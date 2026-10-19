export type Cohort = { submitted_from: string; submitted_to: string; target: string; compiler_version: string; experiment: string };
export type CohortOptions = { targets?: string[]; compiler_versions?: string[]; experiments?: { id: string; name: string }[] };
export const cohortKeys = ['submitted_from', 'submitted_to', 'target', 'compiler_version', 'experiment'] as const;
export function readCohort(params: URLSearchParams): Cohort {
  return Object.fromEntries(cohortKeys.map((key) => [key, params.get(key) ?? ''])) as Cohort;
}
export function cohortQuery(cohort: Cohort): URLSearchParams {
  return new URLSearchParams(Object.entries(cohort).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]));
}
export function CohortFields({ value, options, onChange }: { value: Cohort; options?: CohortOptions | null; onChange: (key: keyof Cohort, value: string) => void }) {
  const choices = (values: string[] | undefined, selected: string) => [...new Set([...(values ?? []), ...(selected ? [selected] : [])])].sort();
  const experiments = options?.experiments ?? [];
  return <>
    <label>Submitted from (UTC)<input type="date" value={value.submitted_from} onChange={(e) => onChange('submitted_from', e.target.value)} max={value.submitted_to || '9999-12-30'} /></label>
    <label>Submitted through (UTC)<input type="date" value={value.submitted_to} onChange={(e) => onChange('submitted_to', e.target.value)} min={value.submitted_from} max="9999-12-30" /></label>
    <label>Target<select aria-label="Target" value={value.target} onChange={(e) => onChange('target', e.target.value)}><option value="">All targets</option>{choices(options?.targets, value.target).map((target) => <option key={target}>{target}</option>)}</select></label>
    <label>Compiler version<select aria-label="Compiler version" value={value.compiler_version} onChange={(e) => onChange('compiler_version', e.target.value)}><option value="">All compiler versions</option>{choices(options?.compiler_versions, value.compiler_version).map((version) => <option key={version}>{version}</option>)}</select></label>
    <label>Experiment<select aria-label="Experiment" value={value.experiment} onChange={(e) => onChange('experiment', e.target.value)}><option value="">All experiments / ungrouped jobs</option>{experiments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}{value.experiment && !experiments.some((item) => item.id === value.experiment) && <option value={value.experiment}>{value.experiment}</option>}</select></label>
  </>;
}
