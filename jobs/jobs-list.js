import { SectionHeader } from '../components/layout/SectionHeader.js';
import { navigate } from '../router.js';
import { getContactsData } from '../contacts/contacts-data.js';
import { getJobsUIState, updateJobsUIState, setJobsMainView } from './jobs-ui-state.js';
import { getJobAvailableHours, loadJobs } from './jobs-store.js';
import { ViewToggleGroup } from './jobs-view-toggle.js';
import { getJobNumber } from './job-number-utils.js';

const { createElement: h, useEffect, useMemo, useState } = React;

const STATUS_FILTERS = [
  { value: 'default', label: 'Default', helper: 'Pending + Active + Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const KIND_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'project', label: 'Projects' },
  { value: 'retainer', label: 'Retainers' },
];

function formatHours(hours) {
  const value = Math.round((Number(hours) || 0) * 10) / 10;
  return `${value}h`;
}

function statusLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'completed') return 'Completed';
  if (status === 'archived') return 'Archived';
  return 'Pending';
}

function kindLabel(kind) {
  return kind === 'retainer' ? 'Retainer' : 'Project';
}

function buildCompanyMap() {
  const companies = getContactsData();
  const map = new Map();
  (companies || []).forEach((company) => {
    if (company?.id) map.set(String(company.id), company.name || `Company ${company.id}`);
  });
  return map;
}

function filterJobs(jobs, uiState, companyMap) {
  const statusFilter = uiState?.statusFilter || 'default';
  const kindFilter = uiState?.kindFilter || 'all';
  const term = String(uiState?.search || '').trim().toLowerCase();
  return (jobs || [])
    .filter((job) => {
      if (statusFilter === 'archived') return job.status === 'archived';
      if (statusFilter === 'pending') return job.status === 'pending';
      if (statusFilter === 'active') return job.status === 'active';
      if (statusFilter === 'completed') return job.status === 'completed';
      if (job.status === 'archived') return false;

      if (kindFilter !== 'all' && job.kind !== kindFilter) return false;

      if (!term) return true;
      const companyName = job.companyId ? companyMap.get(String(job.companyId)) || '' : '';
      const haystack = `${job.name || ''} ${companyName}`.toLowerCase();
      return haystack.includes(term);
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function JobCard({ job, companyMap }) {
  const hours = getJobAvailableHours(job);
  const companyName = job.companyId ? companyMap.get(String(job.companyId)) : '';
  const clientLabel = job.isInternal ? 'Internal' : companyName ? `Client • ${companyName}` : 'Client';
  const status = statusLabel(job.status);
  const kind = kindLabel(job.kind);
  const jobNumber = getJobNumber(job);

  return h('a', {
    href: `#/app/jobs/${job.id}`,
    onClick: (e) => {
      e.preventDefault();
      navigate(`#/app/jobs/${job.id}`);
    },
    className: 'group block rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5 shadow-sm hover:shadow-md transition',
  }, [
    h('div', { className: 'flex flex-wrap items-start justify-between gap-4' }, [
      h('div', { className: 'space-y-2' }, [
        h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, `Job ${jobNumber}`),
        h('div', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, job.name || 'Untitled Job'),
        h('div', { className: 'flex flex-wrap items-center gap-2 text-xs' }, [
          h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 px-2 py-1 text-slate-600 dark:text-slate-200 bg-slate-50 dark:bg-slate-800' }, kind),
          h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 px-2 py-1 text-slate-600 dark:text-slate-200 bg-slate-50 dark:bg-slate-800' }, status),
          h('span', { className: 'text-slate-500 dark:text-slate-400' }, clientLabel),
        ]),
      ]),
      h('div', { className: 'text-right space-y-1' }, [
        h('div', { className: 'text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Available hours'),
        h('div', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, formatHours(hours)),
      ]),
    ]),
  ]);
}

export function JobsListScreen() {
  const [uiState, setUiState] = useState(getJobsUIState());
  const [jobs, setJobs] = useState(loadJobs());
  const companyMap = useMemo(buildCompanyMap, []);
  const filtered = useMemo(() => filterJobs(jobs, uiState, companyMap), [jobs, uiState, companyMap]);

  useEffect(() => {
    setJobsMainView('jobs');
    setJobs(loadJobs());
  }, []);

  const updateFilters = (partial) => {
    const next = updateJobsUIState(partial);
    setUiState(next);
  };

  const statusPills = h('div', { className: 'inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-1 py-1' }, (
    STATUS_FILTERS.map((filter) => h('button', {
      key: filter.value,
      type: 'button',
      title: filter.helper || filter.label,
      className: [
        'px-3 py-1 rounded-full text-xs font-semibold transition-colors border',
        uiState.statusFilter === filter.value
          ? 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm'
          : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-white/10',
      ].join(' '),
      onClick: () => updateFilters({ statusFilter: filter.value }),
    }, filter.label))
  ));

  const kindFilter = h('select', {
    className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-3 text-sm',
    value: uiState.kindFilter,
    onChange: (e) => updateFilters({ kindFilter: e.target.value }),
  }, KIND_FILTERS.map((filter) => h('option', { key: filter.value, value: filter.value }, filter.label)));

  const searchInput = h('div', { className: 'flex-1 min-w-[220px]' }, [
    h('input', {
      type: 'search',
      value: uiState.search || '',
      placeholder: 'Search jobs...',
      onChange: (e) => updateFilters({ search: e.target.value }),
      className: 'w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-netnet-purple',
    }),
  ]);

  const viewToggle = h(ViewToggleGroup, {
    value: 'jobs',
    options: [
      {
        value: 'jobs',
        label: 'Jobs',
        title: 'Jobs',
        icon: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
          h('path', { d: 'M4 6h16' }),
          h('path', { d: 'M4 12h16' }),
          h('path', { d: 'M4 18h16' }),
        ]),
      },
      {
        value: 'tasks',
        label: 'All Job Tasks',
        title: 'All Job Tasks',
        icon: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
          h('rect', { x: '4', y: '4', width: '16', height: '16', rx: '2' }),
          h('path', { d: 'M8 12l3 3 5-6' }),
        ]),
      },
    ],
    onChange: (next) => {
      setJobsMainView(next);
      if (next === 'tasks') navigate('#/app/jobs/tasks');
      if (next === 'jobs') navigate('#/app/jobs');
    },
  });

  const newJobButton = h('button', {
    type: 'button',
    className: 'inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
    onClick: () => navigate('#/app/jobs/new'),
  }, '+ New Job');

  return h('div', { className: 'space-y-4 px-4 pt-4 pb-12' }, [
    h(SectionHeader, {
      title: 'Jobs',
      showHelpIcon: true,
      showSecondaryRow: false,
    }),
    h('div', { className: 'flex w-full flex-wrap items-center gap-2' }, [
      viewToggle,
      statusPills,
      kindFilter,
      searchInput,
      newJobButton,
    ]),
    filtered.length
      ? h('div', { className: 'grid gap-4' }, filtered.map((job) => h(JobCard, { key: job.id, job, companyMap })))
      : h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-6 text-center' }, [
        h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'No jobs yet'),
        h('p', { className: 'mt-2 text-sm text-slate-500 dark:text-slate-400' }, 'Create a job to start planning deliverables and available hours.'),
        h('button', {
          type: 'button',
          className: 'mt-4 inline-flex items-center justify-center h-10 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
          onClick: () => navigate('#/app/jobs/new'),
        }, '+ New Job'),
      ]),
  ]);
}
