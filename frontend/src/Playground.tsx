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
    <div><p className="eyebrow">INTERACTIVE DEMO</p><h2 id="playground-title">Try your own experiment</h2>
      <p>Explore 200 sample jobs, or create a simulated run and inspect its outcome. Your runs stay in this browser. Reset whenever you like.</p>
      <a href="https://github.com/THOM4S05/Quantum-Job-Tracker">View source on GitHub ↗</a></div>
    <form className="playground-form" onSubmit={submit}>
      <label>Experiment name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Simulated outcome<select value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)}>
        {scenarios.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())}</option>)}
      </select></label>
      <div className="filter-actions"><button className="primary">Create simulated run</button><button type="button" onClick={() => { resetDemo(); onReset(); }}>Reset playground</button></div>
      <span className="playground-note">Instant simulated outcomes · No account needed · No real hardware</span>
    </form>
  </section>;
}
