import { navigate } from '../router.js';
import { PerformanceLayout } from './performance-layout.js';
import { PerformancePulse } from './screens/PerformancePulse.js';
import { AtRiskDeliverables } from './screens/AtRiskDeliverables.js';
import { CapacityForecast } from './screens/CapacityForecast.js';
import { JobsAtRisk } from './screens/JobsAtRisk.js';
import { JobPulse } from './screens/JobPulse.js';
import { ReportsRouter } from './reports/ReportsRouter.js';

const { createElement: h, useEffect, useMemo, useState } = React;
const { createRoot } = ReactDOM;

let root = null;
let currentContainer = null;

function parsePerformanceHash(hash) {
  const raw = (hash || location.hash || '').replace('#', '');
  const [pathPart, queryString = ''] = raw.split('?');
  const trimmed = pathPart.replace('/app/performance', '').replace(/^\/+/, '');
  const segments = trimmed ? trimmed.split('/').filter(Boolean) : [];
  return { segments, queryString };
}

function resolveRoute() {
  const { segments, queryString } = parsePerformanceHash();
  if (!segments.length) return { redirect: '#/app/performance/overview' };
  if (segments[0] === 'reports' && !segments[1]) {
    const qs = queryString ? `?${queryString}` : '';
    return { redirect: `#/app/performance/reports/time${qs}` };
  }
  const view = segments[0];
  if (view === 'overview') return { view: 'overview', queryString };
  if (view === 'at-risk-deliverables') return { view, queryString };
  if (view === 'capacity') {
    const params = new URLSearchParams(queryString);
    const horizon = parseInt(params.get('horizonDays') || '', 10);
    if (![14, 30, 60].includes(horizon)) {
      params.set('horizonDays', '30');
      return { redirect: `#/app/performance/capacity?${params.toString()}` };
    }
    return { view, queryString: params.toString() };
  }
  if (view === 'jobs-at-risk') return { view, queryString };
  if (view === 'job-pulse') return { view, queryString };
  if (view === 'reports') return { view, report: segments[1] || 'time', queryString };
  return { redirect: '#/app/performance/overview' };
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
    if (route.view === 'job-pulse') return 'jobs-at-risk';
    return route.view || 'overview';
  }, [route.view]);

  const content = (() => {
    if (route.view === 'overview') return h(PerformancePulse);
    if (route.view === 'at-risk-deliverables') return h(AtRiskDeliverables, { queryString: route.queryString });
    if (route.view === 'capacity') return h(CapacityForecast, { queryString: route.queryString });
    if (route.view === 'jobs-at-risk') return h(JobsAtRisk, { queryString: route.queryString });
    if (route.view === 'job-pulse') return h(JobPulse, { queryString: route.queryString });
    if (route.view === 'reports') return h(ReportsRouter, { report: route.report, queryString: route.queryString });
    return h(PerformancePulse);
  })();

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
