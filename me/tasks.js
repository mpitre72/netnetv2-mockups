import { SectionHeader } from '../components/layout/SectionHeader.js';
import { mountSectionPageShell } from '../components/layout/section-page-shell.js';
import { EmptyStateCard } from '../components/layout/empty-state-card.js';
import { PrimaryButton } from '../components/buttons/primary-button.js';
import { TextInput } from '../components/forms/text-input.js';
import { SelectInput } from '../components/forms/select-input.js';
import { RowActionsMenu } from '../components/performance/primitives.js';
import { TaskSystemRow } from '../components/tasks/task-system-row.js';
import { openTaskReassignDrawer } from '../components/tasks/task-reassign-drawer.js';
import { TASK_SYSTEM_UPDATED_EVENT } from '../components/tasks/task-reassignment-store.js';
import { InlineTaskStatusControl, QuickTasksExecutionTable } from '../quick-tasks/quick-tasks-list.js';
import {
  getDisplayName,
  renderAvatar,
  renderMiniMeters,
} from '../quick-tasks/quick-tasks-helpers.js';
import {
  getCurrentUserId,
  getMemberById,
  loadTeamMembers,
  archiveTask,
  deleteTask,
  setTaskStatus,
} from '../quick-tasks/quick-tasks-store.js';
import { openQuickTaskDrawer } from '../quick-tasks/quick-task-detail.js';
import { navigate } from '../router.js';
import { openJobChatDrawer } from '../jobs/job-chat-drawer.js';
import { getJobNumber } from '../jobs/job-number-utils.js';
import { loadJobs, loadJobChatMessages, updateJob } from '../jobs/jobs-store.js';
import { mergeTaskLifecycleFields } from '../jobs/task-execution-utils.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';
import { getMyTasks } from './tasks-data.js';

const { createElement: h, useEffect, useMemo, useState } = React;
const { createRoot } = ReactDOM;

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const DUE_DATE_FILTERS = [
  { value: 'all', label: 'All due dates' },
  { value: 'overdue', label: 'Overdue' },
  { value: '7', label: 'Next 7 days' },
  { value: '30', label: 'Next 30 days' },
];

function noop() {}

function normalizeStatusValue(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'in_progress' || value === 'in-progress') return 'in-progress';
  if (value === 'completed') return 'completed';
  if (value === 'archived') return 'archived';
  return 'backlog';
}

function toExecutionStatus(status) {
  const normalized = normalizeStatusValue(status);
  if (normalized === 'in-progress') return 'in_progress';
  return normalized;
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((value) => Number.isNaN(value))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function isWithinDays(dateStr, days) {
  const target = parseLocalDate(dateStr);
  if (!target) return false;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = (target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  return diff >= 0 && diff <= days;
}

function isOverdue(dateStr) {
  const target = parseLocalDate(dateStr);
  if (!target) return false;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return target.getTime() < start.getTime();
}

function getStatusToneClass(status) {
  const normalized = normalizeStatusValue(status);
  if (normalized === 'completed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200';
  }
  if (normalized === 'in-progress') {
    return 'bg-netnet-purple/15 text-netnet-purple dark:bg-netnet-purple/20 dark:text-netnet-purple';
  }
  if (normalized === 'archived') {
    return 'bg-slate-200 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
}

function getStatusLabel(status) {
  const normalized = normalizeStatusValue(status);
  if (normalized === 'in-progress') return 'In Progress';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'archived') return 'Archived';
  return 'Backlog';
}

function formatDueLabel(task) {
  if (!task?.dueDate) return { label: '—', tone: 'muted' };
  const today = new Date();
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { label: task.dueDate, tone: 'muted' };
  const dueTime = due.setHours(0, 0, 0, 0);
  const todayTime = today.setHours(0, 0, 0, 0);
  return {
    label: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    tone: dueTime < todayTime ? 'danger' : 'normal',
  };
}

function getDueTiming(task) {
  if (!task?.dueDate) return { label: '—', tone: 'muted' };
  const today = new Date();
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { label: '—', tone: 'muted' };
  const diffDays = Math.round((due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'Overdue', tone: 'danger' };
  if (diffDays === 0) return { label: 'Due today', tone: 'warn' };
  return { label: `Due in ${diffDays}d`, tone: 'normal' };
}

function renderTaskMeter(taskLike, actualHours) {
  const dueTiming = getDueTiming(taskLike);
  const dueToneClass = dueTiming.tone === 'danger'
    ? 'text-rose-600 dark:text-rose-400'
    : dueTiming.tone === 'warn'
      ? 'text-amber-500 dark:text-amber-300'
      : dueTiming.tone === 'muted'
        ? 'text-slate-400 dark:text-slate-500'
        : 'text-slate-600 dark:text-slate-300';
  const meterHtml = renderMiniMeters(taskLike, actualHours).replace(
    /<div class="text-\[11px\] text-slate-600 dark:text-slate-300">Due .*?<\/div>/,
    `<div class="text-[11px] ${dueToneClass}">${dueTiming.label}</div>`,
  );
  return h('div', {
    className: 'min-w-[160px]',
    dangerouslySetInnerHTML: { __html: meterHtml },
  });
}

function getTaskActualHours(task) {
  if (!task) return 0;
  if (Number.isFinite(task.actualHours)) return Number(task.actualHours) || 0;
  if (Array.isArray(task.timeEntries)) {
    return task.timeEntries.reduce((sum, entry) => sum + (Number(entry?.hours) || 0), 0);
  }
  if (Array.isArray(task.allocations)) {
    return task.allocations.reduce((sum, allocation) => sum + (Number(allocation?.actualHours) || 0), 0);
  }
  return 0;
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

function renderChatIndicator() {
  return h('span', {
    className: 'inline-flex items-center text-slate-500 dark:text-slate-300',
    title: 'Task chat available',
    'aria-label': 'Task chat available',
  }, [
    h('svg', {
      viewBox: '0 0 24 24',
      className: 'h-[18px] w-[18px]',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '1.8',
    }, [
      h('path', { d: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }),
    ]),
  ]);
}

function renderTimeIndicator() {
  return h('span', {
    className: 'inline-flex items-center text-slate-600 dark:text-slate-300',
    title: 'Open time details',
    'aria-label': 'Open time details',
  }, [
    h('svg', {
      viewBox: '0 0 24 24',
      className: 'h-[18px] w-[18px]',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '1.8',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }, [
      h('circle', { cx: '12', cy: '12', r: '8' }),
      h('path', { d: 'M12 8v5l3 2' }),
    ]),
  ]);
}

function filterMyTasks(tasks, {
  statusFilter = 'all',
  assigneeFilter = 'all',
  dueDateFilter = 'all',
  searchValue = '',
} = {}) {
  const term = String(searchValue || '').trim().toLowerCase();
  return (tasks || []).filter((task) => {
    const normalizedStatus = normalizeStatusValue(task?.status);
    if (statusFilter !== 'all' && normalizedStatus !== normalizeStatusValue(statusFilter)) return false;
    if (assigneeFilter !== 'all' && String(task?.assigneeId || '') !== String(assigneeFilter || '')) return false;
    if (dueDateFilter === 'overdue' && !isOverdue(task?.dueDate)) return false;
    if (dueDateFilter === '7' && !isWithinDays(task?.dueDate, 7)) return false;
    if (dueDateFilter === '30' && !isWithinDays(task?.dueDate, 30)) return false;
    if (!term) return true;
    const haystack = [
      task?.title,
      task?.description,
      task?.clientName,
      task?.serviceType,
      task?.clientType,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(term);
  });
}

function getSourceAction(task) {
  if (task?.source === 'job') {
    const jobId = task?.originalTaskRef?.jobId;
    return {
      label: 'Open Job',
      onClick: () => {
        if (jobId) navigate(`#/app/jobs/${jobId}`);
      },
    };
  }
  return {
    label: 'Open Quick Tasks',
    onClick: () => navigate('#/app/quick-tasks'),
  };
}

function updateJobTaskStatus(task, nextStatus) {
  const jobId = String(task?.originalTaskRef?.jobId || '');
  const taskId = String(task?.sourceId || '');
  const deliverableId = task?.originalTaskRef?.deliverableId ? String(task.originalTaskRef.deliverableId) : null;
  if (!jobId || !taskId || !nextStatus) return null;
  const job = loadJobs().find((item) => String(item.id) === jobId);
  if (!job) return null;
  const applyLifecycle = (currentTask) => ({
    ...currentTask,
    ...mergeTaskLifecycleFields(currentTask, { status: nextStatus }),
  });

  if (deliverableId) {
    const nextDeliverables = (job.deliverables || []).map((deliverable) => (
      String(deliverable.id) !== deliverableId
        ? deliverable
        : {
          ...deliverable,
          tasks: (deliverable.tasks || []).map((item) => (
            String(item.id) === taskId ? applyLifecycle(item) : item
          )),
        }
    ));
    return updateJob(jobId, { deliverables: nextDeliverables });
  }

  const nextUnassignedTasks = (job.unassignedTasks || []).map((item) => (
    String(item.id) === taskId ? applyLifecycle(item) : item
  ));
  return updateJob(jobId, { unassignedTasks: nextUnassignedTasks });
}

function updateMyTaskStatus(task, nextStatus) {
  if (!task || !nextStatus) return null;
  if (task.source === 'quick') {
    return setTaskStatus(task.sourceId, nextStatus);
  }
  if (task.source === 'job') {
    return updateJobTaskStatus(task, nextStatus);
  }
  return null;
}

function buildJobMap() {
  return new Map(loadJobs().map((job) => [String(job.id), job]));
}

function buildCompanyMap() {
  return new Map((getContactsData() || []).map((company) => [String(company.id), company]));
}

function buildPersonMap(companyMap) {
  const people = [];
  companyMap.forEach((company) => {
    (company.people || []).forEach((person) => {
      people.push([String(person.id), person]);
    });
  });
  (getIndividualsData() || []).forEach((person) => {
    people.push([String(person.id), person]);
  });
  return new Map(people);
}

function resolveClientNameFromJob(job, fallbackClientName, companyMap, personMap) {
  if (fallbackClientName) return fallbackClientName;
  const company = job?.companyId ? companyMap.get(String(job.companyId)) : null;
  if (company?.name) return company.name;
  const person = job?.personId ? personMap.get(String(job.personId)) : null;
  if (person?.name) return person.name;
  const fullName = [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  return job?.companyId || job?.personId ? 'Client' : 'Internal';
}

function openMyTaskTimeSurface(task, jobMap) {
  if (task?.source === 'quick') {
    if (task?.sourceId) {
      openQuickTaskDrawer({
        mode: 'edit',
        taskId: task.sourceId,
      });
    }
    return;
  }
  const jobId = task?.originalTaskRef?.jobId;
  const job = jobId ? jobMap.get(String(jobId)) : null;
  if (job?.id) {
    navigate(`#/app/jobs/${job.id}`);
  }
}

function openMyTaskChat(task, jobMap) {
  if (task?.source !== 'job') return;
  const jobId = task?.originalTaskRef?.jobId;
  const taskId = task?.sourceId;
  const deliverableId = task?.originalTaskRef?.deliverableId || null;
  const job = jobId ? jobMap.get(String(jobId)) : null;
  if (!job || !taskId) return;
  const openWithFreshMessages = () => {
    openJobChatDrawer({
      job,
      jobNumber: getJobNumber(job),
      target: {
        type: 'task',
        deliverableId,
        taskId,
      },
      messages: loadJobChatMessages(job.id),
      readOnly: false,
      onChatUpdate: openWithFreshMessages,
    });
  };
  openWithFreshMessages();
}

function buildAssigneeOptions(members, currentUserId) {
  const currentUser = getMemberById(currentUserId, members);
  return [
    { value: 'all', label: 'All assignees' },
    currentUser
      ? { value: String(currentUser.id), label: getDisplayName(currentUser) || 'Current user' }
      : null,
  ].filter(Boolean);
}

function MyTasksTable({ tasks = [], members = [], onTaskStatusChange, onTaskMutation }) {
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [statusEditorTaskId, setStatusEditorTaskId] = useState(null);
  const memberMap = useMemo(
    () => new Map((members || []).map((member) => [String(member.id), member])),
    [members],
  );
  const jobMap = useMemo(() => buildJobMap(), []);
  const companyMap = useMemo(() => buildCompanyMap(), []);
  const personMap = useMemo(() => buildPersonMap(companyMap), [companyMap]);

  const rows = tasks.map((task) => {
    const taskExpanded = String(expandedTaskId || '') === String(task.id);
    const statusEditing = String(statusEditorTaskId || '') === String(task.id);
    const assignee = task.assigneeId ? memberMap.get(String(task.assigneeId)) : null;
    const due = formatDueLabel(task);
    const actualHours = getTaskActualHours(task.originalTaskRef);
    const meterTask = {
      loeHours: Number(task.loeHours) || 0,
      dueDate: task.dueDate || null,
    };
    const sourceAction = getSourceAction(task);
    const job = task.source === 'job' ? jobMap.get(String(task?.originalTaskRef?.jobId || '')) : null;
    const contextPrimary = task.source === 'job' ? (job?.name || 'Job') : 'Quick Task';
    const contextSecondary = task.source === 'job'
      ? resolveClientNameFromJob(job, task.clientName, companyMap, personMap)
      : (task.clientType === 'internal' ? 'Internal' : (task.clientName || 'Client'));
    const actionsCellContent = h('div', {
      className: 'flex justify-end',
      onClick: (event) => event.stopPropagation(),
      onMouseDown: (event) => event.stopPropagation(),
      onKeyDown: (event) => event.stopPropagation(),
      'data-no-row-toggle': 'true',
    }, [
      h(RowActionsMenu, {
        menuItems: task.source === 'quick'
          ? ['Edit', 'Move Task', 'Archive Task', 'Delete']
          : ['Edit', 'Move Task', 'Open Job'],
        onSelect: (item) => {
          if (item === 'Edit') {
            if (task.source === 'quick') {
              openQuickTaskDrawer({
                mode: 'edit',
                taskId: task.sourceId,
                onUpdated: () => onTaskMutation?.(),
                onDeleted: () => onTaskMutation?.(),
              });
            } else {
              sourceAction.onClick();
            }
          }
          if (item === 'Move Task') {
            openTaskReassignDrawer({ task });
          }
          if (item === 'Archive Task' && task.source === 'quick') {
            archiveTask(task.sourceId);
            onTaskMutation?.();
          }
          if (item === 'Delete' && task.source === 'quick') {
            const result = deleteTask(task.sourceId);
            if (!result?.ok && result?.reason && typeof window?.showToast === 'function') {
              window.showToast(result.reason);
              return;
            }
            onTaskMutation?.();
          }
          if (item === 'Open Job') sourceAction.onClick();
        },
      }),
    ]);

    const expandedContent = h('div', {
      className: 'rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-4',
    }, [
      h('div', {
        key: 'expanded-grid',
        className: 'grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]',
      }, [
        h('div', { key: 'description', className: 'space-y-2 min-w-0' }, [
          h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Description'),
          h('div', { className: 'rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/70 px-4 py-3 text-sm leading-6 text-slate-700 dark:text-slate-200 min-h-[96px]' }, task.description || 'No description yet'),
        ]),
        h('div', { key: 'meta-grid', className: 'grid gap-3 sm:grid-cols-2' }, [
          h('div', { key: 'status', className: 'rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/70 px-4 py-3' }, [
            h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Status'),
            h('div', { className: 'mt-2' }, [
              h('span', { className: `inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusToneClass(task.status)}` }, getStatusLabel(task.status)),
            ]),
          ]),
          h('div', { key: 'assignee', className: 'rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/70 px-4 py-3' }, [
            h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Assignee'),
            h('div', { className: 'mt-2 flex items-center gap-2 min-w-0' }, [
              assignee ? renderHtml(renderAvatar(assignee, { sizeClass: 'h-7 w-7', textClass: 'text-[10px]' })) : null,
              h('span', { className: 'truncate text-sm text-slate-700 dark:text-slate-200' }, assignee ? (getDisplayName(assignee) || 'Assignee') : 'Unassigned'),
            ]),
          ]),
          h('div', { key: 'client', className: 'rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/70 px-4 py-3' }, [
            h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Context'),
            h('div', { className: 'mt-2 space-y-1 min-w-0' }, [
              h('div', { className: 'truncate text-sm font-medium text-slate-900 dark:text-slate-100' }, contextPrimary),
              h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, contextSecondary),
            ]),
          ]),
          h('div', { key: 'service', className: 'rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/70 px-4 py-3' }, [
            h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Service Type'),
            h('div', { className: 'mt-2 text-sm text-slate-700 dark:text-slate-200' }, task.serviceType || 'Unassigned'),
          ]),
          h('div', { key: 'due', className: 'rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/70 px-4 py-3' }, [
            h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Due Date'),
            h('div', {
              className: due.tone === 'danger'
                ? 'mt-2 text-sm text-rose-600 dark:text-rose-300'
                : 'mt-2 text-sm text-slate-500 dark:text-slate-400',
            }, due.label),
          ]),
          h('div', { key: 'loe', className: 'rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-slate-900/70 px-4 py-3' }, [
            h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'LOE / Timeline'),
            h('div', { className: 'mt-2 min-w-0' }, [
              renderTaskMeter(meterTask, actualHours),
            ]),
          ]),
        ]),
      ]),
      h('div', {
        key: 'expanded-footer',
        className: 'flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 dark:border-white/10',
      }, [
        h('div', { className: 'flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400' }, [
          h('span', { className: 'inline-flex items-center rounded-full border border-slate-200/80 dark:border-white/10 px-2 py-1' }, task.source === 'job' ? 'Job Task' : 'Quick Task'),
          task.hasChat ? h('span', { className: 'inline-flex items-center gap-1' }, [renderChatIndicator(), h('span', null, 'Chat available')]) : null,
        ]),
        h('button', {
          type: 'button',
          className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60',
          onClick: (event) => {
            event.stopPropagation();
            sourceAction.onClick();
          },
          'data-no-row-toggle': 'true',
        }, sourceAction.label),
      ]),
    ]);

    return h(TaskSystemRow, {
      key: task.id,
      taskId: task.id,
      expanded: taskExpanded,
      onToggle: (taskId) => {
        setExpandedTaskId((current) => (String(current || '') === String(taskId || '') ? null : taskId));
      },
      colSpan: 10,
      toggleCellClassName: 'px-3 py-3 align-middle w-[36px] text-sm text-gray-700 dark:text-gray-200',
      toggleButtonClassName: 'h-7 w-7 rounded-md border border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50 flex items-center justify-center mx-auto',
      rowClassName: 'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer',
      expandedRowClassName: 'bg-white dark:bg-slate-900/50',
      expandedCellClassName: 'px-5 pb-5 pt-1',
      expandedContent,
      cells: [
        renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
          h('div', { className: 'space-y-1 min-w-0' }, [
            h('div', { className: 'flex items-center gap-2 min-w-0' }, [
              h('span', { className: 'truncate text-sm font-semibold text-slate-900 dark:text-slate-100' }, task.title || 'Untitled task'),
            ]),
            h('div', { className: 'flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400' }, [
              h(InlineTaskStatusControl, {
                taskId: task.id,
                status: toExecutionStatus(task.status),
                editing: statusEditing,
                onStartEdit: (nextTaskId) => setStatusEditorTaskId(nextTaskId),
                onCommit: (nextStatus) => {
                  onTaskStatusChange?.(task, nextStatus);
                  setStatusEditorTaskId(null);
                },
                onCancel: () => setStatusEditorTaskId(null),
                onStopPropagation: (event) => event.stopPropagation(),
              }),
            ]),
          ]),
        ]), 'w-[22%] min-w-0'),
        renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
          h('div', {
            className: 'text-xs text-slate-500 dark:text-slate-400 truncate whitespace-nowrap overflow-hidden text-ellipsis max-w-[240px]',
          }, task.description || 'Add description'),
        ]), 'w-[18%] min-w-0 max-w-[240px]'),
        renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
          h('div', { className: 'space-y-1 min-w-0 max-w-[200px]' }, [
            task.source === 'job'
              ? h('button', {
                type: 'button',
                className: 'block max-w-full truncate text-left text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-netnet-purple dark:hover:text-netnet-purple',
                onClick: (event) => {
                  event.stopPropagation();
                  if (job?.id) navigate(`#/app/jobs/${job.id}`);
                },
                onMouseDown: (event) => event.stopPropagation(),
                'data-no-row-toggle': 'true',
              }, contextPrimary)
              : h('div', { className: 'text-sm font-medium text-slate-900 dark:text-slate-100 truncate' }, contextPrimary),
            h('div', { className: 'text-xs text-slate-500 dark:text-slate-400 truncate' }, contextSecondary),
          ]),
        ]), 'w-[17%] min-w-0 max-w-[200px]'),
        renderCell(h('div', {
          className: 'min-h-[40px] flex flex-col items-center justify-center gap-1',
        }, [
          task.source === 'job'
            ? h('button', {
              type: 'button',
              className: 'inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10',
              onMouseDown: (event) => event.stopPropagation(),
              onClick: (event) => {
                event.stopPropagation();
                openMyTaskChat(task, jobMap);
              },
              'data-no-row-toggle': 'true',
              'aria-label': 'Open task chat',
            }, renderChatIndicator())
            : h('span', { className: 'h-7 w-7 opacity-0', 'aria-hidden': 'true' }, ''),
          h('button', {
            type: 'button',
            className: 'inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10',
            onMouseDown: (event) => event.stopPropagation(),
            onClick: (event) => {
              event.stopPropagation();
              openMyTaskTimeSurface(task, jobMap);
            },
            'data-no-row-toggle': 'true',
            'aria-label': 'Open time details',
          }, renderTimeIndicator()),
        ]), 'w-[56px] min-w-[56px] text-center'),
        renderCell(
          h('div', { className: 'min-h-[40px] flex items-center' }, [
            assignee
              ? renderHtml(renderAvatar(assignee, { sizeClass: 'h-7 w-7', textClass: 'text-[10px]' }))
              : h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, 'Unassigned'),
          ]),
          'w-[8%] min-w-[72px]',
        ),
        renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
          h('div', { className: 'text-sm text-slate-700 dark:text-slate-200 truncate' }, task.serviceType || 'Unassigned'),
        ]), 'w-[13%] min-w-0 max-w-[170px]'),
        renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
          h('div', {
            className: due.tone === 'danger'
              ? 'text-sm text-rose-600 dark:text-rose-300'
              : 'text-sm text-slate-500 dark:text-slate-400',
          }, due.label),
        ]), 'w-[8%] min-w-[88px]'),
        renderCell(h('div', { className: 'min-h-[40px] flex items-center' }, [
          renderTaskMeter(meterTask, actualHours),
        ]), 'w-[14%] min-w-[160px]'),
        renderCell(h('div', { className: 'min-h-[40px] flex items-center justify-end' }, [
          actionsCellContent,
        ]), 'w-[40px] min-w-[40px] text-right'),
      ],
    });
  });

  return h(QuickTasksExecutionTable, {
    tasks,
    members,
    stickyHeader: false,
    customColumns: [
      { key: 'toggle', label: '', className: 'px-3 py-3 w-10' },
      { key: 'task-name', label: 'Task Name', className: 'px-3 py-3 w-[22%]' },
      { key: 'description', label: 'Description', className: 'px-3 py-3 w-[18%]' },
      { key: 'context', label: 'Context', className: 'px-3 py-3 w-[17%]' },
      { key: 'icons', label: '', className: 'px-3 py-3 w-[56px] text-center' },
      { key: 'assignee', label: 'Assignee', className: 'px-3 py-3 w-[8%]' },
      { key: 'service-type', label: 'Service Type', className: 'px-3 py-3 w-[13%]' },
      { key: 'due-date', label: 'Due Date', className: 'px-3 py-3 w-[8%]' },
      { key: 'loe', label: 'LOE / Timeline', className: 'px-3 py-3 w-[14%]' },
      { key: 'actions', label: '', className: 'px-3 py-3 w-[40px] text-right' },
    ],
    customRows: rows,
    customEmptyMessage: 'No matching tasks',
  });
}

export function renderMyTasksHeader(container) {
  if (!container) return;
  const root = createRoot(container);
  const breadcrumb = h('div', { className: 'flex items-center gap-2' }, [
    h('span', { key: 'section', className: 'text-sm text-slate-500 dark:text-white/70' }, 'Me'),
    h('span', { key: 'divider', className: 'text-slate-400 dark:text-white/50' }, '›'),
    h('span', { key: 'title', className: 'text-2xl font-semibold text-slate-900 dark:text-white' }, 'My Tasks'),
  ]);

  root.render(h(SectionHeader, {
    title: breadcrumb,
    showHelpIcon: true,
    showSecondaryRow: false,
    className: 'mb-1',
  }));
}

function MyTasksScreen() {
  const members = useMemo(() => loadTeamMembers(), []);
  const currentUserId = useMemo(() => getCurrentUserId(), []);
  const [refreshToken, setRefreshToken] = useState(0);
  const myTasks = useMemo(() => getMyTasks(currentUserId), [currentUserId, refreshToken]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
    const handleTaskSystemUpdated = () => setRefreshToken((value) => value + 1);
    window.addEventListener(TASK_SYSTEM_UPDATED_EVENT, handleTaskSystemUpdated);
    return () => window.removeEventListener(TASK_SYSTEM_UPDATED_EVENT, handleTaskSystemUpdated);
  }, []);
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [dueDateFilter, setDueDateFilter] = useState('all');
  const [searchValue, setSearchValue] = useState('');
  const filteredTasks = useMemo(() => filterMyTasks(myTasks, {
    statusFilter,
    assigneeFilter,
    dueDateFilter,
    searchValue,
  }), [myTasks, statusFilter, assigneeFilter, dueDateFilter, searchValue]);
  const assigneeOptions = useMemo(
    () => buildAssigneeOptions(members, currentUserId),
    [members, currentUserId],
  );

  useEffect(() => {
    console.log('[My Tasks] unified dataset', myTasks);
  }, [myTasks]);

  const handleTaskStatusChange = (task, nextStatus) => {
    const updated = updateMyTaskStatus(task, nextStatus);
    if (updated) {
      setRefreshToken((current) => current + 1);
    }
  };

  return h('div', { className: 'space-y-0' }, [
    h('div', {
      key: 'controls-wrap',
      id: 'my-tasks-sticky-filters',
      className: 'sticky top-0 z-30 -mx-4 mb-0 px-4 py-3 bg-[#f8fafc] dark:bg-[#020617] border-b border-slate-200/80 dark:border-white/10',
    }, [
      h('div', { className: 'flex w-full flex-wrap items-center gap-2' }, [
        h('div', {
          className: 'inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-1 py-1 flex-none',
        }, STATUS_FILTERS.map((filter) => h('button', {
        key: filter.value,
        type: 'button',
        className: [
          'px-3 py-1 rounded-full text-xs font-semibold transition-colors border whitespace-nowrap',
          filter.value === statusFilter
            ? 'bg-[var(--color-brand-purple,#711FFF)] text-white border-transparent shadow-sm'
            : 'text-slate-600 dark:text-slate-300 border-transparent hover:bg-slate-100 dark:hover:bg-white/10',
        ].join(' '),
        onClick: () => setStatusFilter(filter.value),
        }, filter.label))),
        h('div', { className: 'w-[168px] flex-none' }, [
          h(SelectInput, {
          id: 'my-tasks-assignee-filter',
          value: assigneeFilter,
          onChange: (event) => setAssigneeFilter(event.target.value),
          className: '!bg-white !text-slate-700 !border-slate-200 dark:!bg-slate-900 dark:!text-slate-200 dark:!border-white/10',
          'aria-label': 'Assignee filter',
          options: assigneeOptions,
          }),
        ]),
        h('div', { className: 'w-[168px] flex-none' }, [
          h(SelectInput, {
          id: 'my-tasks-due-date-filter',
          value: dueDateFilter,
          onChange: (event) => setDueDateFilter(event.target.value),
          className: '!bg-white !text-slate-700 !border-slate-200 dark:!bg-slate-900 dark:!text-slate-200 dark:!border-white/10',
          'aria-label': 'Due date filter',
          options: DUE_DATE_FILTERS,
          }),
        ]),
        h('div', { className: 'min-w-0 flex-1' }, [
          h(TextInput, {
          id: 'my-tasks-search',
          type: 'search',
          value: searchValue,
          onChange: (event) => setSearchValue(event.target.value),
          className: '!bg-white !text-slate-700 !border-slate-200 dark:!bg-slate-900 dark:!text-slate-200 dark:!border-white/10',
          placeholder: 'Search tasks...',
          'aria-label': 'Search tasks',
          }),
        ]),
        h(PrimaryButton, {
          className: 'flex-none whitespace-nowrap',
          onClick: noop,
        }, '+ New Task'),
      ]),
    ]),
    myTasks.length === 0
      ? h(EmptyStateCard, {
        title: 'No tasks yet',
        description: 'Your assigned tasks will appear here',
        action: h(PrimaryButton, { onClick: noop }, '+ New Task'),
      })
      : h(MyTasksTable, {
        tasks: filteredTasks,
        members,
        onTaskStatusChange: handleTaskStatusChange,
        onTaskMutation: () => setRefreshToken((current) => current + 1),
      }),
  ]);
}

export function renderMyTasksPage(container = document.getElementById('app-main')) {
  if (!container) {
    console.warn('[MeTasksModule] container not found for renderMyTasksPage.');
    return;
  }

  const { headerMount, bodyMount } = mountSectionPageShell(container, {
    headerId: 'me-tasks-header',
    bodyId: 'me-tasks-body',
  });
  renderMyTasksHeader(headerMount);
  const root = createRoot(bodyMount);
  root.render(h(MyTasksScreen));
}
