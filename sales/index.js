import { SectionHeader } from '../components/layout/SectionHeader.js';
import { mountSectionPageShell } from '../components/layout/section-page-shell.js';
import { TextInput } from '../components/forms/text-input.js';
import { PrimaryButton } from '../components/buttons/primary-button.js';
import { RowActionsMenu } from '../components/performance/primitives.js';
import { QuickTasksExecutionTable } from '../quick-tasks/quick-tasks-list.js';
import { loadTeamMembers } from '../quick-tasks/quick-tasks-store.js';
import { renderAvatar, getDisplayName } from '../quick-tasks/quick-tasks-helpers.js';
import { navigate } from '../router.js';
import { mockSalesOpportunities } from '../data/mock-sales.js';
import { SalesSummaryStrip } from './sales-summary-strip.js';
import { renderOpportunityDetailPage } from './opportunity-detail.js';
import { renderOpportunityFormPage } from './opportunity-form.js';

const { createElement: h, useMemo, useState } = React;
const { createRoot } = ReactDOM;

const CLARITY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'fog', label: 'Fog' },
  { value: 'emerging', label: 'Emerging' },
  { value: 'clear', label: 'Clear' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'project', label: 'Project' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'both', label: 'Both' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

function CompoundFilterControl({ label, id, value, onChange, options = [], widthClass = 'w-[154px]' }) {
  const selected = options.find((option) => String(option.value) === String(value)) || options[0] || { label: '' };

  return h('div', { className: `${widthClass} flex-none`.trim() }, [
    h('div', {
      className: 'relative flex h-11 items-center rounded-md border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200',
    }, [
      h('div', { className: 'pointer-events-none flex min-w-0 items-center gap-1.5' }, [
        h('span', { className: 'shrink-0 text-slate-500 dark:text-slate-400' }, `${label}:`),
        h('span', { className: 'truncate font-medium text-slate-700 dark:text-slate-200' }, selected.label),
      ]),
      h('span', {
        className: 'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500',
        'aria-hidden': 'true',
      }, [
        h('svg', { viewBox: '0 0 20 20', className: 'h-4 w-4', fill: 'currentColor' }, [
          h('path', { d: 'M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.512a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z' }),
        ]),
      ]),
      h('select', {
        id,
        value,
        onChange,
        className: 'absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0',
        'aria-label': `${label} filter`,
      }, options.map((option) => h('option', {
        key: option.value,
        value: option.value,
      }, option.label))),
    ]),
  ]);
}

function SalesColumnLabel({ children }) {
  return h('span', { className: 'font-semibold tracking-[0.01em] text-slate-700 dark:text-slate-200' }, children);
}

function getClarityToneClass(clarity) {
  if (clarity === 'clear') return 'text-slate-900 dark:text-white font-semibold';
  if (clarity === 'emerging') return 'text-slate-700 dark:text-slate-200';
  return 'text-slate-400 dark:text-slate-500';
}

function renderCell(content, className = '') {
  return h('td', { className: `px-3 py-4 align-middle ${className}`.trim() }, content);
}

function renderHtml(html, className = '') {
  return h('div', {
    className,
    dangerouslySetInnerHTML: { __html: html },
  });
}

function formatOptionLabel(value) {
  if (value === 'on-hold') return 'On Hold';
  if (value === 'project') return 'Project';
  if (value === 'retainer') return 'Retainer';
  if (value === 'both') return 'Both';
  return String(value || '')
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function filterOpportunities(opportunities, filters) {
  const term = String(filters.search || '').trim().toLowerCase();
  return opportunities.filter((opportunity) => {
    if (filters.clarity !== 'all' && opportunity.clarity !== filters.clarity) return false;
    if (filters.type !== 'all' && opportunity.type !== filters.type) return false;
    if (filters.status !== 'all' && opportunity.status !== filters.status) return false;
    if (filters.owner !== 'all' && String(opportunity.ownerId) !== String(filters.owner)) return false;

    if (!term) return true;
    const haystack = [
      opportunity.name,
      opportunity.company,
      opportunity.person,
      opportunity.clarity,
      opportunity.type,
      opportunity.status,
      opportunity.projectValue,
      opportunity.retainerValue,
      opportunity.estimatedTiming,
      opportunity.lastModified,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(term);
  });
}

function SalesTable({ opportunities = [], members = [] }) {
  const memberMap = useMemo(
    () => new Map((members || []).map((member) => [String(member.id), member])),
    [members],
  );

  const rows = opportunities.map((opportunity) => {
    const owner = memberMap.get(String(opportunity.ownerId)) || null;
    const companySecondary = opportunity.person || '-';
    const valueContent = opportunity.type === 'both'
      ? h('div', { className: 'space-y-px leading-tight' }, [
        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap' }, opportunity.projectValue),
        h('div', { className: 'text-[11px] font-medium text-slate-500/80 dark:text-slate-400 whitespace-nowrap' }, opportunity.retainerValue),
      ])
      : h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap' }, opportunity.projectValue || opportunity.retainerValue || '-');

    return h('tr', {
      key: opportunity.id,
      className: 'hover:bg-slate-100/95 dark:hover:bg-slate-800/70 transition-colors',
    }, [
      renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
        h('button', {
          type: 'button',
          className: 'truncate text-left text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-netnet-purple dark:hover:text-netnet-purple',
          onClick: () => navigate(`#/app/sales/${opportunity.id}`),
        }, opportunity.name),
      ]), 'w-[22%] min-w-[200px]'),
      renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
        h('div', { className: 'space-y-1 min-w-0 max-w-[220px]' }, [
          h('div', { className: 'text-sm font-medium text-slate-900 dark:text-slate-100 truncate' }, opportunity.company),
          h('div', { className: 'text-xs text-slate-500 dark:text-slate-400 truncate' }, companySecondary),
        ]),
      ]), 'w-[18%] min-w-[180px]'),
      renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
        h('div', { className: `text-sm ${getClarityToneClass(opportunity.clarity)}` }, formatOptionLabel(opportunity.clarity)),
      ]), 'w-[9%] min-w-[96px]'),
      renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
        h('div', { className: 'text-sm text-slate-700 dark:text-slate-200' }, formatOptionLabel(opportunity.type)),
      ]), 'w-[9%] min-w-[96px]'),
      renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
        h('div', { className: 'text-sm text-slate-700 dark:text-slate-200 tabular-nums' }, String(opportunity.linkedJobsCount || 0)),
      ]), 'w-[8%] min-w-[80px]'),
      renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
        h('div', { className: 'text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap' }, opportunity.estimatedTiming),
      ]), 'w-[12%] min-w-[120px]'),
      renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
        valueContent,
      ]), 'w-[11%] min-w-[120px]'),
      renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
        owner
          ? renderHtml(renderAvatar(owner, { sizeClass: 'h-7 w-7', textClass: 'text-[10px]' }))
          : h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, '-'),
      ]), 'w-[7%] min-w-[72px]'),
      renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
        h('div', { className: 'text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap' }, opportunity.lastModified),
      ]), 'w-[10%] min-w-[92px]'),
      renderCell(h('div', {
        className: 'min-h-[40px] flex items-center justify-end',
      }, [
        h(RowActionsMenu, {
          menuItems: ['Open Opportunity', 'Edit Opportunity', 'Duplicate Opportunity', 'Archive Opportunity'],
          onSelect: (item) => {
            if (item === 'Open Opportunity') {
              navigate(`#/app/sales/${opportunity.id}`);
            }
            if (item === 'Edit Opportunity') {
              navigate(`#/app/sales/${opportunity.id}/edit`);
            }
          },
        }),
      ]), 'w-[40px] min-w-[40px] text-right'),
    ]);
  });

  return h(QuickTasksExecutionTable, {
    tasks: [],
    members,
    stickyHeader: false,
    customColumns: [
      { key: 'opportunity-name', label: h(SalesColumnLabel, null, 'Opportunity Name'), className: 'px-3 py-3 w-[22%]' },
      { key: 'company-person', label: h(SalesColumnLabel, null, 'Company / Person'), className: 'px-3 py-3 w-[18%]' },
      { key: 'clarity', label: h(SalesColumnLabel, null, 'Clarity'), className: 'px-3 py-3 w-[9%]' },
      { key: 'type', label: h(SalesColumnLabel, null, 'Type'), className: 'px-3 py-3 w-[9%]' },
      { key: 'linked-jobs', label: h(SalesColumnLabel, null, 'Linked Jobs'), className: 'px-3 py-3 w-[8%]' },
      { key: 'estimated-timing', label: h(SalesColumnLabel, null, 'Estimated Timing'), className: 'px-3 py-3 w-[12%]' },
      { key: 'value', label: h(SalesColumnLabel, null, 'Value'), className: 'px-3 py-3 w-[11%]' },
      { key: 'owner', label: h(SalesColumnLabel, null, 'Owner'), className: 'px-3 py-3 w-[7%]' },
      { key: 'last-modified', label: h(SalesColumnLabel, null, 'Last Modified'), className: 'px-3 py-3 w-[10%]' },
      { key: 'actions', label: '', className: 'px-3 py-3 w-[40px] text-right' },
    ],
    customRows: rows,
    customEmptyMessage: 'No matching opportunities',
  });
}

function SalesIndexScreen() {
  const members = useMemo(() => loadTeamMembers(), []);
  const [search, setSearch] = useState('');
  const [clarity, setClarity] = useState('all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [owner, setOwner] = useState('all');

  const ownerOptions = useMemo(() => [
    { value: 'all', label: 'All owners' },
    ...members.map((member) => ({
      value: member.id,
      label: getDisplayName(member) || member.email || 'Owner',
    })),
  ], [members]);

  const filteredOpportunities = useMemo(() => filterOpportunities(mockSalesOpportunities, {
    search,
    clarity,
    type,
    status,
    owner,
  }), [search, clarity, type, status, owner]);

  return h('div', { className: 'space-y-0' }, [
    h('div', {
      id: 'sales-sticky-group',
      className: 'sticky top-0 z-30 -mx-4 mb-0 px-4 bg-[#f8fafc] dark:bg-[#020617] border-b border-slate-200/80 dark:border-white/10',
    }, [
      h('div', { className: 'flex w-full flex-wrap items-center gap-2 py-3' }, [
        h('div', { className: 'min-w-[220px] flex-1' }, [
          h(TextInput, {
            id: 'sales-search',
            type: 'search',
            value: search,
            onChange: (event) => setSearch(event.target.value),
            className: '!bg-white !text-slate-700 !border-slate-200 dark:!bg-slate-900 dark:!text-slate-200 dark:!border-white/10',
            placeholder: 'Search opportunities...',
            'aria-label': 'Search opportunities',
          }),
        ]),
        h(CompoundFilterControl, {
          label: 'Clarity',
          id: 'sales-clarity-filter',
          value: clarity,
          onChange: (event) => setClarity(event.target.value),
          options: CLARITY_OPTIONS,
        }),
        h(CompoundFilterControl, {
          label: 'Type',
          id: 'sales-type-filter',
          value: type,
          onChange: (event) => setType(event.target.value),
          options: TYPE_OPTIONS,
        }),
        h(CompoundFilterControl, {
          label: 'Status',
          id: 'sales-status-filter',
          value: status,
          onChange: (event) => setStatus(event.target.value),
          options: STATUS_OPTIONS,
        }),
        h(CompoundFilterControl, {
          label: 'Owner',
          id: 'sales-owner-filter',
          value: owner,
          onChange: (event) => setOwner(event.target.value),
          options: ownerOptions,
          widthClass: 'w-[168px]',
        }),
        h(PrimaryButton, {
          className: 'flex-none whitespace-nowrap',
          onClick: () => navigate('#/app/sales/new'),
        }, '+ New Opportunity'),
      ]),
      h('div', { className: 'pb-3' }, [
        h(SalesSummaryStrip, { opportunities: filteredOpportunities, members }),
      ]),
    ]),
    h(SalesTable, { opportunities: filteredOpportunities, members }),
  ]);
}

export function renderSalesPage(container = document.getElementById('app-main'), route = {}) {
  if (!container) {
    console.warn('[SalesModule] container not found for renderSalesPage.');
    return;
  }

  if (route?.mode === 'new') {
    renderOpportunityFormPage(container, { mode: 'create' });
    return;
  }

  if (route?.mode === 'edit') {
    renderOpportunityFormPage(container, { mode: 'edit', opportunityId: route.id });
    return;
  }

  if (route?.id) {
    renderOpportunityDetailPage(container, route.id);
    return;
  }

  const { headerMount, bodyMount } = mountSectionPageShell(container, {
    headerId: 'sales-header',
    bodyId: 'sales-body',
  });

  const headerRoot = createRoot(headerMount);
  const bodyRoot = createRoot(bodyMount);

  headerRoot.render(h(SectionHeader, {
    breadcrumbs: [
      { label: 'Sales' },
    ],
    showHelpIcon: true,
    showSecondaryRow: false,
    className: 'mb-1',
  }));

  bodyRoot.render(h(SalesIndexScreen));
}
