import { navigate } from '../../router.js';
import {
  StackedMeter,
  MovedDateIndicator,
  RowActionsMenu,
  ProgressConfidenceChip,
  ReviewedBadge,
  DriftReasonChips,
  PerfCard,
  PerfSectionTitle,
  ActionModal,
} from '../../components/performance/primitives.js';
import {
  getEffectiveState,
  markReviewed,
  clearReviewed,
  setProgressConfidence,
  updateDueDate,
  completeDeliverable,
  reassignTasks,
  createChangeOrder,
} from '../testdata/performance-state.js';

const { createElement: h, useEffect, useMemo, useState } = React;
const LENSES = [
  { id: 'all', label: 'All' },
  { id: 'pace', label: 'Pace' },
  { id: 'deadlines', label: 'Deadlines' },
  { id: 'confidence', label: 'Confidence' },
];
const FILTER_DEFS = {
  overdue: { label: 'Overdue' },
  dueSoon: { label: 'Due soon (7d)' },
  effortOver: { label: 'Effort overrun' },
  timelineOver: { label: 'Timeline overrun' },
  lowConf: { label: 'Low confidence' },
  needsCheckIn: { label: 'Needs check-in' },
  moved: { label: 'Moved due date' },
};
const REVIEWED_OPTIONS = ['all', 'hide', 'only'];

function parseQuery(queryString = '') {
  const params = new URLSearchParams(queryString);
  const lens = LENSES.some((l) => l.id === params.get('lens')) ? params.get('lens') : 'all';
  const filters = (params.get('filters') || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
  const reviewed = REVIEWED_OPTIONS.includes(params.get('reviewed')) ? params.get('reviewed') : 'all';
  const client = params.get('client') || '';
  const jobId = params.get('jobId') || '';
  const q = params.get('q') || '';
  return { lens, filters, reviewed, client, jobId, q };
}

function updateUrl(next) {
  const params = new URLSearchParams();
  params.set('lens', next.lens || 'all');
  if (next.filters?.length) params.set('filters', next.filters.join(','));
  if (next.reviewed && next.reviewed !== 'all') params.set('reviewed', next.reviewed);
  if (next.client) params.set('client', next.client);
  if (next.jobId) params.set('jobId', next.jobId);
  if (next.q) params.set('q', next.q);
  const qs = params.toString();
  navigate(`#/app/performance/at-risk-deliverables${qs ? `?${qs}` : ''}`);
}

function severityScore(d) {
  let score = 0;
  if (d.overdue) score += 120;
  else if (d.dueSoon) score += 40;
  score += Math.max(0, d.effortPct - 100);
  score += Math.max(0, d.timelinePct - 100);
  if (d.lowConfidence) score += 40;
  if (d.needsCheckIn) score += 10;
  return score;
}

function passesLens(d, lens, filters) {
  if (lens === 'pace') return d.effortOver || d.timelineOver || d.lowConfidence;
  if (lens === 'deadlines') return d.overdue || d.dueSoon;
  if (lens === 'confidence') return d.lowConfidence || d.needsCheckIn;
  // all lens
  const wantsCheckIn = filters.includes('needsCheckIn');
  return d.atRisk || (wantsCheckIn && d.needsCheckIn);
}

function applyFilters(deliverables, filtersState) {
  const filterSet = new Set(filtersState.filters || []);
  return deliverables
    .filter((d) => d.status !== 'completed')
    .filter((d) => passesLens(d, filtersState.lens, filtersState.filters))
    .filter((d) => (!filterSet.has('overdue') ? true : d.overdue))
    .filter((d) => (!filterSet.has('dueSoon') ? true : d.dueSoon))
    .filter((d) => (!filterSet.has('effortOver') ? true : d.effortOver))
    .filter((d) => (!filterSet.has('timelineOver') ? true : d.timelineOver))
    .filter((d) => (!filterSet.has('lowConf') ? true : d.lowConfidence))
    .filter((d) => (!filterSet.has('needsCheckIn') ? true : d.needsCheckIn))
    .filter((d) => (!filterSet.has('moved') ? true : Boolean(d.changedAt)))
    .filter((d) => (filtersState.reviewed === 'hide' ? !d.reviewed : true))
    .filter((d) => (filtersState.reviewed === 'only' ? Boolean(d.reviewed) : true))
    .filter((d) => (filtersState.client ? (d.client || '').toLowerCase() === filtersState.client.toLowerCase() : true))
    .filter((d) => (filtersState.jobId ? String(d.jobId) === String(filtersState.jobId) : true))
    .filter((d) => {
      if (!filtersState.q) return true;
      const q = filtersState.q.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        (d.jobName || '').toLowerCase().includes(q) ||
        (d.client || '').toLowerCase().includes(q)
      );
    });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function DeliverableRow({ del, onAction, onConfidenceChange }) {
  const menuItems = [
    del.reviewed ? 'Clear Reviewed' : 'Mark as Reviewed',
    'Complete Deliverable',
    'Change Deliverable Due Date',
    'Reassign Tasks In Deliverable',
    'Create Change Order',
  ];

  return h('div', { className: 'flex flex-col gap-3 md:flex-row md:items-start md:justify-between' }, [
    h('div', { className: 'space-y-2 min-w-0' }, [
      h('div', { className: 'flex items-center gap-2 flex-wrap' }, [
        h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white truncate' }, del.name),
        del.reviewed ? h(ReviewedBadge, { reviewed: del.reviewed }) : null,
      ]),
      h('div', { className: 'flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 flex-wrap' }, [
        h('button', {
          type: 'button',
          className: 'font-semibold text-[var(--color-brand-purple,#711FFF)] hover:underline',
          onClick: () => navigate(`#/app/performance/job-pulse?jobId=${del.jobId}&deliverableId=${del.id}`),
        }, del.jobName || `Job ${del.jobId}`),
        h('span', { className: 'text-slate-400' }, '•'),
        h('span', null, del.client || 'Client'),
        h('span', { className: 'text-slate-400' }, '•'),
        h('span', null, del.status === 'backlog' ? 'Backlog' : del.status === 'completed' ? 'Completed' : 'In Progress'),
        del.changeOrders?.length ? h('span', { className: 'text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200' }, `${del.changeOrders.length} change order${del.changeOrders.length === 1 ? '' : 's'}`) : null,
      ]),
      h('div', { className: 'flex items-center gap-3 flex-wrap text-sm text-slate-700 dark:text-slate-200' }, [
        del.changedAt
          ? h(MovedDateIndicator, { originalDate: del.originalDue, newDate: del.due, changedAt: del.changedAt, changedBy: del.changedBy })
          : h('div', null, ['Due ', h('span', { className: del.overdue ? 'text-rose-600 dark:text-rose-300 font-semibold' : '' }, formatDate(del.due))]),
        h(ProgressConfidenceChip, { level: del.progressConfidence, onChange: onConfidenceChange, dataDemo: 'confidence-chip' }),
      ]),
      h(StackedMeter, {
        variant: 'inline',
        showHeader: false,
        effort: { actual: del.effortPct, baseline: 100, unit: '%' },
        timeline: { actual: del.timelinePct, baseline: 100, unit: '%' },
        completed: del.status === 'completed',
      }),
      h(DriftReasonChips, { reasons: del.reasons }),
    ]),
    h('div', { className: 'flex items-start gap-3 justify-end' }, [
      h(RowActionsMenu, {
        menuItems,
        onSelect: (item) => onAction(item, del),
        dataDemoButton: 'deliverable-actions',
      }),
    ]),
  ]);
}

export function AtRiskDeliverables({ queryString = '' }) {
  const [filterState, setFilterState] = useState(() => parseQuery(queryString));
  const [perfState, setPerfState] = useState(() => getEffectiveState());
  const [action, setAction] = useState(null);
  const [formState, setFormState] = useState({});

  useEffect(() => {
    setFilterState(parseQuery(queryString));
  }, [queryString]);

  const deliverables = useMemo(() => {
    const filtered = applyFilters(perfState.deliverables, filterState);
    return filtered
      .map((d) => ({ ...d, severity: severityScore(d) }))
      .sort((a, b) => {
        if (!!a.reviewed !== !!b.reviewed) return a.reviewed ? 1 : -1;
        if (b.severity !== a.severity) return b.severity - a.severity;
        const ad = a.due ? new Date(a.due).getTime() : Infinity;
        const bd = b.due ? new Date(b.due).getTime() : Infinity;
        if (ad !== bd) return ad - bd;
        return (a.jobName || '').localeCompare(b.jobName || '');
      });
  }, [perfState.deliverables, filterState]);

  const stats = useMemo(() => {
    const base = perfState.deliverables.filter((d) => d.status !== 'completed');
    const atRisk = base.filter((d) => d.atRisk);
    const reviewed = base.filter((d) => d.reviewed);
    const needsCheckIn = base.filter((d) => d.needsCheckIn);
    return { atRisk: atRisk.length, reviewed: reviewed.length, needsCheckIn: needsCheckIn.length };
  }, [perfState.deliverables]);

  const onLensChange = (lens) => {
    const next = { ...filterState, lens };
    setFilterState(next);
    updateUrl(next);
  };

  const toggleFilter = (id) => {
    const set = new Set(filterState.filters);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const filters = Array.from(set);
    const next = { ...filterState, filters };
    setFilterState(next);
    updateUrl(next);
  };

  const setReviewedFilter = (value) => {
    const next = { ...filterState, reviewed: value };
    setFilterState(next);
    updateUrl(next);
  };

  const clearFilters = () => {
    const next = { ...filterState, filters: [], reviewed: 'all', client: '', jobId: '', q: '' };
    setFilterState(next);
    updateUrl(next);
  };

  const openAction = (type, del) => {
    setAction({ type, del });
    setFormState({
      date: del?.due || '',
      assigneeId: perfState.tasks.find((t) => t.deliverableId === del.id)?.assigneeId || '',
      note: '',
    });
  };

  const closeAction = () => {
    setAction(null);
    setFormState({});
  };

  const confirmAction = () => {
    if (!action) return;
    let nextState = perfState;
    if (action.type === 'Mark as Reviewed') {
      nextState = markReviewed(action.del.id);
      window?.showToast?.('Marked as reviewed');
    } else if (action.type === 'Clear Reviewed') {
      nextState = clearReviewed(action.del.id);
      window?.showToast?.('Reviewed cleared');
    } else if (action.type === 'Complete Deliverable') {
      nextState = completeDeliverable(action.del.id);
      window?.showToast?.('Deliverable marked completed');
    } else if (action.type === 'Change Deliverable Due Date') {
      nextState = updateDueDate(action.del.id, formState.date);
      window?.showToast?.('Due date updated');
    } else if (action.type === 'Reassign Tasks In Deliverable') {
      nextState = reassignTasks(action.del.id, formState.assigneeId || perfState.team[0]?.id);
      window?.showToast?.('Tasks reassigned');
    } else if (action.type === 'Create Change Order') {
      nextState = createChangeOrder(action.del.id, formState.note || 'Change order added');
      window?.showToast?.('Change order created');
    }
    setPerfState(nextState);
    closeAction();
  };

  return h('div', { className: 'space-y-6' }, [
    h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-3' }, [
      h(PerfCard, { variant: 'secondary', className: 'space-y-1' }, [
        h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'At-Risk Deliverables'),
        h('div', { className: 'text-2xl font-bold text-slate-900 dark:text-white' }, stats.atRisk),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Included by eligibility rules'),
      ]),
      h(PerfCard, { variant: 'secondary', className: 'space-y-1' }, [
        h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Reviewed'),
        h('div', { className: 'text-2xl font-bold text-slate-900 dark:text-white' }, stats.reviewed),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Reviewed items are muted in attention'),
      ]),
      h(PerfCard, { variant: 'secondary', className: 'space-y-1' }, [
        h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Needs Confidence Check-In'),
        h('div', { className: 'text-2xl font-bold text-slate-900 dark:text-white' }, stats.needsCheckIn),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, '85–100% effort/timeline with no confidence set'),
      ]),
    ]),

    h(PerfCard, { className: 'space-y-4' }, [
      h(PerfSectionTitle, { title: 'Filters', subtitle: 'Lens and filters persist in the URL for repeatability.' }),
      h('div', { className: 'flex flex-wrap items-center gap-3' }, [
        h('div', { className: 'flex items-center gap-2' }, [
          h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Lens'),
          h('div', { className: 'inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-1 py-1' },
            LENSES.map((lens) =>
              h('button', {
                key: lens.id,
                type: 'button',
                className: [
                  'px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-netnet-purple focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
                  filterState.lens === lens.id
                    ? 'bg-[var(--color-brand-purple,#711FFF)] text-white shadow-sm border-transparent'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-white/10',
                ].join(' '),
                onClick: () => onLensChange(lens.id),
              }, lens.label)
            )
          ),
        ]),
        h('div', { className: 'flex items-center gap-2 flex-wrap' },
          Object.entries(FILTER_DEFS).map(([id, meta]) =>
            h('button', {
              key: id,
              type: 'button',
              className: [
                'px-3 py-1.5 rounded-full border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-netnet-purple focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
                filterState.filters.includes(id)
                  ? 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:border-netnet-purple/50',
              ].join(' '),
              onClick: () => toggleFilter(id),
            }, meta.label)
          )
        ),
        h('div', { className: 'flex items-center gap-2 flex-wrap text-sm text-slate-600 dark:text-slate-300' }, [
          h('label', { className: 'flex items-center gap-1' }, [
            h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Reviewed'),
            h('select', {
              value: filterState.reviewed,
              onChange: (e) => setReviewedFilter(e.target.value),
              className: 'rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-netnet-purple',
            }, REVIEWED_OPTIONS.map((opt) => h('option', { key: opt, value: opt }, opt === 'all' ? 'Show all' : opt === 'hide' ? 'Hide reviewed' : 'Only reviewed'))),
          ]),
          h('label', { className: 'flex items-center gap-1' }, [
            h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Client'),
            h('input', {
              type: 'text',
              value: filterState.client,
              onChange: (e) => {
                const next = { ...filterState, client: e.target.value };
                setFilterState(next); updateUrl(next);
              },
              placeholder: 'Client name',
              className: 'rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-netnet-purple',
            }),
          ]),
          h('label', { className: 'flex items-center gap-1' }, [
            h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Job'),
            h('input', {
              type: 'text',
              value: filterState.jobId,
              onChange: (e) => {
                const next = { ...filterState, jobId: e.target.value };
                setFilterState(next); updateUrl(next);
              },
              placeholder: 'Job id',
              className: 'rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1 text-sm w-24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-netnet-purple',
            }),
          ]),
          h('label', { className: 'flex items-center gap-2' }, [
            h('span', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Search'),
            h('input', {
              type: 'search',
              value: filterState.q,
              onChange: (e) => {
                const next = { ...filterState, q: e.target.value };
                setFilterState(next); updateUrl(next);
              },
              placeholder: 'Deliverable or job',
              className: 'rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-1 text-sm min-w-[180px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-netnet-purple',
            }),
          ]),
          h('button', {
            type: 'button',
            className: 'text-sm font-semibold text-[var(--color-brand-purple,#711FFF)] hover:underline',
            onClick: clearFilters,
          }, 'Clear filters'),
        ]),
      ]),
    ]),

    h(PerfCard, { className: 'space-y-4' }, [
      h(PerfSectionTitle, {
        title: 'At-Risk Deliverables',
        subtitle: `${deliverables.length} items • sorted by urgency, unreviewed first.`,
      }),
      deliverables.length === 0
        ? h('div', { className: 'p-2 text-sm text-slate-600 dark:text-slate-300' }, 'No deliverables match the current lens and filters.')
        : h('div', { className: 'space-y-3' },
            deliverables.map((del) =>
              h(PerfCard, {
                key: del.id,
                variant: 'secondary',
                className: `${del.reviewed ? 'opacity-90' : ''}`,
              }, h(DeliverableRow, {
                del,
                onAction: openAction,
                onConfidenceChange: (val) => { setPerfState(setProgressConfidence(del.id, val)); },
              }))
            )
          ),
    ]),

    action ? h(ActionModal, {
      title: action.type,
      description: action.del?.name,
      onConfirm: confirmAction,
      onCancel: closeAction,
      children: (() => {
        if (action.type === 'Change Deliverable Due Date') {
          return h('div', { className: 'space-y-2' }, [
            h('label', { className: 'text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1' }, [
              'New due date',
              h('input', {
                type: 'date',
                value: formState.date || '',
                onChange: (e) => setFormState((s) => ({ ...s, date: e.target.value })),
                className: 'rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm',
              }),
            ]),
            h('p', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Updates moved date and clears reviewed status.'),
          ]);
        }
        if (action.type === 'Reassign Tasks In Deliverable') {
          return h('div', { className: 'space-y-2' }, [
            h('label', { className: 'text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1' }, [
              'Assign tasks to',
              h('select', {
                value: formState.assigneeId,
                onChange: (e) => setFormState((s) => ({ ...s, assigneeId: e.target.value })),
                className: 'rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm',
              }, perfState.team.map((tm) => h('option', { key: tm.id, value: tm.id }, tm.name))),
            ]),
            h('p', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Reassigns deliverable tasks and clears reviewed status.'),
          ]);
        }
        if (action.type === 'Create Change Order') {
          return h('div', { className: 'space-y-2' }, [
            h('label', { className: 'text-sm text-slate-700 dark:text-slate-200 flex flex-col gap-1' }, [
              'Change order note',
              h('textarea', {
                value: formState.note || '',
                onChange: (e) => setFormState((s) => ({ ...s, note: e.target.value })),
                className: 'rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm',
                rows: 3,
              }),
            ]),
            h('p', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Adds a change order and clears reviewed status.'),
          ]);
        }
        return h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Confirm this action to update deliverable state.');
      })(),
    }) : null,
  ]);
}
