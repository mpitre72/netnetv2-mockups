import { navigate } from '../router.js';
import { PerformanceLayout } from './performance-layout.js';
import { ReportsRouter } from './reports/ReportsRouter.js';
import { PerformanceArchive } from './archive/PerformanceArchive.js';
import { TodayDashboard } from './screens/TodayDashboard.js';
import { ClientsDashboard } from './screens/ClientsDashboard.js';
import { CapacityDashboard } from './screens/CapacityDashboard.js';
import { TeamDashboard } from './screens/TeamDashboard.js';
import { PlanVsActualDashboard } from './screens/PlanVsActualDashboard.js';

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

function resolveRoute() {
  const { segments, queryString } = parsePerformanceHash();
  if (!segments.length) return { redirect: '#/app/performance/today' };
  if (segments[0] === 'reports' && !segments[1]) {
    const qs = queryString ? `?${queryString}` : '';
    return { redirect: `#/app/performance/reports/time${qs}` };
  }
  const view = segments[0];
  if (view === 'estimates') {
    const qs = queryString ? `?${queryString}` : '';
    return { redirect: `#/app/performance/plan-vs-actual${qs}` };
  }
  if (['today', 'clients', 'team', 'capacity', 'plan-vs-actual'].includes(view)) return { view, queryString };
  if (['pulse', 'production', 'patterns', 'overview', 'at-risk-deliverables', 'deliverables-in-drift', 'jobs-at-risk', 'job-pulse'].includes(view)) {
    return { redirect: '#/app/performance/today' };
  }
  if (view === 'archive') {
    const params = new URLSearchParams(queryString);
    return { view, archiveView: params.get('view') || 'pulse', queryString };
  }
  if (view === 'reports') return { view, report: segments[1] || 'time', queryString };
  return { redirect: '#/app/performance/today' };
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

function Screen({ route }) {
  const activeKey = useMemo(() => {
    if (route.view === 'reports') return 'reports';
    return route.view || 'today';
  }, [route.view]);

  const content = (() => {
    if (route.view === 'today') return h(TodayDashboard);
    if (route.view === 'clients') return h(ClientsDashboard);
    if (route.view === 'team') return h(TeamDashboard);
    if (route.view === 'capacity') return h(CapacityDashboard);
    if (route.view === 'plan-vs-actual') return h(PlanVsActualDashboard);
    if (route.view === 'reports') return h(ReportsRouter, { report: route.report, queryString: route.queryString });
    return h(TodayDashboard);
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
