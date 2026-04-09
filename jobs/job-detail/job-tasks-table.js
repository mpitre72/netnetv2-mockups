import { DeliverableLOEMeters } from '../deliverable-loe-meters.js';
import { openSingleDatePickerPopover } from '../../quick-tasks/quick-task-detail.js';
import { renderMiniMeters } from '../../quick-tasks/quick-tasks-helpers.js';
import { JobKanbanTab } from './job-kanban-tab.js';
import { TaskStyleRichTextField } from '../task-style-rich-text-field.js';
import { loadDeliverableTypeOptions, rememberDeliverableType } from '../deliverable-type-store.js';
import { TaskSystemRow } from '../../components/tasks/task-system-row.js';
import { openTaskReassignDrawer } from '../../components/tasks/task-reassign-drawer.js';
import { RowActionsMenu } from '../../components/performance/primitives.js';
import { localDateISO, mergeTaskLifecycleFields, TASK_STATUS_OPTIONS } from '../task-execution-utils.js';
import {
  createRecurringInstanceFromTemplate,
  deriveRecurringDueDate,
  isRecurringTemplateTask,
} from '../retainer-cycle-utils.js';

const { createElement: h, useEffect, useMemo, useRef, useState } = React;

const COLUMN_ORDER = [
  'drag',
  'title',
  'description',
  'chat',
  'assignees',
  'service',
  'due',
  'meter',
  'actions',
];

const EDITABLE_FIELDS = ['title', 'status', 'dueDate', 'recurring'];
const STATUS_OPTIONS = TASK_STATUS_OPTIONS;
const DELIVERABLE_STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];
const HEALTH_STATUS_LABELS = {
  over: 'Drifting',
  tight: 'Tight',
  ok: 'On track',
  muted: 'On track',
};
const CONFIDENCE_OPTIONS = [
  { value: 'not_set', label: 'Not set' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const DEMO_CHAT_STATES = {
  'UX + Visual Design': { totalMessages: 0, hasUnreadMessages: false, mentionCount: 0 },
  'Frontend Build': { totalMessages: 6, hasUnreadMessages: false, mentionCount: 0 },
  'E-commerce': { totalMessages: 4, hasUnreadMessages: true, mentionCount: 0 },
  'General Job Tasks': { totalMessages: 3, hasUnreadMessages: true, mentionCount: 2 },
};
function renderHeaderChatIndicator({ hasChats, hasNewChats, mentionCount }) {
  const badgeValue = mentionCount > 9 ? '9+' : mentionCount || '';
  const toneClass = hasChats ? 'text-white' : 'text-slate-500';
  return React.createElement('span', { className: `relative inline-flex items-center ${toneClass}` }, [
    React.createElement('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
      React.createElement('path', { d: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }),
    ]),
    mentionCount > 0
      ? React.createElement('span', { className: 'absolute -top-1 -right-2 min-w-[16px] h-4 rounded-full bg-[#5FCEA8] text-[10px] font-semibold text-slate-900 px-1 flex items-center justify-center shadow' }, badgeValue)
      : hasNewChats
        ? React.createElement('span', { className: 'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-white shadow' })
        : null,
  ]);
}

function DeliverableIndicatorBox({
  label,
  valueNode,
  revealText,
  boxProps = {},
}) {
  return React.createElement('div', { className: 'w-[152px] h-[64px]', ...boxProps }, [
    React.createElement('div', { className: 'h-full rounded-lg border border-slate-200/50 dark:border-white/10 bg-white/5 dark:bg-slate-900/40 px-3 py-2 text-left flex flex-col justify-between' }, [
      React.createElement('div', { className: 'text-[9px] uppercase tracking-wide text-slate-400' }, label),
      React.createElement('div', { className: 'min-w-0' }, valueNode),
      React.createElement('div', {
        className: 'text-[10px] leading-[12px] h-[12px] text-slate-400/80 opacity-0 group-hover/kpi:opacity-60 transition-opacity whitespace-nowrap',
      }, revealText || ''),
    ]),
  ]);
}

function DeliverableHeaderRow({
  groupId,
  groupName,
  isExpanded,
  isMuted,
  deliverableStatus,
  deliverableDueDate,
  deliverableOverdue,
  healthStatus,
  healthRatio,
  healthTimelineRatio,
  hasChats,
  hasNewChats,
  mentionCount,
  showPools,
  pools,
  serviceTypes,
  confidenceValue,
  onConfidenceChange,
  confidenceMenuOpen,
  onToggleConfidenceMenu,
  statusMenuOpen,
  onToggleStatusMenu,
  onStatusChange,
  onOpenDuePicker,
  onToggle,
  onOpenChat,
  collapsedMeta,
  expandedDetail,
}) {
  const chevronRotation = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
  const healthColor = healthStatus === 'over'
    ? 'bg-rose-500'
    : healthStatus === 'tight'
      ? 'bg-amber-500'
      : 'bg-emerald-500';
  const healthBarHeight = 'h-4';
  const rowClass = `${isMuted ? 'bg-[#1F194C]' : 'bg-[#1F2937]'} border-b border-slate-900/60`;
  const cellPadding = 'px-6 py-4';
  const statusLabel = HEALTH_STATUS_LABELS[healthStatus] || 'On track';
  const effortPercent = Math.round(clamp(healthRatio, 0, 1.2) * 100);
  const timePercent = Math.round(clamp(healthTimelineRatio || 0, 0, 1.2) * 100);
  const healthRolloverLine = `${statusLabel} \u00b7 E${effortPercent}% \u00b7 T${timePercent}%`;
  const confidenceLabel = CONFIDENCE_OPTIONS.find((option) => option.value === confidenceValue)?.label || 'Not set';
  const confidenceRolloverLine = 'Manual forecast';
  const deliverableStatusLabel = DELIVERABLE_STATUS_OPTIONS.find((option) => option.value === deliverableStatus)?.label || 'Backlog';
  const dueDateLabel = formatShortDate(deliverableDueDate);

  return React.createElement('tr', { className: rowClass }, [
    React.createElement('td', { colSpan: COLUMN_ORDER.length, className: cellPadding }, [
      React.createElement('div', { className: isExpanded ? 'space-y-3' : '' }, [
        React.createElement('div', { className: 'grid grid-cols-[1fr_auto] items-center gap-4' }, [
          React.createElement('div', { className: 'flex items-center gap-3' }, [
            React.createElement('button', {
              type: 'button',
              className: 'h-8 w-8 flex items-center justify-center rounded-full border border-slate-200/70 text-slate-200',
              onClick: (event) => {
                event.stopPropagation();
                onToggle?.();
              },
              'aria-label': isExpanded ? 'Collapse deliverable' : 'Expand deliverable',
            }, React.createElement('svg', { className: 'h-4 w-4 transition-transform', style: { transform: chevronRotation }, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' }, [
              React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: '2', d: 'M19 9l-7 7-7-7' }),
            ])),
            React.createElement('div', { className: 'min-w-0' }, [
              React.createElement('div', { className: `truncate text-sm font-semibold ${isMuted ? 'text-slate-300' : 'text-white'}` }, groupName),
              !isExpanded && collapsedMeta
                ? React.createElement('div', { className: 'mt-1 truncate text-[11px] font-medium text-slate-400' }, collapsedMeta)
                : null,
            ]),
          ]),
          React.createElement('div', { className: 'justify-self-end flex items-stretch gap-3 pb-2' }, [
            React.createElement('div', { className: 'flex items-stretch gap-3 group/kpi' }, [
              DeliverableIndicatorBox({
                label: 'Status',
                revealText: `Status: ${deliverableStatusLabel}`,
                valueNode: React.createElement('div', { className: 'relative w-full' }, [
                  React.createElement('button', {
                    type: 'button',
                    className: 'text-[12px] font-semibold text-slate-200 whitespace-nowrap text-left w-full',
                    onClick: (event) => {
                      event.stopPropagation();
                      onToggleStatusMenu?.();
                    },
                    onMouseDown: (event) => event.stopPropagation(),
                    'data-deliverable-status-trigger': groupId,
                    'aria-haspopup': 'menu',
                    'aria-expanded': statusMenuOpen ? 'true' : 'false',
                  }, deliverableStatusLabel),
                  statusMenuOpen
                    ? React.createElement('div', {
                      className: 'contacts-action-menu',
                      'data-deliverable-status-menu': groupId,
                    }, DELIVERABLE_STATUS_OPTIONS.map((option) => (
                      React.createElement('button', {
                        key: option.value,
                        type: 'button',
                        onClick: (event) => {
                          event.stopPropagation();
                          onStatusChange?.(option.value);
                        },
                      }, option.label)
                    )))
                    : null,
                ]),
              }),
              DeliverableIndicatorBox({
                label: 'Due',
                revealText: deliverableDueDate
                  ? `${deliverableOverdue ? 'Overdue' : 'Due'} ${dueDateLabel}`
                  : 'No due date',
                valueNode: React.createElement('button', {
                  type: 'button',
                  className: `text-[12px] font-semibold whitespace-nowrap text-left w-full ${deliverableOverdue ? 'text-rose-400' : 'text-slate-200'}`,
                  onClick: (event) => {
                    event.stopPropagation();
                    onOpenDuePicker?.(event.currentTarget, groupId, deliverableDueDate);
                  },
                  onMouseDown: (event) => event.stopPropagation(),
                  'aria-label': 'Edit due date',
                }, dueDateLabel),
              }),
              DeliverableIndicatorBox({
                label: 'Health',
                revealText: healthRolloverLine,
                valueNode: React.createElement('div', {
                  className: `${healthBarHeight} w-full rounded-full border border-slate-200/70 dark:border-white/10 bg-slate-100 dark:bg-white/10 shadow-inner overflow-hidden`,
                }, [
                  React.createElement('div', {
                    className: `${healthColor} h-full`,
                    style: { width: `${clamp(healthRatio * 100, 0, 100)}%` },
                  }),
                ]),
              }),
              DeliverableIndicatorBox({
                label: 'Confidence',
                revealText: confidenceRolloverLine,
                boxProps: {
                  onClick: (event) => event.stopPropagation(),
                  onMouseDown: (event) => event.stopPropagation(),
                },
                valueNode: React.createElement('div', { className: 'relative w-full flex items-center' }, [
                  React.createElement('button', {
                    type: 'button',
                    className: 'inline-flex w-full items-center justify-between gap-2 text-[12px] font-semibold text-slate-200 leading-none',
                    onClick: (event) => {
                      event.stopPropagation();
                      onToggleConfidenceMenu?.();
                    },
                    onMouseDown: (event) => event.stopPropagation(),
                    'data-confidence-trigger': groupId,
                    'aria-haspopup': 'menu',
                    'aria-expanded': confidenceMenuOpen ? 'true' : 'false',
                  }, [
                    React.createElement('span', { className: 'truncate' }, confidenceLabel),
                    React.createElement('svg', { className: 'h-3 w-3 text-slate-400', viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: '2' }, [
                      React.createElement('path', { d: 'M6 8l4 4 4-4', strokeLinecap: 'round', strokeLinejoin: 'round' }),
                    ]),
                  ]),
                  confidenceMenuOpen
                    ? React.createElement('div', {
                      className: 'contacts-action-menu',
                      'data-confidence-menu': groupId,
                    }, CONFIDENCE_OPTIONS.map((option) => (
                      React.createElement('button', {
                        key: option.value,
                        type: 'button',
                        onClick: (event) => {
                          event.stopPropagation();
                          onConfidenceChange?.(option.value);
                        },
                      }, option.label)
                    )))
                    : null,
                ]),
              }),
            ]),
            React.createElement('button', {
              type: 'button',
              className: 'inline-flex items-center',
              onClick: (event) => {
                if (!onOpenChat || isMuted) return;
                event.stopPropagation();
                onOpenChat({ type: 'deliverable', deliverableId: groupId });
              },
              disabled: !onOpenChat || isMuted,
              'aria-label': 'Open deliverable chat',
            }, renderHeaderChatIndicator({
              hasChats,
              hasNewChats,
              mentionCount,
            })),
          ]),
        ]),
        showPools
          ? React.createElement('div', { className: 'group relative rounded-xl border border-slate-200/10 dark:border-white/10 bg-slate-900/40 p-3' }, [
            React.createElement('div', {
              className: 'absolute left-3 top-2 text-[10px] tracking-wide text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
            }, 'Available Services'),
            React.createElement(DeliverableLOEMeters, {
              deliverableId: groupId,
              pools,
              serviceTypes,
              className: 'mt-1',
            }),
          ])
          : null,
        isExpanded && expandedDetail ? expandedDetail : null,
      ]),
    ]),
  ]);
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyDraftRow() {
  return {
    title: '',
    description: '',
    status: 'in_progress',
    dueDate: '',
    assigneeUserId: '',
    serviceTypeId: '',
    loeHours: '',
    isRecurring: false,
    allocations: [],
  };
}

function createEmptyDraftAllocation() {
  return {
    id: createId('draft_alloc'),
    assigneeUserId: '',
    serviceTypeId: '',
    loeHours: '',
    actualHours: null,
  };
}

function getDraftAllocations(draft) {
  if (Array.isArray(draft?.allocations) && draft.allocations.length) {
    return draft.allocations.map((allocation) => ({
      id: allocation?.id || createId('draft_alloc'),
      assigneeUserId: allocation?.assigneeUserId || '',
      serviceTypeId: allocation?.serviceTypeId || '',
      loeHours: allocation?.loeHours ?? '',
      actualHours: allocation?.actualHours ?? null,
    }));
  }
  if (draft?.assigneeUserId || draft?.serviceTypeId || String(draft?.loeHours || '').trim().length > 0) {
    return [{
      id: createId('draft_alloc'),
      assigneeUserId: draft.assigneeUserId || '',
      serviceTypeId: draft.serviceTypeId || '',
      loeHours: draft.loeHours ?? '',
      actualHours: null,
    }];
  }
  return [];
}

function syncDraftAllocationFields(draft, allocations) {
  const primary = allocations[0] || null;
  return {
    ...draft,
    allocations,
    assigneeUserId: primary?.assigneeUserId || '',
    serviceTypeId: primary?.serviceTypeId || '',
    loeHours: primary?.loeHours ?? '',
  };
}

function confidenceStorageKey(jobId) {
  return `netnet_job_confidence_${jobId || 'unknown'}`;
}

function hybridDeliveryStorageKey(jobId) {
  return `netnet_job_hybrid_delivery_${jobId || 'unknown'}`;
}

function normalizeHybridDeliveryEntry(entry = {}) {
  const serviceTypeEntriesRaw = entry?.serviceTypeEntries && typeof entry.serviceTypeEntries === 'object'
    ? entry.serviceTypeEntries
    : null;
  const legacyServiceTypeHoursRaw = !serviceTypeEntriesRaw && entry?.serviceTypeHours && typeof entry.serviceTypeHours === 'object'
    ? entry.serviceTypeHours
    : {};
  return {
    enabled: !!entry?.enabled,
    serviceTypeEntries: Object.keys(serviceTypeEntriesRaw || legacyServiceTypeHoursRaw).reduce((acc, key) => {
      const rawEntry = serviceTypeEntriesRaw ? (serviceTypeEntriesRaw[key] || {}) : { hours: legacyServiceTypeHoursRaw[key], notes: '' };
      const rawHours = rawEntry?.hours;
      const nextHours = rawHours === '' || rawHours === null || rawHours === undefined || Number.isNaN(Number(rawHours))
        ? null
        : Number(rawHours);
      const nextNotes = String(rawEntry?.notes || '');
      if (nextHours !== null || nextNotes) {
        acc[String(key)] = {
          hours: nextHours,
          notes: nextNotes,
        };
      }
      return acc;
    }, {}),
  };
}

function getHybridServiceEntry(entry = {}, serviceTypeId) {
  const key = String(serviceTypeId || '');
  const item = entry?.serviceTypeEntries?.[key] || {};
  return {
    hours: item?.hours === '' || item?.hours === null || item?.hours === undefined || Number.isNaN(Number(item?.hours))
      ? null
      : Number(item.hours),
    notes: String(item?.notes || ''),
  };
}

function setHybridServiceEntry(entry = {}, serviceTypeId, patch = {}) {
  const key = String(serviceTypeId || '');
  const nextEntries = {
    ...(entry?.serviceTypeEntries || {}),
  };
  const current = getHybridServiceEntry(entry, key);
  const next = {
    hours: patch.hours === undefined
      ? current.hours
      : (patch.hours === '' || patch.hours === null || patch.hours === undefined || Number.isNaN(Number(patch.hours))
        ? null
        : Number(patch.hours)),
    notes: patch.notes === undefined ? current.notes : String(patch.notes || ''),
  };
  if (next.hours === null && !next.notes) {
    delete nextEntries[key];
  } else {
    nextEntries[key] = next;
  }
  return {
    ...normalizeHybridDeliveryEntry(entry),
    serviceTypeEntries: nextEntries,
  };
}

function loadHybridDeliveryMap(jobId) {
  if (!jobId) return {};
  try {
    const raw = localStorage.getItem(hybridDeliveryStorageKey(jobId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.keys(parsed).reduce((acc, key) => {
      acc[String(key)] = normalizeHybridDeliveryEntry(parsed[key]);
      return acc;
    }, {});
  } catch (e) {
    return {};
  }
}

function saveHybridDeliveryMap(jobId, map) {
  if (!jobId) return;
  try {
    localStorage.setItem(hybridDeliveryStorageKey(jobId), JSON.stringify(map || {}));
  } catch (e) {
    // ignore storage errors
  }
}

function loadConfidenceMap(jobId) {
  if (!jobId) return {};
  try {
    const raw = localStorage.getItem(confidenceStorageKey(jobId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveConfidenceMap(jobId, map) {
  if (!jobId) return;
  try {
    localStorage.setItem(confidenceStorageKey(jobId), JSON.stringify(map || {}));
  } catch (e) {
    // ignore storage errors
  }
}

function formatDateInput(value) {
  return value || '';
}

function formatHours(value) {
  const hours = Number(value) || 0;
  return `${hours % 1 ? hours.toFixed(1) : hours}h`;
}

function formatHoursText(value) {
  if (value === '' || value === null || value === undefined) return '—';
  const hours = Number(value);
  if (!Number.isFinite(hours)) return '—';
  return `${hours % 1 ? hours.toFixed(1) : hours}h`;
}

function cloneRecurringAllocations(allocations = []) {
  return (allocations || []).map((allocation) => ({
    ...allocation,
    actualHours: null,
  }));
}

function formatHybridHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return '';
  return hours % 1 ? hours.toFixed(1) : String(hours);
}

function sumHybridServiceTypeHours(serviceTypeEntries = {}) {
  if (!serviceTypeEntries || typeof serviceTypeEntries !== 'object') return 0;
  return Object.keys(serviceTypeEntries).reduce((sum, key) => sum + (Number(serviceTypeEntries[key]?.hours) || 0), 0);
}

function countHybridActiveServices(serviceTypeEntries = {}) {
  if (!serviceTypeEntries || typeof serviceTypeEntries !== 'object') return 0;
  return Object.keys(serviceTypeEntries).reduce((count, key) => (
    (Number(serviceTypeEntries[key]?.hours) || 0) > 0 ? count + 1 : count
  ), 0);
}

function getActualHours(task) {
  if (!task) return 0;
  if (Number.isFinite(task.actualHours)) return Number(task.actualHours) || 0;
  if (Array.isArray(task.timeEntries)) {
    return task.timeEntries.reduce((sum, entry) => sum + (Number(entry?.hours) || 0), 0);
  }
  if (Array.isArray(task.allocations)) {
    return task.allocations.reduce((sum, alloc) => sum + (Number(alloc?.actualHours) || 0), 0);
  }
  return 0;
}

function renderQuickTaskMeter(taskLike, actualHours) {
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

function renderAllocationLoeMeter(loeHours, actualHours) {
  const estimate = Number(loeHours);
  const actual = Number(actualHours);
  const estimateLabel = Number.isFinite(estimate) ? `${Math.round(estimate * 10) / 10}`.replace(/\.0$/, '') : '-';
  const actualLabel = Number.isFinite(actual) ? `${Math.round(actual * 10) / 10}`.replace(/\.0$/, '') : '0';
  const loePercent = Number.isFinite(estimate) && estimate > 0 && Number.isFinite(actual)
    ? Math.min(100, Math.round((actual / estimate) * 100))
    : 0;
  const loeColor = Number.isFinite(estimate) && Number.isFinite(actual) && estimate > 0 && actual > estimate
    ? 'bg-rose-500'
    : loePercent >= 80
      ? 'bg-amber-500'
      : 'bg-emerald-500';
  const loeTooltip = Number.isFinite(estimate) && estimate > 0 && Number.isFinite(actual)
    ? `LOE: ${actualLabel}h of ${estimateLabel}h (${Math.min(999, Math.round((actual / estimate) * 100))}%)`
    : `LOE: ${actualLabel}h of ${estimateLabel === '-' ? '-' : `${estimateLabel}h`}`;
  return h('div', {
    className: 'min-w-[124px] space-y-1',
    title: loeTooltip,
  }, [
    h('div', { className: 'h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden' }, [
      h('div', {
        className: `${loeColor} h-full rounded-full`,
        style: { width: `${loePercent}%` },
      }),
    ]),
    h('div', { className: 'text-[11px] text-slate-600 dark:text-slate-300' }, `LOE ${actualLabel} / ${estimateLabel === '-' ? '-' : estimateLabel}h`),
  ]);
}

function formatDueIn(task) {
  if (!task?.dueDate) return { label: '—', tone: 'muted' };
  const today = new Date();
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { label: task.dueDate, tone: 'muted' };
  const dueTime = due.setHours(0, 0, 0, 0);
  const todayTime = today.setHours(0, 0, 0, 0);
  return {
    label: formatShortDate(task.dueDate),
    tone: dueTime < todayTime ? 'danger' : 'normal',
  };
}

function getDueTiming(task) {
  if (!task?.dueDate) return { label: '—', tone: 'muted' };
  const today = new Date();
  const due = new Date(`${task.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { label: '—', tone: 'muted' };
  const dueTime = due.setHours(0, 0, 0, 0);
  const todayTime = today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueTime - todayTime) / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return { label: 'Overdue', tone: 'danger' };
  if (diffDays === 0) return { label: 'Due today', tone: 'warn' };
  return { label: `Due in ${diffDays}d`, tone: 'normal' };
}

function formatShortDate(dateValue) {
  if (!dateValue) return '—';
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdueDate(dateValue) {
  if (!dateValue) return false;
  const today = new Date();
  const due = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  return due.setHours(0, 0, 0, 0) < today.setHours(0, 0, 0, 0);
}

function getStatusLabel(status) {
  const match = STATUS_OPTIONS.find((option) => option.value === status);
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

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function sortTasks(tasks = []) {
  const order = (task) => {
    if (task.status === 'in_progress') return 0;
    if (task.status === 'backlog' && !task.isDraft) return 1;
    if (task.isDraft) return 2;
    if (task.status === 'completed') return 3;
    if (task.status === 'archived') return 4;
    return 5;
  };
  return tasks
    .map((task, idx) => ({ task, idx }))
    .sort((a, b) => {
      const rankDiff = order(a.task) - order(b.task);
      return rankDiff !== 0 ? rankDiff : a.idx - b.idx;
    })
    .map((item) => item.task);
}

function getTaskAllocations(task) {
  return Array.isArray(task?.allocations) ? task.allocations : [];
}

function sumEstimated(pools = []) {
  return (pools || []).reduce((sum, pool) => sum + (Number(pool?.estimatedHours) || 0), 0);
}

function sumAllocations(task) {
  return getTaskAllocations(task).reduce((sum, alloc) => sum + (Number(alloc?.loeHours) || 0), 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getRatioStatus(ratio) {
  if (ratio >= 1) return 'over';
  if (ratio >= 0.85) return 'tight';
  if (ratio > 0) return 'ok';
  return 'muted';
}

function getTimelineRatio(dueDate) {
  if (!dueDate) return 0;
  const today = new Date();
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 0;
  const diffMs = due.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 0) return 1.1;
  return clamp(1 - diffDays / 30, 0, 1);
}

function getServiceTypeLabels(task, serviceTypeMap) {
  const ids = getTaskAllocations(task)
    .map((alloc) => String(alloc.serviceTypeId || ''))
    .filter(Boolean);
  const unique = [...new Set(ids)];
  if (!unique.length) return '—';
  return unique
    .map((id) => serviceTypeMap.get(id)?.name || 'Service')
    .join(', ');
}

function getAllowedServiceTypeIds(deliverable) {
  const pools = deliverable?.effectivePools || deliverable?.pools || [];
  return (pools || [])
    .filter((pool) => Number(pool?.estimatedHours) > 0)
    .map((pool) => String(pool.serviceTypeId));
}

function getAllocationLoggedHours(task, allocation) {
  const explicitHours = Number(allocation?.actualHours) || 0;
  const timeEntryHours = Array.isArray(task?.timeEntries)
    ? task.timeEntries.reduce((sum, entry) => (
      String(entry?.allocationId || '') === String(allocation?.id || '')
        ? sum + (Number(entry?.hours) || 0)
        : sum
    ), 0)
    : 0;
  return explicitHours + timeEntryHours;
}

function hasAllocationLoggedTime(task, allocation) {
  return getAllocationLoggedHours(task, allocation) > 0;
}

function getAllocationServiceValidationMessage(allocation, deliverable) {
  const serviceTypeId = String(allocation?.serviceTypeId || '').trim();
  if (!serviceTypeId) return '';
  const allowedTypeIds = new Set(getAllowedServiceTypeIds(deliverable));
  if (!allowedTypeIds.size) return 'This deliverable has no available service types.';
  if (!allowedTypeIds.has(serviceTypeId)) return 'This service type is not available in this deliverable.';
  return '';
}

function isTaskReady(task, deliverable) {
  if (!task || !String(task.title || '').trim()) return false;
  if (!String(task.description || '').trim()) return false;
  if (!task.dueDate) return false;
  const allocations = getTaskAllocations(task);
  if (!allocations.length) return false;
  const allowedTypes = new Set(getAllowedServiceTypeIds(deliverable));
  if (!allowedTypes.size) return false;
  return allocations.every((alloc) => {
    if (!alloc) return false;
    const assigneeOk = !!alloc.assigneeUserId;
    const serviceOk = !!alloc.serviceTypeId && allowedTypes.has(String(alloc.serviceTypeId));
    const loeOk = Number(alloc.loeHours) > 0;
    return assigneeOk && serviceOk && loeOk;
  });
}

export function JobTasksExecutionTable({
  job,
  deliverables,
  unassignedTasks,
  serviceTypes,
  members,
  assigneeOptions,
  chatIndicators,
  onOpenChat,
  onOpenDrawer,
  onJobUpdate,
  readOnly,
  cycleKey,
  taskMetaMap,
  collapsedMap,
  onToggleCollapse,
}) {
  const tableRef = useRef(null);
  const buildExpandedGroups = (items, collapsed = {}) => {
    const next = new Set();
    const list = [...(items || []), { id: 'unassigned' }];
    list.forEach((item) => {
      const hasValue = Object.prototype.hasOwnProperty.call(collapsed || {}, item.id);
      const isCollapsed = hasValue ? collapsed[item.id] : true;
      if (!isCollapsed) next.add(item.id);
    });
    return next;
  };

  const [expandedGroups, setExpandedGroups] = useState(() => buildExpandedGroups(deliverables, collapsedMap || {}));
  const [confidenceMap, setConfidenceMap] = useState(() => loadConfidenceMap(job?.id));
  const [hybridDeliveryMap, setHybridDeliveryMap] = useState(() => loadHybridDeliveryMap(job?.id));
  const [deliverableTypeOptions, setDeliverableTypeOptions] = useState(() => loadDeliverableTypeOptions());
  const [openConfidenceMenuId, setOpenConfidenceMenuId] = useState(null);
  const [openDeliverableStatusMenuId, setOpenDeliverableStatusMenuId] = useState(null);
  const [statusPrompt, setStatusPrompt] = useState(null);
  const [statusPromptDate, setStatusPromptDate] = useState(() => formatDateInput(new Date().toISOString().slice(0, 10)));
  const [expandedTaskIds, setExpandedTaskIds] = useState(() => new Set());
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [descriptionEditor, setDescriptionEditor] = useState(null);
  const [expandedFocusTarget, setExpandedFocusTarget] = useState(null);
  const [draftDescriptionEditor, setDraftDescriptionEditor] = useState(null);
  const [draftAllocationEditor, setDraftAllocationEditor] = useState(null);
  const [draftRows, setDraftRows] = useState({});
  const [openDraftRows, setOpenDraftRows] = useState({});
  const [draftFocusKey, setDraftFocusKey] = useState(null);
  const [hybridDescriptionEditor, setHybridDescriptionEditor] = useState(null);
  const [openDetailsRows, setOpenDetailsRows] = useState({});
  const [dragState, setDragState] = useState(null);
  const [deliverableTaskViewMode, setDeliverableTaskViewMode] = useState({});
  const duePickerCleanupRef = useRef(null);
  const draftRowRefs = useRef({});
  const suppressAutoEditRef = useRef(null);

  const isRetainer = job?.kind === 'retainer';
  const getTaskEditableFields = (task) => EDITABLE_FIELDS.filter((field) => !(field === 'recurring' && !isRetainer));

  const focusTaskField = (taskId, field) => {
    if (!taskId || !field) return;
    requestAnimationFrame(() => {
      const selector = `[data-edit-task="${taskId}"][data-edit-field="${field}"]`;
      const node = tableRef.current?.querySelector(selector);
      node?.focus?.();
    });
  };

  const focusExpandedTarget = (taskId, target) => {
    if (!taskId || !target) return;
    requestAnimationFrame(() => {
      const descriptionNode = tableRef.current?.querySelector(`[data-expanded-description="${taskId}"] textarea`);
      const assigneeNode = tableRef.current?.querySelector(`[data-expanded-assignee-focus="${taskId}"]`);
      const addNode = tableRef.current?.querySelector(`[data-expanded-assignee-add="${taskId}"]`);
      const nextNode = target === 'description' ? descriptionNode : (assigneeNode || addNode);
      if (nextNode?.focus) {
        nextNode.focus();
        setExpandedFocusTarget(null);
      }
    });
  };

  const serviceTypeMap = useMemo(
    () => new Map((serviceTypes || []).map((type) => [String(type.id), type])),
    [serviceTypes]
  );
  const assigneeList = useMemo(() => {
    const base = (assigneeOptions && assigneeOptions.length ? assigneeOptions : (members || [])) || [];
    const hasMarc = base.some((member) => (
      member?.name === 'Marc Pitre' || member?.email === 'marc@hellonetnet.com'
    ));
    if (hasMarc) return base;
    return [
      ...base,
      { id: 'team_marc_pitre', name: 'Marc Pitre', email: 'marc@hellonetnet.com' },
    ];
  }, [assigneeOptions, members]);
  const memberMap = useMemo(
    () => new Map(assigneeList.map((member) => [String(member.id), member])),
    [assigneeList]
  );

  const renderAssigneeIdentity = (member) => h('div', { className: 'mb-2 flex min-w-0 items-center gap-2 rounded-md bg-white/70 dark:bg-slate-950/60 px-2.5 py-2' }, [
    h('span', {
      className: 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    }, member ? getInitials(member.name || member.email) : '+'),
    h('span', { className: `truncate text-xs font-medium ${member ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}` }, member?.name || member?.email || 'Unassigned'),
  ]);

  const focusNewestAssigneeControl = (taskId) => {
    if (!taskId) return;
    requestAnimationFrame(() => {
      const nodes = tableRef.current?.querySelectorAll(`[data-expanded-assignee-focus-row="${taskId}"]`);
      const nextNode = nodes?.length ? nodes[nodes.length - 1] : null;
      nextNode?.focus?.();
    });
  };

  const focusNewestDraftAssigneeControl = (rowKey) => {
    if (!rowKey) return;
    requestAnimationFrame(() => {
      const nodes = tableRef.current?.querySelectorAll(`[data-draft-assignee-focus-row="${rowKey}"]`);
      const nextNode = nodes?.length ? nodes[nodes.length - 1] : null;
      nextNode?.focus?.();
    });
  };

  const renderChatIndicator = (indicator = {}) => {
    const total = indicator.totalMessages || 0;
    const mentionCount = indicator.mentionCount || 0;
    const hasUnread = indicator.hasUnreadMessages;
    const badgeValue = mentionCount > 9 ? '9+' : mentionCount || '';
    const toneClass = total > 0
      ? 'text-slate-500 dark:text-slate-300'
      : 'text-slate-400 dark:text-slate-500';
    return h('span', { className: `relative inline-flex items-center ${toneClass}` }, [
      h('svg', { viewBox: '0 0 24 24', className: 'h-4 w-4', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
        h('path', { d: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }),
      ]),
      mentionCount > 0
        ? h('span', { className: 'absolute -top-1 -right-2 min-w-[16px] h-4 rounded-full bg-white text-[10px] font-semibold text-slate-900 px-1 flex items-center justify-center shadow' }, badgeValue)
        : hasUnread
          ? h('span', { className: 'absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-white shadow' })
          : null,
    ]);
  };

  useEffect(() => {
    setExpandedGroups(buildExpandedGroups(deliverables, collapsedMap || {}));
  }, [deliverables, collapsedMap]);

  useEffect(() => {
    setConfidenceMap(loadConfidenceMap(job?.id));
  }, [job?.id]);

  useEffect(() => {
    setHybridDeliveryMap(loadHybridDeliveryMap(job?.id));
  }, [job?.id]);

  useEffect(() => {
    setOpenDetailsRows({});
  }, [job?.id]);

  useEffect(() => {
    if (!openConfidenceMenuId) return undefined;
    const handleClick = (event) => {
      const target = event.target;
      if (target.closest?.('[data-confidence-menu]')) return;
      if (target.closest?.('[data-confidence-trigger]')) return;
      setOpenConfidenceMenuId(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openConfidenceMenuId]);

  useEffect(() => {
    if (!openDeliverableStatusMenuId) return undefined;
    const handleClick = (event) => {
      const target = event.target;
      if (target.closest?.('[data-deliverable-status-menu]')) return;
      if (target.closest?.('[data-deliverable-status-trigger]')) return;
      setOpenDeliverableStatusMenuId(null);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpenDeliverableStatusMenuId(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openDeliverableStatusMenuId]);

  useEffect(() => {
    const handleOutside = (event) => {
      const openKeys = Object.keys(openDraftRows || {}).filter((key) => openDraftRows[key]);
      if (!openKeys.length) return;
      openKeys.forEach((key) => {
        const node = draftRowRefs.current[key];
        if (node && node.contains(event.target)) return;
        const draft = draftRows[key] || createEmptyDraftRow();
        if (hasAllocationStarted(draft)) return;
        setOpenDraftRows((prev) => ({ ...(prev || {}), [key]: false }));
        setDraftRows((prev) => ({ ...prev, [key]: createEmptyDraftRow() }));
        setDraftFocusKey((prev) => (prev === key ? null : prev));
        if (draftDescriptionEditor?.key === key) setDraftDescriptionEditor(null);
        if (draftAllocationEditor?.key === key) setDraftAllocationEditor(null);
      });
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [openDraftRows, draftRows, draftDescriptionEditor, draftAllocationEditor]);

  useEffect(() => {
    if (!expandedTaskIds || expandedTaskIds.size === 0) return undefined;
    const handleClick = (event) => {
      const table = tableRef.current;
      if (!table) return;
      const ids = Array.from(expandedTaskIds);
      const isInside = ids.some((taskId) => {
        const rows = Array.from(table.querySelectorAll(`[data-alloc-group='${taskId}']`));
        return rows.some((row) => row.contains(event.target));
      });
      if (!isInside) setExpandedTaskIds(new Set());
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expandedTaskIds]);

  useEffect(() => () => {
    if (duePickerCleanupRef.current) duePickerCleanupRef.current();
  }, []);

  useEffect(() => {
    if (!expandedFocusTarget?.taskId || !expandedFocusTarget?.target) return;
    if (!expandedTaskIds.has(expandedFocusTarget.taskId)) return;
    focusExpandedTarget(expandedFocusTarget.taskId, expandedFocusTarget.target);
  }, [expandedFocusTarget, expandedTaskIds, descriptionEditor]);

  const updateConfidence = (deliverableId, value) => {
    if (!deliverableId) return;
    setConfidenceMap((prev) => {
      const next = { ...(prev || {}) };
      next[String(deliverableId)] = value;
      saveConfidenceMap(job?.id, next);
      return next;
    });
    setOpenConfidenceMenuId(null);
  };

  const updateDeliverable = (deliverableId, patch) => {
    if (typeof onJobUpdate !== 'function' || readOnly) return;
    const nextDeliverables = (job.deliverables || []).map((deliverable) => {
      if (deliverable.id !== deliverableId) return deliverable;
      return { ...deliverable, ...(patch || {}) };
    });
    onJobUpdate({ deliverables: nextDeliverables });
  };

  const getHybridDeliveryState = (deliverableId) => {
    const key = String(deliverableId || '');
    return normalizeHybridDeliveryEntry(hybridDeliveryMap?.[key] || {});
  };

  const updateHybridDelivery = (deliverableId, patch) => {
    if (!deliverableId) return;
    setHybridDeliveryMap((prev) => {
      const key = String(deliverableId);
      const next = {
        ...(prev || {}),
        [key]: normalizeHybridDeliveryEntry({
          ...normalizeHybridDeliveryEntry(prev?.[key] || {}),
          ...(patch || {}),
        }),
      };
      saveHybridDeliveryMap(job?.id, next);
      return next;
    });
  };

  const startHybridDescriptionEdit = (deliverableId, serviceTypeId) => {
    const hybridState = getHybridDeliveryState(deliverableId);
    const entry = getHybridServiceEntry(hybridState, serviceTypeId);
    setHybridDescriptionEditor({
      deliverableId: String(deliverableId),
      serviceTypeId: String(serviceTypeId),
      value: entry.notes || '',
    });
  };

  const saveHybridDescriptionEdit = () => {
    if (!hybridDescriptionEditor) return;
    updateHybridDelivery(hybridDescriptionEditor.deliverableId, setHybridServiceEntry(
      getHybridDeliveryState(hybridDescriptionEditor.deliverableId),
      hybridDescriptionEditor.serviceTypeId,
      { notes: hybridDescriptionEditor.value }
    ));
    setHybridDescriptionEditor(null);
  };

  const cancelHybridDescriptionEdit = () => {
    setHybridDescriptionEditor(null);
  };

  const toggleDetailsRow = (deliverableId) => {
    if (!deliverableId) return;
    setOpenDetailsRows((prev) => ({
      ...(prev || {}),
      [String(deliverableId)]: !prev?.[String(deliverableId)],
    }));
  };

  const openStatusPrompt = (deliverableId, nextStatus, promptType) => {
    const today = new Date().toISOString().slice(0, 10);
    setStatusPrompt({ deliverableId, nextStatus, promptType });
    setStatusPromptDate(today);
  };

  const handleDeliverableStatusSelect = (deliverable, nextStatus) => {
    if (!deliverable || !nextStatus) return;
    const currentStatus = deliverable.status || 'backlog';
    if (currentStatus === nextStatus) {
      setOpenDeliverableStatusMenuId(null);
      return;
    }
    if (currentStatus === 'backlog' && nextStatus === 'in_progress') {
      setOpenDeliverableStatusMenuId(null);
      openStatusPrompt(deliverable.id, nextStatus, 'start');
      return;
    }
    if (currentStatus === 'in_progress' && nextStatus === 'completed') {
      setOpenDeliverableStatusMenuId(null);
      openStatusPrompt(deliverable.id, nextStatus, 'complete');
      return;
    }
    setOpenDeliverableStatusMenuId(null);
    updateDeliverable(deliverable.id, {
      status: nextStatus,
      startedAt: nextStatus === 'backlog' ? null : deliverable.startedAt || null,
      completedAt: nextStatus === 'completed' ? (deliverable.completedAt || null) : null,
    });
  };

  const confirmStatusPrompt = () => {
    if (!statusPrompt) return;
    const deliverable = (job.deliverables || []).find((item) => item.id === statusPrompt.deliverableId);
    if (!deliverable) {
      setStatusPrompt(null);
      return;
    }
    if (statusPrompt.promptType === 'start') {
      updateDeliverable(deliverable.id, {
        status: 'in_progress',
        startedAt: statusPromptDate || new Date().toISOString().slice(0, 10),
      });
    }
    if (statusPrompt.promptType === 'complete') {
      updateDeliverable(deliverable.id, {
        status: 'completed',
        completedAt: statusPromptDate || new Date().toISOString().slice(0, 10),
      });
    }
    setStatusPrompt(null);
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      const isExpanded = next.has(groupId);
      if (isExpanded) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      if (typeof onToggleCollapse === 'function') {
        onToggleCollapse(groupId, isExpanded);
      }
      return next;
    });
  };

  const draftKey = (deliverableId) => deliverableId || 'unassigned';
  const hasAllocationStarted = (draft) => {
    if (!draft) return false;
    const allocations = getDraftAllocations(draft);
    return allocations.some((allocation) => (
      allocation.assigneeUserId
      || allocation.serviceTypeId
      || String(allocation.loeHours || '').trim().length > 0
    ));
  };
  const getDraftRow = (deliverableId) => {
    const key = draftKey(deliverableId);
    return draftRows[key] || createEmptyDraftRow();
  };
  const updateDraftRow = (deliverableId, patch) => {
    const key = draftKey(deliverableId);
    const current = draftRows[key] || createEmptyDraftRow();
    const nextDraftBase = { ...createEmptyDraftRow(), ...current, ...(patch || {}) };
    const nextDraft = syncDraftAllocationFields(nextDraftBase, getDraftAllocations(nextDraftBase));
    setDraftRows((prev) => ({
      ...prev,
      [key]: nextDraft,
    }));
    if (readOnly) return;
    if (!String(nextDraft.title || '').trim()) return;
    if (!hasAllocationStarted(nextDraft)) return;
    const task = createTaskFromDraft(deliverableId, nextDraft);
    if (task) {
      setExpandedTaskIds((prev) => {
        const next = new Set(prev);
        next.add(task.id);
        return next;
      });
    }
  };
  const clearDraftRow = (deliverableId) => {
    const key = draftKey(deliverableId);
    setDraftRows((prev) => ({ ...prev, [key]: createEmptyDraftRow() }));
  };
  const isDraftRowOpen = (deliverableId) => {
    const key = draftKey(deliverableId);
    return !!openDraftRows[key];
  };
  const openDraftRow = (deliverableId) => {
    const key = draftKey(deliverableId);
    setOpenDraftRows((prev) => ({ ...(prev || {}), [key]: true }));
    setDraftFocusKey(key);
    setDraftRows((prev) => ({
      ...prev,
      [key]: { ...createEmptyDraftRow(), ...(prev[key] || {}) },
    }));
  };
  const closeDraftRow = (deliverableId) => {
    const key = draftKey(deliverableId);
    setOpenDraftRows((prev) => ({ ...(prev || {}), [key]: false }));
    setDraftFocusKey((prev) => (prev === key ? null : prev));
    if (draftDescriptionEditor?.key === key) setDraftDescriptionEditor(null);
    if (draftAllocationEditor?.key === key) setDraftAllocationEditor(null);
  };

  const openDatePicker = (anchorEl, value, onSelect) => {
    if (!anchorEl) return;
    if (duePickerCleanupRef.current) duePickerCleanupRef.current();
    duePickerCleanupRef.current = openSingleDatePickerPopover({
      anchorEl,
      value,
      onSelect: (next) => onSelect?.(next),
      onClear: () => onSelect?.(''),
      onClose: () => {
        duePickerCleanupRef.current = null;
      },
    });
  };

  const openDeliverableDatePicker = (anchorEl, deliverableId, value) => {
    if (!anchorEl || readOnly) return;
    if (duePickerCleanupRef.current) duePickerCleanupRef.current();
    duePickerCleanupRef.current = openSingleDatePickerPopover({
      anchorEl,
      value,
      onSelect: (next) => updateDeliverable(deliverableId, { dueDate: next || null }),
      onClear: () => updateDeliverable(deliverableId, { dueDate: null }),
      onClose: () => {
        duePickerCleanupRef.current = null;
      },
    });
  };

  const getTaskList = (deliverableId) => {
    if (!deliverableId) return unassignedTasks || [];
    const deliverable = (deliverables || []).find((item) => item.id === deliverableId);
    return deliverable?.tasks || [];
  };

  const updateTaskList = (deliverableId, updater) => {
    if (typeof onJobUpdate !== 'function' || readOnly) return;
    if (!deliverableId) {
      const nextTasks = (updater(unassignedTasks || []) || []).map((task) => ({
        ...task,
        isDraft: !isTaskReady(task, null),
      }));
      onJobUpdate({ unassignedTasks: nextTasks });
      return;
    }
    const nextDeliverables = (job.deliverables || []).map((deliverable) => {
      if (deliverable.id !== deliverableId) return deliverable;
      const nextTasks = updater(deliverable.tasks || []);
      const readyDeliverable = (deliverables || []).find((item) => item.id === deliverableId) || deliverable;
      const normalizedTasks = (nextTasks || []).map((task) => ({
        ...task,
        isDraft: !isTaskReady(task, readyDeliverable),
      }));
      return { ...deliverable, tasks: normalizedTasks };
    });
    onJobUpdate({ deliverables: nextDeliverables });
  };

  const isRecurringInstance = (task) => !!(
    job?.kind === 'retainer'
    && task?.isRecurring
    && task?.recurringTemplateId
    && task?.cycleKey
    && !isRecurringTemplateTask(task)
  );

  const applyRecurringTemplateUpdates = (tasks, task, patch = {}, allocationUpdater = null) => {
    const list = Array.isArray(tasks) ? tasks : [];
    if (!isRecurringInstance(task)) {
      return list.map((item) => {
        if (item.id !== task.id) return item;
        if (allocationUpdater) {
          return { ...item, allocations: allocationUpdater(getTaskAllocations(item)) };
        }
        return { ...item, ...patch };
      });
    }

    const recurringTemplateId = String(task.recurringTemplateId || '');
    const currentCycleKey = String(task.cycleKey || '');
    const templateTask = list.find((item) => (
      String(item?.recurringTemplateId || '') === recurringTemplateId && isRecurringTemplateTask(item)
    )) || null;

    const templatePatch = {};
    if (Object.prototype.hasOwnProperty.call(patch, 'title')) templatePatch.title = patch.title;
    if (Object.prototype.hasOwnProperty.call(patch, 'description')) templatePatch.description = patch.description;
    if (Object.prototype.hasOwnProperty.call(patch, 'dueDate')) templatePatch.dueDate = patch.dueDate || null;

    const nextTemplateAllocations = allocationUpdater
      ? cloneRecurringAllocations(allocationUpdater(getTaskAllocations(templateTask || task)))
      : null;
    const nextTemplateDueDate = Object.prototype.hasOwnProperty.call(templatePatch, 'dueDate')
      ? (templatePatch.dueDate || null)
      : (templateTask?.dueDate || task?.dueDate || null);

    return list.map((item) => {
      const matchesSeries = String(item?.recurringTemplateId || '') === recurringTemplateId;
      if (!matchesSeries) return item;

      if (item.id === task.id) {
        if (allocationUpdater) {
          return { ...item, allocations: allocationUpdater(getTaskAllocations(item)) };
        }
        return { ...item, ...patch };
      }

      if (isRecurringTemplateTask(item)) {
        if (allocationUpdater) {
          return { ...item, allocations: nextTemplateAllocations };
        }
        return { ...item, ...templatePatch };
      }

      const itemCycleKey = String(item?.cycleKey || '');
      if (!itemCycleKey || itemCycleKey <= currentCycleKey) return item;

      if (allocationUpdater) {
        return { ...item, allocations: cloneRecurringAllocations(nextTemplateAllocations) };
      }

      const futurePatch = { ...templatePatch };
      if (Object.prototype.hasOwnProperty.call(templatePatch, 'dueDate')) {
        futurePatch.dueDate = deriveRecurringDueDate(nextTemplateDueDate, itemCycleKey);
      }
      return Object.keys(futurePatch).length ? { ...item, ...futurePatch } : item;
    });
  };

  const toggleRecurringTask = (deliverableId, task) => {
    if (!task || readOnly || job?.kind !== 'retainer') return;
    updateTaskList(deliverableId, (tasks) => {
      const list = Array.isArray(tasks) ? tasks : [];
      const currentCycleKey = task?.cycleKey || cycleKey || null;
      if (!currentCycleKey) return list;

      if (isRecurringInstance(task)) {
        return list.map((item) => (
          item.id === task.id
            ? { ...item, isRecurring: false, recurringTemplateId: null }
            : item
        ));
      }

      if (task?.isRecurring && task?.recurringTemplateId) return list;

      const recurringTemplateId = createId('recurring');
      const templateTask = {
        id: createId('task'),
        jobId: task.jobId || job?.id || null,
        deliverableId: deliverableId || task.deliverableId || null,
        title: task.title || '',
        description: task.description || '',
        status: 'backlog',
        isDraft: false,
        isRecurring: true,
        recurringTemplateId,
        dueDate: task.dueDate || null,
        startedAt: null,
        startTimestamp: null,
        completedAt: null,
        completedTimestamp: null,
        cycleKey: null,
        timeEntries: [],
        allocations: cloneRecurringAllocations(getTaskAllocations(task)),
      };

      return [
        templateTask,
        ...list.map((item) => (
          item.id === task.id
            ? {
              ...item,
              isRecurring: true,
              recurringTemplateId,
              cycleKey: item.cycleKey || currentCycleKey,
            }
            : item
        )),
      ];
    });
  };

  const updateTask = (deliverableId, taskId, patch) => {
    updateTaskList(deliverableId, (tasks) => {
      const currentTask = (tasks || []).find((task) => task.id === taskId);
      if (!currentTask) return tasks || [];
      return applyRecurringTemplateUpdates(tasks, currentTask, patch);
    });
  };

  const updateAllocations = (deliverableId, taskId, updater) => {
    updateTaskList(deliverableId, (tasks) => {
      const currentTask = (tasks || []).find((task) => task.id === taskId);
      if (!currentTask) return tasks || [];
      return applyRecurringTemplateUpdates(tasks, currentTask, {}, updater);
    });
  };

  const isTaskExpanded = (taskId) => expandedTaskIds.has(taskId);
  const ensureTaskExpanded = (taskId) => {
    setExpandedTaskIds(new Set([taskId]));
  };
  const toggleTaskExpanded = (taskId) => {
    setExpandedTaskIds((prev) => {
      const next = new Set();
      if (!prev.has(taskId)) next.add(taskId);
      return next;
    });
    if (descriptionEditor?.taskId === taskId) setDescriptionEditor(null);
    if (editingCell?.taskId === taskId) {
      setEditingCell(null);
      setEditingValue('');
    }
  };

  const openExpandedEditor = (task, deliverableId, target) => {
    if (!task || !target) return;
    ensureTaskExpanded(task.id);
    setExpandedFocusTarget({ taskId: task.id, target });
    if (target === 'description') {
      setEditingCell(null);
      setEditingValue('');
      setDescriptionEditor({
        taskId: task.id,
        deliverableId,
        value: task.description || '',
      });
      return;
    }
    if (target === 'assignees') {
      setEditingCell(null);
      setEditingValue('');
    }
  };

  const getPrimaryAllocation = (task) => getTaskAllocations(task)[0] || null;

  const updatePrimaryAllocation = (deliverableId, taskId, patch) => {
    updateAllocations(deliverableId, taskId, (allocations) => {
      const next = [...(allocations || [])];
      if (!next.length) {
        next.push({ id: createId('alloc'), assigneeUserId: null, serviceTypeId: null, loeHours: null });
      }
      next[0] = { ...next[0], ...(patch || {}) };
      return next;
    });
  };

  const getFieldValue = (task, field) => {
    if (!task) return '';
    const primary = getPrimaryAllocation(task);
    if (field === 'title') return task.title || '';
    if (field === 'description') return task.description || '';
    if (field === 'status') return task.status || 'in_progress';
    if (field === 'dueDate') return task.dueDate || '';
    if (field === 'assignees') return primary?.assigneeUserId ? String(primary.assigneeUserId) : '';
    if (field === 'service') return primary?.serviceTypeId ? String(primary.serviceTypeId) : '';
    if (field === 'loe') return primary?.loeHours ?? '';
    return '';
  };

  const startEdit = (task, deliverableId, field, valueOverride) => {
    if (readOnly) return;
    if (field === 'recurring') return;
    if (field === 'description') {
      openExpandedEditor(task, deliverableId, 'description');
      return;
    }
    if (field === 'assignees') {
      openExpandedEditor(task, deliverableId, 'assignees');
      return;
    }
    if (field !== 'dueDate' && editingCell?.taskId === task.id && editingCell.field === field) {
      setEditingCell(null);
      setEditingValue('');
      return;
    }
    if (field === 'dueDate') {
      setEditingCell(null);
      setEditingValue('');
      setDescriptionEditor(null);
      const cell = tableRef.current?.querySelector(`[data-edit-task="${task.id}"][data-edit-field="dueDate"]`);
      openDatePicker(cell, task.dueDate || '', (next) => {
        commitField(task, deliverableId, 'dueDate', next);
      });
      return;
    }
    setDescriptionEditor(null);
    setEditingCell({ taskId: task.id, deliverableId, field });
    setEditingValue(valueOverride !== undefined ? valueOverride : getFieldValue(task, field));
  };

  const handleEditCancel = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const commitField = (task, deliverableId, field, value) => {
    if (!task) return;
    const nextValue = field === 'title' ? String(value || '').trim() : value;
    if (field === 'title' && !nextValue) return false;
    if (field === 'status') {
      updateTask(deliverableId, task.id, mergeTaskLifecycleFields(task, {
        status: nextValue || 'in_progress',
      }));
      return true;
    }
    if (field === 'dueDate') {
      updateTask(deliverableId, task.id, { dueDate: nextValue || null });
      return true;
    }
    if (field === 'assignees') {
      updatePrimaryAllocation(deliverableId, task.id, { assigneeUserId: nextValue || null });
      return true;
    }
    if (field === 'service') {
      updatePrimaryAllocation(deliverableId, task.id, { serviceTypeId: nextValue || null });
      return true;
    }
    if (field === 'loe') {
      const loeHours = Number(nextValue);
      updatePrimaryAllocation(deliverableId, task.id, { loeHours: Number.isFinite(loeHours) ? loeHours : null });
      return true;
    }
    updateTask(deliverableId, task.id, { [field]: nextValue });
    return true;
  };

  const commitOnBlur = (task, deliverableId, field, value) => {
    const committed = commitField(task, deliverableId, field, value);
    if (!committed) return;
    if (editingCell?.taskId === task.id && editingCell.field === field) {
      setEditingCell(null);
      setEditingValue('');
    }
  };

  const getAdjacentField = (task, field, direction) => {
    const fields = getTaskEditableFields(task);
    const idx = fields.indexOf(field);
    if (idx < 0) return null;
    const next = fields[idx + direction];
    return next || null;
  };

  const handleEditorKeyDown = (event, task, deliverableId, field) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleEditCancel();
      suppressAutoEditRef.current = { taskId: task.id, field };
      focusTaskField(task.id, field);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const committed = commitField(task, deliverableId, field, editingValue);
      if (!committed) return;
      handleEditCancel();
      suppressAutoEditRef.current = { taskId: task.id, field };
      focusTaskField(task.id, field);
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const committed = commitField(task, deliverableId, field, editingValue);
      if (!committed) return;
      const direction = event.shiftKey ? -1 : 1;
      const nextField = getAdjacentField(task, field, direction);
      handleEditCancel();
      if (!nextField) return;
      focusTaskField(task.id, nextField);
    }
  };

  const createTaskFromDraft = (deliverableId, draftOverride) => {
    const draft = draftOverride || getDraftRow(deliverableId);
    const title = String(draft.title || '').trim();
    if (!title) return null;
    const draftAllocations = getDraftAllocations(draft);
    const hasAllocation = draftAllocations.some((allocation) => (
      allocation.assigneeUserId || allocation.serviceTypeId || String(allocation.loeHours || '').trim().length > 0
    ));
    if (!hasAllocation) return null;
    const allocations = hasAllocation
      ? draftAllocations.map((allocation) => ({
        id: createId('alloc'),
        assigneeUserId: allocation.assigneeUserId || null,
        serviceTypeId: allocation.serviceTypeId || null,
        loeHours: String(allocation.loeHours || '').trim().length ? Number(allocation.loeHours) || null : null,
        actualHours: null,
      }))
      : [];
    const recurringTemplateId = draft.isRecurring ? createId('recurring') : null;
    const task = {
      id: createId('task'),
      jobId: job.id,
      deliverableId: deliverableId || null,
      title,
      description: String(draft.description || ''),
      status: draft.status || 'in_progress',
      isDraft: true,
      isRecurring: !!draft.isRecurring,
      recurringTemplateId,
      dueDate: draft.dueDate || null,
      startedAt: null,
      completedAt: null,
      cycleKey: cycleKey || null,
      allocations,
    };

    let taskWithLifecycle = {
      ...task,
      ...mergeTaskLifecycleFields(task, {
        status: task.status,
        startedAt: task.status === 'in_progress' ? localDateISO() : null,
        completedAt: task.status === 'completed' ? localDateISO() : null,
      }),
    };

    if (draft.isRecurring && cycleKey) {
      const templateTask = {
        id: createId('task'),
        jobId: job.id,
        deliverableId: deliverableId || null,
        title,
        description: String(draft.description || ''),
        status: 'backlog',
        isDraft: false,
        isRecurring: true,
        recurringTemplateId,
        dueDate: draft.dueDate || null,
        startedAt: null,
        completedAt: null,
        cycleKey: null,
        allocations: cloneRecurringAllocations(allocations),
        timeEntries: [],
      };
      const instanceTask = createRecurringInstanceFromTemplate(templateTask, cycleKey) || task;
      taskWithLifecycle = {
        ...instanceTask,
        status: draft.status || 'in_progress',
        isDraft: true,
        ...mergeTaskLifecycleFields(instanceTask, {
          status: draft.status || 'in_progress',
          startedAt: (draft.status || 'in_progress') === 'in_progress' ? localDateISO() : null,
          completedAt: (draft.status || 'in_progress') === 'completed' ? localDateISO() : null,
        }),
      };
      updateTaskList(deliverableId, (tasks) => [taskWithLifecycle, templateTask, ...(tasks || [])]);
    } else {
      updateTaskList(deliverableId, (tasks) => [taskWithLifecycle, ...(tasks || [])]);
    }
    clearDraftRow(deliverableId);
    closeDraftRow(deliverableId);
    return taskWithLifecycle;
  };

  const createTaskAndEdit = (deliverableId, nextField) => {
    const task = createTaskFromDraft(deliverableId);
    if (!task) return;
    requestAnimationFrame(() => {
      startEdit(task, deliverableId, nextField);
    });
  };

  const handleDragStart = (event, deliverableId, taskId) => {
    if (readOnly) return;
    setDragState({ deliverableId, taskId });
    event.dataTransfer?.setData('text/plain', String(taskId));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (event, deliverableId, targetTaskId) => {
    if (readOnly || !dragState) return;
    event.preventDefault();
    if (dragState.deliverableId !== deliverableId) return;
    const tasks = getTaskList(deliverableId);
    const fromIndex = tasks.findIndex((task) => task.id === dragState.taskId);
    const toIndex = tasks.findIndex((task) => task.id === targetTaskId);
    if (fromIndex < 0 || toIndex < 0) return;
    const dragTask = tasks[fromIndex];
    const targetTask = tasks[toIndex];
    if (dragTask?.status !== targetTask?.status) return;
    const nextTasks = [...tasks];
    nextTasks.splice(fromIndex, 1);
    nextTasks.splice(toIndex, 0, dragTask);
    updateTaskList(deliverableId, () => nextTasks);
    setDragState(null);
  };

  const handleKeyNav = (event) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const cell = event.currentTarget;
    const row = cell.dataset.row;
    const col = cell.dataset.col;
    const table = tableRef.current;
    if (!table || !row || !col) return;
    event.preventDefault();

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const cells = Array.from(table.querySelectorAll(`[data-col='${col}'][data-cell='task']`));
      const idx = cells.indexOf(cell);
      const next = cells[idx + (event.key === 'ArrowDown' ? 1 : -1)];
      next?.focus();
      return;
    }

    const colIdx = COLUMN_ORDER.indexOf(col);
    if (colIdx < 0) return;
    const nextCol = event.key === 'ArrowRight' ? COLUMN_ORDER[colIdx + 1] : COLUMN_ORDER[colIdx - 1];
    if (!nextCol) return;
    const nextCell = table.querySelector(`[data-row='${row}'][data-col='${nextCol}']`);
    nextCell?.focus();
  };

  const groups = (deliverables || []).map((deliverable) => {
    const tasks = sortTasks(deliverable.tasks || []);
    return { ...deliverable, tasks };
  });
  const unassignedGroup = {
    id: 'unassigned',
    name: 'General Job Tasks',
    status: 'in_progress',
    tasks: sortTasks(unassignedTasks || []),
  };

  const renderAllocations = (task, deliverable) => {
    const allocations = Array.isArray(task.allocations) ? task.allocations : [];
    const allowedTypeIds = getAllowedServiceTypeIds(deliverable);
    const hasPools = allowedTypeIds.length > 0;
    const isReady = isTaskReady(task, deliverable);
    const draftOutlineClass = !isReady ? 'outline outline-1 outline-[#6d28d9]/35 outline-offset-[-1px]' : '';
    const gridStyle = { gridTemplateColumns: '1.15fr 1fr 0.55fr 0.8fr auto' };
    const totalLoe = allocations.reduce((sum, allocation) => sum + (Number(allocation?.loeHours) || 0), 0);

    const addAllocation = () => {
      if (readOnly) return;
      ensureTaskExpanded(task.id);
      updateAllocations(deliverable?.id || null, task.id, (list) => [
        ...list,
        { id: createId('alloc'), assigneeUserId: null, serviceTypeId: null, loeHours: null },
      ]);
      focusNewestAssigneeControl(task.id);
    };
    const removeAllocation = (allocationId) => {
      if (readOnly) return;
      updateAllocations(deliverable?.id || null, task.id, (list) => (
        (list || []).filter((item) => item.id !== allocationId)
      ));
    };
    return h('div', {
      'data-no-row-toggle': 'true',
      className: `rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-4 ${draftOutlineClass}`,
      onMouseDown: (event) => event.stopPropagation(),
      onClick: (event) => event.stopPropagation(),
    }, [
      h('div', { className: 'flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-slate-950/50' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Allocations'),
          h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'This task is composed of these allocations.'),
        ]),
        h('div', { className: 'rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300' }, `Total LOE: ${formatHoursText(totalLoe)}`),
      ]),
      hasPools ? null : h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Assign this task to a deliverable with available hours to set service types.'),
      h('div', { className: 'grid gap-3 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 px-1', style: gridStyle }, [
        h('div', null, 'Assignee'),
        h('div', null, 'Service Type'),
        h('div', null, 'LOE'),
        h('div', null, 'Metrics'),
        h('div', { className: 'text-right' }, 'Actions'),
      ]),
      allocations.length
        ? h('div', { className: 'space-y-2' }, allocations.map((alloc, idx) => {
          const allocationActual = getAllocationLoggedHours(task, alloc);
          const removeDisabled = hasAllocationLoggedTime(task, alloc);
          const allocationMember = alloc?.assigneeUserId ? memberMap.get(String(alloc.assigneeUserId)) : null;
          const serviceValidationMessage = getAllocationServiceValidationMessage(alloc, deliverable);
          const currentServiceTypeId = String(alloc?.serviceTypeId || '');
          const invalidServiceSelected = !!currentServiceTypeId && !allowedTypeIds.includes(currentServiceTypeId);
          const actionMenu = removeDisabled
            ? h('button', {
              type: 'button',
              disabled: true,
              title: 'Cannot remove assignee with logged time',
              className: 'p-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-500 shadow-sm cursor-not-allowed inline-flex items-center justify-center',
              onMouseDown: (event) => event.stopPropagation(),
              onClick: (event) => event.stopPropagation(),
            }, [
              h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
                h('circle', { cx: '12', cy: '5', r: '1.5' }),
                h('circle', { cx: '12', cy: '12', r: '1.5' }),
                h('circle', { cx: '12', cy: '19', r: '1.5' }),
              ]),
            ])
            : h(RowActionsMenu, {
              menuItems: ['Remove Assignee'],
              onSelect: (item) => {
                if (item === 'Remove Assignee') removeAllocation(alloc.id);
              },
            });
          return h('div', {
            key: alloc.id,
            className: 'grid gap-3 items-start rounded-lg border border-slate-200/80 bg-white/80 px-3 py-3 dark:border-white/10 dark:bg-slate-950/50',
            style: gridStyle,
          }, [
            h('div', { className: 'min-w-0' }, [
              renderAssigneeIdentity(allocationMember),
              h('select', {
                value: alloc.assigneeUserId ? String(alloc.assigneeUserId) : '',
                disabled: readOnly,
                'data-expanded-assignee-focus-row': task.id,
                'data-no-row-toggle': 'true',
                onMouseDown: (event) => event.stopPropagation(),
                onClick: (event) => event.stopPropagation(),
                onChange: (event) => updateAllocations(deliverable?.id || null, task.id, (list) => (
                  list.map((item) => item.id === alloc.id ? { ...item, assigneeUserId: event.target.value || null } : item)
                )),
                className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
              }, [
                h('option', { value: '' }, 'Unassigned'),
                ...(assigneeList || []).map((member) => h('option', { key: member.id, value: member.id }, member.name || member.email)),
              ]),
            ]),
            h('div', { className: 'min-w-0' }, [
              h('select', {
                value: alloc.serviceTypeId ? String(alloc.serviceTypeId) : '',
                disabled: readOnly || !hasPools,
                'data-no-row-toggle': 'true',
                onMouseDown: (event) => event.stopPropagation(),
                onClick: (event) => event.stopPropagation(),
                onChange: (event) => updateAllocations(deliverable?.id || null, task.id, (list) => (
                  list.map((item) => item.id === alloc.id ? { ...item, serviceTypeId: event.target.value || null } : item)
                )),
                className: `h-10 w-full rounded-md border bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60 ${serviceValidationMessage ? 'border-rose-300 dark:border-rose-500/60' : 'border-slate-200 dark:border-white/10'}`,
              }, [
                h('option', { value: '' }, hasPools ? 'Select' : 'No pools'),
                invalidServiceSelected
                  ? h('option', { value: currentServiceTypeId }, serviceTypeMap.get(currentServiceTypeId)?.name || 'Unavailable service type')
                  : null,
                ...allowedTypeIds.map((id) => h('option', { key: id, value: id }, serviceTypeMap.get(id)?.name || id)),
              ].filter(Boolean)),
              serviceValidationMessage
                ? h('div', { className: 'mt-1 text-[11px] text-rose-600 dark:text-rose-300' }, serviceValidationMessage)
                : null,
            ]),
            h('input', {
              type: 'number',
              min: 0,
              step: 0.25,
              value: alloc.loeHours ?? '',
              disabled: readOnly,
              'data-no-row-toggle': 'true',
              onMouseDown: (event) => event.stopPropagation(),
              onClick: (event) => event.stopPropagation(),
              onChange: (event) => {
                const raw = event.target.value;
                const next = raw === '' ? null : Number(raw);
                updateAllocations(deliverable?.id || null, task.id, (list) => (
                  list.map((item) => item.id === alloc.id ? { ...item, loeHours: Number.isFinite(next) ? next : null } : item)
                ));
              },
              className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
            }),
            h('div', { className: 'pt-1' }, renderAllocationLoeMeter(alloc.loeHours, allocationActual)),
            h('div', {
              className: 'flex justify-end pt-1',
              'data-no-row-toggle': 'true',
              onMouseDown: (event) => event.stopPropagation(),
              onClick: (event) => event.stopPropagation(),
            }, [actionMenu]),
          ]);
        }))
        : h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'No assignees yet.'),
      h('button', {
        type: 'button',
        className: 'inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-60',
        'data-expanded-assignee-add': task.id,
        'data-no-row-toggle': 'true',
        onMouseDown: (event) => event.stopPropagation(),
        onClick: (event) => {
          event.stopPropagation();
          addAllocation();
        },
        disabled: readOnly,
      }, '+ Assignee'),
    ]);
  };

  const renderDescriptionEditor = (task, deliverableId, isDraft) => {
    const value = descriptionEditor?.taskId === task.id
      ? (descriptionEditor?.value ?? '')
      : String(task.description || '');
    const save = () => {
      if (readOnly) return;
      updateTask(deliverableId, task.id, { description: value });
      setDescriptionEditor(null);
    };
    const cancel = () => {
      setDescriptionEditor(null);
    };
    return h('div', { 'data-expanded-description': task.id }, [
      h(TaskStyleRichTextField, {
        label: 'Description',
        value,
        rows: 3,
        autoFocus: descriptionEditor?.taskId === task.id,
        disabled: readOnly,
        onChange: (nextValue) => setDescriptionEditor({
          taskId: task.id,
          deliverableId,
          value: nextValue,
        }),
        onBlur: save,
        onKeyDown: (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            save();
          }
        },
        footerText: 'Enter to save · Esc to cancel',
      }),
    ]);
  };

  const renderDraftDescriptionEditor = (deliverableId) => {
    const draft = getDraftRow(deliverableId);
    const close = () => setDraftDescriptionEditor(null);
    return h('tr', { key: `draft-${deliverableId || 'unassigned'}-description`, className: 'bg-white dark:bg-slate-900/60' }, [
      h('td', { colSpan: COLUMN_ORDER.length, className: 'px-4 py-3' }, [
        h(TaskStyleRichTextField, {
          label: 'Description',
          value: draft.description || '',
          rows: 3,
          autoFocus: true,
          disabled: readOnly,
          onChange: (nextValue) => updateDraftRow(deliverableId, { description: nextValue }),
          onBlur: close,
          onKeyDown: (event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              close();
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              close();
            }
          },
          footerText: 'Enter to save · Esc to cancel',
        }),
      ]),
    ]);
  };

  const getDraftAssigneeDisplay = (draft) => {
    const members = getDraftAllocations(draft)
      .map((allocation) => allocation?.assigneeUserId ? memberMap.get(String(allocation.assigneeUserId)) : null)
      .filter(Boolean);
    return {
      members,
      tooltip: members.length
        ? members.map((member) => member.name || member.email || 'Unnamed').join('\n')
        : 'Add assignee',
    };
  };

  const renderDraftAllocationsEditor = (deliverable) => {
    const deliverableId = deliverable?.id || null;
    const draft = getDraftRow(deliverableId);
    const allocations = getDraftAllocations(draft);
    const allowedTypeIds = getAllowedServiceTypeIds(deliverable);
    const hasPools = allowedTypeIds.length > 0;
    const totalLoe = allocations.reduce((sum, allocation) => sum + (Number(allocation?.loeHours) || 0), 0);
    const gridStyle = { gridTemplateColumns: '1.15fr 1fr 0.55fr 0.8fr auto' };
    const setAllocations = (nextAllocations) => {
      updateDraftRow(deliverableId, syncDraftAllocationFields(draft, nextAllocations));
    };
    const rowKey = draftKey(deliverableId);
    return h('tr', { key: `draft-${deliverableId || 'unassigned'}-assignees`, className: 'bg-white dark:bg-slate-900/60' }, [
      h('td', { colSpan: COLUMN_ORDER.length, className: 'px-4 py-3' }, [
        h('div', {
          className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-4',
          onMouseDown: (event) => event.stopPropagation(),
          onClick: (event) => event.stopPropagation(),
        }, [
          h('div', { className: 'flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-slate-950/50' }, [
            h('div', { className: 'space-y-1' }, [
              h('div', { className: 'text-sm font-semibold text-slate-900 dark:text-white' }, 'Allocations'),
              h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'This task is composed of these allocations.'),
            ]),
            h('div', { className: 'rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300' }, `Total LOE: ${formatHoursText(totalLoe)}`),
          ]),
          hasPools ? null : h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'Assign this task to a deliverable with available hours to set service types.'),
          h('div', { className: 'grid gap-3 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 px-1', style: gridStyle }, [
            h('div', null, 'Assignee'),
            h('div', null, 'Service Type'),
            h('div', null, 'LOE'),
            h('div', null, 'Metrics'),
            h('div', { className: 'text-right' }, 'Actions'),
          ]),
          allocations.length
            ? h('div', { className: 'space-y-2' }, allocations.map((alloc, idx) => (
              (() => {
                const allocationMember = alloc?.assigneeUserId ? memberMap.get(String(alloc.assigneeUserId)) : null;
                const serviceValidationMessage = getAllocationServiceValidationMessage(alloc, deliverable);
                const currentServiceTypeId = String(alloc?.serviceTypeId || '');
                const invalidServiceSelected = !!currentServiceTypeId && !allowedTypeIds.includes(currentServiceTypeId);
                return (
              h('div', {
                key: alloc.id,
                className: 'grid gap-3 items-start rounded-lg border border-slate-200/80 bg-white/80 px-3 py-3 dark:border-white/10 dark:bg-slate-950/50',
                style: gridStyle,
              }, [
                h('div', { className: 'min-w-0' }, [
                  renderAssigneeIdentity(allocationMember),
                  h('select', {
                    value: alloc.assigneeUserId ? String(alloc.assigneeUserId) : '',
                    autoFocus: idx === 0,
                    disabled: readOnly,
                    'data-draft-assignee-focus-row': rowKey,
                    'data-no-row-toggle': 'true',
                    onMouseDown: (event) => event.stopPropagation(),
                    onClick: (event) => event.stopPropagation(),
                    onChange: (event) => {
                      const nextAllocations = allocations.map((item) => (
                        item.id === alloc.id ? { ...item, assigneeUserId: event.target.value || '' } : item
                      ));
                      setAllocations(nextAllocations);
                    },
                    className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
                  }, [
                    h('option', { value: '' }, 'Unassigned'),
                    ...(assigneeList || []).map((member) => h('option', { key: member.id, value: member.id }, member.name || member.email)),
                  ]),
                ]),
                h('div', { className: 'min-w-0' }, [
                  h('select', {
                    value: alloc.serviceTypeId ? String(alloc.serviceTypeId) : '',
                    disabled: readOnly || !hasPools,
                    'data-no-row-toggle': 'true',
                    onMouseDown: (event) => event.stopPropagation(),
                    onClick: (event) => event.stopPropagation(),
                    onChange: (event) => {
                      const nextAllocations = allocations.map((item) => (
                        item.id === alloc.id ? { ...item, serviceTypeId: event.target.value || '' } : item
                      ));
                      setAllocations(nextAllocations);
                    },
                    className: `h-10 w-full rounded-md border bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60 ${serviceValidationMessage ? 'border-rose-300 dark:border-rose-500/60' : 'border-slate-200 dark:border-white/10'}`,
                  }, [
                    h('option', { value: '' }, hasPools ? 'Select' : 'No pools'),
                    invalidServiceSelected
                      ? h('option', { value: currentServiceTypeId }, serviceTypeMap.get(currentServiceTypeId)?.name || 'Unavailable service type')
                      : null,
                    ...allowedTypeIds.map((id) => h('option', { key: id, value: id }, serviceTypeMap.get(id)?.name || id)),
                  ].filter(Boolean)),
                  serviceValidationMessage
                    ? h('div', { className: 'mt-1 text-[11px] text-rose-600 dark:text-rose-300' }, serviceValidationMessage)
                    : null,
                ]),
                h('input', {
                  type: 'number',
                  min: 0,
                  step: 0.25,
                  value: alloc.loeHours ?? '',
                  disabled: readOnly,
                  'data-no-row-toggle': 'true',
                  onMouseDown: (event) => event.stopPropagation(),
                  onClick: (event) => event.stopPropagation(),
                  onChange: (event) => {
                    const nextAllocations = allocations.map((item) => (
                      item.id === alloc.id ? { ...item, loeHours: event.target.value } : item
                    ));
                    setAllocations(nextAllocations);
                  },
                  className: 'h-10 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
                }),
                h('div', { className: 'pt-1' }, renderAllocationLoeMeter(alloc.loeHours, alloc.actualHours)),
                h('div', { className: 'flex justify-end' }, [
                  h('button', {
                    type: 'button',
                    disabled: readOnly,
                    onClick: (event) => {
                      event.stopPropagation();
                      setAllocations(allocations.filter((item) => item.id !== alloc.id));
                    },
                    className: 'p-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-200 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-60',
                    title: 'Remove assignee',
                  }, [
                    h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, [
                      h('circle', { cx: '12', cy: '5', r: '1.5' }),
                      h('circle', { cx: '12', cy: '12', r: '1.5' }),
                      h('circle', { cx: '12', cy: '19', r: '1.5' }),
                    ]),
                  ]),
                ]),
              ])
            );
              })()
            )))
            : h('div', { className: 'text-xs text-slate-500 dark:text-slate-400' }, 'No assignees yet.'),
          h('button', {
            type: 'button',
            className: 'inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-60',
            'data-no-row-toggle': 'true',
            onMouseDown: (event) => event.stopPropagation(),
            onClick: (event) => {
              event.stopPropagation();
              setAllocations([...allocations, createEmptyDraftAllocation()]);
              focusNewestDraftAssigneeControl(rowKey);
            },
            disabled: readOnly,
          }, '+ Assignee'),
        ]),
      ]),
    ]);
  };

  const getAssigneeDisplay = (task) => {
    const allocations = getTaskAllocations(task);
    const members = allocations
      .map((allocation) => allocation?.assigneeUserId ? memberMap.get(String(allocation.assigneeUserId)) : null)
      .filter(Boolean);
    return {
      members,
      tooltip: members.length
        ? members.map((member) => member.name || member.email || 'Unnamed').join('\n')
        : 'Add assignee',
    };
  };

  const getServiceDisplay = (task) => {
    const allocations = getTaskAllocations(task);
    const uniqueIds = [...new Set(allocations.map((alloc) => String(alloc?.serviceTypeId || '')).filter(Boolean))];
    const serviceNames = uniqueIds.map((id) => serviceTypeMap.get(String(id))?.name || 'Service');
    return {
      label: uniqueIds.length > 1 ? 'Multiple' : (serviceNames[0] || '—'),
      tooltip: serviceNames.length ? serviceNames.join('\n') : 'No service type',
    };
  };

  const getEditableDisplayButtonProps = (task, deliverableId, field) => ({
    type: 'button',
    tabIndex: 0,
    'data-no-row-toggle': 'true',
    'data-edit-task': task.id,
    'data-edit-field': field,
    onMouseDown: (event) => event.stopPropagation(),
    onClick: (event) => {
      event.stopPropagation();
      startEdit(task, deliverableId, field);
    },
    onFocus: () => {
      if (readOnly) return;
      if (field === 'recurring') return;
      if (
        suppressAutoEditRef.current
        && suppressAutoEditRef.current.taskId === task.id
        && suppressAutoEditRef.current.field === field
      ) {
        suppressAutoEditRef.current = null;
        return;
      }
      if (editingCell?.taskId === task.id && editingCell.field === field) return;
      startEdit(task, deliverableId, field);
    },
    className: 'group w-full min-w-0 rounded-md px-1.5 py-1 text-left transition hover:bg-slate-100/70 dark:hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-netnet-purple/40',
  });

  const renderTaskRow = (task, deliverableId, deliverable) => {
    const due = formatDueIn(task);
    const taskMeta = taskMetaMap?.get(task.id) || {};
    const allocTotal = sumAllocations(task);
    const chatIndicator = chatIndicators?.task?.get(String(task.id)) || {};
    const canOpenDrawer = !!deliverableId && typeof onOpenDrawer === 'function';
    const canMoveTask = !!deliverableId;
    const actionItems = [];
    if (canOpenDrawer) actionItems.push('Edit');
    if (canMoveTask) actionItems.push('Move Task');
    const statusLabel = getStatusLabel(task.status);
    const allowedTypeIds = deliverable
      ? (deliverable.effectivePools || [])
        .filter((pool) => Number(pool?.estimatedHours) > 0)
        .map((pool) => String(pool.serviceTypeId))
      : [];
    const hasPools = allowedTypeIds.length > 0;
    const isReady = isTaskReady(task, deliverable);
    const isDraft = !isReady;
    const draftOutlineClass = isDraft ? 'outline outline-1 outline-[#6d28d9]/35 outline-offset-[-1px]' : '';
    const taskExpanded = isTaskExpanded(task.id);
    const titleEditing = editingCell?.taskId === task.id && editingCell.field === 'title';
    const statusEditing = editingCell?.taskId === task.id && editingCell.field === 'status';
    const assigneeDisplay = getAssigneeDisplay(task);
    const serviceDisplay = getServiceDisplay(task);
    const totalLoeLabel = formatHoursText(allocTotal);

    const cellClass = 'px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 align-middle';
    const expandedPanel = h('div', {
      'data-no-row-toggle': 'true',
      className: 'rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-4 transition-all duration-200 ease-out',
      onMouseDown: (event) => event.stopPropagation(),
      onClick: (event) => event.stopPropagation(),
    }, [
      renderDescriptionEditor(task, deliverableId, isDraft),
      renderAllocations(task, deliverable),
    ]);

    return [h(TaskSystemRow, {
      key: task.id,
      taskId: task.id,
      expanded: taskExpanded,
      onToggle: toggleTaskExpanded,
      colSpan: COLUMN_ORDER.length,
      rowClassName: `contacts-row border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors cursor-pointer ${draftOutlineClass}`,
      expandedRowClassName: `bg-white dark:bg-slate-900/60 ${draftOutlineClass}`,
      rowProps: {
        tabIndex: -1,
        onDragOver: (event) => {
          if (readOnly) return;
          if (dragState?.deliverableId !== deliverableId) return;
          event.preventDefault();
        },
        onDrop: (event) => handleDrop(event, deliverableId, task.id),
      },
      expandedContent: expandedPanel,
      cells: [
        h('td', {
          key: 'title',
          className: `${cellClass} w-[260px] max-w-[260px]`,
        }, [
          h('div', { className: 'space-y-1 min-w-0' }, [
            titleEditing
              ? h('input', {
                type: 'text',
                value: editingValue,
                autoFocus: true,
                'data-edit-task': task.id,
                'data-edit-field': 'title',
                'data-no-row-toggle': 'true',
                className: 'h-9 w-full rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-gray-900 dark:text-gray-100',
                onClick: (event) => event.stopPropagation(),
                onMouseDown: (event) => event.stopPropagation(),
                onChange: (event) => setEditingValue(event.target.value || ''),
                onBlur: () => commitOnBlur(task, deliverableId, 'title', editingValue),
                onKeyDown: (event) => handleEditorKeyDown(event, task, deliverableId, 'title'),
              })
              : h('button', {
                ...getEditableDisplayButtonProps(task, deliverableId, 'title'),
                className: 'group w-full min-w-0 rounded-md px-1.5 py-1 text-left text-sm font-semibold text-gray-900 transition hover:bg-slate-100/70 hover:text-netnet-purple focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:text-gray-100 dark:hover:bg-white/5 dark:hover:text-netnet-purple',
              }, [
                h('span', { className: 'block truncate' }, task.title || 'Untitled task'),
              ]),
            h('div', { className: 'flex items-center gap-2 px-1.5 text-[11px] leading-4 text-gray-500 dark:text-gray-400 min-w-0' }, [
              isDraft
                ? h('span', { className: 'text-[10px] font-semibold tracking-wide text-purple-400 uppercase' }, 'DRAFT')
                : null,
              taskMeta?.plannedLabel
                ? h('span', { className: 'rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-0.5 text-slate-600 dark:text-slate-300' }, `Pending: ${taskMeta.plannedLabel}`)
                : null,
              statusEditing
                ? h('select', {
                  value: editingValue || task.status || 'backlog',
                  autoFocus: true,
                  tabIndex: -1,
                  'data-edit-task': task.id,
                  'data-edit-field': 'status',
                  'data-no-row-toggle': 'true',
                  className: 'h-7 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200',
                  onMouseDown: (event) => event.stopPropagation(),
                  onClick: (event) => event.stopPropagation(),
                  onChange: (event) => {
                    const nextValue = event.target.value || 'backlog';
                    setEditingValue(nextValue);
                    commitField(task, deliverableId, 'status', nextValue);
                    setEditingCell(null);
                    setEditingValue('');
                  },
                  onBlur: () => {
                    setEditingCell(null);
                    setEditingValue('');
                  },
                  onKeyDown: (event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setEditingCell(null);
                      setEditingValue('');
                    }
                  },
                }, STATUS_OPTIONS.map((option) => (
                  h('option', { key: option.value, value: option.value }, option.label)
                )))
                : h('button', {
                  ...getEditableDisplayButtonProps(task, deliverableId, 'status'),
                  className: 'inline-flex items-center rounded-md px-1.5 py-0.5 transition hover:bg-slate-100/70 focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:hover:bg-white/5',
                }, [
                  h('span', { className: `rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusToneClass(task.status)}` }, statusLabel),
                ]),
            ].filter(Boolean)),
          ]),
        ]),
        h('td', {
          key: 'description',
          className: `${cellClass} w-[240px] max-w-[240px]`,
        }, [
          h('button', {
            type: 'button',
            tabIndex: -1,
            'data-no-row-toggle': 'true',
            onMouseDown: (event) => event.stopPropagation(),
            onClick: (event) => {
              event.stopPropagation();
              openExpandedEditor(task, deliverableId, 'description');
            },
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                openExpandedEditor(task, deliverableId, 'description');
              }
            },
            className: 'group w-full min-w-0 rounded-md px-1.5 py-1 text-left transition hover:bg-slate-100/70 focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:hover:bg-white/5',
          }, [
            h('span', { className: 'block truncate text-xs text-slate-500 dark:text-slate-400' }, task.description || 'Add description'),
          ]),
        ]),
        h('td', {
          key: 'chat',
          className: `${cellClass} text-center w-[52px]`,
        }, [
          h('button', {
            type: 'button',
            tabIndex: -1,
            'data-no-row-toggle': 'true',
            className: 'inline-flex items-center justify-center text-xs font-semibold',
            onMouseDown: (event) => event.stopPropagation(),
            onClick: (event) => {
              event.stopPropagation();
              onOpenChat && onOpenChat({ type: 'task', deliverableId, taskId: task.id });
            },
            disabled: !onOpenChat,
            'aria-label': 'Open task chat',
          }, renderChatIndicator(chatIndicator)),
        ]),
        h('td', {
          key: 'assignees',
          className: `${cellClass} w-[170px] max-w-[170px]`,
        }, [
          h('button', {
            type: 'button',
            tabIndex: -1,
            title: assigneeDisplay.tooltip,
            'data-no-row-toggle': 'true',
            onMouseDown: (event) => event.stopPropagation(),
            onClick: (event) => {
              event.stopPropagation();
              openExpandedEditor(task, deliverableId, 'assignees');
            },
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                openExpandedEditor(task, deliverableId, 'assignees');
              }
            },
            className: 'group w-full rounded-md px-1.5 py-1 text-left transition hover:bg-slate-100/70 focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:hover:bg-white/5',
          }, [
            assigneeDisplay.members.length
              ? h('div', { className: 'flex -space-x-1 items-center' }, assigneeDisplay.members.slice(0, 3).map((member, idx) => (
                h('span', {
                  key: `${task.id}-assignee-${idx}`,
                  className: 'h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center border border-white dark:border-slate-900',
                }, getInitials(member.name || member.email))
              )))
              : h('span', { className: 'inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 dark:border-white/15 text-sm font-semibold text-slate-400 dark:text-slate-500' }, '+'),
          ]),
        ]),
        h('td', {
          key: 'service',
          className: `${cellClass} w-[150px] max-w-[150px]`,
        }, [
          h('span', {
            className: 'block truncate px-1.5 py-1 text-xs text-slate-500 dark:text-slate-400',
            title: hasPools ? serviceDisplay.tooltip : 'No pools',
          }, hasPools ? serviceDisplay.label : 'No pools'),
        ]),
        h('td', {
          key: 'due',
          className: `${cellClass} w-[90px]`,
        }, [
          h('button', {
            ...getEditableDisplayButtonProps(task, deliverableId, 'dueDate'),
            className: `w-full rounded-md px-1.5 py-1 text-left text-xs font-medium transition hover:bg-slate-100/70 focus:outline-none focus:ring-1 focus:ring-netnet-purple/40 dark:hover:bg-white/5 ${due.tone === 'danger' ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`,
            onMouseDown: (event) => event.stopPropagation(),
            onClick: (event) => {
              event.stopPropagation();
              startEdit(task, deliverableId, 'dueDate');
            },
          }, due.label),
        ]),
        h('td', {
          key: 'meter',
          className: `${cellClass} w-[86px]`,
        }, [
          h('span', { className: 'block truncate px-1.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400' }, totalLoeLabel),
        ]),
        h('td', {
          key: 'actions',
          className: `px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 align-middle text-right w-[82px]`,
        }, [
          h('div', { className: 'flex items-center justify-end gap-2' }, [
            isRetainer
              ? h('button', {
                type: 'button',
                title: 'Recurring monthly\nCreates a new instance each month',
                'aria-label': 'Recurring monthly',
                'aria-pressed': !!task.isRecurring,
                'data-edit-task': task.id,
                'data-edit-field': 'recurring',
                'data-no-row-toggle': 'true',
                onMouseDown: (event) => event.stopPropagation(),
                onClick: (event) => {
                  event.stopPropagation();
                  toggleRecurringTask(deliverableId, task);
                },
                className: [
                  'inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition',
                  task.isRecurring
                    ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-400'
                    : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                ].join(' '),
              }, 'R')
              : null,
            (readOnly || !actionItems.length)
              ? h('button', {
                type: 'button',
                tabIndex: -1,
                'data-no-row-toggle': 'true',
                className: 'nn-btn nn-btn--micro',
                disabled: true,
                onMouseDown: (event) => event.stopPropagation(),
                onClick: (event) => event.stopPropagation(),
                title: 'More',
              }, '⋮')
              : h(RowActionsMenu, {
                triggerTabIndex: 0,
                menuItems: actionItems,
                onSelect: (item) => {
                  if (item === 'Edit') {
                    onOpenDrawer?.(deliverableId, task.id);
                  }
                  if (item === 'Move Task') {
                    openTaskReassignDrawer({
                      task: {
                        ...task,
                        source: 'job',
                        sourceId: task.id,
                        originalTaskRef: {
                          ...task,
                          jobId: job?.id || null,
                          deliverableId: deliverableId || null,
                        },
                      },
                    });
                  }
                },
              }),
          ]),
        ]),
      ],
    })];
  };

  const renderGroupHeader = (group, isMuted = false) => {
    const isExpanded = expandedGroups.has(group.id);
    const baseIndicator = !isMuted
      ? (chatIndicators?.deliverable?.get(String(group.id)) || {})
      : {};
    const demoIndicator = !isExpanded ? DEMO_CHAT_STATES[group.name] : null;
    const deliverableChatIndicator = demoIndicator || baseIndicator;
    const deliverableStatus = group.status || 'backlog';
    const deliverableOverdue = isOverdueDate(group.dueDate) && deliverableStatus !== 'completed';
    const health = (() => {
      const pools = group.effectivePools || [];
      const estimated = sumEstimated(pools);
      const assigned = (pools || []).reduce((sum, pool) => sum + (Number(pool?.assignedHours) || 0), 0);
      const actual = (pools || []).reduce((sum, pool) => sum + (Number(pool?.actualHours) || 0), 0);
      const taskTotal = (group.tasks || []).reduce((sum, task) => sum + sumAllocations(task), 0);
      const usage = Math.max(assigned, actual, taskTotal);
      const ratio = estimated ? usage / estimated : 0;
      return { ratio: clamp(ratio, 0, 1.2), status: getRatioStatus(ratio) };
    })();
    const hasChats = (deliverableChatIndicator.totalMessages || 0) > 0;
    const mentionCount = deliverableChatIndicator.mentionCount || 0;
    const hasNewChats = !!deliverableChatIndicator.hasUnreadMessages && mentionCount === 0;
    const confidenceValue = confidenceMap?.[String(group.id)] || 'not_set';
    const confidenceMenuOpen = openConfidenceMenuId === group.id;
    const statusMenuOpen = openDeliverableStatusMenuId === group.id;
    const hybridState = getHybridDeliveryState(group.id);
    const hybridServiceTypeIds = getAllowedServiceTypeIds(group);
    const hybridTotalHours = sumHybridServiceTypeHours(hybridState.serviceTypeEntries);
    const hybridActiveServices = countHybridActiveServices(hybridState.serviceTypeEntries);
    const deliverableTypeLabel = String(group.deliverableType || '').trim();
    const detailsOpen = !!openDetailsRows?.[String(group.id)];
    const modifiedByChangeOrder = (job?.changeOrders || []).some((changeOrder) => (
      changeOrder?.status === 'applied'
      && (changeOrder?.changes || []).some((change) => (
        String(change?.deliverableId || '') === String(group.id)
        || String(change?.createdDeliverableId || '') === String(group.id)
      ))
    ));
    const collapsedMetaParts = [];
    if (modifiedByChangeOrder) {
      collapsedMetaParts.push('Modified by Change Order');
    }
    if (deliverableTypeLabel) {
      collapsedMetaParts.push(`→ ${deliverableTypeLabel}`);
    }
    if (!isMuted && job?.status === 'active' && hybridState.enabled) {
      collapsedMetaParts.push(hybridActiveServices > 0
        ? `Agent-assisted • ~${formatHybridHours(hybridTotalHours)} hrs across ${hybridActiveServices} services`
        : 'Agent-assisted');
    }
    const collapsedHybridMeta = collapsedMetaParts.join(' • ') || null;
    const deliverableTypeDetail = h('div', { className: 'rounded-xl border border-slate-200/10 bg-white/5 p-4 space-y-3' }, [
      h('div', { className: 'space-y-1' }, [
        h('div', { className: 'text-sm font-semibold text-white' }, 'Deliverable Type'),
        h('div', { className: 'text-xs text-slate-400' }, 'Group similar deliverables across jobs'),
      ]),
      h('div', { className: 'space-y-2' }, [
        h('input', {
          type: 'text',
          list: `deliverable-type-options-${group.id}`,
          value: deliverableTypeLabel,
          placeholder: 'e.g. Website Build, SEO Sprint',
          onChange: (event) => updateDeliverable(group.id, { deliverableType: String(event.target.value || '').trim() || null }),
          onBlur: (event) => setDeliverableTypeOptions((current) => rememberDeliverableType(event.target.value, current)),
          onKeyDown: (event) => {
            if (event.key === 'Enter') {
              setDeliverableTypeOptions((current) => rememberDeliverableType(event.currentTarget.value, current));
            }
          },
          className: 'h-10 w-full rounded-md border border-slate-200/10 bg-slate-900 px-3 text-sm text-slate-100',
        }),
        h('datalist', { id: `deliverable-type-options-${group.id}` },
          (deliverableTypeOptions || []).map((option) => h('option', { key: option, value: option }))
        ),
      ]),
    ]);
    const hybridDetail = !isMuted && job?.status === 'active'
      ? h('div', { className: 'rounded-xl border border-slate-200/10 bg-slate-900/40 p-4 space-y-4' }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-sm font-semibold text-white' }, 'Hybrid Delivery'),
          h('div', { className: 'text-xs text-slate-400' }, 'Estimate how much AI contributed to each type of work on this deliverable.'),
        ]),
        h('div', { className: 'flex items-start justify-between gap-4 rounded-lg border border-slate-200/10 bg-white/5 px-3 py-3' }, [
          h('div', { className: 'text-xs text-slate-400' }, hybridState.enabled
            ? 'Hybrid detail is enabled for this deliverable.'
            : 'No AI-assisted work recorded'),
          h('label', { className: 'relative inline-flex cursor-pointer items-center' }, [
            h('input', {
              type: 'checkbox',
              className: 'peer sr-only',
              checked: !!hybridState.enabled,
              onChange: (event) => updateHybridDelivery(group.id, { enabled: !!event.target.checked }),
            }),
            h('span', { className: 'h-6 w-11 rounded-full bg-slate-700 transition-colors peer-checked:bg-netnet-purple' }),
            h('span', { className: 'pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5' }),
          ]),
        ]),
        hybridState.enabled
          ? h('div', { className: 'space-y-4' }, [
            hybridServiceTypeIds.length
              ? h('div', { className: 'overflow-hidden rounded-xl border border-slate-200/10 bg-white/5' }, [
                h('div', {
                  className: 'grid items-center gap-3 border-b border-slate-200/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400',
                  style: { gridTemplateColumns: '1fr 1.4fr 140px' },
                }, [
                  h('div', null, 'Service Type'),
                  h('div', null, 'Description'),
                  h('div', { className: 'text-right' }, 'AI Contribution (hrs)'),
                ]),
                hybridServiceTypeIds.map((serviceTypeId) => {
                  const serviceEntry = getHybridServiceEntry(hybridState, serviceTypeId);
                  const editorOpen = hybridDescriptionEditor
                    && String(hybridDescriptionEditor.deliverableId) === String(group.id)
                    && String(hybridDescriptionEditor.serviceTypeId) === String(serviceTypeId);
                  return h('div', {
                    key: `${group.id}-${serviceTypeId}`,
                    className: 'grid items-start gap-3 border-b border-slate-200/10 px-4 py-3 last:border-b-0',
                    style: { gridTemplateColumns: '1fr 1.4fr 140px' },
                  }, [
                    h('div', { className: 'pt-2 text-sm font-medium text-slate-200' }, serviceTypeMap.get(String(serviceTypeId))?.name || 'Service Type'),
                    editorOpen
                      ? h('textarea', {
                        value: hybridDescriptionEditor.value,
                        rows: 3,
                        autoFocus: true,
                        placeholder: 'Add notes',
                        onChange: (event) => setHybridDescriptionEditor((prev) => ({ ...prev, value: event.target.value })),
                        onBlur: saveHybridDescriptionEdit,
                        onKeyDown: (event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelHybridDescriptionEdit();
                          }
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            saveHybridDescriptionEdit();
                          }
                        },
                        className: 'w-full rounded-md border border-slate-200/10 bg-slate-900 px-3 py-2 text-sm text-slate-100',
                      })
                      : h('button', {
                        type: 'button',
                        className: `w-full rounded-md border border-transparent px-3 py-2 text-left text-sm ${serviceEntry.notes ? 'text-slate-300' : 'text-slate-500'} hover:border-slate-200/10 hover:bg-slate-900/60`,
                        onClick: () => startHybridDescriptionEdit(group.id, serviceTypeId),
                      }, serviceEntry.notes || 'Add notes'),
                    h('input', {
                      type: 'number',
                      min: '0',
                      step: '0.25',
                      value: serviceEntry.hours ?? '',
                      placeholder: '0',
                      onChange: (event) => {
                        const raw = String(event.target.value || '').trim();
                        updateHybridDelivery(group.id, setHybridServiceEntry(
                          hybridState,
                          serviceTypeId,
                          { hours: raw === '' ? null : Number(raw) }
                        ));
                      },
                      className: 'h-10 w-full rounded-md border border-slate-200/10 bg-slate-900 px-3 text-right text-sm text-slate-100',
                    }),
                  ]);
                }),
              ])
              : h('div', { className: 'text-xs text-slate-400' }, 'No service types are mapped to this deliverable yet.'),
            h('div', { className: 'text-sm font-medium text-slate-300' }, `Total AI contribution: ${formatHybridHours(hybridTotalHours || 0)} hrs`),
          ])
          : null,
      ])
      : null;
    const expandedHybridDetail = h('div', { className: 'rounded-xl border border-slate-200/10 bg-slate-950/20 overflow-hidden' }, [
      h('button', {
        type: 'button',
        className: 'flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors',
        onClick: (event) => {
          event.stopPropagation();
          toggleDetailsRow(group.id);
        },
        'aria-expanded': detailsOpen ? 'true' : 'false',
      }, [
        h('div', { className: 'space-y-1' }, [
          h('div', { className: 'text-sm font-semibold text-white' }, 'Details'),
          h('div', { className: 'text-xs text-slate-400' }, detailsOpen
            ? 'Hide deliverable metadata'
            : 'Show Deliverable Type and Hybrid Delivery'),
        ]),
        h('svg', {
          className: 'h-4 w-4 text-slate-400 transition-transform duration-200',
          style: { transform: detailsOpen ? 'rotate(180deg)' : 'rotate(0deg)' },
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24',
          strokeWidth: '2',
        }, [
          h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M19 9l-7 7-7-7' }),
        ]),
      ]),
      detailsOpen
        ? h('div', { className: 'border-t border-slate-200/10 px-4 py-4 space-y-4 transition-all duration-200 ease-out' }, [
          deliverableTypeDetail,
          hybridDetail,
        ].filter(Boolean))
        : null,
    ]);
    return h(DeliverableHeaderRow, {
      groupId: group.id,
      groupName: group.name || 'Deliverable',
      isExpanded,
      isMuted,
      deliverableStatus,
      deliverableDueDate: group.dueDate || null,
      deliverableOverdue,
      healthStatus: health.status,
      healthRatio: health.ratio,
      healthTimelineRatio: getTimelineRatio(group.dueDate),
      hasChats,
      hasNewChats,
      mentionCount,
      showPools: isExpanded && group.effectivePools,
      pools: group.effectivePools,
      serviceTypes,
      confidenceValue,
      onConfidenceChange: (value) => updateConfidence(group.id, value),
      confidenceMenuOpen,
      onToggleConfidenceMenu: () => {
        setOpenConfidenceMenuId((prev) => (prev === group.id ? null : group.id));
      },
      statusMenuOpen,
      onToggleStatusMenu: () => {
        setOpenDeliverableStatusMenuId((prev) => (prev === group.id ? null : group.id));
      },
      onStatusChange: (nextStatus) => handleDeliverableStatusSelect(group, nextStatus),
      onOpenDuePicker: (anchorEl, deliverableId, value) => openDeliverableDatePicker(anchorEl, deliverableId, value),
      onToggle: () => toggleGroup(group.id),
      onOpenChat,
      collapsedMeta: collapsedHybridMeta,
      expandedDetail: expandedHybridDetail,
    });
  };

  const renderTaskHeaderRow = (groupId) => h('tr', {
    key: `header-${groupId}`,
    className: 'contacts-column-header-row text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
  }, [
    h('th', { className: 'px-3 py-2 w-10' }, ''),
    h('th', { className: 'px-4 py-2 w-[260px]' }, 'Task'),
    h('th', { className: 'px-4 py-2 w-[240px]' }, 'Description'),
    h('th', { className: 'px-4 py-2 text-center w-[52px]' }, 'Chat'),
    h('th', { className: 'px-4 py-2 w-[170px]' }, 'Assignee(s)'),
    h('th', { className: 'px-4 py-2 w-[150px]' }, 'Service Type'),
    h('th', { className: 'px-4 py-2 w-[90px]' }, 'Due Date'),
    h('th', { className: 'px-4 py-2 w-[86px]' }, 'LOE'),
    h('th', { className: 'px-3 py-2 text-right w-[82px]' }, ''),
  ]);

  const renderTasksSubToolbarRow = (groupId) => {
    const key = String(groupId || 'unassigned');
    const mode = deliverableTaskViewMode[key] || 'list';
    const setMode = (nextMode) => {
      setDeliverableTaskViewMode((prev) => ({ ...prev, [key]: nextMode }));
    };
    const buttonBase = 'h-7 w-7 rounded-md border flex items-center justify-center transition-colors';
    const active = 'border-netnet-purple/60 bg-netnet-purple/15 text-netnet-purple';
    const inactive = 'border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60';
    return h('tr', { key: `tasks-toolbar-${key}`, className: 'border-b border-gray-200 dark:border-gray-700 bg-transparent' }, [
      h('td', { colSpan: COLUMN_ORDER.length, className: 'px-6 py-2' }, [
        h('div', { className: 'flex items-center justify-end gap-1' }, [
          h('button', {
            type: 'button',
            className: `${buttonBase} ${mode === 'list' ? active : inactive}`,
            onClick: (event) => {
              event.stopPropagation();
              setMode('list');
            },
            title: 'List view',
            'aria-label': 'List view',
            'aria-pressed': mode === 'list' ? 'true' : 'false',
          }, [
            h('svg', { viewBox: '0 0 20 20', className: 'h-3.5 w-3.5', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
              h('line', { x1: '4', y1: '5', x2: '16', y2: '5' }),
              h('line', { x1: '4', y1: '10', x2: '16', y2: '10' }),
              h('line', { x1: '4', y1: '15', x2: '16', y2: '15' }),
            ]),
          ]),
          h('button', {
            type: 'button',
            className: `${buttonBase} ${mode === 'kanban' ? active : inactive}`,
            onClick: (event) => {
              event.stopPropagation();
              setMode('kanban');
            },
            title: 'Kanban view',
            'aria-label': 'Kanban view',
            'aria-pressed': mode === 'kanban' ? 'true' : 'false',
          }, [
            h('svg', { viewBox: '0 0 20 20', className: 'h-3.5 w-3.5', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8' }, [
              h('rect', { x: '3.5', y: '4', width: '4', height: '12', rx: '0.8' }),
              h('rect', { x: '8', y: '4', width: '4', height: '12', rx: '0.8' }),
              h('rect', { x: '12.5', y: '4', width: '4', height: '12', rx: '0.8' }),
            ]),
          ]),
        ]),
      ]),
    ]);
  };

  const renderDeliverableKanbanRow = (group) => {
    const deliverableId = group?.id === 'unassigned' ? null : group?.id;
    const scopedDeliverable = {
      id: group?.id || 'unassigned',
      name: group?.name || 'Deliverable',
      effectivePools: group?.effectivePools || [],
      pools: group?.effectivePools || group?.pools || [],
      tasks: group?.tasks || [],
    };
    const scopedJob = {
      ...job,
      deliverables: [scopedDeliverable],
    };
    return h('tr', { key: `kanban-${group?.id || 'unassigned'}`, className: 'border-b border-gray-200 dark:border-gray-800' }, [
      h('td', {
        colSpan: COLUMN_ORDER.length,
        className: 'px-6 py-3',
        'data-deliverable-kanban': 'true',
        'data-deliverable-id': group?.id || 'unassigned',
        'data-scoped-task-count': String((group?.tasks || []).length),
        'data-show-deliverable-label': 'false',
      }, [
        h(JobKanbanTab, {
          job: scopedJob,
          onJobUpdate: (patch) => {
            const nextTasks = patch?.deliverables?.[0]?.tasks || [];
            updateTaskList(deliverableId, () => nextTasks);
          },
          readOnly,
          chatIndicators,
          onOpenChat,
          showDeliverableLabel: false,
          embedded: true,
        }),
      ]),
    ]);
  };

  const renderDraftRow = (deliverable, autoFocus = false) => {
    const deliverableId = deliverable?.id || null;
    const draft = getDraftRow(deliverableId);
    const draftAllocations = getDraftAllocations(draft);
    const draftAssigneeDisplay = getDraftAssigneeDisplay(draft);
    const draftPrimaryService = draftAllocations[0]?.serviceTypeId
      ? (serviceTypeMap.get(String(draftAllocations[0].serviceTypeId))?.name || 'Service')
      : '—';
    const draftLoeLabel = formatHoursText(draftAllocations.reduce((sum, allocation) => sum + (Number(allocation?.loeHours) || 0), 0));
    const baseCell = 'px-4 py-2.5 text-sm text-gray-500 dark:text-gray-300 align-middle whitespace-nowrap overflow-hidden';
    const draftRowKey = draftKey(deliverableId);
    return h('tr', {
      key: `draft-${deliverableId || 'unassigned'}`,
      className: 'border-b border-gray-200 dark:border-gray-800 whitespace-nowrap',
      ref: (node) => {
        if (node) {
          draftRowRefs.current[draftRowKey] = node;
        } else {
          delete draftRowRefs.current[draftRowKey];
        }
      },
    }, [
      h('td', { className: `px-3 py-2.5 align-middle w-10 whitespace-nowrap overflow-hidden` }, [
        h('div', { className: 'h-7 w-7 rounded-md border border-dashed border-slate-200 dark:border-white/10' }),
      ]),
      h('td', { className: `${baseCell} w-[260px] max-w-[260px]` }, [
        h('div', { className: 'flex min-w-0 flex-col gap-1.5' }, [
          h('input', {
            type: 'text',
            value: draft.title,
            placeholder: 'Task name…',
            autoFocus,
            disabled: readOnly,
            onChange: (event) => updateDraftRow(deliverableId, { title: event.target.value }),
            className: 'h-9 w-full min-w-0 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-60',
          }),
          h('select', {
            value: draft.status,
            disabled: readOnly,
            onChange: (event) => updateDraftRow(deliverableId, { status: event.target.value }),
            className: 'h-7 w-full min-w-0 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300',
          }, STATUS_OPTIONS.map((option) => (
            h('option', { key: option.value, value: option.value }, option.label)
          ))),
        ]),
      ]),
      h('td', {
        className: `${baseCell} w-[240px] max-w-[240px]`,
      }, [
        h('button', {
          type: 'button',
          disabled: readOnly,
          onClick: (event) => {
            event.stopPropagation();
            setDraftDescriptionEditor({ key: draftRowKey, deliverableId });
          },
          className: 'w-full min-w-0 rounded-md px-1.5 py-1 text-left transition hover:bg-slate-100/70 dark:hover:bg-white/5 disabled:opacity-60',
        }, [
          h('span', { className: 'block truncate text-xs text-slate-500 dark:text-slate-400' }, draft.description || 'Add description'),
        ]),
      ]),
      h('td', { className: `${baseCell} text-center w-[52px]` }, [
        h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, '—'),
      ]),
      h('td', { className: `${baseCell} w-[170px] max-w-[170px]` }, [
        h('button', {
          type: 'button',
          disabled: readOnly,
          title: draftAssigneeDisplay.tooltip,
          onClick: (event) => {
            event.stopPropagation();
            setDraftAllocationEditor({ key: draftRowKey, deliverableId });
          },
          className: 'w-full min-w-0 rounded-md px-1.5 py-1 text-left transition hover:bg-slate-100/70 dark:hover:bg-white/5 disabled:opacity-60',
        }, [
          draftAssigneeDisplay.members.length
            ? h('div', { className: 'flex -space-x-1 items-center' }, draftAssigneeDisplay.members.slice(0, 3).map((member, idx) => (
              h('span', {
                key: `draft-${draftRowKey}-assignee-${idx}`,
                className: 'h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center border border-white dark:border-slate-900',
              }, getInitials(member.name || member.email))
            )))
            : h('span', { className: 'inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 dark:border-white/15 text-sm font-semibold text-slate-400 dark:text-slate-500' }, '+'),
        ]),
      ]),
      h('td', { className: `${baseCell} w-[150px] max-w-[150px]` }, [
        h('span', { className: 'block truncate px-1.5 py-1 text-xs text-slate-500 dark:text-slate-400' }, draftPrimaryService),
      ]),
      h('td', { className: `${baseCell} w-[90px]` }, [
        h('button', {
          type: 'button',
          disabled: readOnly,
          onClick: (event) => {
            event.stopPropagation();
            openDatePicker(event.currentTarget, draft.dueDate, (next) => updateDraftRow(deliverableId, { dueDate: next }));
          },
          className: 'block w-full truncate rounded-md px-1.5 py-1 text-left text-xs text-slate-500 transition hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
        }, draft.dueDate || 'Select date'),
      ]),
      h('td', { className: `${baseCell} w-[86px]` }, [
        h('span', { className: 'block truncate px-1.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400' }, draftLoeLabel),
      ]),
      h('td', { className: `px-3 py-2.5 text-sm text-gray-500 dark:text-gray-300 align-middle text-right w-[82px] whitespace-nowrap overflow-hidden` }, [
        (job?.kind === 'retainer' && cycleKey)
          ? h('div', { className: 'flex justify-end' }, [
            h('button', {
              type: 'button',
              title: 'Recurring monthly\nCreates a new instance each month',
              'aria-label': 'Recurring monthly',
              'aria-pressed': !!draft.isRecurring,
              disabled: readOnly,
              onClick: (event) => {
                event.stopPropagation();
                updateDraftRow(deliverableId, { isRecurring: !draft.isRecurring });
              },
              className: [
                'inline-flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold transition',
                draft.isRecurring
                  ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-400'
                  : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200 dark:border-white/10 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                readOnly ? 'cursor-not-allowed opacity-60' : '',
              ].join(' '),
            }, 'R'),
          ])
          : h('span', { className: 'text-xs text-slate-400 dark:text-slate-500' }, '—'),
      ]),
    ]);
  };

  const renderAddTaskTrigger = (deliverable) => {
    const deliverableId = deliverable?.id || null;
    return h('tr', { key: `add-${deliverableId || 'unassigned'}`, className: 'border-b border-gray-200 dark:border-gray-800' }, [
      h('td', { colSpan: COLUMN_ORDER.length, className: 'px-6 py-3' }, [
        h('button', {
          type: 'button',
          disabled: readOnly,
          onClick: (event) => {
            event.stopPropagation();
            openDraftRow(deliverableId);
          },
          className: 'text-sm font-semibold text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-60',
        }, '+ Add a task'),
      ]),
    ]);
  };

  const renderSectionSpacer = (key) => h('tr', {
    key: `spacer-${key}`,
    className: 'h-4',
  }, [
    h('td', { colSpan: COLUMN_ORDER.length, className: 'p-0' }, [
      h('div', { className: 'h-4' }),
    ]),
  ]);

  const statusPromptTitle = statusPrompt?.promptType === 'complete'
    ? 'Complete deliverable?'
    : 'Start deliverable?';
  const statusPromptLabel = statusPrompt?.promptType === 'complete'
    ? 'Completion date'
    : 'Start date';

  return h('div', { className: 'overflow-hidden' }, [
    h('table', { className: 'w-full table-fixed text-left border-collapse', ref: tableRef }, [
      ...groups.map((group) => {
        const rows = [];
        const draftKeyId = draftKey(group.id);
        const mode = deliverableTaskViewMode[String(group.id)] || 'list';
        rows.push(renderGroupHeader(group));
        if (expandedGroups.has(group.id)) {
          rows.push(renderTasksSubToolbarRow(group.id));
          if (mode === 'kanban') {
            rows.push(renderDeliverableKanbanRow(group));
          } else {
            rows.push(renderTaskHeaderRow(group.id));
            (group.tasks || []).forEach((task) => {
              rows.push(...renderTaskRow(task, group.id, group));
            });
            if (isDraftRowOpen(group.id)) {
                rows.push(renderDraftRow(group, draftFocusKey === draftKeyId));
                if (draftDescriptionEditor?.key === draftKeyId) {
                  rows.push(renderDraftDescriptionEditor(group.id));
                }
                if (draftAllocationEditor?.key === draftKeyId) {
                  rows.push(renderDraftAllocationsEditor(group));
                }
              } else {
                rows.push(renderAddTaskTrigger(group));
              }
          }
        }
        rows.push(renderSectionSpacer(group.id));
        return h('tbody', { key: group.id }, rows);
      }),
      h('tbody', { key: 'unassigned' }, [
        renderGroupHeader(unassignedGroup, true),
        ...(expandedGroups.has('unassigned')
          ? [
            renderTasksSubToolbarRow('unassigned'),
            ...((deliverableTaskViewMode.unassigned || 'list') === 'kanban'
              ? [renderDeliverableKanbanRow(unassignedGroup)]
              : [
                renderTaskHeaderRow('unassigned'),
                ...(unassignedGroup.tasks || []).flatMap((task) => renderTaskRow(task, null, null)),
                ...(isDraftRowOpen(null)
                  ? [
                    renderDraftRow(null, draftFocusKey === draftKey(null)),
                    ...(draftDescriptionEditor?.key === draftKey(null) ? [renderDraftDescriptionEditor(null)] : []),
                    ...(draftAllocationEditor?.key === draftKey(null) ? [renderDraftAllocationsEditor(null)] : []),
                  ]
                  : [renderAddTaskTrigger(null)]),
              ]),
          ]
          : []),
        renderSectionSpacer('unassigned'),
      ]),
    ]),
    statusPrompt
      ? h('div', { className: 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4' }, [
        h('div', { className: 'w-full max-w-sm rounded-xl border border-slate-200/10 bg-slate-900 text-slate-100 shadow-xl' }, [
          h('div', { className: 'px-5 py-4 border-b border-slate-800' }, [
            h('div', { className: 'text-base font-semibold' }, statusPromptTitle),
          ]),
          h('div', { className: 'px-5 py-4 space-y-3' }, [
            h('label', { className: 'block text-xs font-semibold text-slate-300' }, statusPromptLabel),
            h('input', {
              type: 'date',
              value: statusPromptDate || '',
              onChange: (event) => setStatusPromptDate(event.target.value),
              className: 'h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100',
            }),
          ]),
          h('div', { className: 'px-5 py-4 flex items-center justify-end gap-2 border-t border-slate-800' }, [
            h('button', {
              type: 'button',
              className: 'px-3 py-1.5 text-sm text-slate-300 hover:text-white',
              onClick: () => setStatusPrompt(null),
            }, 'Cancel'),
            h('button', {
              type: 'button',
              className: 'px-3 py-1.5 rounded-md bg-slate-100 text-slate-900 text-sm font-semibold hover:bg-white',
              onClick: confirmStatusPrompt,
            }, 'Confirm'),
          ]),
        ]),
      ])
      : null,
  ]);
}
