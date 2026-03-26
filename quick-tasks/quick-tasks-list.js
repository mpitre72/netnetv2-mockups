import { TaskStyleRichTextField } from '../jobs/task-style-rich-text-field.js';
import { TaskSystemRow } from '../components/tasks/task-system-row.js';
import {
  getCurrentUserId,
  getMemberById,
  getServiceTypeById,
  getTaskActualHours,
  getTaskAssigneeIds,
  getTaskAllocations,
  getTaskContext,
  getTaskServiceTypeIds,
  getTaskTotalLoe,
} from './quick-tasks-store.js';
import { renderMiniMeters } from './quick-tasks-helpers.js';
import { getContactsData, getIndividualsData } from '../contacts/contacts-data.js';

const { createElement: h, useEffect, useMemo, useState } = React;

function formatDueLabel(task) {
  if (!task?.dueDate) return { label: '—', tone: 'muted' };
  if (task.status === 'completed') return { label: 'Done', tone: 'muted' };
  const today = new Date();
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { label: task.dueDate, tone: 'muted' };
  const diffMs = due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: 'Overdue', tone: 'danger' };
  if (diffDays === 0) return { label: 'Due today', tone: 'warn' };
  return { label: `${diffDays}d`, tone: diffDays <= 5 ? 'warn' : 'neutral' };
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function quarterRound(value) {
  return Math.round((Number(value) || 0) * 4) / 4;
}

function redistributeHours(allocations, totalHours) {
  const nextTotal = Math.max(0, quarterRound(totalHours));
  if (!Array.isArray(allocations) || !allocations.length) return allocations || [];
  if (allocations.length === 1) {
    return allocations.map((allocation) => ({ ...allocation, loeHours: nextTotal }));
  }
  const currentTotal = allocations.reduce((sum, allocation) => sum + (Number(allocation?.loeHours) || 0), 0);
  let remaining = nextTotal;
  return allocations.map((allocation, index) => {
    if (index === allocations.length - 1) {
      return { ...allocation, loeHours: quarterRound(remaining) };
    }
    const base = currentTotal > 0
      ? (Number(allocation?.loeHours) || 0) / currentTotal
      : (1 / allocations.length);
    const hours = quarterRound(clamp(base * nextTotal, 0, nextTotal));
    remaining = quarterRound(remaining - hours);
    return { ...allocation, loeHours: hours };
  });
}

function companyMapFrom(companies = []) {
  return new Map(companies.map((company) => [String(company.id), company]));
}

function personMapFrom(companies = [], individuals = []) {
  const map = new Map();
  companies.forEach((company) => {
    (company.people || []).forEach((person) => {
      map.set(String(person.id), { ...person, companyId: company.id, companyName: company.name });
    });
  });
  individuals.forEach((person) => {
    if (!map.has(String(person.id))) {
      map.set(String(person.id), { ...person, companyId: null, companyName: '' });
    }
  });
  return map;
}

function serviceTypeLabel(task, serviceTypeMap) {
  const ids = getTaskServiceTypeIds(task);
  if (!ids.length) return 'Unassigned';
  return ids.map((id) => serviceTypeMap.get(String(id))?.name || 'Service').join(', ');
}

function contextSummary(task, companyMap, personMap) {
  const context = getTaskContext(task);
  if (context.type === 'internal') {
    return { primary: 'Internal', secondary: '' };
  }
  const company = context.companyId ? companyMap.get(String(context.companyId)) : null;
  const person = context.personId ? personMap.get(String(context.personId)) : null;
  return {
    primary: company?.name || 'Client',
    secondary: person?.name || '',
  };
}

function renderMeter(task) {
  return h('div', {
    className: 'min-w-[160px]',
    dangerouslySetInnerHTML: {
      __html: renderMiniMeters({
        loeHours: getTaskTotalLoe(task),
        dueDate: task.dueDate || null,
      }, getTaskActualHours(task)),
    },
  });
}

function EmptyState({ statusFilter, onNewTask }) {
  const titleMap = {
    all: 'No quick tasks yet',
    backlog: 'No backlog quick tasks',
    in_progress: 'No in-progress quick tasks',
    completed: 'No completed tasks yet',
    archived: 'No archived quick tasks',
  };
  const bodyMap = {
    all: 'Create your first Quick Task to start tracking real work.',
    backlog: 'Move work here when you are ready to start.',
    in_progress: 'Start a task to see it here.',
    completed: 'Complete a task to see it here.',
    archived: 'Archived tasks appear here after archiving.',
  };
  const title = titleMap[statusFilter] || titleMap.all;
  const body = bodyMap[statusFilter] || bodyMap.all;
  const showAction = ['all', 'backlog', 'in_progress'].includes(statusFilter);
  return h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 shadow-sm overflow-hidden' }, [
    h('div', { className: 'px-6 py-10 text-center' }, [
      h('div', { className: 'text-base font-semibold text-slate-900 dark:text-white' }, title),
      h('div', { className: 'mt-2 text-sm text-slate-500 dark:text-slate-400' }, body),
      showAction
        ? h('button', {
          type: 'button',
          className: 'mt-4 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
          onClick: onNewTask,
        }, '+ New Quick Task')
        : null,
    ]),
  ]);
}

export function QuickTasksExecutionTable({
  tasks = [],
  members = [],
  serviceTypes = [],
  statusFilter = 'all',
  highlightTaskId = null,
  autoExpandTaskId = null,
  onNewTask,
  onTaskUpdate,
  onTaskDelete,
  onTaskArchive,
  onTaskStatusChange,
}) {
  const [expandedTaskIds, setExpandedTaskIds] = useState(() => new Set());
  const [descriptionEditor, setDescriptionEditor] = useState(null);
  const companies = useMemo(() => getContactsData(), []);
  const individuals = useMemo(() => getIndividualsData(), []);
  const companyMap = useMemo(() => companyMapFrom(companies), [companies]);
  const personMap = useMemo(() => personMapFrom(companies, individuals), [companies, individuals]);
  const memberMap = useMemo(() => new Map(members.map((member) => [String(member.id), member])), [members]);
  const serviceTypeMap = useMemo(() => new Map(serviceTypes.map((type) => [String(type.id), type])), [serviceTypes]);
  const currentUserId = getCurrentUserId(members);

  useEffect(() => {
    if (!autoExpandTaskId) return;
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      next.add(autoExpandTaskId);
      return next;
    });
  }, [autoExpandTaskId]);

  const toggleTaskExpanded = (taskId) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const saveDescription = (task, value) => {
    onTaskUpdate?.(task.id, { description: String(value || '') });
    setDescriptionEditor(null);
  };

  const updateAllocations = (task, updater) => {
    const current = getTaskAllocations(task);
    const next = typeof updater === 'function' ? updater(current) : current;
    onTaskUpdate?.(task.id, { allocations: next });
  };

  if (!tasks.length) {
    return h(EmptyState, { statusFilter, onNewTask });
  }

  return h('div', { className: 'rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 shadow-sm overflow-hidden' }, [
    h('div', { className: 'overflow-x-auto' }, [
      h('table', { className: 'w-full text-left border-collapse' }, [
        h('thead', { className: 'bg-gray-50 dark:bg-gray-800/80 text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold' }, [
          h('tr', null, [
            h('th', { className: 'px-6 py-3 border-b border-gray-200 dark:border-gray-700 w-10' }),
            h('th', { className: 'px-6 py-3 border-b border-gray-200 dark:border-gray-700 min-w-[240px]' }, 'Task Name'),
            h('th', { className: 'px-6 py-3 border-b border-gray-200 dark:border-gray-700 min-w-[180px]' }, 'Context'),
            h('th', { className: 'px-6 py-3 border-b border-gray-200 dark:border-gray-700 min-w-[160px]' }, 'Service Type'),
            h('th', { className: 'px-6 py-3 border-b border-gray-200 dark:border-gray-700 min-w-[100px]' }, 'Due'),
            h('th', { className: 'px-6 py-3 border-b border-gray-200 dark:border-gray-700 min-w-[180px]' }, 'Meter'),
            h('th', { className: 'px-6 py-3 border-b border-gray-200 dark:border-gray-700 min-w-[160px]' }, 'Assignees'),
          ]),
        ]),
        h('tbody', { className: 'divide-y divide-gray-100 dark:divide-gray-800' }, tasks.map((task) => {
          const taskExpanded = expandedTaskIds.has(task.id);
          const taskHighlighted = highlightTaskId && String(highlightTaskId) === String(task.id);
          const due = formatDueLabel(task);
          const summary = contextSummary(task, companyMap, personMap);
          const allocationList = getTaskAllocations(task);
          const descriptionValue = descriptionEditor?.taskId === task.id
            ? (descriptionEditor.value ?? '')
            : String(task.description || '');
          const sharedServiceTypeId = getTaskServiceTypeIds(task)[0] || '';
          const totalLoe = getTaskTotalLoe(task);
          const context = getTaskContext(task);
          const personChoices = context.companyId
            ? (companyMap.get(String(context.companyId))?.people || [])
            : individuals;
          const assigneeBadges = getTaskAssigneeIds(task)
            .map((id) => memberMap.get(String(id)))
            .filter(Boolean);
          const expandedContent = h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-4 transition-all duration-200 ease-out' }, [
            h(TaskStyleRichTextField, {
              label: 'Description',
              value: descriptionValue,
              rows: 3,
              autoFocus: descriptionEditor?.taskId === task.id,
              onChange: (nextValue) => setDescriptionEditor({ taskId: task.id, value: nextValue }),
              onBlur: () => saveDescription(task, descriptionValue),
              onKeyDown: (event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setDescriptionEditor(null);
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  saveDescription(task, descriptionValue);
                }
              },
              footerText: 'Enter to save · Esc to cancel',
            }),
            h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 p-4 space-y-3' }, [
              h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Assignees'),
              allocationList.length
                ? h('div', { className: 'space-y-2' }, allocationList.map((allocation) => h('div', {
                  key: allocation.id,
                  className: 'grid gap-3 items-center md:grid-cols-[1fr_auto]',
                }, [
                  h('select', {
                    value: allocation.assigneeUserId ? String(allocation.assigneeUserId) : '',
                    onClick: (event) => event.stopPropagation(),
                    onChange: (event) => updateAllocations(task, (list) => (
                      list.map((item) => item.id === allocation.id
                        ? { ...item, assigneeUserId: event.target.value || null }
                        : item)
                    )),
                    className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
                  }, [
                    h('option', { value: '' }, 'Unassigned'),
                    ...members.map((member) => h('option', { key: member.id, value: member.id }, member.name || member.email || 'Member')),
                  ]),
                  h('button', {
                    type: 'button',
                    className: 'inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-white/10 px-3 h-10 text-xs font-semibold text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
                    onClick: (event) => {
                      event.stopPropagation();
                      updateAllocations(task, (list) => list.length > 1 ? list.filter((item) => item.id !== allocation.id) : list);
                    },
                    disabled: allocationList.length <= 1,
                  }, 'Remove'),
                ])))
                : h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'No assignees yet.'),
              h('button', {
                type: 'button',
                className: 'inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                onClick: (event) => {
                  event.stopPropagation();
                  updateAllocations(task, (list) => [
                    ...(list || []),
                    {
                      id: `alloc_${Math.random().toString(36).slice(2, 9)}`,
                      assigneeUserId: currentUserId || null,
                      serviceTypeId: sharedServiceTypeId || null,
                      loeHours: 0,
                    },
                  ]);
                },
              }, '+ Assignee'),
            ]),
            h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 p-4 space-y-3' }, [
              h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Service Type + LOE'),
              h('div', { className: 'grid gap-3 md:grid-cols-2' }, [
                h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
                  h('span', null, 'Service Type'),
                  h('select', {
                    value: sharedServiceTypeId,
                    onClick: (event) => event.stopPropagation(),
                    onChange: (event) => {
                      const nextValue = event.target.value || null;
                      updateAllocations(task, (list) => list.map((allocation) => ({ ...allocation, serviceTypeId: nextValue })));
                    },
                    className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm',
                  }, [
                    h('option', { value: '' }, 'Select service type'),
                    ...serviceTypes.map((type) => h('option', { key: type.id, value: type.id }, type.name)),
                  ]),
                ]),
                h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
                  h('span', null, 'LOE (hours)'),
                  h('input', {
                    type: 'number',
                    min: 0,
                    step: 0.25,
                    value: totalLoe || '',
                    onClick: (event) => event.stopPropagation(),
                    onChange: (event) => {
                      const raw = event.target.value;
                      const nextValue = raw === '' ? 0 : Number(raw);
                      updateAllocations(task, (list) => redistributeHours(list, Number.isFinite(nextValue) ? nextValue : 0));
                    },
                    className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm',
                  }),
                ]),
              ]),
            ]),
            h('div', { className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/40 p-4 space-y-3' }, [
              h('div', { className: 'text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400' }, 'Context'),
              h('div', { className: 'inline-flex rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-1 self-start' }, [
                ['client', 'Client'],
                ['internal', 'Internal'],
              ].map(([value, label]) => h('button', {
                key: value,
                type: 'button',
                className: `px-3 py-1 rounded-full text-sm font-semibold ${context.type === value ? 'bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-white/10' : 'text-slate-600 dark:text-white/70'}`,
                onClick: (event) => {
                  event.stopPropagation();
                  onTaskUpdate?.(task.id, {
                    context: value === 'internal'
                      ? { type: 'internal', companyId: null, personId: null }
                      : {
                        type: 'client',
                        companyId: context.companyId || companies[0]?.id || null,
                        personId: context.personId,
                      },
                  });
                },
              }, label))),
              context.type === 'client'
                ? h('div', { className: 'grid gap-3 md:grid-cols-2' }, [
                  h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
                    h('span', null, 'Company'),
                    h('select', {
                      value: context.companyId || '',
                      onClick: (event) => event.stopPropagation(),
                      onChange: (event) => {
                        const companyId = event.target.value || null;
                        onTaskUpdate?.(task.id, {
                          context: {
                            type: 'client',
                            companyId,
                            personId: companyId ? context.personId : null,
                          },
                        });
                      },
                      className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm',
                    }, [
                      h('option', { value: '' }, 'Select company'),
                      ...companies.map((company) => h('option', { key: company.id, value: company.id }, company.name || 'Company')),
                    ]),
                  ]),
                  h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
                    h('span', null, 'Person'),
                    h('select', {
                      value: context.personId || '',
                      onClick: (event) => event.stopPropagation(),
                      onChange: (event) => {
                        onTaskUpdate?.(task.id, {
                          context: {
                            type: 'client',
                            companyId: context.companyId,
                            personId: event.target.value || null,
                          },
                        });
                      },
                      className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm',
                    }, [
                      h('option', { value: '' }, 'Optional person'),
                      ...personChoices.map((person) => h('option', { key: person.id, value: person.id }, person.name || 'Person')),
                    ]),
                  ]),
                ])
                : null,
            ]),
            h('div', { className: 'flex flex-wrap items-center justify-between gap-3 pt-1' }, [
              h('div', { className: 'flex flex-wrap items-center gap-2' }, [
                h('button', {
                  type: 'button',
                  className: 'px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
                  onClick: (event) => {
                    event.stopPropagation();
                    onTaskStatusChange?.(task.id, task.status === 'completed' ? 'backlog' : 'completed', task.status);
                  },
                }, task.status === 'completed' ? 'Reopen' : 'Mark Completed'),
                task.status === 'completed'
                  ? h('button', {
                    type: 'button',
                    className: 'px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
                    onClick: (event) => {
                      event.stopPropagation();
                      onTaskArchive?.(task.id);
                    },
                  }, 'Archive')
                  : null,
              ]),
              h('button', {
                type: 'button',
                className: 'px-3 py-2 rounded-md border border-red-200 text-xs text-red-600 hover:bg-red-50',
                onClick: (event) => {
                  event.stopPropagation();
                  onTaskDelete?.(task.id);
                },
              }, 'Delete'),
            ]),
          ]);

          return h(TaskSystemRow, {
            key: task.id,
            taskId: task.id,
            expanded: taskExpanded,
            onToggle: toggleTaskExpanded,
            colSpan: 7,
            rowClassName: [
              'border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer',
              taskHighlighted ? 'bg-netnet-purple/5 dark:bg-netnet-purple/10' : '',
            ].join(' ').trim(),
            expandedRowClassName: taskHighlighted ? 'bg-netnet-purple/5 dark:bg-netnet-purple/10' : 'bg-white dark:bg-slate-900/60',
            expandedContent,
            cells: [
              h('td', { key: 'title', className: 'px-6 py-3 align-top min-w-[240px]' }, [
                h('div', { className: 'space-y-1' }, [
                  h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-gray-100' }, task.title || 'Untitled task'),
                  h('div', { className: 'text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide' }, task.status === 'completed' ? 'Completed' : task.status === 'backlog' ? 'Backlog' : 'In Progress'),
                ]),
              ]),
              h('td', { key: 'context', className: 'px-6 py-3 align-top min-w-[180px]' }, [
                h('div', { className: 'flex flex-col' }, [
                  h('span', {
                    className: summary.primary === 'Internal'
                      ? 'inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/60 dark:text-slate-100 dark:border-white/10'
                      : 'text-sm font-medium text-slate-900 dark:text-slate-100',
                  }, summary.primary),
                  summary.secondary ? h('span', { className: 'text-xs text-slate-500 dark:text-slate-400' }, summary.secondary) : null,
                ]),
              ]),
              h('td', { key: 'service', className: 'px-6 py-3 text-sm text-gray-600 dark:text-gray-400 min-w-[160px]' }, serviceTypeLabel(task, serviceTypeMap)),
              h('td', { key: 'due', className: 'px-6 py-3 text-sm min-w-[100px]' }, [
                h('span', {
                  className: due.tone === 'danger'
                    ? 'text-rose-600 dark:text-rose-300'
                    : due.tone === 'warn'
                      ? 'text-amber-600 dark:text-amber-300'
                      : 'text-gray-600 dark:text-gray-400',
                }, due.label),
              ]),
              h('td', { key: 'meter', className: 'px-6 py-3 min-w-[180px]' }, renderMeter(task)),
              h('td', { key: 'assignees', className: 'px-6 py-3 align-top min-w-[160px]' }, [
                assigneeBadges.length
                  ? h('div', { className: 'flex -space-x-1 items-center' }, assigneeBadges.slice(0, 4).map((member) => h('span', {
                    key: `${task.id}-${member.id}`,
                    className: 'h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center border border-white dark:border-slate-900',
                    title: member.name || member.email || 'Assignee',
                  }, getInitials(member.name || member.email))))
                  : h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, 'Unassigned'),
              ]),
            ],
          });
        })),
      ]),
    ]),
  ]);
}

export function getQuickTaskPrimaryAssignee(task, members = []) {
  const assigneeId = getTaskAssigneeIds(task)[0] || '';
  return getMemberById(assigneeId, members);
}

export function getQuickTaskPrimaryServiceType(task, serviceTypes = []) {
  const serviceTypeId = getTaskServiceTypeIds(task)[0] || '';
  return getServiceTypeById(serviceTypeId, serviceTypes);
}
