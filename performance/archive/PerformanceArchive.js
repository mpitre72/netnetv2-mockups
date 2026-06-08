import { PerfCard } from '../../components/performance/primitives.js';
import { PerformancePulse } from '../screens/PerformancePulse.js';
import { AtRiskDeliverables } from '../screens/AtRiskDeliverables.js';
import { CapacityForecast } from '../screens/CapacityForecast.js';
import { JobsAtRisk } from '../screens/JobsAtRisk.js';

const { createElement: h } = React;

const ARCHIVE_ITEMS = [
  { key: 'pulse', label: 'Pulse', href: '#/app/performance/archive?view=pulse' },
  { key: 'deliverables-in-drift', label: 'Deliverables in Drift', href: '#/app/performance/archive?view=deliverables-in-drift' },
  { key: 'capacity', label: 'Capacity Outlook', href: '#/app/performance/archive?view=capacity&horizonDays=30' },
  { key: 'jobs-at-risk', label: 'Jobs in Drift', href: '#/app/performance/archive?view=jobs-at-risk' },
];

function archiveQueryString(queryString = '') {
  const params = new URLSearchParams(queryString);
  params.delete('view');
  return params.toString();
}

function normalizeArchiveView(view) {
  const allowed = ARCHIVE_ITEMS.map((item) => item.key);
  return allowed.includes(view) ? view : 'pulse';
}

function ArchiveNav({ active }) {
  return h('div', { className: 'inline-flex flex-wrap items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-slate-950/40' },
    ARCHIVE_ITEMS.map((item) => {
      const isActive = item.key === active;
      return h('a', {
        key: item.key,
        href: item.href,
        className: [
          'inline-flex items-center rounded px-2.5 py-1 text-xs font-medium transition',
          isActive
            ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white'
            : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
        ].join(' '),
      }, item.label);
    })
  );
}

function ArchivedScreen({ view, queryString }) {
  const childQuery = archiveQueryString(queryString);
  if (view === 'deliverables-in-drift') return h(AtRiskDeliverables, { queryString: childQuery });
  if (view === 'capacity') return h(CapacityForecast, { queryString: childQuery });
  if (view === 'jobs-at-risk') return h(JobsAtRisk, { queryString: childQuery });
  return h(PerformancePulse);
}

export function PerformanceArchive({ archiveView = 'pulse', queryString = '' }) {
  const active = normalizeArchiveView(archiveView);

  return h('div', { className: 'space-y-6 pt-4' }, [
    h(PerfCard, { className: 'space-y-4' }, [
      h('div', { className: 'space-y-2' }, [
        h('p', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Hidden Dev Archive'),
        h('h1', { className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'Performance Archive'),
        h('p', { className: 'max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300' }, 'These old dashboard views are preserved for reference only while Performance is rebuilt. Reports remain live in the main Performance area.'),
      ]),
      h(ArchiveNav, { active }),
    ]),
    h(ArchivedScreen, { view: active, queryString }),
  ]);
}
