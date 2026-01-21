import { loadServiceTypes, loadTeamMembers } from '../quick-tasks/quick-tasks-store.js';
import { JobPlanEditor, buildDeliverablesFromPlan, createPlanStateFromJob } from './jobs-plan-grid.js';
import { JobTaskDrawer } from './job-task-drawer.js';
import { getJobCycleKey, setJobCycleKey } from './jobs-ui-state.js';
import {
  ensureRecurringInstances,
  formatCycleLabel,
  formatCycleLabelShort,
  getCurrentCycleKey,
  getPoolsForCycle,
  getTaskCycleKey,
  shiftCycleKey,
} from './retainer-cycle-utils.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function buildDefaultServiceTypeIds(serviceTypes) {
  return (serviceTypes || []).slice(0, 3).map((type) => type.id);
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

function sortTasks(list = []) {
  const rank = (task) => {
    if (task.status === 'in_progress') return 0;
    if (task.status === 'backlog' && !task.isDraft) return 1;
    if (task.isDraft) return 2;
    if (task.status === 'completed') return 3;
    return 4;
  };
  return [...list].sort((a, b) => rank(a) - rank(b));
}

export function JobPlanTab({
  job,
  onJobUpdate,
  readOnly: readOnlyOverride,
  chatMessages = [],
  onOpenChat,
}) {
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const members = useMemo(() => loadTeamMembers(), []);
  const memberMap = useMemo(() => new Map(members.map((m) => [String(m.id), m])), [members]);
  const defaultServiceTypeIds = useMemo(() => buildDefaultServiceTypeIds(serviceTypes), [serviceTypes]);
  const isRetainer = job?.kind === 'retainer';
  const readOnly = readOnlyOverride === undefined ? job?.status === 'archived' : readOnlyOverride;

  const [cycleKey, setCycleKey] = useState(() => {
    if (!job || job.kind !== 'retainer') return null;
    return getJobCycleKey(job.id) || job.currentCycleKey || getCurrentCycleKey();
  });
  const [plan, setPlan] = useState(() => createPlanStateFromJob(job, defaultServiceTypeIds, { cycleKey }));
  const planRef = useRef(plan);
  const [expandedIds, setExpandedIds] = useState([]);
  const [draftInputs, setDraftInputs] = useState({});
  const [drawerState, setDrawerState] = useState({ deliverableId: null, taskId: null });
  const chatCounts = useMemo(() => {
    const deliverableCounts = new Map();
    const taskCounts = new Map();
    (chatMessages || []).forEach((message) => {
      if (String(message.jobId) !== String(job?.id)) return;
      if (message.tagTarget?.type === 'task' && message.taskId) {
        const taskId = String(message.taskId);
        taskCounts.set(taskId, (taskCounts.get(taskId) || 0) + 1);
        if (message.deliverableId) {
          const deliverableId = String(message.deliverableId);
          deliverableCounts.set(deliverableId, (deliverableCounts.get(deliverableId) || 0) + 1);
        }
      } else if (message.tagTarget?.type === 'deliverable' && message.deliverableId) {
        const deliverableId = String(message.deliverableId);
        deliverableCounts.set(deliverableId, (deliverableCounts.get(deliverableId) || 0) + 1);
      }
    });
    return { deliverable: deliverableCounts, task: taskCounts };
  }, [chatMessages, job?.id]);

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
    if (!job) return;
    setPlan(createPlanStateFromJob(job, defaultServiceTypeIds, { cycleKey }));
    setExpandedIds((prev) => (prev.length ? prev : job.deliverables.map((d) => d.id)));
  }, [job?.id, job?.updatedAt, defaultServiceTypeIds.join('|'), cycleKey]);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    if (!job || !isRetainer || !cycleKey || typeof onJobUpdate !== 'function' || readOnly) return;
    const { deliverables, changed } = ensureRecurringInstances(job, cycleKey);
    if (changed) onJobUpdate({ deliverables });
  }, [job?.id, job?.updatedAt, isRetainer, cycleKey, readOnly]);

  useEffect(() => {
    if (!job || typeof onJobUpdate !== 'function' || readOnly) return undefined;
    const handle = setTimeout(() => {
      const deliverables = buildDeliverablesFromPlan(
        planRef.current,
        job.deliverables || [],
        { cycleKey, jobKind: job.kind }
      );
      onJobUpdate({
        serviceTypeIds: planRef.current.serviceTypeIds,
        deliverables,
      });
    }, 500);
    return () => clearTimeout(handle);
  }, [plan]);

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

  const planNameMap = new Map((plan?.rows || []).map((row) => [String(row.id), row.name]));

  const teamIds = Array.isArray(job.teamUserIds) ? job.teamUserIds : [];
  let assigneeOptions = teamIds.length
    ? members.filter((m) => teamIds.includes(m.id))
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

  const toggleExpanded = (deliverableId) => {
    setExpandedIds((prev) => (
      prev.includes(deliverableId)
        ? prev.filter((id) => id !== deliverableId)
        : [...prev, deliverableId]
    ));
  };

  const updateTasks = (deliverableId, updater) => {
    if (typeof onJobUpdate !== 'function' || readOnly) return;
    const baseDeliverables = buildDeliverablesFromPlan(
      planRef.current,
      job.deliverables || [],
      { cycleKey, jobKind: job.kind }
    );
    const nextDeliverables = baseDeliverables.map((deliverable) => {
      if (deliverable.id !== deliverableId) return deliverable;
      return { ...deliverable, tasks: updater(deliverable.tasks || []) };
    });
    onJobUpdate({ deliverables: nextDeliverables });
  };

  const createDraftTask = (deliverableId, title) => {
    if (readOnly) return;
    const trimmed = String(title || '').trim();
    if (!trimmed) return;
    const task = {
      id: createId('task'),
      jobId: job.id,
      deliverableId,
      title: trimmed,
      description: '',
      status: 'backlog',
      isDraft: true,
      isRecurring: false,
      recurringTemplateId: null,
      dueDate: null,
      completedAt: null,
      cycleKey: isRetainer ? cycleKey : null,
      allocations: [],
    };
    updateTasks(deliverableId, (tasks) => [task, ...(tasks || [])]);
    setDraftInputs((prev) => ({ ...prev, [deliverableId]: '' }));
  };

  const openDrawer = (deliverableId, taskId) => {
    setDrawerState({ deliverableId, taskId });
  };

  const closeDrawer = () => setDrawerState({ deliverableId: null, taskId: null });
  const openChat = (target) => {
    if (typeof onOpenChat === 'function') onOpenChat(target);
  };

  const activeDeliverable = job.deliverables.find((d) => d.id === drawerState.deliverableId) || null;
  const activeTask = activeDeliverable?.tasks?.find((t) => t.id === drawerState.taskId) || null;
  const activeTaskCycleKey = isRetainer ? getTaskCycleKey(activeTask, activeCycleKey) : null;
  const drawerDeliverable = isRetainer && activeDeliverable
    ? { ...activeDeliverable, pools: getPoolsForCycle(activeDeliverable, activeTaskCycleKey || activeCycleKey) }
    : activeDeliverable;

  const saveTask = (payload) => {
    if (!activeDeliverable || !activeTask) return;
    updateTasks(activeDeliverable.id, (tasks) => (
      (tasks || []).map((task) => (task.id === activeTask.id ? { ...task, ...payload } : task))
    ));
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

  const cycleSelector = isRetainer ? h('div', {
    className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-4 flex flex-wrap items-center justify-between gap-3',
  }, [
    h('div', { className: 'space-y-1' }, [
      h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Cycle'),
      h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Pools and tasks follow the selected month.'),
    ]),
    h('div', { className: 'inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1' }, [
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
    ]),
  ]) : null;

  return h('div', { className: 'space-y-6 pb-12' }, [
    cycleSelector,
    h(JobPlanEditor, {
      plan,
      onPlanChange: setPlan,
      serviceTypes,
      readOnly,
    }),
    h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/60 p-5 space-y-4' }, [
      h('div', { className: 'space-y-1' }, [
        h('h3', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Deliverables · Tasks'),
        h('p', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Draft tasks live with deliverables until they are ready to start.'),
      ]),
      (job.deliverables || []).length
        ? h('div', { className: 'space-y-4' }, (job.deliverables || []).map((deliverable) => {
          const deliverableName = planNameMap.get(String(deliverable.id)) || deliverable.name || 'Deliverable';
          const isExpanded = expandedIds.includes(deliverable.id);
          const taskMeta = new Map();
          const visibleTasks = (deliverable.tasks || []).filter((task) => {
            const meta = getTaskMeta(task);
            if (meta.show) taskMeta.set(task.id, meta);
            return meta.show;
          });
          const sorted = sortTasks(visibleTasks || []);
          const activeTasks = sorted.filter((task) => task.status !== 'completed');
          const completedTasks = sorted.filter((task) => task.status === 'completed');
          const deliverableChatCount = chatCounts.deliverable.get(String(deliverable.id)) || 0;
          return h('div', { key: deliverable.id, className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3 space-y-3' }, [
            h('div', { className: 'flex items-center justify-between' }, [
              h('div', { className: 'space-y-1' }, [
                h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, deliverableName),
                h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, `${visibleTasks.length} tasks`),
              ]),
              h('div', { className: 'flex items-center gap-3' }, [
                h('button', {
                  type: 'button',
                  className: 'inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                  onClick: () => openChat({ type: 'deliverable', deliverableId: deliverable.id }),
                  'aria-label': 'Open deliverable chat',
                }, [
                  h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
                    h('path', { d: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }),
                  ]),
                  deliverableChatCount
                    ? h('span', { className: 'rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-200' }, String(deliverableChatCount))
                    : null,
                ].filter(Boolean)),
                h('button', {
                  type: 'button',
                  className: 'text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                  onClick: () => toggleExpanded(deliverable.id),
                }, isExpanded ? 'Hide tasks' : 'Show tasks'),
              ]),
            ]),
            isExpanded ? h('div', { className: 'space-y-3' }, [
              h('div', { className: 'flex items-center gap-2' }, [
                h('input', {
                  type: 'text',
                  value: draftInputs[deliverable.id] || '',
                  onChange: (e) => setDraftInputs((prev) => ({ ...prev, [deliverable.id]: e.target.value })),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      createDraftTask(deliverable.id, draftInputs[deliverable.id]);
                    }
                  },
                  placeholder: 'Add a draft task…',
                  disabled: readOnly,
                  className: 'flex-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white disabled:opacity-60',
                }),
                h('button', {
                  type: 'button',
                  className: 'inline-flex items-center justify-center h-9 px-3 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50',
                  onClick: () => createDraftTask(deliverable.id, draftInputs[deliverable.id]),
                  disabled: readOnly,
                }, 'Add'),
              ]),
              activeTasks.length
                ? h('div', { className: 'space-y-2' }, activeTasks.map((task) => {
                  const meta = taskMeta.get(task.id) || {};
                  const plannedLabel = meta.plannedLabel;
                  const taskChatCount = chatCounts.task.get(String(task.id)) || 0;
                  return h('button', {
                    key: task.id,
                    type: 'button',
                    className: 'w-full text-left rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition',
                    onClick: () => openDrawer(deliverable.id, task.id),
                  }, [
                    h('div', { className: 'flex items-start justify-between gap-3' }, [
                      h('div', { className: 'space-y-1' }, [
                        h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, task.title || 'Untitled task'),
                        h('div', { className: 'flex items-center gap-2 flex-wrap text-xs' }, [
                          task.isDraft ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-900' }, 'Draft') : null,
                          task.isRecurring ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900' }, 'R') : null,
                          plannedLabel ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-900' }, `Pending: ${plannedLabel}`) : null,
                          h('span', { className: `rounded-full px-2 py-0.5 ${statusClasses(task.status)}` }, formatStatus(task.status)),
                          task.dueDate ? h('span', { className: 'text-slate-500 dark:text-slate-400' }, `Due ${task.dueDate}`) : null,
                        ].filter(Boolean)),
                      ]),
                      h('div', { className: 'mt-2 flex items-center gap-3' }, [
                        renderAllocationsSummary(task),
                        h('button', {
                          type: 'button',
                          className: 'inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                          onClick: (event) => {
                            event.stopPropagation();
                            openChat({ type: 'task', deliverableId: deliverable.id, taskId: task.id });
                          },
                          'aria-label': 'Open task chat',
                        }, [
                          h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
                            h('path', { d: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }),
                          ]),
                          taskChatCount
                            ? h('span', { className: 'rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-200' }, String(taskChatCount))
                            : null,
                        ].filter(Boolean)),
                      ]),
                    ]),
                  ]);
                }))
                : h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'No active tasks yet.'),
              completedTasks.length
                ? h('details', { className: 'rounded-lg border border-dashed border-slate-200 dark:border-white/10 p-3' }, [
                  h('summary', { className: 'text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer' }, `Completed (${completedTasks.length})`),
                  h('div', { className: 'mt-3 space-y-2' }, completedTasks.map((task) => {
                    const taskChatCount = chatCounts.task.get(String(task.id)) || 0;
                    return h('button', {
                      key: task.id,
                      type: 'button',
                      className: 'w-full text-left rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition',
                      onClick: () => openDrawer(deliverable.id, task.id),
                    }, [
                      h('div', { className: 'flex items-start justify-between gap-3' }, [
                        h('div', { className: 'space-y-1' }, [
                          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, task.title || 'Untitled task'),
                          h('div', { className: 'flex items-center gap-2 text-xs' }, [
                            task.isRecurring ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900' }, 'R') : null,
                            h('span', { className: `rounded-full px-2 py-0.5 ${statusClasses(task.status)}` }, formatStatus(task.status)),
                            task.completedAt ? h('span', { className: 'text-slate-500 dark:text-slate-400' }, `Completed ${task.completedAt}`) : null,
                          ].filter(Boolean)),
                        ]),
                        h('div', { className: 'flex items-center gap-3' }, [
                          renderAllocationsSummary(task),
                          h('button', {
                            type: 'button',
                            className: 'inline-flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                            onClick: (event) => {
                              event.stopPropagation();
                              openChat({ type: 'task', deliverableId: deliverable.id, taskId: task.id });
                            },
                            'aria-label': 'Open task chat',
                          }, [
                            h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
                              h('path', { d: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }),
                            ]),
                            taskChatCount
                              ? h('span', { className: 'rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-200' }, String(taskChatCount))
                              : null,
                          ].filter(Boolean)),
                        ]),
                      ]),
                    ]);
                  })),
                ])
                : null,
            ]) : null,
          ]);
        }))
        : h('div', { className: 'text-sm text-slate-500 dark:text-slate-400' }, 'Add a deliverable to start planning tasks.'),
    ]),
    h(JobTaskDrawer, {
      isOpen: !!drawerState.taskId,
      task: activeTask,
      deliverable: drawerDeliverable,
      assignees: assigneeOptions,
      serviceTypes,
      showTeamHint,
      showRecurring: isRetainer,
      cycleKey: activeTaskCycleKey || activeCycleKey,
      readOnly,
      onClose: closeDrawer,
      onSave: saveTask,
    }),
  ]);
}
