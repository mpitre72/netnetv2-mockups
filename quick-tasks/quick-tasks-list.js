import { TaskStyleRichTextField } from '../jobs/task-style-rich-text-field.js';
import { TaskSystemRow } from '../components/tasks/task-system-row.js';
import { RowActionsMenu } from '../components/performance/primitives.js';
import { TASK_STATUS_OPTIONS } from '../jobs/task-execution-utils.js';
import {
  canDeleteTask,
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
import { openSingleDatePickerPopover } from './quick-task-detail.js';
import { openTaskReassignDrawer } from '../components/tasks/task-reassign-drawer.js';

const { createElement: h, useEffect, useMemo, useState } = React;

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
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

function getStatusLabel(status) {
  const match = TASK_STATUS_OPTIONS.find((option) => option.value === status);
  return match ? match.label : 'Backlog';
}

function getStatusToneClass(status) {
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200';
  }
  if (status === 'in_progress') {
    return 'bg-netnet-purple/15 text-netnet-purple dark:bg-netnet-purple/20 dark:text-netnet-purple';
  }
  if (status === 'archived') {
    return 'bg-slate-200 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
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
  return serviceTypeMap.get(String(ids[0]))?.name || 'Service';
}

function clientSummary(task, companyMap, personMap) {
  const context = getTaskContext(task);
  if (context.type === 'internal') {
    return { primary: 'Internal', secondary: '' };
  }
  const company = context.companyId ? companyMap.get(String(context.companyId)) : null;
  const person = context.personId ? personMap.get(String(context.personId)) : null;
  if (!company && person) {
    return {
      primary: person.name || 'Client',
      secondary: '',
    };
  }
  return {
    primary: company?.name || 'Client',
    secondary: person?.name || '',
  };
}

function renderMeter(task) {
  const dueTiming = getDueTiming(task);
  const dueToneClass = dueTiming.tone === 'danger'
    ? 'text-rose-600 dark:text-rose-400'
    : dueTiming.tone === 'warn'
      ? 'text-amber-500 dark:text-amber-300'
      : dueTiming.tone === 'muted'
        ? 'text-slate-400 dark:text-slate-500'
        : 'text-slate-600 dark:text-slate-300';
  const meterHtml = renderMiniMeters({
    loeHours: getTaskTotalLoe(task),
    dueDate: task.dueDate || null,
  }, getTaskActualHours(task)).replace(
    /<div class="text-\[11px\] text-slate-600 dark:text-slate-300">Due .*?<\/div>/,
    `<div class="text-[11px] ${dueToneClass}">${dueTiming.label}</div>`,
  );
  return h('div', {
    className: 'min-w-[160px]',
    dangerouslySetInnerHTML: {
      __html: meterHtml,
    },
  });
}

function renderCell(content, className = '') {
  return h('td', { className: `px-3 py-4 align-top ${className}`.trim() }, content);
}

function stopRowToggle(event) {
  event.stopPropagation();
}

export function InlineTaskStatusControl({
  taskId = null,
  status = 'backlog',
  editing = false,
  onStartEdit,
  onCommit,
  onCancel,
  onStopPropagation = stopRowToggle,
}) {
  const statusLabel = getStatusLabel(status);
  if (editing) {
    return h('select', {
      value: status || 'backlog',
      autoFocus: true,
      onClick: onStopPropagation,
      onMouseDown: onStopPropagation,
      onChange: (event) => onCommit?.(event.target.value || 'backlog'),
      onBlur: () => onCancel?.(),
      onKeyDown: (event) => {
        onStopPropagation(event);
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel?.();
        }
      },
      className: 'h-7 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200',
    }, TASK_STATUS_OPTIONS.map((option) => (
      h('option', { key: option.value, value: option.value }, option.label)
    )));
  }
  return h('button', {
    type: 'button',
    className: 'inline-flex items-center',
    onClick: (event) => {
      onStopPropagation(event);
      onStartEdit?.(taskId);
    },
    onMouseDown: onStopPropagation,
    'aria-label': 'Edit task status',
  }, [
    h('span', { className: `rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusToneClass(status)}` }, statusLabel),
  ]);
}

function formatPickerButtonLabel(value) {
  if (!value) return 'Select date';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Select date';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function createDraft(members = [], serviceTypes = [], companies = []) {
  const currentUserId = getCurrentUserId(members) || '';
  const defaultServiceTypeId = serviceTypes[0]?.id || '';
  const defaultCompany = Array.isArray(companies) && companies.length ? companies[0] : null;
  return {
    title: '',
    description: '',
    dueDate: '',
    contextType: 'client',
    companyId: defaultCompany?.id || '',
    personId: '',
    allocations: [{
      id: createId('alloc'),
      assigneeUserId: currentUserId,
      serviceTypeId: defaultServiceTypeId,
      loeHours: 0,
    }],
  };
}

function validateDraft(draft) {
  const allocation = Array.isArray(draft?.allocations) ? draft.allocations[0] || {} : {};
  const errors = {
    title: String(draft?.title || '').trim() ? '' : 'Title is required.',
    serviceTypeId: allocation?.serviceTypeId ? '' : 'Service Type is required.',
    loeHours: Number(allocation?.loeHours) > 0 ? '' : 'LOE must be greater than 0.',
    dueDate: draft?.dueDate ? '' : 'Due date is required.',
    assignee: allocation?.assigneeUserId ? '' : 'Assignee is required.',
    companyId: draft?.contextType === 'client' && !draft?.companyId ? 'Company is required for Client tasks.' : '',
  };
  const ready = Object.values(errors).every((message) => !message);
  return { ready, errors };
}

export function QuickTasksExecutionTable({
  tasks = [],
  members = [],
  serviceTypes = [],
  statusFilter = 'all',
  stickyOffsetPx = 0,
  stickyHeader = true,
  highlightTaskId = null,
  autoExpandTaskId = null,
  createIntentId = 0,
  onCreateTask,
  onTaskUpdate,
  onTaskDelete,
  onTaskArchive,
  onTaskStatusChange,
  customColumns = null,
  customRows = null,
  customEmptyMessage = '',
}) {
  const companies = useMemo(() => getContactsData(), []);
  const individuals = useMemo(() => getIndividualsData(), []);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [descriptionEditor, setDescriptionEditor] = useState(null);
  const [titleEditor, setTitleEditor] = useState(null);
  const [statusEditorTaskId, setStatusEditorTaskId] = useState(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draft, setDraft] = useState(() => createDraft(members, serviceTypes, companies));
  const [showDraftErrors, setShowDraftErrors] = useState(false);
  const companyMap = useMemo(() => companyMapFrom(companies), [companies]);
  const personMap = useMemo(() => personMapFrom(companies, individuals), [companies, individuals]);
  const memberMap = useMemo(() => new Map(members.map((member) => [String(member.id), member])), [members]);
  const serviceTypeMap = useMemo(() => new Map(serviceTypes.map((type) => [String(type.id), type])), [serviceTypes]);

  useEffect(() => {
    if (!autoExpandTaskId) return;
    setExpandedTaskId(String(autoExpandTaskId));
  }, [autoExpandTaskId]);

  useEffect(() => {
    if (!createIntentId) return;
    setDraftOpen(true);
    setShowDraftErrors(false);
    setDraft(createDraft(members, serviceTypes, companies));
  }, [createIntentId, members, serviceTypes, companies]);

  const toggleTaskExpanded = (taskId) => {
    setExpandedTaskId((current) => (String(current) === String(taskId) ? null : String(taskId)));
  };

  const saveTitle = (task, value) => {
    const nextTitle = String(value || '').trim();
    if (!nextTitle) {
      setTitleEditor(null);
      return;
    }
    onTaskUpdate?.(task.id, { title: nextTitle });
    setTitleEditor(null);
  };

  const saveDescription = (task, value) => {
    onTaskUpdate?.(task.id, { description: String(value || '') });
    setDescriptionEditor(null);
  };

  const saveStatus = (task, nextStatus) => {
    if (!nextStatus || nextStatus === task.status) {
      setStatusEditorTaskId(null);
      return;
    }
    onTaskStatusChange?.(task.id, nextStatus, task.status);
    setStatusEditorTaskId(null);
  };

  const updateAllocations = (task, updater) => {
    const current = getTaskAllocations(task);
    const next = typeof updater === 'function' ? updater(current) : current;
    onTaskUpdate?.(task.id, { allocations: next });
  };

  const updateDraftField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateDraftAllocation = (patch) => {
    setDraft((current) => {
      const base = Array.isArray(current.allocations) && current.allocations.length
        ? current.allocations
        : createDraft(members, serviceTypes, companies).allocations;
      return {
        ...current,
        allocations: [{ ...base[0], ...(patch || {}) }],
      };
    });
  };

  const openDraft = () => {
    setDraftOpen(true);
    setShowDraftErrors(false);
    setDraft((current) => (draftOpen ? current : createDraft(members, serviceTypes, companies)));
  };

  const closeDraft = () => {
    setDraftOpen(false);
    setShowDraftErrors(false);
    setDraft(createDraft(members, serviceTypes, companies));
  };

  const draftValidation = validateDraft(draft);
  const draftAllocation = Array.isArray(draft.allocations) ? draft.allocations[0] || {} : {};
  const draftContextIsClient = draft.contextType === 'client';
  const draftCompany = draft.companyId ? companyMap.get(String(draft.companyId)) : null;
  const draftPeople = draftCompany?.people || (!draft.companyId ? individuals : []);

  const handleCreateTask = () => {
    setShowDraftErrors(true);
    if (!draftValidation.ready) return;
    const payload = {
      title: String(draft.title || '').trim(),
      description: String(draft.description || '').trim(),
      status: 'in_progress',
      dueDate: draft.dueDate || null,
      context: draftContextIsClient
        ? {
          type: 'client',
          companyId: draft.companyId || null,
          personId: draft.personId || null,
        }
        : {
          type: 'internal',
          companyId: null,
          personId: null,
        },
      allocations: [{
        id: createId('alloc'),
        assigneeUserId: draftAllocation.assigneeUserId || null,
        serviceTypeId: draftAllocation.serviceTypeId || null,
        loeHours: quarterRound(draftAllocation.loeHours || 0),
      }],
    };
    const created = typeof onCreateTask === 'function' ? onCreateTask(payload) : null;
    closeDraft();
    if (created?.id) {
      setExpandedTaskId(String(created.id));
    }
  };

  const openExpandedTask = (taskId) => {
    setExpandedTaskId(String(taskId));
  };

  const renderExpandedContent = (task) => {
    const allocationList = getTaskAllocations(task);
    const descriptionValue = descriptionEditor?.taskId === task.id
      ? (descriptionEditor.value ?? '')
      : String(task.description || '');
    const sharedServiceTypeId = getTaskServiceTypeIds(task)[0] || '';
    const totalLoe = getTaskTotalLoe(task);
    const context = getTaskContext(task);
    const primaryAllocation = allocationList[0] || {
      id: createId('alloc'),
      assigneeUserId: getCurrentUserId(members) || null,
      serviceTypeId: sharedServiceTypeId || null,
      loeHours: totalLoe || 0,
    };
    const personChoices = context.companyId
      ? (companyMap.get(String(context.companyId))?.people || [])
      : individuals;
    const savePrimaryAllocation = (patch = {}) => {
      onTaskUpdate?.(task.id, {
        allocations: [{
          ...primaryAllocation,
          loeHours: patch.loeHours !== undefined ? patch.loeHours : totalLoe,
          ...patch,
        }],
      });
    };

    return h('div', { className: 'rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-4' }, [
      h(TaskStyleRichTextField, {
        label: 'Description',
        value: descriptionValue,
        rows: 4,
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
      h('div', { className: 'space-y-2' }, [
        h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Context'),
        h('div', { className: 'flex flex-wrap items-center gap-3' }, [
          h('div', { className: 'inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-1 self-start' }, [
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
            ? h(React.Fragment, null, [
              h('label', { className: 'flex min-w-[220px] flex-1 flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
                h('span', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Company'),
                h('select', {
                  value: context.companyId || '',
                  onClick: stopRowToggle,
                  onMouseDown: stopRowToggle,
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
              h('label', { className: 'flex min-w-[220px] flex-1 flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
                h('span', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Person'),
                h('select', {
                  value: context.personId || '',
                  onClick: stopRowToggle,
                  onMouseDown: stopRowToggle,
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
      ]),
      h('div', { className: 'grid gap-3 xl:grid-cols-3' }, [
        h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
          h('span', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Assignee'),
          h('select', {
            value: primaryAllocation.assigneeUserId ? String(primaryAllocation.assigneeUserId) : '',
            onClick: stopRowToggle,
            onMouseDown: stopRowToggle,
            onChange: (event) => savePrimaryAllocation({ assigneeUserId: event.target.value || null }),
            className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
          }, [
            h('option', { value: '' }, 'Unassigned'),
            ...members.map((member) => h('option', { key: member.id, value: member.id }, member.name || member.email || 'Member')),
          ]),
        ]),
        h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
          h('span', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Service Type'),
          h('select', {
            value: primaryAllocation.serviceTypeId ? String(primaryAllocation.serviceTypeId) : sharedServiceTypeId,
            onClick: stopRowToggle,
            onMouseDown: stopRowToggle,
            onChange: (event) => {
              const nextValue = event.target.value || null;
              savePrimaryAllocation({ serviceTypeId: nextValue });
            },
            className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm',
          }, [
            h('option', { value: '' }, 'Select service type'),
            ...serviceTypes.map((type) => h('option', { key: type.id, value: type.id }, type.name)),
          ]),
        ]),
        h('label', { className: 'flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200' }, [
          h('span', { className: 'text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'LOE (hours)'),
          h('input', {
            type: 'number',
            min: 0,
            step: 0.25,
            value: totalLoe || '',
            onClick: stopRowToggle,
            onMouseDown: stopRowToggle,
            onChange: (event) => {
              const raw = event.target.value;
              const nextValue = raw === '' ? 0 : Number(raw);
              savePrimaryAllocation({ loeHours: quarterRound(Number.isFinite(nextValue) ? nextValue : 0) });
            },
            className: 'h-10 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm',
          }),
        ]),
      ]),
    ]);
  };

  const rows = [];
  const useCustomRows = Array.isArray(customRows);

  if (!useCustomRows) {
    tasks.forEach((task) => {
      const taskExpanded = String(expandedTaskId || '') === String(task.id);
      const taskHighlighted = highlightTaskId && String(highlightTaskId) === String(task.id);
      const due = formatDueLabel(task);
      const summary = clientSummary(task, companyMap, personMap);
      const primaryAssigneeId = getTaskAllocations(task)[0]?.assigneeUserId || '';
      const primaryAssignee = primaryAssigneeId ? memberMap.get(String(primaryAssigneeId)) : null;
      const hasLoggedTime = (Array.isArray(task.timeEntries) && task.timeEntries.length > 0) || getTaskActualHours(task) > 0;
      const deleteDisabledReason = hasLoggedTime
        ? 'Cannot delete task with logged time'
        : (!canDeleteTask(task) ? 'Cannot delete this task' : '');
      const titleEditing = titleEditor?.taskId === task.id;
      const statusEditing = String(statusEditorTaskId || '') === String(task.id);
      const assigneeCellContent = primaryAssignee
        ? h('div', { className: 'flex items-center' }, [
          h('span', {
            key: `${task.id}-${primaryAssignee.id}`,
            className: 'h-7 w-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center border border-white dark:border-slate-900',
            title: primaryAssignee.name || primaryAssignee.email || 'Assignee',
          }, getInitials(primaryAssignee.name || primaryAssignee.email)),
        ])
        : h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, 'Unassigned');
      const actionsMenu = deleteDisabledReason
        ? h('button', {
          type: 'button',
          disabled: true,
          title: deleteDisabledReason,
          className: 'p-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-500 shadow-sm cursor-not-allowed inline-flex items-center justify-center',
        }, [
          h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
            h('circle', { cx: '12', cy: '5', r: '1.5' }),
            h('circle', { cx: '12', cy: '12', r: '1.5' }),
            h('circle', { cx: '12', cy: '19', r: '1.5' }),
          ]),
        ])
        : h(RowActionsMenu, {
          menuItems: ['Edit', 'Move Task', 'Archive Task', 'Delete'],
          onSelect: (item) => {
            if (item === 'Edit') openExpandedTask(task.id);
            if (item === 'Move Task') {
              openTaskReassignDrawer({
                task: {
                  ...task,
                  source: 'quick',
                  sourceId: task.id,
                },
              });
            }
            if (item === 'Archive Task') onTaskArchive?.(task.id);
            if (item === 'Delete') onTaskDelete?.(task.id);
          },
        });
      const actionsCellContent = h('div', {
        className: 'flex justify-end',
        onClick: stopRowToggle,
        onMouseDown: stopRowToggle,
        onKeyDown: stopRowToggle,
      }, [
        actionsMenu,
      ]);

      rows.push(
        h(TaskSystemRow, {
          key: task.id,
          taskId: task.id,
          expanded: taskExpanded,
          onToggle: toggleTaskExpanded,
          colSpan: 9,
          toggleCellClassName: 'px-3 py-3 align-middle w-[36px] text-sm text-gray-700 dark:text-gray-200',
          toggleButtonClassName: 'h-7 w-7 rounded-md border border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-50 flex items-center justify-center mx-auto',
          rowClassName: [
            'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer',
            taskHighlighted ? 'bg-netnet-purple/5 dark:bg-netnet-purple/10' : '',
          ].join(' ').trim(),
          expandedRowClassName: taskHighlighted ? 'bg-netnet-purple/5 dark:bg-netnet-purple/10' : 'bg-white dark:bg-slate-900/50',
          expandedCellClassName: 'px-5 pb-5 pt-1',
          expandedContent: renderExpandedContent(task),
          cells: [
            renderCell(h('div', { className: 'space-y-1 min-w-0' }, [
              titleEditing
                ? h('input', {
                  type: 'text',
                  value: titleEditor.value,
                  autoFocus: true,
                  onClick: stopRowToggle,
                  onMouseDown: stopRowToggle,
                  onChange: (event) => setTitleEditor({ taskId: task.id, value: event.target.value || '' }),
                  onBlur: () => saveTitle(task, titleEditor.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setTitleEditor(null);
                    }
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      saveTitle(task, titleEditor.value);
                    }
                  },
                  className: 'h-9 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-900 dark:text-slate-100',
                })
                : h('button', {
                  type: 'button',
                  className: 'block w-full text-left text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-netnet-purple dark:hover:text-netnet-purple',
                  onClick: (event) => {
                    stopRowToggle(event);
                    setTitleEditor({ taskId: task.id, value: task.title || '' });
                  },
                }, task.title || 'Untitled task'),
              h('div', { className: 'flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400' }, [
              h(InlineTaskStatusControl, {
                taskId: task.id,
                status: task.status || 'backlog',
                editing: statusEditing,
                onStartEdit: (nextTaskId) => setStatusEditorTaskId(nextTaskId),
                onCommit: (nextStatus) => saveStatus(task, nextStatus),
                onCancel: () => setStatusEditorTaskId(null),
                onStopPropagation: stopRowToggle,
              }),
            ]),
          ]), 'w-[22%] min-w-0'),
            renderCell(h('button', {
              type: 'button',
              className: 'block w-full truncate whitespace-nowrap overflow-hidden text-ellipsis text-left text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
              onClick: (event) => {
                stopRowToggle(event);
                openExpandedTask(task.id);
                setDescriptionEditor({ taskId: task.id, value: task.description || '' });
              },
            }, task.description || 'Add description'), 'w-[18%] min-w-0 max-w-[240px]'),
            renderCell(h('button', {
              type: 'button',
              className: 'block w-full text-left',
              onClick: (event) => {
                stopRowToggle(event);
                openExpandedTask(task.id);
              },
            }, h('div', { className: 'space-y-1 min-w-0 max-w-[200px]' }, [
              h('div', {
                className: summary.primary === 'Internal'
                  ? 'inline-flex max-w-full w-fit items-center rounded-full border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-700/60 dark:text-slate-100'
                  : 'text-sm font-medium text-slate-900 dark:text-slate-100 truncate',
              }, summary.primary),
              summary.secondary ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400 truncate' }, summary.secondary) : null,
            ])), 'w-[17%] min-w-0 max-w-[200px]'),
            renderCell(h('button', {
              type: 'button',
              className: 'block w-full text-left',
              title: primaryAssignee?.name || primaryAssignee?.email || 'Assignee',
              onClick: (event) => {
                stopRowToggle(event);
                openExpandedTask(task.id);
              },
            }, assigneeCellContent), 'w-[8%] min-w-[72px]'),
            renderCell(h('button', {
              type: 'button',
              className: 'block w-full truncate text-left text-sm text-slate-700 dark:text-slate-200 hover:text-netnet-purple dark:hover:text-netnet-purple',
              title: serviceTypeLabel(task, serviceTypeMap),
              onClick: (event) => {
                stopRowToggle(event);
                openExpandedTask(task.id);
              },
            }, serviceTypeLabel(task, serviceTypeMap)), 'w-[13%] min-w-0 max-w-[170px]'),
            renderCell(h('button', {
              type: 'button',
              className: due.tone === 'danger'
                ? 'text-sm text-rose-600 dark:text-rose-300 hover:text-rose-500'
                : 'text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
              onClick: (event) => {
                stopRowToggle(event);
                openSingleDatePickerPopover({
                  anchorEl: event.currentTarget,
                  value: task.dueDate || '',
                  onSelect: (next) => onTaskUpdate?.(task.id, { dueDate: next || null }),
                  onClear: () => onTaskUpdate?.(task.id, { dueDate: null }),
                });
              },
            }, due.label), 'w-[8%] min-w-[88px]'),
            renderCell(renderMeter(task), 'w-[14%] min-w-[160px]'),
            renderCell(actionsCellContent, 'w-[40px] min-w-[40px] text-right'),
          ],
        })
      );
    });

    if (!tasks.length && !draftOpen) {
      rows.push(h('tr', { key: 'empty-message' }, [
        h('td', { colSpan: 9, className: 'px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400' }, 'Create your first Quick Task'),
      ]));
    }

    if (draftOpen) {
      rows.push(h('tr', { key: 'draft-row', className: 'bg-netnet-purple/[0.04] dark:bg-netnet-purple/[0.08]' }, [
      h('td', { className: 'px-3 py-4 w-10 align-top text-slate-400' }, '•'),
      h('td', { className: 'px-3 py-4 min-w-0 align-top' }, [
        h('div', { className: 'space-y-2' }, [
          h('input', {
            type: 'text',
            value: draft.title,
            onChange: (event) => updateDraftField('title', event.target.value || ''),
            placeholder: 'Task title',
            className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
          }),
          showDraftErrors && draftValidation.errors.title
            ? h('div', { className: 'text-xs text-red-500' }, draftValidation.errors.title)
            : null,
        ]),
      ]),
      h('td', { className: 'px-3 py-4 min-w-0 align-top' }, [
        h('button', {
          type: 'button',
          className: 'w-full text-left text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300',
          onClick: openDraft,
        }, draft.description ? 'Description added' : 'Add description below'),
      ]),
      h('td', { className: 'px-3 py-4 min-w-0 align-top' }, [
        h('div', { className: 'space-y-2' }, [
          h('div', {
            className: draftContextIsClient
              ? 'text-sm font-medium text-slate-900 dark:text-slate-100'
              : 'inline-flex w-fit items-center rounded-full border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-700/60 dark:text-slate-100',
          }, draftContextIsClient ? (draft.companyId ? (companyMap.get(String(draft.companyId))?.name || 'Client') : 'Client') : 'Internal'),
          draftContextIsClient && draft.personId
            ? h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, personMap.get(String(draft.personId))?.name || '')
            : null,
        ]),
      ]),
      h('td', { className: 'px-3 py-4 min-w-0 align-top' }, [
        h('div', { className: 'space-y-2' }, [
          h('select', {
            value: draftAllocation.assigneeUserId ? String(draftAllocation.assigneeUserId) : '',
            onChange: (event) => updateDraftAllocation({ assigneeUserId: event.target.value || null }),
            className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
          }, [
            h('option', { value: '' }, 'Assignee'),
            ...members.map((member) => h('option', { key: member.id, value: member.id }, member.name || member.email || 'Member')),
          ]),
          showDraftErrors && draftValidation.errors.assignee
            ? h('div', { className: 'text-xs text-red-500' }, draftValidation.errors.assignee)
            : null,
        ]),
      ]),
      h('td', { className: 'px-3 py-4 min-w-0 align-top' }, [
        h('div', { className: 'space-y-2' }, [
          h('select', {
            value: draftAllocation.serviceTypeId ? String(draftAllocation.serviceTypeId) : '',
            onChange: (event) => updateDraftAllocation({ serviceTypeId: event.target.value || null }),
            className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
          }, [
            h('option', { value: '' }, 'Service type'),
            ...serviceTypes.map((type) => h('option', { key: type.id, value: type.id }, type.name)),
          ]),
          showDraftErrors && draftValidation.errors.serviceTypeId
            ? h('div', { className: 'text-xs text-red-500' }, draftValidation.errors.serviceTypeId)
            : null,
        ]),
      ]),
      h('td', { className: 'px-3 py-4 min-w-0 align-top' }, [
        h('div', { className: 'space-y-2' }, [
          h('button', {
            type: 'button',
            className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60',
            onClick: (event) => {
              openSingleDatePickerPopover({
                anchorEl: event.currentTarget,
                value: draft.dueDate || '',
                onSelect: (next) => updateDraftField('dueDate', next || ''),
                onClear: () => updateDraftField('dueDate', ''),
              });
            },
          }, formatPickerButtonLabel(draft.dueDate)),
          showDraftErrors && draftValidation.errors.dueDate
            ? h('div', { className: 'text-xs text-red-500' }, draftValidation.errors.dueDate)
            : null,
        ]),
      ]),
      h('td', { className: 'px-3 py-4 min-w-0 align-top' }, [
        h('div', { className: 'space-y-2' }, [
          h('input', {
            type: 'number',
            min: 0,
            step: 0.25,
            value: draftAllocation.loeHours ?? '',
            onChange: (event) => updateDraftAllocation({ loeHours: event.target.value === '' ? 0 : quarterRound(event.target.value) }),
            className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
          }),
          showDraftErrors && draftValidation.errors.loeHours
            ? h('div', { className: 'text-xs text-red-500' }, draftValidation.errors.loeHours)
            : null,
        ]),
      ]),
      h('td', { className: 'px-3 py-4 w-[40px] align-top' }, ''),
    ]));

      rows.push(h('tr', { key: 'draft-details-row', className: 'bg-netnet-purple/[0.04] dark:bg-netnet-purple/[0.08]' }, [
      h('td', { colSpan: 9, className: 'px-3 pb-5 pt-1' }, [
        h('div', { className: 'rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-5 space-y-4' }, [
          h('div', { className: 'space-y-2' }, [
            h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Context'),
            h('div', { className: 'flex flex-wrap items-center gap-3' }, [
              h('div', { className: 'inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 p-1 self-start' }, [
                ['client', 'Client'],
                ['internal', 'Internal'],
              ].map(([value, label]) => h('button', {
                key: value,
                type: 'button',
                className: `px-3 py-1 rounded-full text-sm font-semibold ${draft.contextType === value ? 'bg-white dark:bg-slate-700 shadow border border-slate-200 dark:border-white/10' : 'text-slate-600 dark:text-white/70'}`,
                onClick: () => updateDraftField('contextType', value),
              }, label))),
              draftContextIsClient
                ? h(React.Fragment, null, [
                  h('div', { className: 'flex min-w-[220px] flex-1 flex-col gap-1' }, [
                    h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Company'),
                    h('select', {
                      value: draft.companyId || '',
                      onChange: (event) => updateDraftField('companyId', event.target.value || ''),
                      className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
                    }, [
                      h('option', { value: '' }, 'Select company'),
                      ...companies.map((company) => h('option', { key: company.id, value: company.id }, company.name || 'Company')),
                    ]),
                    showDraftErrors && draftValidation.errors.companyId
                      ? h('div', { className: 'text-xs text-red-500' }, draftValidation.errors.companyId)
                      : null,
                  ]),
                  h('div', { className: 'flex min-w-[220px] flex-1 flex-col gap-1' }, [
                    h('div', { className: 'text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400' }, 'Person'),
                    h('select', {
                      value: draft.personId || '',
                      onChange: (event) => updateDraftField('personId', event.target.value || ''),
                      className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200',
                      disabled: !draft.companyId,
                    }, [
                      h('option', { value: '' }, draft.companyId ? 'Optional person' : 'Select company first'),
                      ...draftPeople.map((person) => h('option', { key: person.id, value: person.id }, person.name || 'Person')),
                    ]),
                  ]),
                ])
                : null,
            ]),
          ]),
          h(TaskStyleRichTextField, {
            label: 'Description',
            value: draft.description || '',
            rows: 4,
            onChange: (value) => updateDraftField('description', value),
            footerText: '',
          }),
          h('div', { className: 'flex items-center justify-end gap-2' }, [
            h('button', {
              type: 'button',
              className: 'inline-flex items-center justify-center h-10 px-4 rounded-md border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
              onClick: closeDraft,
            }, 'Cancel'),
            h('button', {
              type: 'button',
              className: `inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-semibold ${draftValidation.ready ? 'bg-netnet-purple text-white hover:brightness-110' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`,
              disabled: !draftValidation.ready,
              onClick: handleCreateTask,
            }, 'Create Quick Task'),
          ]),
        ]),
      ]),
      ]));
    } else {
      rows.push(h('tr', { key: 'add-task-row' }, [
        h('td', { colSpan: 9, className: 'px-3 py-4' }, [
          h('button', {
            type: 'button',
            className: 'text-sm font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
            onClick: openDraft,
          }, '+ Add Task'),
        ]),
      ]));
    }
  }

  const columns = Array.isArray(customColumns) && customColumns.length
    ? customColumns
    : [
      { key: 'toggle', label: '', className: 'px-3 py-3 w-10' },
      { key: 'task-name', label: 'Task Name', className: 'px-3 py-3 w-[22%]' },
      { key: 'description', label: 'Description', className: 'px-3 py-3 w-[18%]' },
      { key: 'context', label: 'Context', className: 'px-3 py-3 w-[17%]' },
      { key: 'assignee', label: 'Assignee', className: 'px-3 py-3 w-[8%]' },
      { key: 'service-type', label: 'Service Type', className: 'px-3 py-3 w-[13%]' },
      { key: 'due-date', label: 'Due Date', className: 'px-3 py-3 w-[8%]' },
      { key: 'loe', label: 'LOE / Timeline', className: 'px-3 py-3 w-[14%]' },
      { key: 'actions', label: '', className: 'px-3 py-3 w-[40px] text-right' },
    ];
  const renderedRows = useCustomRows
    ? (customRows.length
      ? customRows
      : [
        h('tr', { key: 'custom-empty-message' }, [
          h('td', {
            colSpan: columns.length,
            className: 'px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400',
          }, customEmptyMessage || 'No tasks'),
        ]),
      ])
    : rows;
  const headerStyle = stickyHeader
    ? {
      position: 'sticky',
      top: `${stickyOffsetPx || 0}px`,
      zIndex: 20,
    }
    : undefined;

  return h('div', { className: 'space-y-4' }, [
    h('section', { className: 'rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-900/70 shadow-sm' }, [
      h('table', { className: 'w-full table-fixed text-left border-collapse' }, [
          h('thead', {
            className: 'bg-slate-100 dark:bg-slate-900 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400',
            style: headerStyle,
          }, [
            h('tr', null, columns.map((column, index) => h('th', {
              key: column.key || `${column.label || 'column'}-${index}`,
              className: column.className || 'px-3 py-3',
            }, column.label || ''))),
          ]),
          h('tbody', { className: 'divide-y divide-slate-200/80 dark:divide-white/10' }, renderedRows),
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
