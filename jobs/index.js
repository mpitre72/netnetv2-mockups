import { navigate } from '../router.js';
import { JobsListScreen } from './jobs-list.js';
import { JobsCreateScreen } from './jobs-create.js';
import { JobsAllTasksScreen } from './jobs-all-tasks.js';
import { JobDetailShell } from './job-detail/job-detail-shell.js';

const { createElement: h, useEffect, useState } = React;
const { createRoot } = ReactDOM;

let root = null;
let currentContainer = null;

function parseJobsHash(hash) {
  const raw = (hash || location.hash || '').replace('#', '');
  const [pathPart] = raw.split('?');
  const trimmed = pathPart.replace('/app/jobs', '').replace(/^\/+/, '');
  const segments = trimmed ? trimmed.split('/').filter(Boolean) : [];
  return { segments };
}

function resolveRoute() {
  const { segments } = parseJobsHash();
  if (!segments.length) return { view: 'list' };
  if (segments[0] === 'new') return { view: 'new' };
  if (segments[0] === 'tasks') return { view: 'all_tasks' };
  if (!segments[0]) return { redirect: '#/app/jobs' };
  const jobId = segments[0];
  const subview = segments[1] || 'plan';
  return { view: 'detail', jobId, subview };
}

function useJobsRoute() {
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

function JobsApp() {
  const route = useJobsRoute();
  if (route.redirect) return null;
  if (route.view === 'new') return h(JobsCreateScreen);
  if (route.view === 'all_tasks') return h(JobsAllTasksScreen);
  if (route.view === 'detail') return h(JobDetailShell, { jobId: route.jobId, subview: route.subview });
  return h(JobsListScreen);
}

export function renderJobsPage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[JobsModule] container not found for renderJobsPage.');
    return;
  }
  container.className = 'h-full w-full overflow-y-auto';
  if (currentContainer !== container) {
    container.innerHTML = '';
    root = createRoot(container);
    currentContainer = container;
  }
  root.render(h(JobsApp));
}
