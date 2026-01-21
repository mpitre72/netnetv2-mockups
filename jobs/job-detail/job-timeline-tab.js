import { getCurrentUserId, loadTeamMembers } from '../../quick-tasks/quick-tasks-store.js';

const { createElement: h, useEffect, useMemo, useState } = React;

const MS_DAY = 24 * 60 * 60 * 1000;

const ZOOMS = [
  { value: 'day', label: 'Day', pxPerDay: 28, tickStep: 1 },
  { value: 'week', label: 'Week', pxPerDay: 10, tickStep: 7 },
  { value: 'month', label: 'Month', pxPerDay: 4, tickStep: 30 },
];

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseISO(dateStr) {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(dateStr, days) {
  const base = parseISO(dateStr) || new Date();
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + days);
  return localDateISO(next);
}

function diffDays(startStr, endStr) {
  const start = parseISO(startStr);
  const end = parseISO(endStr);
  if (!start || !end) return 0;
  return Math.round((end.getTime() - start.getTime()) / MS_DAY);
}

function formatDateLabel(dateStr) {
  if (!dateStr) return 'No due date';
  const date = parseISO(dateStr);
  if (!date) return dateStr;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatTick(dateStr, zoom) {
  const date = parseISO(dateStr);
  if (!date) return dateStr || '';
  if (zoom === 'month') {
    return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function buildDependencyDraft(job) {
  const draft = {};
  (job?.deliverables || []).forEach((deliverable) => {
    draft[deliverable.id] = Array.isArray(deliverable.dependencyDeliverableIds)
      ? [...deliverable.dependencyDeliverableIds]
      : [];
  });
  return draft;
}

function detectCycle(graph) {
  const visiting = new Set();
  const visited = new Set();
  const visit = (node) => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    const deps = graph.get(node) || [];
    for (const dep of deps) {
      if (visit(dep)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  for (const node of graph.keys()) {
    if (visit(node)) return true;
  }
  return false;
}

function validateDependencies(deliverables) {
  const ids = new Set((deliverables || []).map((d) => String(d.id)));
  const graph = new Map();
  for (const deliverable of deliverables || []) {
    const id = String(deliverable.id);
    const deps = (deliverable.dependencyDeliverableIds || [])
      .map((dep) => String(dep))
      .filter((dep) => dep && dep !== id && ids.has(dep));
    graph.set(id, deps);
  }
  if (detectCycle(graph)) {
    return 'Dependency cycles are not allowed. Remove the loop and try again.';
  }
  return '';
}

function getStartDate(deliverable, deliverableMap, fallbackStart, today) {
  const deps = Array.isArray(deliverable.dependencyDeliverableIds) ? deliverable.dependencyDeliverableIds : [];
  const candidates = deps
    .map((depId) => deliverableMap.get(String(depId))?.dueDate)
    .filter(Boolean);
  if (candidates.length) {
    const latest = candidates.sort().slice(-1)[0];
    return addDays(latest, 1);
  }
  return fallbackStart || today;
}

export function JobTimelineTab({ job, onJobUpdate, readOnly: readOnlyOverride }) {
  const [zoom, setZoom] = useState('week');
  const [editingId, setEditingId] = useState(null);
  const [draftDueDate, setDraftDueDate] = useState('');
  const [historyOpenId, setHistoryOpenId] = useState(null);
  const [showDependencies, setShowDependencies] = useState(false);
  const [dependencyDraft, setDependencyDraft] = useState(() => buildDependencyDraft(job));
  const [dependencyError, setDependencyError] = useState('');

  const members = useMemo(() => loadTeamMembers(), []);
  const memberMap = useMemo(() => new Map(members.map((member) => [String(member.id), member])), [members]);
  const currentUserId = useMemo(() => getCurrentUserId(members), [members]);
  const today = useMemo(() => localDateISO(), []);

  useEffect(() => {
    setDependencyDraft(buildDependencyDraft(job));
  }, [job?.id, job?.deliverables?.length]);

  if (!job) return null;
  const readOnly = readOnlyOverride === undefined ? job.status === 'archived' : readOnlyOverride;

  const deliverables = job.deliverables || [];
  const deliverableMap = new Map(deliverables.map((deliverable) => [String(deliverable.id), deliverable]));
  const jobStart = job.startDate || today;
  const zoomConfig = ZOOMS.find((item) => item.value === zoom) || ZOOMS[1];

  const schedule = deliverables.map((deliverable) => {
    const startDate = getStartDate(deliverable, deliverableMap, jobStart, today);
    const endDate = deliverable.dueDate || null;
    return { deliverable, startDate, endDate };
  });

  const rangeStart = schedule.reduce((min, item) => (!min || item.startDate < min ? item.startDate : min), null) || today;
  const maxEnd = schedule.reduce((max, item) => {
    const end = item.endDate || item.startDate;
    return !max || end > max ? end : max;
  }, null) || today;
  const targetEnd = job.targetEndDate || null;
  const rangeEnd = targetEnd && targetEnd > maxEnd ? targetEnd : maxEnd;
  const paddedStart = addDays(rangeStart, -3);
  const paddedEnd = addDays(rangeEnd, 3);
  const rangeDays = Math.max(1, diffDays(paddedStart, paddedEnd) + 1);
  const timelineWidth = rangeDays * zoomConfig.pxPerDay;
  const finishLineOffset = targetEnd ? diffDays(paddedStart, targetEnd) * zoomConfig.pxPerDay : null;

  const ticks = [];
  for (let offset = 0; offset <= rangeDays; offset += zoomConfig.tickStep) {
    ticks.push({
      date: addDays(paddedStart, offset),
      offset: offset * zoomConfig.pxPerDay,
    });
  }

  const openEdit = (deliverable) => {
    if (readOnly) return;
    setEditingId(deliverable.id);
    setDraftDueDate(deliverable.dueDate || '');
  };

  const closeEdit = () => {
    setEditingId(null);
    setDraftDueDate('');
  };

  const saveDueDate = () => {
    if (readOnly) return;
    if (!editingId || typeof onJobUpdate !== 'function') return;
    const deliverable = deliverableMap.get(String(editingId));
    if (!deliverable) {
      closeEdit();
      return;
    }
    const nextDate = draftDueDate || null;
    const prevDate = deliverable.dueDate || null;
    if (prevDate === nextDate) {
      closeEdit();
      return;
    }
    const originalDueDate = deliverable.originalDueDate || (prevDate && prevDate !== nextDate ? prevDate : null);
    const dueDateHistory = Array.isArray(deliverable.dueDateHistory) ? [...deliverable.dueDateHistory] : [];
    dueDateHistory.push({
      fromDate: prevDate,
      toDate: nextDate,
      changedAt: new Date().toISOString(),
      changedByUserId: currentUserId || null,
    });
    const nextDeliverables = deliverables.map((item) => (
      item.id === deliverable.id
        ? { ...item, dueDate: nextDate, originalDueDate, dueDateHistory }
        : item
    ));
    onJobUpdate({ deliverables: nextDeliverables });
    closeEdit();
  };

  const toggleDependency = (deliverableId, dependencyId) => {
    if (readOnly) return;
    setDependencyDraft((prev) => {
      const current = new Set(prev[deliverableId] || []);
      if (current.has(dependencyId)) {
        current.delete(dependencyId);
      } else {
        current.add(dependencyId);
      }
      return { ...prev, [deliverableId]: Array.from(current) };
    });
  };

  const saveDependencies = () => {
    if (readOnly) return;
    if (typeof onJobUpdate !== 'function') return;
    const nextDeliverables = deliverables.map((deliverable) => {
      const deps = Array.isArray(dependencyDraft[deliverable.id]) ? dependencyDraft[deliverable.id] : [];
      const filtered = deps
        .map((id) => String(id))
        .filter((id) => id && id !== String(deliverable.id) && deliverableMap.has(id));
      return { ...deliverable, dependencyDeliverableIds: Array.from(new Set(filtered)) };
    });
    const error = validateDependencies(nextDeliverables);
    if (error) {
      setDependencyError(error);
      return;
    }
    onJobUpdate({ deliverables: nextDeliverables });
    setShowDependencies(false);
    setDependencyError('');
  };

  const renderHistory = (deliverable) => {
    const history = Array.isArray(deliverable.dueDateHistory) ? deliverable.dueDateHistory : [];
    if (!history.length) return h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'No changes yet.');
    return h('div', { className: 'space-y-2' }, history.slice().reverse().map((entry, idx) => {
      const user = entry.changedByUserId ? memberMap.get(String(entry.changedByUserId)) : null;
      return h('div', { key: `${entry.changedAt || idx}` , className: 'text-xs text-slate-600 dark:text-slate-300' }, [
        h('div', { className: 'font-semibold' }, `${formatDateLabel(entry.fromDate)} → ${formatDateLabel(entry.toDate)}`),
        entry.changedAt
          ? h('div', { className: 'text-[11px] text-slate-500 dark:text-slate-400' }, [
            new Date(entry.changedAt).toLocaleString(),
            user ? ` · ${user.name || user.email || 'User'}` : '',
          ].join(''))
          : null,
      ]);
    }));
  };

  const zoomControls = h('div', { className: 'inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-1 py-1' }, (
    ZOOMS.map((option) => h('button', {
      key: option.value,
      type: 'button',
      className: [
        'px-3 py-1 rounded-full text-xs font-semibold transition-colors border',
        zoom === option.value
          ? 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm'
          : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-white/10',
      ].join(' '),
      onClick: () => setZoom(option.value),
    }, option.label))
  ));

  return h('div', { className: 'space-y-5 pb-12' }, [
    h('div', { className: 'flex flex-wrap items-center justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('div', { className: 'text-lg font-semibold text-slate-900 dark:text-white' }, 'Timeline'),
        h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Deliverable-level schedule with dependencies and slippage tracking.'),
      ]),
        h('div', { className: 'flex flex-wrap items-center gap-2' }, [
          zoomControls,
          h('button', {
            type: 'button',
            className: 'inline-flex items-center justify-center h-9 px-3 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50',
            onClick: () => {
              setDependencyDraft(buildDependencyDraft(job));
              setDependencyError('');
              setShowDependencies(true);
            },
            disabled: readOnly,
          }, 'Dependencies'),
        ]),
      ]),
    targetEnd
      ? h('div', { className: 'flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400' }, [
        h('span', { className: 'inline-block w-3 h-3 rounded-sm bg-rose-400/70' }),
        h('span', null, `Job deadline · ${formatDateLabel(targetEnd)}`),
      ])
      : null,
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60' }, [
      h('div', { className: 'overflow-x-auto' }, [
        h('div', { className: 'min-w-[720px]' }, [
          h('div', {
            className: 'grid border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400',
            style: { gridTemplateColumns: `280px ${timelineWidth}px` },
          }, [
            h('div', { className: 'px-4 py-3' }, 'Deliverable'),
            h('div', { className: 'relative h-9' }, [
              h('div', { className: 'absolute inset-0' }, ticks.map((tick) => (
                h('div', { key: tick.date, className: 'absolute top-0 bottom-0', style: { left: `${tick.offset}px` } }, [
                  h('div', { className: 'absolute top-0 bottom-0 w-px bg-slate-200 dark:bg-white/10' }),
                  h('div', { className: 'absolute -top-1 translate-x-1 text-[10px]' }, formatTick(tick.date, zoom)),
                ])
              ))),
              finishLineOffset !== null && finishLineOffset >= 0 && finishLineOffset <= timelineWidth
                ? h('div', { className: 'absolute top-0 bottom-0 w-px bg-rose-400/70', style: { left: `${finishLineOffset}px` } })
                : null,
            ]),
          ]),
          schedule.map(({ deliverable, startDate, endDate }) => {
            const offset = diffDays(paddedStart, startDate) * zoomConfig.pxPerDay;
            const endForBar = endDate || startDate;
            const duration = Math.max(1, diffDays(startDate, endForBar) + 1);
            const width = duration * zoomConfig.pxPerDay;
            const moved = !!deliverable.originalDueDate && deliverable.originalDueDate !== deliverable.dueDate;
            const depsCount = Array.isArray(deliverable.dependencyDeliverableIds)
              ? deliverable.dependencyDeliverableIds.length
              : 0;
            return h('div', {
              key: deliverable.id,
              className: 'grid border-t border-slate-200 dark:border-white/10',
              style: { gridTemplateColumns: `280px ${timelineWidth}px` },
            }, [
              h('div', { className: 'px-4 py-3 space-y-1' }, [
                h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, deliverable.name || 'Deliverable'),
                h('div', { className: 'flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400' }, [
                  readOnly
                    ? h('span', null, deliverable.dueDate ? formatDateLabel(deliverable.dueDate) : 'No due date')
                    : h('button', {
                      type: 'button',
                      className: 'underline underline-offset-2 hover:text-slate-900 dark:hover:text-white',
                      onClick: () => openEdit(deliverable),
                    }, deliverable.dueDate ? formatDateLabel(deliverable.dueDate) : 'No due date'),
                  depsCount
                    ? h('span', { className: 'rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300' }, `Depends on ${depsCount}`)
                    : null,
                  moved
                    ? h('button', {
                      type: 'button',
                      className: 'rounded-full border border-amber-200 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-200',
                      onClick: () => setHistoryOpenId(historyOpenId === deliverable.id ? null : deliverable.id),
                    }, 'Moved')
                    : null,
                ]),
                historyOpenId === deliverable.id
                  ? h('div', { className: 'mt-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 text-xs shadow-md' }, [
                    h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500' }, 'Due date history'),
                    h('div', { className: 'mt-2 space-y-2' }, [
                      h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, `Original: ${formatDateLabel(deliverable.originalDueDate)}`),
                      h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, `Current: ${formatDateLabel(deliverable.dueDate)}`),
                      renderHistory(deliverable),
                    ]),
                  ])
                  : null,
              ]),
              h('div', { className: 'relative py-3' }, [
                finishLineOffset !== null && finishLineOffset >= 0 && finishLineOffset <= timelineWidth
                  ? h('div', { className: 'absolute top-0 bottom-0 w-px bg-rose-400/70', style: { left: `${finishLineOffset}px` } })
                  : null,
                h('div', { className: 'absolute top-1/2 h-3 -translate-y-1/2', style: { left: `${offset}px`, width: `${width}px` } }, [
                  endDate
                    ? h('div', { className: 'h-3 rounded-full bg-netnet-purple/80 dark:bg-netnet-purple/70 shadow-sm' })
                    : h('div', { className: 'h-3 w-3 rounded-full border border-dashed border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900' }),
                ]),
              ]),
            ]);
          }),
        ]),
      ]),
    ]),
    editingId
      ? h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
        h('div', { className: 'absolute inset-0 bg-black/40', onClick: closeEdit }),
        h('div', { className: 'relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl' }, [
          h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Change due date'),
          h('input', {
            type: 'date',
            value: draftDueDate,
            onChange: (e) => setDraftDueDate(e.target.value || ''),
            className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
          }),
          h('div', { className: 'flex items-center justify-end gap-2' }, [
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: closeEdit,
            }, 'Cancel'),
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
              onClick: saveDueDate,
            }, 'Save'),
          ]),
        ]),
      ])
      : null,
    showDependencies
      ? h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center px-4' }, [
        h('div', { className: 'absolute inset-0 bg-black/40', onClick: () => setShowDependencies(false) }),
        h('div', { className: 'relative z-10 w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-xl' }, [
          h('div', { className: 'flex items-start justify-between gap-4' }, [
            h('div', { className: 'space-y-1' }, [
              h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Dependencies'),
              h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Define which deliverables must complete before another can start.'),
            ]),
            h('button', {
              type: 'button',
              className: 'h-9 w-9 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
              onClick: () => setShowDependencies(false),
              'aria-label': 'Close',
            }, '×'),
          ]),
          deliverables.length < 2
            ? h('div', { className: 'rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400' }, 'Add at least two deliverables to set dependencies.')
            : h('div', { className: 'space-y-4 max-h-[60vh] overflow-y-auto' }, deliverables.map((deliverable) => (
              h('div', { key: deliverable.id, className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3' }, [
                h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, deliverable.name || 'Deliverable'),
                h('div', { className: 'flex flex-wrap gap-2' }, deliverables.filter((item) => item.id !== deliverable.id).map((item) => (
                  h('label', {
                    key: item.id,
                    className: 'flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-1 text-xs text-slate-600 dark:text-slate-300',
                  }, [
                    h('input', {
                      type: 'checkbox',
                      checked: (dependencyDraft[deliverable.id] || []).includes(item.id),
                      onChange: () => toggleDependency(deliverable.id, item.id),
                      disabled: readOnly,
                      className: 'h-3 w-3 rounded border-slate-300 dark:border-white/20 text-netnet-purple focus:ring-netnet-purple disabled:opacity-60',
                    }),
                    h('span', null, item.name || 'Deliverable'),
                  ])
                ))),
              ])
            ))),
          dependencyError
            ? h('div', { className: 'rounded-lg border border-rose-200 dark:border-rose-400/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-200' }, dependencyError)
            : null,
          h('div', { className: 'flex items-center justify-end gap-2 pt-2' }, [
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: () => setShowDependencies(false),
            }, 'Cancel'),
            h('button', {
              type: 'button',
              className: `inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-semibold ${readOnly ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-netnet-purple text-white hover:brightness-110'}`,
              onClick: saveDependencies,
              disabled: readOnly,
            }, 'Save dependencies'),
          ]),
        ]),
      ])
      : null,
  ]);
}
