import { loadServiceTypes, loadTeamMembers } from '../../quick-tasks/quick-tasks-store.js';
import { JobTaskDrawer } from '../job-task-drawer.js';
import { ViewToggleGroup } from '../jobs-view-toggle.js';
import {
  getDeliverableCollapsedMap,
  getJobCycleKey,
  getJobTasksViewMode,
  setDeliverableCollapsed,
  setJobCycleKey,
  setJobTasksViewMode,
} from '../jobs-ui-state.js';
import { JobKanbanTab } from './job-kanban-tab.js';
import { JobTasksExecutionTable } from './job-tasks-table.js';
import { RetainerMonthSwitcher } from './retainer-month-switcher.js';
import {
  ensureRecurringInstances,
  getCurrentCycleKey,
  getPoolsForCycle,
  isRecurringTemplateTask,
  isDeliverableVisibleInCycle,
  getTaskCycleKey,
} from '../retainer-cycle-utils.js';
import { mergeTaskLifecycleFields } from '../task-execution-utils.js';

const { createElement: h, useEffect, useMemo, useState } = React;

function getTaskMeta(task, activeCycleKey, isRetainer) {
  if (isRecurringTemplateTask(task)) {
    return { show: false, carryover: false, plannedLabel: null };
  }
  if (!isRetainer || !activeCycleKey) {
    return { show: true, carryover: false, plannedLabel: null };
  }
  const taskCycleKey = getTaskCycleKey(task, activeCycleKey);
  return {
    show: String(taskCycleKey || '') === String(activeCycleKey),
    carryover: false,
    plannedLabel: null,
  };
}

export function JobTasksTab({
  job,
  onJobUpdate,
  readOnly: readOnlyOverride,
  chatIndicators,
  onOpenChat,
}) {
  const [viewMode, setViewMode] = useState(() => getJobTasksViewMode(job?.id));
  const [drawerState, setDrawerState] = useState({ deliverableId: null, taskId: null });
  const [collapsedMap, setCollapsedMap] = useState(() => getDeliverableCollapsedMap(job?.id));
  const isRetainer = job?.kind === 'retainer';
  const readOnly = readOnlyOverride === undefined ? job?.status === 'archived' : readOnlyOverride;
  const [cycleKey, setCycleKey] = useState(() => {
    if (!job || job.kind !== 'retainer') return null;
    return getJobCycleKey(job.id) || job.currentCycleKey || getCurrentCycleKey();
  });

  const members = useMemo(() => loadTeamMembers(), []);
  const serviceTypes = useMemo(() => loadServiceTypes().filter((type) => type.active), []);
  const memberMap = useMemo(() => new Map(members.map((member) => [String(member.id), member])), [members]);

  const chatIndicatorMaps = chatIndicators || { deliverable: new Map(), task: new Map() };

  useEffect(() => {
    setViewMode(getJobTasksViewMode(job?.id));
  }, [job?.id]);

  useEffect(() => {
    setCollapsedMap(getDeliverableCollapsedMap(job?.id));
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
  const setCycle = (nextKey) => {
    if (!job || !isRetainer || !nextKey) return;
    setCycleKey(nextKey);
    setJobCycleKey(job.id, nextKey);
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

  const taskMetaMap = new Map();
  const deliverablesForTable = (job.deliverables || [])
    .filter((deliverable) => !isRetainer || isDeliverableVisibleInCycle(deliverable, activeCycleKey))
    .map((deliverable) => {
    const effectivePools = isRetainer && activeCycleKey
      ? getPoolsForCycle(deliverable, activeCycleKey)
      : (deliverable.pools || []);
    const tasks = (deliverable.tasks || []).filter((task) => {
      const meta = getTaskMeta(task, activeCycleKey, isRetainer);
      if (meta.show) taskMetaMap.set(task.id, meta);
      return meta.show;
    });
      return { ...deliverable, tasks, effectivePools };
    });
  const unassignedTasks = (job.unassignedTasks || []).filter((task) => {
    const meta = getTaskMeta(task, activeCycleKey, isRetainer);
    if (meta.show) taskMetaMap.set(task.id, meta);
    return meta.show;
  });

  const openDrawer = (deliverableId, taskId) => setDrawerState({ deliverableId, taskId });
  const closeDrawer = () => setDrawerState({ deliverableId: null, taskId: null });
  const handleToggleCollapse = (deliverableId, collapsed) => {
    if (!job || !deliverableId) return;
    setDeliverableCollapsed(job.id, deliverableId, collapsed);
    setCollapsedMap((prev) => ({ ...(prev || {}), [deliverableId]: collapsed }));
  };

  const activeDeliverable = job.deliverables.find((d) => d.id === drawerState.deliverableId) || null;
  const activeTask = activeDeliverable?.tasks?.find((t) => t.id === drawerState.taskId) || null;
  const activeTaskCycleKey = isRetainer ? getTaskCycleKey(activeTask, activeCycleKey) : null;
  const drawerDeliverable = isRetainer && activeDeliverable
    ? { ...activeDeliverable, pools: getPoolsForCycle(activeDeliverable, activeTaskCycleKey || activeCycleKey) }
    : activeDeliverable;

  const handleSaveTask = (payload) => {
    if (!activeDeliverable || !activeTask) return;
    if (typeof onJobUpdate !== 'function' || readOnly) return;
    const nextPayload = mergeTaskLifecycleFields(activeTask, payload);
    const nextDeliverables = (job.deliverables || []).map((deliverable) => {
      if (deliverable.id !== activeDeliverable.id) return deliverable;
      const tasks = (deliverable.tasks || []).map((task) => (
        task.id === activeTask.id ? { ...task, ...nextPayload } : task
      ));
      return { ...deliverable, tasks };
    });
    onJobUpdate({ deliverables: nextDeliverables });
    closeDrawer();
  };

  const toggleView = (mode) => {
    setViewMode(mode);
    setJobTasksViewMode(job.id, mode);
  };

  const resolvedViewMode = isRetainer ? 'list' : viewMode;
  const viewToggle = !isRetainer ? h(ViewToggleGroup, {
    value: resolvedViewMode,
    options: [
      {
        value: 'list',
        label: 'List',
        title: 'List view',
        icon: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
          h('rect', { x: '3', y: '4', width: '18', height: '6', rx: '2' }),
          h('rect', { x: '3', y: '14', width: '18', height: '6', rx: '2' }),
        ]),
      },
      {
        value: 'kanban',
        label: 'Kanban',
        title: 'Kanban view',
        icon: h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
          h('rect', { x: '3', y: '4', width: '5', height: '16', rx: '1.5' }),
          h('rect', { x: '9.5', y: '4', width: '5', height: '16', rx: '1.5' }),
          h('rect', { x: '16', y: '4', width: '5', height: '16', rx: '1.5' }),
        ]),
      },
    ],
    onChange: toggleView,
  }) : null;
  const cycleSelector = isRetainer ? h(RetainerMonthSwitcher, {
    cycleKey: activeCycleKey,
    onChange: setCycle,
    ariaLabel: 'Selected month',
  }) : null;

  const kanbanTaskFilter = isRetainer && activeCycleKey
    ? (task) => getTaskMeta(task, activeCycleKey, isRetainer).show
    : null;

  return h('div', { className: 'space-y-4 pb-12' }, [
    h('div', { className: 'flex flex-wrap items-center justify-between gap-3' }, [
      h('div', { className: 'space-y-1' }, [
      h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, 'Tasks'),
      ]),
      h('div', { className: 'flex flex-wrap items-center gap-3' }, [
        viewToggle,
        cycleSelector,
      ].filter(Boolean)),
    ]),
    resolvedViewMode === 'kanban'
      ? h(JobKanbanTab, {
        job,
        onJobUpdate,
        readOnly,
        chatIndicators: chatIndicatorMaps,
        onOpenChat,
        taskFilter: kanbanTaskFilter,
      })
      : h(JobTasksExecutionTable, {
        job,
        deliverables: deliverablesForTable,
        unassignedTasks,
        serviceTypes,
        members,
        assigneeOptions,
        chatIndicators: chatIndicatorMaps,
        onOpenChat,
        onOpenDrawer: isRetainer ? null : openDrawer,
        onJobUpdate,
        readOnly,
        cycleKey: activeCycleKey,
        taskMetaMap: isRetainer ? null : taskMetaMap,
        collapsedMap,
        onToggleCollapse: handleToggleCollapse,
      }),
    !isRetainer ? h(JobTaskDrawer, {
      isOpen: !!activeTask,
      task: activeTask,
      deliverable: drawerDeliverable,
      assignees: assigneeOptions,
      serviceTypes,
      showTeamHint: teamIds.length === 0,
      showRecurring: isRetainer,
      cycleKey: activeTaskCycleKey || activeCycleKey,
      readOnly,
      onClose: closeDrawer,
      onSave: handleSaveTask,
    }) : null,
  ]);
}
