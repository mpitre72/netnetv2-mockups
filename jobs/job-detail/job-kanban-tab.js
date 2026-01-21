import { loadServiceTypes, loadTeamMembers } from '../../quick-tasks/quick-tasks-store.js';
import { JobTaskDrawer } from '../job-task-drawer.js';
import { READY_TASK_MESSAGE, isTaskReady } from '../job-tasks-helpers.js';
import { getCurrentCycleKey, getPoolsForCycle, getTaskCycleKey } from '../retainer-cycle-utils.js';

const { createElement: h, useMemo, useRef, useState } = React;

function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function formatStatus(status) {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'completed') return 'Completed';
  return 'Backlog';
}

function statusClasses(status) {
  if (status === 'in_progress') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200';
  }
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200';
}

function findTask(job, taskId) {
  for (const deliverable of job?.deliverables || []) {
    const task = (deliverable.tasks || []).find((item) => String(item.id) === String(taskId));
    if (task) return { task, deliverable };
  }
  return { task: null, deliverable: null };
}

export function JobKanbanTab({ job, onJobUpdate, readOnly: readOnlyOverride }) {
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const members = useMemo(() => loadTeamMembers(), []);
  const memberMap = useMemo(() => new Map(members.map((m) => [String(m.id), m])), [members]);

  const [drawerState, setDrawerState] = useState({ deliverableId: null, taskId: null });
  const [draggingId, setDraggingId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [blockedNotice, setBlockedNotice] = useState(null);
  const [pendingComplete, setPendingComplete] = useState(null);
  const [completionDate, setCompletionDate] = useState(localDateISO());
  const dragMetaRef = useRef(null);

  if (!job) return null;
  const isRetainer = job.kind === 'retainer';
  const readOnly = readOnlyOverride === undefined ? job.status === 'archived' : readOnlyOverride;

  const deliverableNameMap = new Map((job.deliverables || []).map((d) => [String(d.id), d.name || 'Deliverable']));

  const teamIds = Array.isArray(job.teamUserIds) ? job.teamUserIds : [];
  let assigneeOptions = teamIds.length
    ? members.filter((m) => teamIds.includes(m.id))
    : members;
  if (job.jobLeadUserId && !assigneeOptions.some((m) => String(m.id) === String(job.jobLeadUserId))) {
    const lead = memberMap.get(String(job.jobLeadUserId));
    if (lead) assigneeOptions = [lead, ...assigneeOptions];
  }
  const showTeamHint = teamIds.length === 0;

  const allTasks = (job.deliverables || []).flatMap((deliverable) => (
    (deliverable.tasks || []).map((task) => ({
      ...task,
      deliverableName: deliverableNameMap.get(String(deliverable.id)) || 'Deliverable',
      deliverableId: deliverable.id,
    }))
  ));

  const grouped = {
    backlog: allTasks.filter((task) => task.status === 'backlog'),
    in_progress: allTasks.filter((task) => task.status === 'in_progress'),
    completed: allTasks.filter((task) => task.status === 'completed'),
  };

  const applyTaskUpdate = (deliverableId, taskId, updates) => {
    if (typeof onJobUpdate !== 'function') return;
    const nextDeliverables = (job.deliverables || []).map((deliverable) => {
      if (deliverable.id !== deliverableId) return deliverable;
      const tasks = (deliverable.tasks || []).map((task) => {
        if (task.id !== taskId) return task;
        return { ...task, ...updates };
      });
      return { ...deliverable, tasks };
    });
    onJobUpdate({ deliverables: nextDeliverables });
  };

  const openDrawer = (deliverableId, taskId) => setDrawerState({ deliverableId, taskId });
  const closeDrawer = () => setDrawerState({ deliverableId: null, taskId: null });

  const activeDeliverable = job.deliverables.find((d) => d.id === drawerState.deliverableId) || null;
  const activeTask = activeDeliverable?.tasks?.find((t) => t.id === drawerState.taskId) || null;
  const activeTaskCycleKey = isRetainer ? getTaskCycleKey(activeTask, job.currentCycleKey || getCurrentCycleKey()) : null;
  const drawerDeliverable = isRetainer && activeDeliverable
    ? { ...activeDeliverable, pools: getPoolsForCycle(activeDeliverable, activeTaskCycleKey) }
    : activeDeliverable;

  const handleSaveTask = (payload) => {
    if (!activeDeliverable || !activeTask) return;
    applyTaskUpdate(activeDeliverable.id, activeTask.id, payload);
    closeDrawer();
  };

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

  const handleDrop = (taskId, nextStatus) => {
    if (readOnly) return;
    if (!taskId || !nextStatus) return;
    const { task, deliverable } = findTask(job, taskId);
    if (!task || !deliverable) return;
    if (task.status === nextStatus) return;

    if ((nextStatus === 'in_progress' || nextStatus === 'completed') && !isTaskReady(task, deliverable)) {
      setBlockedNotice({ taskId: task.id, deliverableId: deliverable.id });
      window?.showToast?.(READY_TASK_MESSAGE);
      return;
    }

    if (nextStatus === 'completed') {
      setPendingComplete({ taskId: task.id, deliverableId: deliverable.id, fromStatus: task.status });
      setCompletionDate(localDateISO());
      return;
    }

    applyTaskUpdate(deliverable.id, task.id, { status: nextStatus, completedAt: null });
  };

  const confirmCompletion = () => {
    if (readOnly) return;
    if (!pendingComplete) return;
    applyTaskUpdate(pendingComplete.deliverableId, pendingComplete.taskId, {
      status: 'completed',
      completedAt: completionDate || localDateISO(),
    });
    setPendingComplete(null);
  };

  const cancelCompletion = () => setPendingComplete(null);

  const openBlockedTask = () => {
    if (!blockedNotice) return;
    openDrawer(blockedNotice.deliverableId, blockedNotice.taskId);
    setBlockedNotice(null);
  };

  const onDragStart = (task) => (event) => {
    if (readOnly) return;
    dragMetaRef.current = { id: task.id, status: task.status };
    event.dataTransfer?.setData('text/plain', task.id);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(task.id);
  };

  const onDragEnd = () => {
    if (readOnly) return;
    dragMetaRef.current = null;
    setDraggingId(null);
    setDragOver(null);
  };

  const onDragOver = (status) => (event) => {
    if (readOnly) return;
    event.preventDefault();
    if (dragOver !== status) setDragOver(status);
  };

  const onDragLeave = (status) => () => {
    if (readOnly) return;
    if (dragOver === status) setDragOver(null);
  };

  const onDrop = (status) => (event) => {
    if (readOnly) return;
    event.preventDefault();
    setDragOver(null);
    const taskId = event.dataTransfer?.getData('text/plain') || dragMetaRef.current?.id;
    handleDrop(taskId, status);
  };

  const renderColumn = (status, title, tasks) => {
    const highlight = dragOver === status && !readOnly;
    const bodyClass = [
      'mt-4 flex-1 space-y-3 min-h-[140px] rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/40 p-2 transition-colors',
      highlight ? 'ring-2 ring-netnet-purple/40 border-netnet-purple/40 bg-netnet-purple/5' : '',
    ].join(' ');

    const emptyMarkup = h('div', { className: 'rounded-lg border border-dashed border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 px-3 py-4 text-xs text-slate-500 dark:text-white/50' }, [
      h('div', { className: 'text-xs font-semibold text-slate-700 dark:text-white/70' }, `No ${title.toLowerCase()} tasks`),
    ]);

    return h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-4 flex flex-col' }, [
      h('div', { className: 'flex items-center justify-between' }, [
        h('h3', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, title),
        h('span', { className: 'min-w-[28px] rounded-full bg-slate-100 px-2 py-0.5 text-center text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200' }, `${tasks.length}`),
      ]),
      h('div', { className: bodyClass, onDragOver: readOnly ? undefined : onDragOver(status), onDragLeave: readOnly ? undefined : onDragLeave(status), onDrop: readOnly ? undefined : onDrop(status) }, [
        tasks.length ? tasks.map((task) => (
          h('div', {
            key: task.id,
            className: [
              'group rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 shadow-sm transition-shadow hover:shadow-md',
              draggingId === task.id ? 'opacity-60' : '',
            ].join(' '),
          }, [
            h('div', { className: 'flex items-start gap-2' }, [
              h('button', {
                type: 'button',
                className: 'mt-0.5 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5',
                draggable: !readOnly,
                onDragStart: readOnly ? undefined : onDragStart(task),
                onDragEnd: readOnly ? undefined : onDragEnd,
                disabled: readOnly,
                'aria-disabled': readOnly,
                'aria-label': 'Drag task',
              }, [
                h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
                  h('circle', { cx: '8', cy: '8', r: '1' }),
                  h('circle', { cx: '16', cy: '8', r: '1' }),
                  h('circle', { cx: '8', cy: '16', r: '1' }),
                  h('circle', { cx: '16', cy: '16', r: '1' }),
                ]),
              ]),
              h('button', {
                type: 'button',
                className: 'min-w-0 flex-1 text-left',
                onClick: () => openDrawer(task.deliverableId, task.id),
              }, [
                h('div', { className: 'min-w-0 space-y-2' }, [
                  h('div', { className: 'flex items-center gap-2 flex-wrap' }, [
                    h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white truncate' }, task.title || 'Untitled'),
                    task.isDraft
                      ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-900' }, 'Draft')
                      : null,
                    h('span', { className: `rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses(task.status)}` }, formatStatus(task.status)),
                  ].filter(Boolean)),
                  h('div', { className: 'text-[11px] text-slate-500 dark:text-slate-400 truncate' }, task.deliverableName || 'Deliverable'),
                  task.dueDate
                    ? h('div', { className: 'text-[11px] text-slate-500 dark:text-slate-400' }, `Due ${task.dueDate}`)
                    : null,
                  h('div', { className: 'pt-1' }, renderAllocationsSummary(task)),
                ]),
              ]),
            ]),
          ])
        )) : emptyMarkup,
      ]),
    ]);
  };

  return h('div', { className: 'space-y-5 pb-12' }, [
    blockedNotice
      ? h('div', { className: 'rounded-lg border border-amber-200 dark:border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200 flex items-center justify-between' }, [
        h('div', null, READY_TASK_MESSAGE),
        h('div', { className: 'flex items-center gap-2' }, [
          h('button', {
            type: 'button',
            className: 'text-xs font-semibold text-amber-700 dark:text-amber-200 hover:underline',
            onClick: openBlockedTask,
          }, 'Open task'),
          h('button', {
            type: 'button',
            className: 'text-xs text-amber-700 dark:text-amber-200',
            onClick: () => setBlockedNotice(null),
            'aria-label': 'Dismiss',
          }, '×'),
        ]),
      ])
      : null,
    h('div', { className: 'grid grid-cols-1 gap-4 md:grid-cols-3' }, [
      renderColumn('backlog', 'Backlog', grouped.backlog),
      renderColumn('in_progress', 'In Progress', grouped.in_progress),
      renderColumn('completed', 'Completed', grouped.completed),
    ]),
    h(JobTaskDrawer, {
      isOpen: !!drawerState.taskId,
      task: activeTask,
      deliverable: drawerDeliverable,
      assignees: assigneeOptions,
      serviceTypes,
      showTeamHint,
      showRecurring: isRetainer,
      cycleKey: activeTaskCycleKey,
      readOnly,
      onClose: closeDrawer,
      onSave: handleSaveTask,
    }),
    pendingComplete
      ? h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center' }, [
        h('div', { className: 'absolute inset-0 bg-black/30' }),
        h('div', { className: 'relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl' }, [
          h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Mark task as completed'),
          h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Choose the completion date for this task.'),
          h('input', {
            type: 'date',
            value: completionDate,
            onChange: (e) => setCompletionDate(e.target.value || localDateISO()),
            className: 'w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200',
          }),
          h('div', { className: 'flex items-center justify-end gap-2' }, [
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: cancelCompletion,
            }, 'Cancel'),
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-9 px-4 rounded-md bg-netnet-purple text-white text-sm font-semibold hover:brightness-110',
              onClick: confirmCompletion,
            }, 'Confirm'),
          ]),
        ]),
      ])
      : null,
  ]);
}
