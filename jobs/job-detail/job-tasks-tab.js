import { loadServiceTypes, loadTeamMembers } from '../../quick-tasks/quick-tasks-store.js';
import { JobTaskDrawer } from '../job-task-drawer.js';
import { ViewToggleGroup } from '../jobs-view-toggle.js';
import { getJobCycleKey, getJobTasksViewMode, setJobCycleKey, setJobTasksViewMode } from '../jobs-ui-state.js';
import {
  ensureRecurringInstances,
  formatCycleLabel,
  formatCycleLabelShort,
  getCurrentCycleKey,
  getPoolsForCycle,
  getTaskCycleKey,
  shiftCycleKey,
} from '../retainer-cycle-utils.js';

const { createElement: h, useEffect, useMemo, useState } = React;

function formatStatus(task) {
  if (task.isDraft) return 'Draft';
  if (task.status === 'in_progress') return 'In Progress';
  if (task.status === 'completed') return 'Completed';
  return 'Backlog';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function isCycleEarlier(taskCycleKey, currentCycleKey) {
  if (!taskCycleKey || !currentCycleKey) return false;
  return String(taskCycleKey) < String(currentCycleKey);
}

function sortTasks(tasks = []) {
  const order = (task) => {
    if (task.status === 'in_progress') return 0;
    if (!task.isDraft && task.status === 'backlog') return 1;
    if (task.isDraft) return 2;
    if (task.status === 'completed') return 3;
    return 4;
  };
  return [...(tasks || [])].sort((a, b) => order(a) - order(b));
}

export function JobTasksTab({ job, onJobUpdate, readOnly: readOnlyOverride }) {
  const [viewMode, setViewMode] = useState(() => getJobTasksViewMode(job?.id));
  const [drawerState, setDrawerState] = useState({ deliverableId: null, taskId: null });
  const isRetainer = job?.kind === 'retainer';
  const readOnly = readOnlyOverride === undefined ? job?.status === 'archived' : readOnlyOverride;
  const [cycleKey, setCycleKey] = useState(() => {
    if (!job || job.kind !== 'retainer') return null;
    return getJobCycleKey(job.id) || job.currentCycleKey || getCurrentCycleKey();
  });

  const members = useMemo(() => loadTeamMembers(), []);
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const memberMap = useMemo(() => new Map(members.map((member) => [String(member.id), member])), [members]);

  useEffect(() => {
    setViewMode(getJobTasksViewMode(job?.id));
  }, [job?.id]);

  useEffect(() => {
    if (!job) return;
    if (job.kind !== 'retainer') {
      setCycleKey(null);
      return;
    }
    const stored = getJobCycleKey(job.id);
    const nextCycleKey = stored || job.currentCycleKey || getCurrentCycleKey();
    setCycleKey(nextCycleKey);
  }, [job?.id, job?.kind, job?.currentCycleKey]);

  useEffect(() => {
    if (!job || !isRetainer || !cycleKey || typeof onJobUpdate !== 'function' || readOnly) return;
    const { deliverables, changed } = ensureRecurringInstances(job, cycleKey);
    if (changed) onJobUpdate({ deliverables });
  }, [job?.id, job?.updatedAt, isRetainer, cycleKey, readOnly]);

  if (!job) return null;

  const activeCycleKey = isRetainer ? (cycleKey || getCurrentCycleKey()) : null;
  const cycleLabel = activeCycleKey ? formatCycleLabel(activeCycleKey) : '';
  const cycleLabelText = cycleLabel || activeCycleKey || '';
  const setCycle = (nextKey) => {
    if (!job || !isRetainer || !nextKey) return;
    setCycleKey(nextKey);
    setJobCycleKey(job.id, nextKey);
  };
  const shiftCycle = (delta) => {
    if (!activeCycleKey) return;
    setCycle(shiftCycleKey(activeCycleKey, delta));
  };

  const teamIds = Array.isArray(job.teamUserIds) ? job.teamUserIds : [];
  const teamSet = new Set(teamIds.map((id) => String(id)));
  let assigneeOptions = teamIds.length
    ? members.filter((member) => teamSet.has(String(member.id)))
    : members;
  if (job.jobLeadUserId && !assigneeOptions.some((m) => String(m.id) === String(job.jobLeadUserId))) {
    const lead = memberMap.get(String(job.jobLeadUserId));
    if (lead) assigneeOptions = [lead, ...assigneeOptions];
  }
  const showTeamHint = teamIds.length === 0;

  const getTaskMeta = (task) => {
    if (!isRetainer || !activeCycleKey) {
      return { show: true, carryover: false, plannedLabel: null };
    }
    const taskCycleKey = getTaskCycleKey(task, activeCycleKey);
    const isCurrent = taskCycleKey === activeCycleKey;
    if (isCurrent) {
      return { show: true, carryover: false, plannedLabel: null };
    }
    const isCarryover = !task.isRecurring && task.status !== 'completed' && isCycleEarlier(task.cycleKey, activeCycleKey);
    if (isCarryover) {
      return { show: true, carryover: true, plannedLabel: formatCycleLabelShort(task.cycleKey) };
    }
    return { show: false, carryover: false, plannedLabel: null };
  };

  const updateTasks = (deliverableId, updater) => {
    if (typeof onJobUpdate !== 'function' || readOnly) return;
    const nextDeliverables = (job.deliverables || []).map((deliverable) => {
      if (deliverable.id !== deliverableId) return deliverable;
      return { ...deliverable, tasks: updater(deliverable.tasks || []) };
    });
    onJobUpdate({ deliverables: nextDeliverables });
  };

  const openDrawer = (deliverableId, taskId) => setDrawerState({ deliverableId, taskId });
  const closeDrawer = () => setDrawerState({ deliverableId: null, taskId: null });

  const activeDeliverable = job.deliverables.find((d) => d.id === drawerState.deliverableId) || null;
  const activeTask = activeDeliverable?.tasks?.find((t) => t.id === drawerState.taskId) || null;
  const activeTaskCycleKey = isRetainer ? getTaskCycleKey(activeTask, activeCycleKey) : null;
  const drawerDeliverable = isRetainer && activeDeliverable
    ? { ...activeDeliverable, pools: getPoolsForCycle(activeDeliverable, activeTaskCycleKey || activeCycleKey) }
    : activeDeliverable;

  const handleSaveTask = (payload) => {
    if (!activeDeliverable || !activeTask) return;
    updateTasks(activeDeliverable.id, (tasks) => (
      (tasks || []).map((task) => (task.id === activeTask.id ? { ...task, ...payload } : task))
    ));
    closeDrawer();
  };

  const toggleView = (mode) => {
    setViewMode(mode);
    setJobTasksViewMode(job.id, mode);
  };

  const viewToggle = h(ViewToggleGroup, {
    value: viewMode,
    options: [
      {
        value: 'grouped',
        label: 'Grouped',
        title: 'Grouped by deliverable',
        icon: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
          h('rect', { x: '3', y: '4', width: '18', height: '6', rx: '2' }),
          h('rect', { x: '3', y: '14', width: '18', height: '6', rx: '2' }),
        ]),
      },
      {
        value: 'flat',
        label: 'All tasks',
        title: 'View all tasks',
        icon: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
          h('path', { d: 'M4 6h16' }),
          h('path', { d: 'M4 12h16' }),
          h('path', { d: 'M4 18h16' }),
        ]),
      },
    ],
    onChange: toggleView,
  });

  const cycleSelector = isRetainer ? h('div', {
    className: 'inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1',
  }, [
    h('button', {
      type: 'button',
      className: 'h-8 w-8 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
      onClick: () => shiftCycle(-1),
      'aria-label': 'Previous month',
    }, '<'),
    h('span', { className: 'text-sm font-semibold text-slate-700 dark:text-slate-200 px-2' }, cycleLabelText || 'Month'),
    h('button', {
      type: 'button',
      className: 'h-8 w-8 rounded-full border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
      onClick: () => shiftCycle(1),
      'aria-label': 'Next month',
    }, '>'),
  ]) : null;

  const renderAllocationsSummary = (task) => {
    const allocations = Array.isArray(task.allocations) ? task.allocations : [];
    if (!allocations.length) return h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, 'No allocations');
    const assigneeIds = [...new Set(allocations.map((alloc) => String(alloc.assigneeUserId || '')).filter(Boolean))];
    const initials = assigneeIds
      .map((id) => memberMap.get(id))
      .filter(Boolean)
      .map((member) => getInitials(member.name || member.email));
    return h('div', { className: 'flex items-center gap-2' }, [
      h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${allocations.length} allocations`),
      h('div', { className: 'flex -space-x-1' }, initials.slice(0, 3).map((label, idx) => (
        h('span', {
          key: `${label}-${idx}`,
          className: 'h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center border border-white dark:border-slate-900',
        }, label)
      ))),
    ]);
  };

  const groupedView = h('div', { className: 'space-y-4' }, (job.deliverables || []).map((deliverable) => {
    const taskMeta = new Map();
    const visibleTasks = (deliverable.tasks || []).filter((task) => {
      const meta = getTaskMeta(task);
      if (meta.show) taskMeta.set(task.id, meta);
      return meta.show;
    });
    const sorted = sortTasks(visibleTasks || []);
    return h('div', { key: deliverable.id, className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 space-y-3' }, [
      h('div', { className: 'flex items-center justify-between' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, deliverable.name || 'Deliverable'),
          h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${visibleTasks.length} tasks`),
        ]),
        h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, formatDate(deliverable.dueDate)),
      ]),
      sorted.length
        ? h('div', { className: 'space-y-2' }, sorted.map((task) => {
          const meta = taskMeta.get(task.id) || {};
          const plannedLabel = meta.plannedLabel;
          return h('button', {
            key: task.id,
            type: 'button',
            className: 'w-full text-left rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5',
            onClick: () => openDrawer(deliverable.id, task.id),
          }, [
            h('div', { className: 'flex items-start justify-between gap-3' }, [
              h('div', { className: 'space-y-1' }, [
                h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, task.title || 'Untitled task'),
                h('div', { className: 'flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400' }, [
                  task.isDraft
                    ? h('span', { className: 'rounded-full border border-amber-200 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-200' }, 'Draft')
                    : null,
                  task.isRecurring
                    ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300' }, 'R')
                    : null,
                  plannedLabel
                    ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300' }, `Pending: ${plannedLabel}`)
                    : null,
                  h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300' }, formatStatus(task)),
                  task.dueDate ? h('span', null, formatDate(task.dueDate)) : null,
                ]),
              ]),
              renderAllocationsSummary(task),
            ]),
          ]);
        }))
        : h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'No tasks yet.'),
    ]);
  }));

  const flatTasks = (job.deliverables || []).flatMap((deliverable) => (
    (deliverable.tasks || []).map((task) => {
      const meta = getTaskMeta(task);
      if (!meta.show) return null;
      return { task, deliverable, meta };
    }).filter(Boolean)
  ));

  const flatView = flatTasks.length
    ? h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 overflow-x-auto' }, [
      h('div', { className: 'min-w-[720px]' }, [
        h('div', { className: 'grid gap-3 px-5 py-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10', style: { gridTemplateColumns: '2fr 1.2fr 1fr 1fr' } }, [
          h('div', null, 'Task'),
          h('div', null, 'Deliverable'),
          h('div', null, 'Status'),
          h('div', null, 'Due date'),
        ]),
        ...flatTasks.map(({ task, deliverable, meta }) => h('button', {
          key: task.id,
          type: 'button',
          className: 'grid gap-3 px-5 py-3 border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-left',
          style: { gridTemplateColumns: '2fr 1.2fr 1fr 1fr' },
          onClick: () => openDrawer(deliverable.id, task.id),
        }, [
          h('div', { className: 'space-y-1' }, [
            h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, task.title || 'Untitled task'),
            h('div', { className: 'flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400' }, [
              task.isDraft
                ? h('span', { className: 'rounded-full border border-amber-200 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-200' }, 'Draft')
                : null,
              task.isRecurring
                ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300' }, 'R')
                : null,
              meta?.plannedLabel
                ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300' }, `Pending: ${meta.plannedLabel}`)
                : null,
            ].filter(Boolean)),
          ]),
          h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, deliverable.name || 'Deliverable'),
          h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, formatStatus(task)),
          h('div', { className: 'text-xs text-slate-600 dark:text-slate-300' }, formatDate(task.dueDate)),
        ])),
      ]),
    ])
    : h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-6 text-center' }, [
      h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'No tasks yet'),
      h('p', { className: 'mt-2 text-sm text-slate-500 dark:text-slate-400' }, 'Add tasks to deliverables to see them here.'),
    ]);

  return h('div', { className: 'space-y-4 pb-12' }, [
    h('div', { className: 'flex flex-wrap items-center justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Tasks'),
        h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Switch between grouped and flat task views.'),
      ]),
      h('div', { className: 'flex flex-wrap items-center gap-3' }, [
        viewToggle,
        cycleSelector,
      ].filter(Boolean)),
    ]),
    viewMode === 'flat' ? flatView : groupedView,
    h(JobTaskDrawer, {
      isOpen: !!activeTask,
      task: activeTask,
      deliverable: drawerDeliverable,
      assignees: assigneeOptions,
      serviceTypes,
      showTeamHint,
      showRecurring: isRetainer,
      cycleKey: activeTaskCycleKey || activeCycleKey,
      readOnly,
      onClose: closeDrawer,
      onSave: handleSaveTask,
    }),
  ]);
}
