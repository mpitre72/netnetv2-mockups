import { navigate } from '../router.js';
import { PerfCard } from '../components/performance/primitives.js';
import { PerformanceLayout } from './performance-layout.js';
import { JobPulse } from './screens/JobPulse.js';
import { ReportsRouter } from './reports/ReportsRouter.js';
import { PerformanceArchive } from './archive/PerformanceArchive.js';

const { createElement: h, useEffect, useMemo, useState } = React;
const { createRoot } = ReactDOM;

let root = null;
let currentContainer = null;

export function unmountPerformancePage() {
  if (root) {
    try {
      root.unmount();
    } catch (e) {
      console.warn('[Performance] unmount warning', e);
    }
  }
  root = null;
  currentContainer = null;
}

function parsePerformanceHash(hash) {
  const raw = (hash || location.hash || '').replace('#', '');
  const [pathPart, queryString = ''] = raw.split('?');
  const trimmed = pathPart.replace('/app/performance', '').replace(/^\/+/, '');
  const segments = trimmed ? trimmed.split('/').filter(Boolean) : [];
  return { segments, queryString };
}

function archiveRedirect(view, queryString = '') {
  const params = new URLSearchParams();
  params.set('view', view);
  const incoming = new URLSearchParams(queryString);
  incoming.forEach((value, key) => {
    if (key !== 'view') params.append(key, value);
  });
  return `#/app/performance/archive?${params.toString()}`;
}

function resolveRoute() {
  const { segments, queryString } = parsePerformanceHash();
  if (!segments.length) return { redirect: '#/app/performance/pulse' };
  if (segments[0] === 'reports' && !segments[1]) {
    const qs = queryString ? `?${queryString}` : '';
    return { redirect: `#/app/performance/reports/time${qs}` };
  }
  const view = segments[0];
  if (['pulse', 'production', 'team', 'patterns'].includes(view)) return { view, queryString };
  if (view === 'overview') return { redirect: archiveRedirect('pulse', queryString) };
  if (view === 'at-risk-deliverables') {
    return { redirect: archiveRedirect('deliverables-in-drift', queryString) };
  }
  if (view === 'deliverables-in-drift') return { redirect: archiveRedirect('deliverables-in-drift', queryString) };
  if (view === 'capacity') {
    return { redirect: archiveRedirect('capacity', queryString) };
  }
  if (view === 'jobs-at-risk') return { redirect: archiveRedirect('jobs-at-risk', queryString) };
  if (view === 'archive') {
    const params = new URLSearchParams(queryString);
    return { view, archiveView: params.get('view') || 'pulse', queryString };
  }
  if (view === 'job-pulse') return { view, queryString };
  if (view === 'reports') return { view, report: segments[1] || 'time', queryString };
  return { redirect: '#/app/performance/pulse' };
}

function usePerformanceRoute() {
  const [route, setRoute] = useState(resolveRoute());
  useEffect(() => {
    const onHash = () => setRoute(resolveRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (route.redirect && location.hash !== route.redirect) {
      navigate(route.redirect);
    }
  }, [route]);
  return route;
}

function PerformancePlaceholder({ title, copy }) {
  return h(PerfCard, { className: 'space-y-3 p-6' }, [
    h('p', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Performance'),
    h('h2', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, title),
    h('p', { className: 'max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300' }, copy),
  ]);
}

function Screen({ route }) {
  const activeKey = useMemo(() => {
    if (route.view === 'reports') return 'reports';
    if (route.view === 'job-pulse') return 'production';
    return route.view || 'pulse';
  }, [route.view]);

  const content = (() => {
    if (route.view === 'pulse') return h(PerformancePlaceholder, {
      title: 'Pulse',
      copy: 'Pulse will show what needs attention right now.',
    });
    if (route.view === 'production') return h(PerformancePlaceholder, {
      title: 'Production',
      copy: 'Production will show active work that needs attention.',
    });
    if (route.view === 'team') return h(PerformancePlaceholder, {
      title: 'Team',
      copy: 'Team will show workload, capacity, and missing planning details.',
    });
    if (route.view === 'patterns') return h(PerformancePlaceholder, {
      title: 'Patterns',
      copy: 'Patterns will show what keeps happening across work, services, clients, and retainers.',
    });
    if (route.view === 'job-pulse') return h(JobPulse, { queryString: route.queryString });
    if (route.view === 'reports') return h(ReportsRouter, { report: route.report, queryString: route.queryString });
    return h(PerformancePlaceholder, {
      title: 'Pulse',
      copy: 'Pulse will show what needs attention right now.',
    });
  })();

  if (route.view === 'archive') {
    return h(PerformanceArchive, { archiveView: route.archiveView, queryString: route.queryString });
  }

  return h(PerformanceLayout, { activeKey }, content);
}

function PerformanceApp() {
  const route = usePerformanceRoute();
  if (route.redirect) return null;
  return h(Screen, { route });
}

export function renderPerformancePage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[Performance] container not found for renderPerformancePage.');
    return;
  }
  if (currentContainer !== container) {
    container.innerHTML = '';
    root = createRoot(container);
    currentContainer = container;
  }
  root.render(h(PerformanceApp));
}
