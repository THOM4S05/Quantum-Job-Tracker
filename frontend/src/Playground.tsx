import { FormEvent, useState } from 'react';
import { addDemoJob, resetDemo, scenarios, type Scenario } from './demo';
import { jobHref } from './environment';

export function Playground({ onReset }: { onReset: () => void }) {
  const [name, setName] = useState('My quantum experiment');
  const [scenario, setScenario] = useState<Scenario>('success');
  function submit(event: FormEvent) {
    event.preventDefault();
    const item = addDemoJob(name, scenario);
    window.location.assign(jobHref(item.job.id));
  }
  return <section className="playground" aria-labelledby="playground-title">
    <div><p className="eyebrow">BROWSER SIMULATION</p><h2 id="playground-title">Create a simulated run</h2>
      <p>Enter a name and select an outcome. The run and its event history are generated immediately and saved in this browser.</p>
      <a href="https://github.com/THOM4S05/Quantum-Job-Tracker">Source code on GitHub</a></div>
    <form className="playground-form" onSubmit={submit}>
      <label>Experiment name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Simulated outcome<select value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)}>
        {scenarios.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())}</option>)}
      </select></label>
      <div className="filter-actions"><button className="primary">Create simulated run</button><button type="button" onClick={() => { resetDemo(); onReset(); }}>Reset demo</button></div>
      <span className="playground-note">Reset demo removes personal runs. The 200 sample jobs remain.</span>
    </form>
  </section>;
}
