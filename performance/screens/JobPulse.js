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

const { createElement: h, useMemo, useState } = React;

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function severityScore(del) {
  let score = 0;
  if (del.overdue) score += 6;
  if (del.effortOver) score += 4;
  if (del.timelineOver) score += 4;
  if (del.lowConfidence) score += 3;
  if (del.dueSoon) score += 1;
  if (del.needsCheckIn) score += 0.5;
  return score;
}

function statusOrder(status) {
  if (status === 'in-progress') return 0;
  if (status === 'backlog') return 1;
  if (status === 'completed') return 3;
  return 2;
}

function sortDeliverables(deliverables, focusedId) {
  const list = [...deliverables];
  list.sort((a, b) => {
    const aStatus = statusOrder(a.status);
    const bStatus = statusOrder(b.status);
    if (aStatus !== bStatus) return aStatus - bStatus;
    const aDrift = severityScore(a);
    const bDrift = severityScore(b);
    const aUnreviewed = !a.reviewed && aDrift > 0;
    const bUnreviewed = !b.reviewed && bDrift > 0;
    if (aUnreviewed !== bUnreviewed) return aUnreviewed ? -1 : 1;
    if (bDrift !== aDrift) return bDrift - aDrift;
    const ad = a.due ? new Date(a.due).getTime() : Infinity;
    const bd = b.due ? new Date(b.due).getTime() : Infinity;
    if (ad !== bd) return ad - bd;
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (b.status === 'completed' && a.status !== 'completed') return -1;
    return (a.name || '').localeCompare(b.name || '');
  });
  if (focusedId) {
    const idx = list.findIndex((d) => String(d.id) === String(focusedId));
    if (idx > 0) {
      const [item] = list.splice(idx, 1);
      list.unshift(item);
    }
  }
  return list;
}

function summarizeJob(deliverables) {
  const overdue = deliverables.filter((d) => d.overdue && d.status !== 'completed').length;
  const atRisk = deliverables.filter((d) => d.atRisk).length;
  const watch = deliverables.filter((d) => d.dueSoon && d.status !== 'completed').length;
  const changeOrders = deliverables.reduce((sum, d) => sum + (d.changeOrders?.length || 0), 0);
  const lowConfidence = deliverables.filter((d) => d.lowConfidence).length;
  const needsCheckIn = deliverables.filter((d) => d.needsCheckIn).length;
  let stateLabel = 'Flowing';
  if (overdue > 0 || atRisk > 0) stateLabel = 'Drifting';
  else if (watch > 0 || needsCheckIn > 0) stateLabel = 'Wobbly';
  return { overdue, atRisk, watch, changeOrders, lowConfidence, needsCheckIn, stateLabel };
}

function buildHistory(deliverables) {
  const events = [];
  deliverables.forEach((d) => {
    if (d.changedAt) events.push({ date: d.changedAt, label: `${d.name}: Due date moved` });
    if (d.reviewed?.at) events.push({ date: d.reviewed.at, label: `${d.name}: Reviewed` });
    if (d.completedAt) events.push({ date: d.completedAt, label: `${d.name}: Completed` });
    (d.changeOrders || []).forEach((co) => events.push({ date: co.createdAt, label: `${d.name}: Change order created` }));
  });
  return events
    .filter((e) => e.date && !Number.isNaN(new Date(e.date).getTime()))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function DeliverableRow({ del, expanded, onToggle, onAction, onConfidenceChange, tasks, team, isFocused }) {
  const menuItems = [
    del.reviewed ? 'Clear Reviewed' : 'Mark as Reviewed',
    'Complete Deliverable',
    'Change Deliverable Due Date',
    'Reassign Tasks In Deliverable',
    'Create Change Order',
  ];
  const focusClass = isFocused ? 'ring-1 ring-[var(--color-brand-purple,#711FFF)]/70 bg-[var(--color-brand-purple,#711FFF)]/5' : '';
  return h('div', { className: `space-y-2 ${focusClass} rounded-xl` }, [
    h('div', {
      className: 'px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer rounded-xl',
      onClick: onToggle,
    }, [
      h('div', { className: 'space-y-1 min-w-0' }, [
        h('div', { className: 'flex items-center gap-2 flex-wrap' }, [
          h('div', { className: 'font-semibold text-slate-900 dark:text-white truncate' }, del.name),
          del.reviewed ? h(ReviewedBadge, { reviewed: del.reviewed }) : null,
        ]),
        h('div', { className: 'flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 flex-wrap' }, [
          h('span', null, del.status === 'backlog' ? 'Backlog' : del.status === 'completed' ? 'Completed' : 'In Progress'),
          h('span', { className: 'text-slate-400' }, '•'),
          del.changedAt
            ? h(MovedDateIndicator, { originalDate: del.originalDue, newDate: del.due, changedAt: del.changedAt, changedBy: del.changedBy })
            : h('span', null, `Due ${formatDate(del.due)}`),
          del.completedAt ? h('span', null, `Completed ${formatDate(del.completedAt)}`) : null,
          h(ProgressConfidenceChip, { level: del.progressConfidence, onChange: (val) => onConfidenceChange(val), dataDemo: 'confidence-chip' }),
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
    h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, expanded ? 'Hide details' : 'Show details'),
      h('div', { onClick: (e) => e.stopPropagation() },
        h(RowActionsMenu, {
          menuItems,
          onSelect: (item) => { onAction(item); },
          dataDemoButton: 'deliverable-actions',
        })
      ),
    ]),
  ]),
    expanded ? h('div', { className: 'px-4 pb-4 space-y-3 text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/40 rounded-xl' }, [
      h('div', null, [
        h('div', { className: 'font-semibold text-slate-900 dark:text-white' }, 'Timeline'),
        h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' },
          del.changedAt
            ? `Moved from ${formatDate(del.originalDue)} to ${formatDate(del.due)} on ${formatDate(del.changedAt)}${del.changedBy ? ` by ${del.changedBy}` : ''}`
            : `Planned for ${formatDate(del.due)}`),
      ]),
      del.changeOrders?.length
        ? h('div', null, [
            h('div', { className: 'font-semibold text-slate-900 dark:text-white' }, `Change orders (${del.changeOrders.length})`),
            h('ul', { className: 'list-disc pl-4 space-y-1 text-xs text-slate-600 dark:text-slate-300' },
              del.changeOrders.map((co) =>
                h('li', { key: co.id }, `${co.note || 'Change order'} — ${formatDate(co.createdAt)}`)
              )
            ),
          ])
        : null,
      tasks.length
        ? h('div', null, [
            h('div', { className: 'font-semibold text-slate-900 dark:text-white' }, `Tasks (${tasks.length})`),
            h('ul', { className: 'space-y-1 text-xs text-slate-600 dark:text-slate-300' },
              tasks.map((t) =>
                h('li', { key: t.id }, `${t.title || 'Task'} — ${team.find((m) => m.id === t.assigneeId)?.name || 'Unassigned'}`)
              )
            ),
          ])
        : null,
    ]) : null,
  ]);
}

export function JobPulse({ queryString = '' }) {
  const params = useMemo(() => new URLSearchParams(queryString), [queryString]);
  const jobId = params.get('jobId');
  const focusDeliverableId = params.get('deliverableId');
  const [state, setState] = useState(() => getEffectiveState());
  const [expanded, setExpanded] = useState(() => new Set(focusDeliverableId ? [focusDeliverableId] : []));
  const [action, setAction] = useState(null);
  const [formState, setFormState] = useState({});

  const job = useMemo(() => state.jobs.find((j) => String(j.id) === String(jobId)), [state.jobs, jobId]);
  const jobDeliverables = useMemo(() => sortDeliverables(state.deliverables.filter((d) => String(d.jobId) === String(jobId)), focusDeliverableId), [state.deliverables, jobId, focusDeliverableId]);
  const summary = useMemo(() => summarizeJob(jobDeliverables), [jobDeliverables]);
  const history = useMemo(() => buildHistory(jobDeliverables), [jobDeliverables]);

  const refresh = () => setState(getEffectiveState());

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openAction = (type, del) => {
    setAction({ type, del });
    setFormState({
      date: del?.due || '',
      assigneeId: state.team[0]?.id || '',
      note: '',
    });
  };

  const closeAction = () => {
    setAction(null);
    setFormState({});
  };

  const doAction = () => {
    if (!action) return;
    let next = state;
    if (action.type === 'Mark as Reviewed') next = markReviewed(action.del.id);
    else if (action.type === 'Clear Reviewed') next = clearReviewed(action.del.id);
    else if (action.type === 'Complete Deliverable') next = completeDeliverable(action.del.id);
    else if (action.type === 'Change Deliverable Due Date') next = updateDueDate(action.del.id, formState.date);
    else if (action.type === 'Reassign Tasks In Deliverable') next = reassignTasks(action.del.id, formState.assigneeId || state.team[0]?.id);
    else if (action.type === 'Create Change Order') next = createChangeOrder(action.del.id, formState.note || 'Change order added');
    setState(next);
    closeAction();
    window?.showToast?.(`${action.type} saved`);
  };

  if (!job) {
    return h('div', { className: 'rounded-xl border border-dashed border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-slate-900/50 p-5 text-sm text-slate-600 dark:text-slate-200' },
      jobId ? `Job ${jobId} not found.` : 'Pass ?jobId=<id> to load a job pulse card.');
  }

  return h('div', { className: 'space-y-6' }, [
    h(PerfCard, { className: 'space-y-2' }, [
      h(PerfSectionTitle, {
        title: job.name,
        subtitle: job.client || 'Client',
        rightSlot: h('div', { className: 'text-xs text-slate-500 dark:text-slate-300' }, `Lead: Not set • Status: ${job.status || 'Active'}`),
      }),
    ]),

    h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-3' }, [
      h(PerfCard, { variant: 'secondary', className: 'space-y-1' }, [
        h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, summary.stateLabel),
        h('div', { className: 'text-2xl font-bold text-slate-900 dark:text-white' }, `${summary.atRisk} at risk`),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, `${summary.overdue} overdue • ${summary.watch} watchlist`),
      ]),
      h(PerfCard, { variant: 'secondary', className: 'space-y-1' }, [
        h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Confidence'),
        h('div', { className: 'text-2xl font-bold text-slate-900 dark:text-white' }, `${summary.lowConfidence} low confidence`),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, `${summary.needsCheckIn} need check-in`),
      ]),
      h(PerfCard, { variant: 'secondary', className: 'space-y-1' }, [
        h('div', { className: 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Changes'),
        h('div', { className: 'text-2xl font-bold text-slate-900 dark:text-white' }, `${summary.changeOrders} change orders`),
        h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Includes created/activated (prototype)'),
      ]),
    ]),

    h(PerfCard, { className: 'space-y-3' }, [
      h(PerfSectionTitle, { title: 'Deliverables', subtitle: `${jobDeliverables.length} deliverables • tap row to expand` }),
      jobDeliverables.length === 0
        ? h('div', { className: 'p-2 text-sm text-slate-600 dark:text-slate-300' }, 'No deliverables for this job.')
        : h('div', { className: 'space-y-3' },
            jobDeliverables.map((del) =>
              h(PerfCard, {
                key: del.id,
                variant: 'secondary',
                className: expanded.has(del.id) ? 'ring-1 ring-slate-200 dark:ring-white/10' : '',
              }, h(DeliverableRow, {
                del,
                expanded: expanded.has(del.id),
                onToggle: () => toggle(del.id),
                onAction: (item) => openAction(item, del),
                onConfidenceChange: (val) => { setState(setProgressConfidence(del.id, val)); },
                tasks: state.tasks.filter((t) => t.deliverableId === del.id),
                team: state.team,
                isFocused: String(del.id) === String(focusDeliverableId),
              }))
            )
          ),
    ]),

    h(PerfCard, { className: 'space-y-3' }, [
      h(PerfSectionTitle, { title: 'Recent changes' }),
      history.length === 0
        ? h('div', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'No recent changes captured.')
        : h('ul', { className: 'space-y-2 text-sm text-slate-700 dark:text-slate-200' },
            history.slice(0, 8).map((ev, idx) =>
              h('li', { key: idx, className: 'flex items-center gap-2' }, [
                h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, formatDate(ev.date)),
                h('span', null, ev.label),
              ])
            )
          ),
    ]),

    h(PerfCard, { className: 'space-y-2 border-dashed' }, [
      h(PerfSectionTitle, { title: 'Evidence (Phase 1 hook)', subtitle: 'Coming soon data touchpoints.' }),
      h('div', { className: 'flex flex-wrap gap-3 text-sm' }, [
        h('button', { className: 'px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200' }, 'Time entries (coming soon)'),
        h('button', { className: 'px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200' }, 'Service type breakdown (coming soon)'),
        h('button', { className: 'px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200' }, 'Team contribution (coming soon)'),
      ]),
    ]),

    action ? h(ActionModal, {
      title: action.type,
      description: action.del?.name,
      onConfirm: doAction,
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
              }, state.team.map((tm) => h('option', { key: tm.id, value: tm.id }, tm.name))),
            ]),
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
          ]);
        }
        return h('p', { className: 'text-sm text-slate-600 dark:text-slate-300' }, 'Confirm to apply this change. Reviewed clears when material state changes.');
      })(),
    }) : null,
  ]);
}
