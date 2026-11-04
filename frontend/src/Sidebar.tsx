import { useState } from 'react';
import { guideHref, homeHref, isDemo } from './environment';

type View = 'jobs' | 'overview' | 'comparison' | 'guide' | 'implementation';
type Props = { active: View; jobsHref?: string; overviewHref?: string; comparisonHref?: string };

const iconPaths: Record<View, string> = {
  jobs: 'M4 4h16v16H4z M4 9h16 M9 9v11',
  overview: 'M4 20V10 M10 20V4 M16 20v-8 M22 20H2',
  comparison: 'M4 7h15 M15 3l4 4-4 4 M20 17H5 M9 13l-4 4 4 4',
  guide: 'M12 6C8 3 4 4 3 5v15c3-2 6-1 9 1 3-2 6-3 9-1V5c-1-1-5-2-9 1z M12 6v15',
  implementation: 'M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18',
};

export function Sidebar({ active, jobsHref = `${homeHref}?view=jobs`, overviewHref = `${homeHref}?view=overview`, comparisonHref = `${homeHref}?view=comparison` }: Props) {
  const [open, setOpen] = useState(false);
  const links: { view: View; name: string; href: string }[] = [
    { view: 'overview', name: 'Overview', href: overviewHref },
    { view: 'jobs', name: 'Jobs', href: jobsHref },
    { view: 'comparison', name: 'Comparisons', href: comparisonHref },
    { view: 'guide', name: 'Demo & Guide', href: guideHref },
    { view: 'implementation', name: 'How it works', href: `${homeHref}?view=implementation` },
  ];
  return <aside className="sidebar" aria-label="Workspace navigation">
    <header><span className="mark" aria-hidden="true">Q<span /></span><span className="brand-name">Quantum<br /> Job Tracker</span></header>
    <button type="button" className="mobile-menu" aria-expanded={open} aria-controls="workspace-menu" onClick={() => setOpen(!open)}>{open ? 'Close menu' : 'Menu'}<span aria-hidden="true">{open ? '−' : '+'}</span></button>
    <nav id="workspace-menu" className={`workspace-menu${open ? ' is-open' : ''}`} aria-label="Main">
      <p className="workspace-label">WORKSPACE</p>
      {links.map(({ view, name, href }) => <a key={view} className={`nav-item${active === view ? ' active' : ''}${view === 'guide' || view === 'implementation' ? ' nav-secondary' : ''}`} href={href} aria-current={active === view ? 'page' : undefined}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[view]} /></svg><span>{name}</span>
      </a>)}
    </nav>
    <div className="sidebar-bottom"><span>{isDemo ? 'Browser demo' : 'Local workspace'}</span><span>Simulated job data</span></div>
  </aside>;
}
